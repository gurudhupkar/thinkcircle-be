import express from "express"
import bcyrpt from "bcrypt"
import { Router } from "express"
import { registerschema } from "../utils/validation";
import { PrismaClient } from "@prisma/client"
import { error } from "console";
import { success } from "zod";
const userRouter :Router = Router();
const prisma = new PrismaClient();
const SALT_ROUNDS= 10
userRouter.post("/register" , async(req,res)=>{
   const parseddatawithsuccess = registerschema.safeParse(req.body)
    if(!parseddatawithsuccess.success){
       return res.status(400).json({
            message:"Please enter all valid fields",
            success:false
        })
    }
    const {name ,email , passwordHash} = parseddatawithsuccess.data
    try{
        const hash = await bcyrpt.hash(passwordHash , SALT_ROUNDS)
     const user = await prisma.user.create({
            data:{
                name,
                email,
                passwordHash:hash
            }
        })
        if(user){
            res.status(200).json({
                message:"user created successfully",
                success:true,
                name : user.name,
                email:user.email
            })
        }
        else{
           res.status(400).json({
            message:"User not created ",
            success:false
           })
        }
    }
    catch(error :any){
        console.log(error)
        res.status(500).json({
            message:"Email alredy exists",
            success:false
        })
    }

})

export {userRouter}