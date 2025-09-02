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


export {grouprouter}