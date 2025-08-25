import express from "express"
import { userRouter } from "./routes/auth";
import * as dotenv from 'dotenv'
import { PrismaClient } from "@prisma/client";
import { rateLimit } from 'express-rate-limit'
import path from "path";
import cors from "cors"
dotenv.config()

const app = express();
app.use(express.json())
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
        ? Number(process.env.RATE_LIMIT_WINDOW_MS)
        : 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS
        ? Number(process.env.RATE_LIMIT_MAX_REQUESTS)
        : 30,
    validate: true,
    legacyHeaders: true,


});
app.use(limiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const uploadPath = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadPath));
app.use(cors())
const port = process.env.PORT || 3001
const prisma = new PrismaClient();
const serverStartTime = Date.now();
app.get("/status", (req, res) => {
    const uptimeMs = Date.now() - serverStartTime; 
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
    res.status(200).json({
        message: "Server is up and running",
        success: true,
        uptime: `${hours}h ${minutes}m ${seconds}s`

    })
})
const connectDB = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  try {
    await prisma.$connect();
    console.log("Database Connected!");
  } catch (err) {
    console.error("Database Not Connected:", err);
  }
};
connectDB();
app.use("/api/v1/user", userRouter)
app.listen(port, () => {
    console.log(`Server is running on ${port}`)
})