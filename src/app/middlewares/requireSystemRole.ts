import { NextFunction, Request, Response } from "express";
import status from "http-status";
import AppError from "../errors/AppError";
import { SystemRole } from "../constants/role";

export const requireSystemRole = (...allowedRoles: SystemRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(status.UNAUTHORIZED, "Not authenticated");
      }

      if (!req.user.systemRole) {
        throw new AppError(status.FORBIDDEN, "System role is missing from user profile");
      }

      if (!allowedRoles.includes(req.user.systemRole as SystemRole)) {
        throw new AppError(
          status.FORBIDDEN,
          `System access denied. Required role: ${allowedRoles.join(" or ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
