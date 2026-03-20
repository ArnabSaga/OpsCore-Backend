import multer from "multer";
import status from "http-status";
import AppError from "../../errors/AppError";
import { userProfileStorage } from "../../lib/cloudinary";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "../../constants/upload";

export const uploadProfilePhoto = multer({
  storage: userProfileStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          status.BAD_REQUEST,
          `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
        )
      );
    }

    cb(null, true);
  },
});
