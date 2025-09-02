import express from "express"
import { PrismaClient } from "@prisma/client"
import jwt from "jsonwebtoken"
import { AuthRequest, userMiddleware } from "../middleware/authmiddleware";
import { Router } from "express"
import { formGroups } from "../utils/Formation";
import { success } from "zod";
const prisma = new PrismaClient();

const grouprouter :Router = Router();

grouprouter.post("/form_group" , async (req:AuthRequest ,res)=>{
      try {
    const result = await formGroups();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to form groups" });
  }
})

grouprouter.get("/groups" , async (req:AuthRequest ,res)=>{
    try{
        const findgroups = await prisma.group.findMany({
            include:{members:true}
        })

        if(!findgroups){
            return res.status(400).json({
                message:"Unable to find the groups",
                success:false
            })
        }
        else{
            return res.status(200).json({
                message:"Found the groups",
                success:true,
                findgroups
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


export {grouprouter}