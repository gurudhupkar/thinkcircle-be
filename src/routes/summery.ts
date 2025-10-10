import express from "express";
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { generateGroupSummary } from "../utils/summary";
import { success } from "zod";

const summaryRouter = express.Router();

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

export { summaryRouter };
