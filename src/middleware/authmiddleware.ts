import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import path = require("path");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const JWT_USER_SEC = process.env.SECRET_KEY || "";
const prisma = new PrismaClient();
if (!JWT_USER_SEC) {
  console.log("JWT secrect missing");
}
export interface AuthRequest extends Request {
  user?: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
}

export async function userMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    //   const header = req.headers['authorization'];

    //   if (!header) {
    //     return res.status(401).json({ message: "Authorization header missing" });
    //   }
    //       const decoded = jwt.verify(header, JWT_USER_SEC as string) as { id: string };
    //     console.log(decoded)
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(400).json({
        message: "Authorization header missing",
      });
    }

    const token = authHeader;
    const decoded = jwt.verify(token, JWT_USER_SEC) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, firstname: true, lastname: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or deleted" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
