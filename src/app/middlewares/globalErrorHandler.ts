import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { envVars } from "../config/env";
import AppError from "../errors/AppError";
import {
  handlePrismaClientInitializationError,
  handlePrismaClientKnownRequestError,
  handlePrismaClientRustPanicError,
  handlePrismaClientUnknownError,
  handlePrismaClientValidationError,
} from "../errors/handlePrismaErrors";
import { TErrorSources } from "../interfaces/error.interface";
import multer from "multer";
import { destroyCloudinaryAssetByUrl } from "../lib/cloudinary";
import { MAX_FILE_SIZE } from "../constants/upload";

const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (envVars.NODE_ENV === "development") {
    if (err instanceof ZodError) {
      console.error(`[Zod Validation Error]:`, err.issues);
    } else if (err instanceof SyntaxError && "body" in err) {
      console.error("[Syntax Error in Request Body]:", err.message);
    } else {
      console.error(err);
    }
  }

  if (req.file && (req.file as Express.Multer.File).path) {
    destroyCloudinaryAssetByUrl((req.file as Express.Multer.File).path).catch(console.error);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach((file) => {
        if (file.path) destroyCloudinaryAssetByUrl(file.path).catch(console.error);
      });
    } else {
      Object.values(req.files).forEach((fileArray) => {
        if (Array.isArray(fileArray)) {
          fileArray.forEach((file) => {
            if (file.path) destroyCloudinaryAssetByUrl(file.path).catch(console.error);
          });
        }
      });
    }
  }

  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong!";
  let errorSources: TErrorSources[] = [
    {
      path: "",
      message: "Something went wrong!",
    },
  ];

  if (err instanceof ZodError) {
    statusCode = status.BAD_REQUEST;
    message = "Validation Error";
    errorSources = err.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "",
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const simplifiedError = handlePrismaClientKnownRequestError(err);
    statusCode = simplifiedError.statusCode ?? status.BAD_REQUEST;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    const simplifiedError = handlePrismaClientValidationError(err);
    statusCode = simplifiedError.statusCode ?? status.BAD_REQUEST;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const simplifiedError = handlePrismaClientUnknownError(err);
    statusCode = simplifiedError.statusCode ?? status.INTERNAL_SERVER_ERROR;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    const simplifiedError = handlePrismaClientInitializationError(err);
    statusCode = simplifiedError.statusCode ?? status.INTERNAL_SERVER_ERROR;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof Prisma.PrismaClientRustPanicError) {
    const simplifiedError = handlePrismaClientRustPanicError();
    statusCode = simplifiedError.statusCode ?? status.INTERNAL_SERVER_ERROR;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  } else if (err instanceof multer.MulterError) {
    statusCode = status.BAD_REQUEST;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        : err.message;
    errorSources = [
      {
        path: "",
        message: message,
      },
    ];
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorSources,
    error: envVars.NODE_ENV === "development" ? err : undefined,
    stack: envVars.NODE_ENV === "development" ? err?.stack : undefined,
  });
};

export default globalErrorHandler;
