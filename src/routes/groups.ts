import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { Router } from "express";
// import { formGroups } from "../utils/Formation";
import { success } from "zod";
import { connect } from "http2";
const prisma = new PrismaClient();

const grouprouter: Router = Router();

grouprouter.post(
  "/create-group",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    try {
      const { subjectFocus, name, maxsize } = req.body;
      if (!subjectFocus || !name) {
        return res.status(400).json({
          message: "Enter the given fields",
          success: false,
        });
      }

      const group = await prisma.group.create({
        data: {
          name,
          subjectFocus,
          admin: {
            connect: { id: userId },
          },
          maxSize: maxsize,
          createdByAI: false,
        },
      });
      const profile = await prisma.profile.findUnique({
        where: { userId: userId },
      });
      if (!profile) {
        return res.status(400).json({
          message: "profile not found for this user",
          success: false,
        });
      }
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          profileId: profile.id,
          role: "ADMIN",
        },
      });
      res.status(200).json({
        message: "Group created successfully",
        success: true,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        message: "Something went wrong",
        success: false,
      });
    }
  }
);
grouprouter.get("/groups", async (req: AuthRequest, res) => {
  try {
    const { subjectFocus } = req.body;
    const findgroups = await prisma.group.findMany({
      where: { subjectFocus: subjectFocus },
    });
    if (!findgroups) {
      return res.status(400).json({
        message: "Unable to find the groups",
        success: false,
      });
    } else {
      return res.status(200).json({
        message: "Found the groups",
        success: true,
        findgroups,
      });
    }
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
    });
  }
});
grouprouter.post("/join/:id", userMiddleware, async (req: AuthRequest, res) => {
  const userId = (req as any).user.id;
  try {
    const groupId = req.params.id;

    console.log(groupId);

    const profile = await prisma.profile.findUnique({
      where: { userId: userId },
    });

    if (!profile) {
      return res.status(400).json({
        message: "profile not found",
        success: false,
      });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      return res.status(400).json({
        message: "Group does not exits",
        success: false,
      });
    }
    const groupmember = await prisma.groupMember.findUnique({
      where: {
        groupId_profileId: {
          groupId,
          profileId: profile.id,
        },
      },
    });
    if (groupmember) {
      return res.status(400).json({
        message: "you are already the part of the given group",
        success: false,
      });
    }

    const joinrequest = await prisma.groupJoinRequest.create({
      data: {
        groupId,
        profileId: profile.id,
        status: "PENDING",
      },
    });
    await prisma.notification.create({
      data: {
        userId: group.adminId,
        type: "JOIN_REQUEST",
        content: `User ${profile.id} requested to join your group ${group.name}`,
      },
    });

    res.status(201).json({
      message: "Join request sent successfully.",
      success: true,
      joinrequest,
    });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
    });
  }
});

export { grouprouter };
