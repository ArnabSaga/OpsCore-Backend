import multer from "multer";
import status from "http-status";
import AppError from "../../errors/AppError";
import { taskAttachmentStorage } from "../../lib/cloudinary";
import { ALLOWED_ATTACHMENT_TYPES, MAX_FILE_SIZE } from "../../constants/upload";

export const uploadTaskAttachment = multer({
  storage: taskAttachmentStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(status.BAD_REQUEST, `Invalid file type. Allowed types: images, PDF, DOC, DOCX`)
      );
    }

    cb(null, true);
  },
});
