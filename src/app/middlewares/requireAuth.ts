import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import AppError from "../errors/AppError";

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      throw new AppError(status.UNAUTHORIZED, "Not authenticated");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        systemRole: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (!dbUser) {
      throw new AppError(status.UNAUTHORIZED, "User not found");
    }

    if (dbUser.isDeleted) {
      throw new AppError(status.FORBIDDEN, "User account is deleted");
    }

    if (!dbUser.isActive) {
      throw new AppError(status.FORBIDDEN, "User account is inactive");
    }

    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      systemRole: String(dbUser.systemRole),
      isActive: dbUser.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
};
