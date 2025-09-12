import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { Router } from "express";
// import { formGroups } from "../utils/Formation";
import { success } from "zod";
import { connect } from "http2";
import { error } from "console";
const prisma = new PrismaClient();

const notifyrouter: Router = Router();

notifyrouter.get(
  "/notification",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    try {
      const notification = await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" },
      });
      res.json({
        success: true,
        notification,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "failed to fetch the notifications",
        success: false,
      });
    }
  }
);

export { notifyrouter };
