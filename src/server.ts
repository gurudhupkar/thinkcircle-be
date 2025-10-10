import express from "express";
import { userRouter } from "./routes/auth";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { rateLimit } from "express-rate-limit";
import path from "path";
import cors from "cors";
import { profilerouter } from "./routes/profile";
import { grouprouter } from "./routes/groups";
import http from "http";
// import  from "./socket";
import { notifyrouter } from "./routes/notification";
import { initSocket } from "./socket";

import morgan from "morgan";
import { summaryRouter } from "./routes/summery";
dotenv.config();

const app = express();
app.use(express.json());

app.use(morgan("dev"));

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const uploadPath = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadPath));

var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:3500",
    "http://127.0.0.1:5500",
  ],
  credentials: true,

  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
const port = process.env.PORT || 3001;
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
    uptime: `${hours}h ${minutes}m ${seconds}s`,
  });
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Database Connected!");
  } catch (err) {
    console.error("Database Not Connected:", err);
  }
};
connectDB();

app.use("/api/v1/user", userRouter);
app.use("/api/v1/profile", profilerouter);
app.use("/api/v1/group", grouprouter);
app.use("/api/v1/notification", notifyrouter);
app.use("/api/v1/summary", summaryRouter);

const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
