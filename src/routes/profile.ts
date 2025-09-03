import express from "express"
import { PrismaClient } from "@prisma/client"
import jwt from "jsonwebtoken"
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { Router } from "express"
import { success } from "zod";
import { profileSchema } from "../utils/validation";
import tr from "zod/v4/locales/tr.cjs";


const profilerouter: Router = Router();
const prisma = new PrismaClient();

profilerouter.post("/create_profile", userMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = (req as any).user.id
        const parsedata = profileSchema.safeParse(req.body)
        // console.log(req.body);


        if (!parsedata.success) {
            // console.log(parsedata)
            return res.status(400).json({
                message: "Please enter all the valid fields",
                success: false
            })
        }
        const { subjects, learningStyle, availability, goals } = parsedata.data;

        const profile = await prisma.profile.upsert({
            where: { userId },
            update: {
                subjects,
                learningStyle,
                availability,
                goals
            },
            create: {
                userId,
                subjects,
                learningStyle,
                availability,
                goals
            }
        })
        if (!profile) {
            return res.status(400).json({
                message: "Unable to create profile",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "Profile has been created",
                success: true
            })
        }

    }
    catch (error: any) {
        console.log(error)
        return res.status(500).json({

            message: "Something went wrong",
            success: false
        })
    }
})
profilerouter.get("/my_profile", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user.id
    // console.log(userId)
    try {
        const user = await prisma.profile.findUnique({
            where: { userId: userId },
            include: { user: true }
        })
        // console.log(user)
        if (!user) {
            return res.status(400).json({
                message: "profile not found or created",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "Profile found successfully",
                success: true,
                user
            })
        }
    }
    catch (error: any) {
        return res.status(500).json({
            message: "something went wrong",
            success: false
        })
    }
})
profilerouter.post("/update", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user.id
    const pasreddata = profileSchema.safeParse(req.body)
    if (!pasreddata.success) {
        return res.status(400).json({
            message: "Please enter all the valid fields",
            success: false
        })
    }
    const { subjects, learningStyle, availability, goals } = pasreddata.data;

    try {

        const updateprofile = await prisma.profile.update({
            where: { userId: userId },
            data: {
                subjects,
                learningStyle,
                availability,
                goals
            }
        })
        if (!updateprofile) {
            return res.status(400).json({
                message: "Unable to  update your profile",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "Updated your profile",
                success: true
            })
        }

    }
    catch (error: any) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }

})
profilerouter.get("/subject_specific", userMiddleware, async (req: AuthRequest, res) => {

    const userId = (req as any).user.id
    const { subject } = req.body
    try {

        const user = await prisma.profile.findMany({
            where: {
                subjects: {
                    has: subject
                }
            },
            select: {
                id: true,
                subjects: true,
                groupId: true,
                userId: true
            }
        })
        if (!user) {
            return res.status(400).json({
                message: "No user with such specific subject",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "User found with the specific subject",
                success: true,
                user
            })
        }
    }
    catch (error: any) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
profilerouter.post("/grouping", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user.id;
    const { profileId, subjectfocus, groupname } = req.body;

    try {

        const currentuser = await prisma.profile.findUnique({
            where: { userId: userId },
        });

        if (!currentuser) {
            return res.status(400).json({
                message: "User profile not found",
                success: false,
            });
        }


        const selectedProfile = await prisma.profile.findUnique({
            where: { id: profileId },
        });

        if (!selectedProfile) {
            return res.status(404).json({
                message: "Selected profile not found",
                success: false,
            });
        }
        // Check for Existing group id
        if (currentuser.groupId || selectedProfile.groupId) {
            return res.status(400).json({
                message: "One or both users are already in a group. Cannot form a new group.",
                currentUserGroup: currentuser.groupId,
                selectedUserGroup: selectedProfile.groupId,
                success: false,
            });
        }
        // Check for subject overlapping 
        const userSubjects = currentuser.subjects;
        const overlap = selectedProfile.subjects.some((subj) =>
            userSubjects.includes(subj)
        );

        if (!overlap) {
            return res.status(400).json({
                message: "Cannot form group with a user having completely different subjects",
                invalidProfile: selectedProfile.id,
                success: false,
            });
        }


        const group = await prisma.group.create({
            data: {
                name: groupname || "Custom Study Group",
                subjectFocus: subjectfocus || "General",
            },
        });


        await prisma.profile.updateMany({
            where: { id: { in: [currentuser.id, selectedProfile.id] } },
            data: { groupId: group.id },
        });

        return res.status(201).json({
            message: "Group created successfully",
            success: true,
            group,
        });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
        });
    }
});





export { profilerouter }