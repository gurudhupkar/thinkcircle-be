import express from "express"
import { userRouter } from "./routes/auth";
import * as dotenv from 'dotenv'
import { PrismaClient } from "@prisma/client";
dotenv.config()

const app = express();
app.use(express.json())

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