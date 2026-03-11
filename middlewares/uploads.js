import multer from "multer";
import path from "path";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../Utils/cloudinary.js";

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "patient-images",
    allowed_formats: ["jpeg", "jpg", "png", "webp"],
    public_id: (req, file) => {
      const uniqueName =
        Date.now() + "-" + Math.round(Math.random() * 1e9);
      return uniqueName;
    }
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;

  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WEBP images are allowed"));
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
});

export default upload;
