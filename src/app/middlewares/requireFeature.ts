import { NextFunction, Request, Response } from "express";
import status from "http-status";
import AppError from "../errors/AppError";
import { PlanFeatureKey } from "../config/planFeatures";
import { assertPlanFeatureEnabled } from "../utils/checkPlanLimit";

export const requireFeature = (featureKey: PlanFeatureKey) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(status.UNAUTHORIZED, "Authentication is required");
      }

      if (!req.workspaceId) {
        throw new AppError(
          status.BAD_REQUEST,
          "Workspace context is required before feature access can be checked"
        );
      }

      await assertPlanFeatureEnabled(req.workspaceId, featureKey);

      next();
    } catch (error) {
      next(error);
    }
  };
};
