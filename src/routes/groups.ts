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
grouprouter.get(
  "/join-request/:groupId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user?.id;
    // console.log(userId);
    const groupId = req.params.groupId;
    // console.log(groupId);

    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { adminId: true },
      });
      // console.log(group?.adminId);

      if (!group || group.adminId !== userId) {
        return res.status(403).json({
          message: "You are not allowed to view the requset",
          success: false,
        });
      }
      const request = await prisma.groupJoinRequest.findMany({
        where: { groupId },
        select: { profile: true, status: true },
      });
      res.status(200).json({
        success: true,
        request,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);

grouprouter.post(
  "/:groupId/join-request/:requestId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    const { groupId, requestId } = req.params;
    const { action } = req.body;

    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: {
          adminId: true,
          maxSize: true,
        },
      });
      if (!group || group.adminId !== userId) {
        return res.status(403).json({
          message: "you are not allowed to manage this groups requests",
          success: false,
        });
      }
      const joinrequest = await prisma.groupJoinRequest.findUnique({
        where: { id: requestId },
      });
      if (!joinrequest || joinrequest.groupId !== groupId) {
        return res.status(403).json({
          message: "Request Does not exits",
          success: false,
        });
      }
      if (action === "ACCEPTED") {
        await prisma.$transaction(async (tx) => {
          const membercount = await tx.groupMember.count({
            where: { groupId },
          });
          if (membercount >= group.maxSize) {
            throw new Error("Member Limit exceed");
          }
          await tx.groupMember.create({
            data: {
              groupId,
              profileId: joinrequest.profileId,
              role: Role.MEMBER,
            },
          });
          await tx.groupJoinRequest.delete({
            where: { id: requestId },
          });

          const profile = await prisma.profile.findUnique({
            where: { id: joinrequest.profileId },
            select: { userId: true },
          });

          if (profile) {
            await prisma.notification.create({
              data: {
                userId: profile.userId,
                type: "JOIN_REQUEST",
                content: "Your request has been approved",
              },
            });
          }
          res.json({
            success: true,
            message: "Join request approved. User added to group.",
          });
        });
      }
      if (action === "REJECTED") {
        await prisma.groupJoinRequest.delete({
          where: { id: requestId },
        });
        const profile = await prisma.profile.findUnique({
          where: { id: joinrequest.profileId },
          select: { userId: true },
        });
        if (profile) {
          await prisma.notification.create({
            data: {
              userId: profile.userId,
              type: "JOIN_REQUEST",
              content: "Your request has been rejected by the admin",
            },
          });
        }
        return res.json({
          message: "Your request has been rejected",
          success: true,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid action. Use APPROVE or REJECT",
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
grouprouter.get(
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
export { grouprouter };
