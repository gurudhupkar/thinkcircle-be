import express from "express";
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { generateGroupSummary } from "../utils/summary";
import { success } from "zod";
import { PrismaClient } from "@prisma/client";

const summaryRouter = express.Router();
const prisma = new PrismaClient();
summaryRouter.post(
  "/group/:id/summary",
  userMiddleware,
  async (req: AuthRequest, res) => {
    try {
      await generateGroupSummary(req, res);
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        message: "Server error in summary route",
        success: false,
      });
    }
  }
);
summaryRouter.get(
  "/group/:id/summary",
  userMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const userId = (req as any).user.id;
      const groupId = req.params.id;

      const summary = await prisma.$transaction(async (tx) => {
        const profile = await tx.profile.findUnique({
          where: { userId: userId },
          select: {
            id: true,
          },
        });
        if (!profile) {
          return res.status(401).json({
            message: "profile not found",
            success: false,
          });
        }
        const group = await tx.groupMember.findUnique({
          where: {
            groupId_profileId: {
              profileId: profile.id,
              groupId: groupId,
            },
          },
        });
        if (!group) {
          return res.status(401).json({
            message: "user is not part of the group",
            success: false,
          });
        }
        const summary = await tx.summary.findMany({
          where: { groupId: groupId },
        });
        if (!summary) {
          return res.status(401).json({
            message: "No summary for this group yet",
            success: false,
          });
        }
        res.status(200).json({
          summary,
        });
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "Something went wrong",
        success: false,
      });
    }
  }
);

export { summaryRouter };
