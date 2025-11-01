import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import e, { Router } from "express";
// import { formGroups } from "../utils/Formation";
import { success } from "zod";
import { connect } from "http2";
import { error } from "console";
import { id } from "zod/v4/locales/index.cjs";
import { upload } from "../middleware/upload";
import { io } from "../socket";
import { suggestgroups } from "../utils/Formation";
const prisma = new PrismaClient();

const grouprouter: Router = Router();

grouprouter.post(
  "/create-group",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    try {
      const { subjectFocus, name, maxsize, description } = req.body;
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
          description,
          memberCount: 1,
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
grouprouter.get("/groups", userMiddleware, async (req: AuthRequest, res) => {
  try {
    const subjectFocus = req.query.subjectFocus as string;
    if (!subjectFocus) {
      throw Error("Enter Subjects ");
    }
    if (subjectFocus) {
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
    }
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
    });
  }
});

grouprouter.get("/my-groups", userMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const groups = await prisma.profile.findUnique({
      where: {
        userId,
      },
      select: {
        memberships: {
          include: {
            group: true,
          },
        },
      },
    });

    if (groups) {
      res.json({ success: true, groups: groups.memberships });
    } else {
      res.json({ success: false, message: "No groups joined", groups: [] });
    }
  } catch (err) {
    res.json({ success: false, message: "Unable to find associated groups" });
  }
});

grouprouter.post("/join/:id", userMiddleware, async (req: AuthRequest, res) => {
  const userId = (req as any).user.id;
  const subjectFocus = req.body.subjectFocus;
  const groupId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return {
          status: 400,
          message: "Profile not found",
          success: false,
        };
      }

      const group = await tx.group.findUnique({
        where: { id: groupId },
      });

      if (!group || group.subjectFocus !== subjectFocus) {
        return {
          status: 400,
          message: "Group does not exist or your subject focus does not match",
          success: false,
        };
      }

      const existingMember = await tx.groupMember.findUnique({
        where: {
          groupId_profileId: {
            groupId,
            profileId: profile.id,
          },
        },
      });

      if (existingMember) {
        return {
          status: 400,
          message: "You are already part of this group",
          success: false,
        };
      }

      const existingRequest = await tx.groupJoinRequest.findUnique({
        where: {
          groupId_profileId: {
            groupId,
            profileId: profile.id,
          },
        },
      });

      if (existingRequest && existingRequest.status === "PENDING") {
        return {
          status: 201,
          message: "You have already applied for this group",
          success: true,
        };
      }

      const joinRequest = await tx.groupJoinRequest.create({
        data: {
          groupId,
          profileId: profile.id,
          status: "PENDING",
        },
      });

      await tx.notification.create({
        data: {
          userId: group.adminId,
          type: "JOIN_REQUEST",
          content: `User ${(req as any).user.firstname} ${(req as any).user.lastname
            } requested to join your group ${group.name}`,
        },
      });

      return {
        status: 201,
        message: "Join request sent successfully.",
        success: true,
        joinRequest,
      };
    });

    res.status(result.status).json(result);
  } catch (error: any) {
    console.error(" Error in join route:", error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
    });
  }
});

