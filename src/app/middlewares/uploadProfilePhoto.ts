import { NextFunction, Request, Response } from "express";
import status from "http-status";
import multer from "multer";
import AppError from "../errors/AppError";
import { userProfileStorage } from "../config/cloudinary.config";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: userProfileStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new AppError(status.BAD_REQUEST, "Invalid file type. Allowed types: jpg, png, webp")
      );
    }

    cb(null, true);
  },
});

export const uploadProfilePhoto = (req: Request, res: Response, next: NextFunction) => {
  upload.single("profilePhoto")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new AppError(status.BAD_REQUEST, "File size must not exceed 5MB"));
      }
      return next(new AppError(status.BAD_REQUEST, error.message));
    }

    if (error) {
      return next(error);
    }

    next();
  });
};
