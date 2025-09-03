import express from "express"
import bcyrpt from "bcrypt"
import { Router } from "express"
import { loginschema, registerschema, updatePasswordSchema } from "../utils/validation";
import { PrismaClient } from "@prisma/client"
import { error, profile } from "console";
import { email, success, tuple } from "zod";
import jwt from "jsonwebtoken"
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { create } from "domain";
import crypto from "crypto"
import { sendPasswordResetLink } from "../utils/sendemail";
import { fa } from "zod/v4/locales/index.cjs";
import { upload } from "../middleware/upload";
const userRouter: Router = Router();
const JWT_USER_SEC = process.env.SECRET_KEY || ""
const prisma = new PrismaClient();
if (!JWT_USER_SEC) {
    console.log("JWT secrect missing");
}
const SALT_ROUNDS = 10
userRouter.post("/register", async (req, res) => {
    const parseddatawithsuccess = registerschema.safeParse(req.body)
    if (!parseddatawithsuccess.success) {
        console.log(parseddatawithsuccess)
        return res.status(400).json({
            message: "Please enter all valid fields",
            success: false
        })
    }
    const { firstname, lastname, email, password } = parseddatawithsuccess.data
    try {
        const hash = await bcyrpt.hash(password, SALT_ROUNDS)
        const user = await prisma.user.create({
            data: {
                firstname,
                lastname,
                email,
                passwordHash: hash
            }
        })
        if (user) {
            res.status(200).json({
                message: "user created successfully",
                success: true,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email
            })
        }
        else {
            res.status(400).json({
                message: "User not created ",
                success: false
            })
        }
    }
    catch (error: any) {
        console.log(error)
        res.status(500).json({
            message: "Email alredy exists",
            success: false
        })
    }

})
userRouter.post("/login", async (req, res) => {
    const parsedbody = loginschema.safeParse(req.body)

    if (!parsedbody.success) {
        return res.status(400).json({
            message: "Enter all the valid fields",
            success: true
        })
    }
    try {
        const { email, passwordHash } = parsedbody.data
        // console.log(passwordHash)
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            return res.status(404).json({
                message: "Email does not exits ",
                success: false
            })
        }
        // console.log(user.passwordHash)

        const match = await bcyrpt.compare(passwordHash, (user as any).passwordHash)
        if (match) {
            const token = jwt.sign({ id: user.id }, JWT_USER_SEC, { expiresIn: "1h" })
            return res.status(200).json({
                message: "User login successfully",
                success: true,
                token,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email
            })

        }
        else {
            return res.status(404).json({
                message: "Incorrect password",
                success: false
            })
        }



    }
    catch (err: any) {
        console.log(err);
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
userRouter.get("/me", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user?.id
    // console.log(userId)
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
            return res.status(400).json({
                message: "User Not Logged In",
                success: false
            })
        }
        else {
            res.json({
                message: "Found the user",
                success: true,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                create: user.createdAt
            })
        }
    }
    catch (err: any) {
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }


})
userRouter.post("/update_email", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user?.id
    const { email } = req.body
    if (!email) {
        return res.status(400).json({
            message: "Please Enter all the required Fields",
            success: false
        })
    }
    try {
        const updateuser = await prisma.user.update({
            where: { id: userId },
            data: { email: email }
        })
        if (!updateuser) {
            return res.status(400).json({
                message: "Failed to update the user",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "Email updated successfully",
                success: true
            })
        }

    } catch (error: any) {
        return res.status(500).json({
            message: "Failed to update the email",
            success: false
        })
    }
})
userRouter.post("/update_password", userMiddleware, async (req: AuthRequest, res) => {
    const userId = (req as any).user?.id
    try {
        const parseddata = updatePasswordSchema.parse(req.body)
        const { oldPassword, newPassword } = parseddata

        if (oldPassword == newPassword) {
            return res.status(401).json({
                message: "New password and old password are same... Please Set a new password",
                success: false
            })
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        })
        if (!user) {
            return res.status(400).json({
                message: "user not found",
                success: false
            })
        }
        const match = await bcyrpt.compare(oldPassword, user.passwordHash)

        if (!match) {
            return res.status(400).json({
                message: "Please Enter the correct previous password",
                success: false
            })
        }
        const password = await bcyrpt.hash(newPassword, SALT_ROUNDS)
        const updateuser = await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: password }
        })
        if (!updateuser) {
            return res.status(400).json({
                message: "Falied to update the password",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "password updated successfully",
                success: true
            })
        }
    }
    catch (error: any) {
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
userRouter.put("/update", userMiddleware, async (req: AuthRequest, res) => {

    const userId = (req as any).user?.id
    const { firstname, lastname } = req.body
    if (!firstname || !lastname) {
        return res.status(400).json({
            message: "Please Enter all the required Fields",
            success: false
        })
    }
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { firstname: firstname, lastname: lastname }
        })

        if (!user) {
            return res.status(400).json({
                message: "Unable to update the user",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "updated the user details successfully",
                success: true
            })
        }

    }
    catch (error: any) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