grouprouter.get(
  "/group-members/:groupId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const groupId = req.params.groupId;
    const userId = (req as any).user.id;

    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: userId },
      });
      if (!profile) {
        return res.status(404).json({
          message: "profile not found for this user",
          success: false,
        });
      }
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });
      if (!group) {
        return res.status(404).json({
          message: "Group not found",
          success: false,
        });
      }

      const ismember = await prisma.groupMember.findUnique({
        where: {
          groupId_profileId: {
            groupId,
            profileId: profile.id,
          },
        },
        select: {
          role: true,
          profileId: true,
        },
      });
      if (!ismember) {
        return res.status(403).json({
          message: "You are not the member of this group",
          success: false,
        });
      }
      const members = await prisma.groupMember.findMany({
        where: {
          groupId: groupId,
        },
        select: {
          role: true,
          profile: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstname: true,
                  lastname: true,
                  email: true,
                  profilepic: true,
                },
              },
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        members,
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
grouprouter.delete(
  "/delete-request",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    const { groupId } = req.body;

    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: userId },
        select: { id: true },
      });
      if (!profile) {
        return res.status(404).json({
          message: "User not found",
          success: false,
        });
      }
      const groupjoin = await prisma.groupJoinRequest.findUnique({
        where: {
          groupId_profileId: {
            groupId,
            profileId: profile.id,
          },
        },
      });
      if (!groupjoin) {
        return res.status(404).json({
          message: "Join request not found",
          success: false,
        });
      }
      await prisma.groupJoinRequest.delete({
        where: {
          groupId_profileId: {
            groupId,
            profileId: profile.id,
          },
        },
      });

      return res.json({
        message: "Join request deleted successfully",
        success: true,
      });
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({
        message: "Something went wrong",
        success: false,
      });
    }
  }
);
grouprouter.get(
  "/suggest-groups",
  userMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const userId = (req as any).user.id;
      const subjectFocus = req.query.subjectFocus as string | undefined;
      const suggestions = await suggestgroups(userId, subjectFocus);
      res.status(200).json({
        message: " Group suggestions generated successfully",
        suggestions,
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
// admin
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
        select: {
          profile: {
            include: {
              user: true,
            },
          },
          createdAt: true,
          status: true,
          id: true,
        },
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

          let grp = await tx.group.findFirst({
            where: { id: groupId }
          })

          if (grp) {

            const oldMemberCount = grp?.memberCount;
            await tx.group.update({
              where: { id: groupId }, data: {
                memberCount: oldMemberCount + 1
              }
            })
          } else {
            throw new Error("Could not update member count")
          }

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
        await prisma.$transaction(async (tx) => {
          await tx.groupJoinRequest.delete({
            where: { id: requestId },
          });
          const profile = await tx.profile.findUnique({
            where: { id: joinrequest.profileId },
            select: { userId: true },
          });

          let grp = await tx.group.findFirst({
            where: { id: groupId }
          })

          if (grp) {

            const oldMemberCount = grp?.memberCount;
            await tx.group.update({
              where: { id: groupId }, data: {
                memberCount: oldMemberCount - 1
              }
            })
          } else {
            throw new Error("Could not update member count")
          }


          if (profile) {
            await tx.notification.create({
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
        })
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
grouprouter.delete(
  "/group/:groupId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    console.log(userId);
    const groupId = req.params.groupId as string;

    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { adminId: true },
      });
      console.log(group?.adminId);
      if (!group || group.adminId !== userId) {
        return res.status(403).json({
          message: "You are not allowed to delete the group",
          success: false,
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.groupMember.deleteMany({ where: { groupId } });
          await tx.message.deleteMany({ where: { groupId } });
          await tx.groupJoinRequest.deleteMany({ where: { groupId } });
          await tx.summary.deleteMany({ where: { groupId } });
          await tx.group.delete({ where: { id: groupId } });
        });
        return res.json({
          success: true,
          message: "Group and all related data deleted successfully",
        });
      }
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        message: "Something went wrong",
        success: false,
      });
    }
  }
);
grouprouter.delete(
  "/groups/:groupId/memberId/:memberId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    const { groupId, memberId } = req.params;

    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });
      if (group?.adminId !== userId) {
        return res.status(403).json({
          message: "You are not allowed to remove any member",
          success: false,
        });
      }
      const groupmember = await prisma.groupMember.findUnique({
        where: {
          groupId_profileId: {
            groupId,
            profileId: memberId,
          },
        },
      });
      if (!groupmember) {
        return res.status(404).json({
          message: "Member does not exits",
          success: false,
        });
      } else {
        const deletemember = await prisma.groupMember.delete({
          where: {
            groupId_profileId: {
              groupId,
              profileId: memberId,
            },
          },
        });
      }
      return res.status(200).json({
        message: `User with ${memberId} has been deleted`,
        success: true,
      });
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({
        message: "Something went wrong",
        success: false,
      });
    }
  }
);

// attachment upload route

grouprouter.post(
  "/attachments/:groupId",
  userMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { message } = req.body;
      const senderId = (req as any).user.id;
      if (!senderId || !groupId) {
        return res.status(400).json({
          success: false,
          message: "groupId required",
        });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "please upload the file" });
      }

      const member = await prisma.groupMember.findUnique({
        where: { groupId_profileId: { groupId, profileId: req.user!.id } },
      });
      if (!member) {
        return res.status(401).json({
          success: false,
          message: "you are not a member of the group",
        });
      }

      const newmessage = await prisma.message.create({
        data: {
          groupId,
          message: message || "",
          senderId: senderId,
        },
      });
      if (req.file) {
        await prisma.messageAttachment.create({
          data: {
            messageId: newmessage.id,
            url: `/uploads/${req.file.filename}`,
            type: "FILE",
          },
        });
      }
      const fullMessage = await prisma.message.findUnique({
        where: { id: newmessage.id },
        include: { attachments: true, sender: true },
      });
      io.to(groupId).emit("new-message", fullMessage);
      res.json(fullMessage);
    } catch (err: any) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);


// group details route

grouprouter.get("/:id/details", userMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const id = req.params.id
  try {
    const group = await prisma.group.findFirst({
      where: { id },
      include: {
        admin: true,
        members: {
          include: {
            profile: {
              include: {
                user: {
                  select: {
                    firstname: true,
                    lastname: true,
                    profilepic: true
                  }
                }
              }
            }
          }
        }
      }
    })
    if (group) {
      res.status(200).json({ success: true, message: "Group found", group })
    } else {
      res.status(401).json({ error: true, message: "You are not a member of this group." })
    }
  } catch (err) {
    console.log(err)
    res.status(503).json({ error: true, message: "Unable to fetch group details. Please try again later" })
  }

})


// Edit group name and description
grouprouter.put(
  "/edit/:groupId",
  userMiddleware,
  async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const { groupId } = req.params;
    const { name, description } = req.body;

    try {
      // Validate input
      if (!name && !description) {
        return res.status(400).json({
          success: false,
          message: "Please provide a new name or description to update.",
        });
      }

      // Find the group and verify ownership
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { adminId: true },
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Group not found.",
        });
      }

      if (group.adminId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to edit this group.",
        });
      }

      // Update group details
      const updatedGroup = await prisma.group.update({
        where: { id: groupId },
        data: {
          ...(name && { name }),
          ...(description && { description }),
        },
        include: {
          admin: true,
          members: {
            include: {
              profile: {
                include: {
                  user: {
                    select: {
                      firstname: true,
                      lastname: true,
                      profilepic: true
                    }
                  }
                }
              }
            }
          }
        }

      });

      return res.status(200).json({
        success: true,
        message: "Group details updated successfully.",
        group: updatedGroup,
      });
    } catch (error: any) {
      console.error("Error updating group:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong while updating the group.",
      });
    }
  }
);



export { grouprouter };
