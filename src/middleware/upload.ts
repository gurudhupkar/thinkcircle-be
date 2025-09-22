import multer from "multer";
import path from "path";
import fs from "fs";

const uploadRoot = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body?.senderId || (req as any).user.id || "unknown";
    const userFolder = path.join(uploadRoot, userId);

    // Create folder if not exists
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    cb(null, userFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueSuffix + ext);
  },
});

export const upload = multer({ storage });
