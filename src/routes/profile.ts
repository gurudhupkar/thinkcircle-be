import express from "express"
import { PrismaClient } from "@prisma/client"
import jwt from "jsonwebtoken"
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { Router } from "express"
import { success } from "zod";
import { profileSchema } from "../utils/validation";


const profilerouter :Router = Router();
const prisma = new PrismaClient();

profilerouter.post("/create_profile" , userMiddleware , async (req :AuthRequest , res)=>{
    try {
        const userId = (req as any).user.id
        const parsedata = profileSchema.safeParse(req.body)
        // console.log(req.body);
        

       if (!parsedata.success){
        // console.log(parsedata)
        return res.status(400).json({
            message:"Please enter all the valid fields",
            success:false
        })
       }
      const { subjects, learningStyle, availability, goals } = parsedata.data;

      const profile = await prisma.profile.upsert({
       where:{userId},
       update:{
        subjects,
        learningStyle,
        availability,
        goals
       },
       create:{
        userId,
        subjects,
        learningStyle,
        availability,
        goals
       }
      })
      if(!profile){
        return res.status(400).json({
            message:"Unable to create profile",
            success:false
        })
      }
      else{
        res.status(200).json({
            message:"Profile has been created",
            success:true
        })
      }

    }
    catch(error:any){
             console.log(error)
        return res.status(500).json({
       
            message:"Something went wrong",
            success:false
        })
    }
})
profilerouter.get("/my_profile" , userMiddleware , async(req:AuthRequest ,res)=>{
    const userId = (req as any).user.id
    // console.log(userId)
    try{
        const user = await prisma.profile.findUnique({
            where:{userId:userId},
             include: { user: true }
        })
        // console.log(user)
        if(!user){
            return res.status(400).json({
                message:"profile not found or created",
                success:false
            })
        }
        else{
            res.status(200).json({
                message:"Profile found successfully",
                success:true,
                user
            })
        }
    }
    catch(error:any){
        return res.status(500).json({
            message:"something went wrong",
            success:false
        })
    }
})







export {profilerouter}