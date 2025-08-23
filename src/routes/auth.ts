import express from "express"
import bcyrpt from "bcrypt"
import { Router } from "express"
import { loginschema, registerschema, updatePasswordSchema } from "../utils/validation";
import { PrismaClient } from "@prisma/client"
import { error } from "console";
import { email, success, tuple } from "zod";
import jwt from "jsonwebtoken"
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { create } from "domain";
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
        return res.status(400).json({
            message: "Please enter all valid fields",
            success: false
        })
    }
    const { name, email, passwordHash } = parseddatawithsuccess.data
    try {
        const hash = await bcyrpt.hash(passwordHash, SALT_ROUNDS)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hash
            }
        })
        if (user) {
            res.status(200).json({
                message: "user created successfully",
                success: true,
                name: user.name,
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
                name: user.name,
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
userRouter.get("/me", userMiddleware , async(req:AuthRequest , res)=>{
    const userId = (req as any).user?.id
    // console.log(userId)
    try{
  const user = await prisma.user.findUnique({where:{id:userId}})
    if(!user){
        return res.status(400).json({
            message:"User Not Logged In",
            success:false
        })
    }
    else{
        res.json({
            message:"Found the user",
            success:true,
            name:user.name,
            email:user.email,
            create:user.createdAt
        })
    }
    }
    catch(err:any){
        return res.status(500).json({
            message:"Something went wrong",
            success:false
        })
    }
  

})
userRouter.post("/update_email" , userMiddleware , async (req:AuthRequest , res)=>{
    const userId = (req as any).user?.id
   const {email} = req.body
    try{
        const updateuser = await prisma.user.update({
            where:{id:userId},
            data:{email:email}
        })
        if(!updateuser){
            return res.status(400).json({
                message:"Failed to update the user",
                success:false
            })
        }
        else{
            res.status(200).json({
                message:"Email updated successfully",
                success:true
            })
        }

    }catch(error:any){
        return res.status(500).json({
            message:"Failed to update the email"
        })
    }
})
userRouter.post("/update_password" , userMiddleware , async(req:AuthRequest , res)=>{
    const userId = (req as any).user?.id
    
   

    try{
        const parseddata = updatePasswordSchema.parse(req.body)
        const {oldPassword , newPassword} = parseddata

        if(oldPassword == newPassword){
            return res.status(401).json({
                message:"New password and old password are same... Please Set a new password",
                success:false
            })
        }

        const user = await prisma.user.findUnique({
            where :{id:userId}
        })
        if(!user){
            return res.status(400).json({
                message:"user not found",
                success:false
            })
        }
        const match = await bcyrpt.compare(oldPassword , user.passwordHash)

        if(!match){
            return res.status(400).json({
                message:"Please Enter the correct previous password",
                success:false
            })
        }
         const password = await bcyrpt.hash(newPassword , SALT_ROUNDS)
        const updateuser = await prisma.user.update({
            where:{id:userId},
            data:{passwordHash: password}
        })
        if(!updateuser){
            return res.status(400).json({
                message:"Falied to update the password",
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
    catch(error:any){
        return res.status(500).json({
            message:"Something went wrong",
            success:false
        })
    }
})

export { userRouter }