userRouter.post("/forgot_password", async (req: AuthRequest, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        })
        if (!user) {
            return res.status(400).json({
                message: "User not found or email does not exists",
                success: false
            })
        }
        const token = crypto.randomBytes(32).toString("hex")
        const expiry = new Date(Date.now() + 10 * 60 * 1000)

        const updateuser = await prisma.user.update({
            where: { email },
            data: {
                resettoken: token,
                resettokenExpiry: expiry
            }
        })
        await sendPasswordResetLink(email, token)
        res.status(200).json({
            message: "Link sent to your email",
            success: true

        })


    }
    catch (error: any) {
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
userRouter.post("/reset_password/:token", async (req: AuthRequest, res) => {
    const { token } = req.params
    // console.log(token)
    const { confirmPassword, newPassword } = req.body
    if (!confirmPassword || !newPassword) {
        return res.status(400).json({
            message: "Please enter all the required fields",
            success: false
        })
    }
    if (confirmPassword != newPassword) {
        return res.status(400).json({
            message: "password fields should match",
            success: false
        })
    }
    try {
        const user = await prisma.user.findFirst({
            where: {
                resettoken: token,
                resettokenExpiry: { gt: new Date() }
            }
        })
        if (user?.resettoken !== token || user?.resettokenExpiry! < new Date()) {
            return res.status(404).json({
                message: "Invalid token or token has expired",
                success: false
            })
        }
        if (!user) {
            return res.status(400).json({
                message: "Invalid token or token has expired",
                success: false
            })
        }
        const hash = await bcyrpt.hash(newPassword, SALT_ROUNDS)

        const updateuser = await prisma.user.update({
            where:{id:user?.id},
            data:{
                passwordHash:hash,
                resettoken:null,
                resettokenExpiry:null
            }
        })
        if(!updateuser){
            return res.status(400).json({
                message:"Failed to update the password",
                success:false
            })
        }
        else{
            res.status(200).json({
                message:"password updated successfully",
                success:true
            })
        }

    }
    catch (error: any) {
        return res.status(500).json({
            message: "Something went wrong",
            success: false
        })
    }
})
userRouter.post("/update_profile", userMiddleware , upload.single("profilepic"), async (req:AuthRequest ,res)=>{
    try{
        const userId = (req as any).user.id

        if(!req.file){
            return res.status(400).json({
                messsage:"Please upload the file",
                success:false
            })
        }
         const filename = req.file?.filename
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

        const updateuser = await prisma.user.update({
            where:{id:userId},
            data:{
                profilepic:imageUrl
            }
        })
           if (!updateuser) {
            return res.status(400).json({
                message: "Failed to update the profile",
                success: false
            })
        }
        else {
            res.status(200).json({
                message: "Profile photo updated",
                success: true,
                user: updateuser
            })
        }
    
    }
    catch(error:any){
        return res.status(500).json({
            message:"Something went wrong",
            success:false
        })
    }
})
export { userRouter }