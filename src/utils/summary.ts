import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { AuthRequest } from "../middleware/authmiddleware";
import { Request, Response } from "express";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const generateGroupSummary = async (req: AuthRequest, res: Response) => {
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

    const prompt = `
You are an AI study assistant. Analyze the following group chat conversation and produce a structured study summary.

Chat:
${chatText}

Return the output strictly as JSON with this structure:
{
  "topicsCovered": ["topic1", "topic2"],
  "keyQuestions": ["question1", "question2"],
  "actionItems": ["task1", "task2"]
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    let summaryData;
    try {
      summaryData = JSON.parse(responseText);
    } catch {
      console.warn("⚠️ Gemini response not JSON, fallback...");
      summaryData = {
        topicsCovered: ["General Discussion"],
        keyQuestions: ["N/A"],
        actionItems: ["Manual follow-up needed"],
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

    res.status(201).json({
      message: "AI summary generated successfully",
      summary,
    });
  } catch (err) {
    console.error("❌ Error generating group summary:", err);
    res.status(500).json({ message: "Server error generating AI summary" });
  }
};
