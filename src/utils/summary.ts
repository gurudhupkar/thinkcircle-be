import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/authmiddleware";
import { Response } from "express";
import fetch from "node-fetch";

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(" Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// async function listModels() {
//   try {
//     const response = await fetch(
//       `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`, //  use ?key=
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     if (!response.ok) {
//       console.error(
//         " Error fetching models:",
//         response.status,
//         await response.text()
//       );
//       return;
//     }

//     const data = await response.json();
//     console.log(" Available models:");
//     data.models.forEach((m: any) => console.log("•", m.name));
//   } catch (err) {
//     console.error("Error listing models:", err);
//   }
// }

export const generateGroupSummary = async (req: AuthRequest, res: Response) => {
  //   await listModels();

  const { id: groupId } = req.params;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const isMember = await prisma.groupMember.findUnique({
      where: {
        groupId_profileId: {
          groupId,
          profileId: profile.id,
        },
      },
    });

    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group.",
      });
    }

    const messages = await prisma.message.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        sender: { select: { firstname: true, lastname: true } },
      },
    });

    if (messages.length === 0) {
      return res.status(404).json({
        message: "No messages found in this group.",
      });
    }

    const chatText = messages
      .map((msg) => `${msg.sender.firstname}: ${msg.message}`)
      .join("\n");
    // console.log(chatText);
    const prompt = `
You are an AI study assistant. Analyze the following group chat and produce a structured summary.

Chat:
${chatText}

Return the output strictly as JSON with this structure:
{
  "topicsCovered": ["topic1", "topic2"],
  "keyQuestions": ["question1", "question2"],
  "actionItems": ["task1", "task2"]
}`;

    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash-lite",
    });
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    // console.log(" Gemini raw response:", responseText);

    let summaryData;
    try {
      const cleaned = responseText
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();

      summaryData = JSON.parse(cleaned);
    } catch {
      console.warn("Gemini response not JSON, using dynamic fallback");

      const uniqueWords = Array.from(
        new Set(
          chatText
            .split(/\s+/)
            .map((w) => w.replace(/[^\w]/g, "").toLowerCase())
            .filter((w) => w.length > 4)
        )
      );

      const topWords = uniqueWords.slice(0, 3);
      const keyQuestions = messages
        .filter((m) => m.message.includes("?"))
        .map((m) => m.message)
        .slice(0, 2);

      const actionItems = messages
        .filter((m) =>
          /(do|complete|submit|prepare|check|review|create|update)/i.test(
            m.message
          )
        )
        .map((m) => m.message)
        .slice(0, 2);

      summaryData = {
        topicsCovered: topWords.length > 0 ? topWords : ["Miscellaneous"],
        keyQuestions:
          keyQuestions.length > 0 ? keyQuestions : ["No questions found"],
        actionItems:
          actionItems.length > 0 ? actionItems : ["No clear actions found"],
      };
    }

    const summary = await prisma.summary.create({
      data: {
        groupId,
        topicsCovered: summaryData.topicsCovered,
        keyQuestions: summaryData.keyQuestions,
        actionItems: summaryData.actionItems,
      },
    });

    return res.status(201).json({
      message: "AI summary generated successfully",
      summary,
    });
  } catch (err) {
    console.error(" Error generating group summary:", err);
    return res
      .status(500)
      .json({ message: "Server error generating AI summary" });
  }
};
