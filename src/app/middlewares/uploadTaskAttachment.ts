import { NextFunction, Request, Response } from "express";
import status from "http-status";
import multer from "multer";
import AppError from "../errors/AppError";
import { taskAttachmentStorage } from "../config/cloudinary.config";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: taskAttachmentStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new AppError(status.BAD_REQUEST, "Invalid file type. Allowed types: images, PDF, DOC, DOCX")
      );
    }

    cb(null, true);
  },
});

export const uploadTaskAttachment = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (error: unknown) => {
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
