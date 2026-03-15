import { NextFunction, Request, Response } from "express";
import status from "http-status";
import AppError from "../errors/AppError";

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(status.UNAUTHORIZED, "Not authenticated");
      }

      if (!req.workspaceRole) {
        throw new AppError(status.FORBIDDEN, "Workspace role is missing from request context");
      }

      const normalizedAllowedRoles = allowedRoles.map((role) => role.toUpperCase());
      const currentRole = req.workspaceRole.toUpperCase();

      if (!normalizedAllowedRoles.includes(currentRole)) {
        throw new AppError(
          status.FORBIDDEN,
          `Access denied. Required role: ${normalizedAllowedRoles.join(" or ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
