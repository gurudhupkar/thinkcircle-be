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
        where: { userId },
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

notifyrouter.post("/read", userMiddleware, async (req, res) => {
  // if readAll is true no id is required, all notifications will be marked as read
  // if one notification needs to be set as read readAll needs to be false and id 
  // needs to be passed
  const { id, readAll } = req.body
  const userId = (req as any).user.id;

  if (id && !readAll && userId) {
    try {

      await prisma.notification.update({
        where: { id, userId }, data: {
          read: true
        }
      })

      res.status(200).json({ success: true, message: "Notification marked as read" })

    } catch (err) {
      console.log(err)
      res.status(503).json({ error: true, message: "Unable to mark notification as read." })
    }
  }
  if (readAll && userId) {
    try {

      await prisma.notification.updateMany({
        where: { userId, read: false }, data: { read: true }
      })
      res.status(200).json({ success: true, message: "Notifications marked as read" })


    } catch (err) {
      res.status(503).json({ error: true, message: "Unable to mark notifications as read" })
    }
  }
  else {
    res.status(503).json({ error: true, message: "Unexpected error occured" })
  }

})

export { notifyrouter };
