import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.use(requireAuth);

router.get("/profile", UserController.getProfile);

router.patch(
  "/profile",
  validateRequest(UserValidation.updateProfileSchema),
  UserController.updateProfile
);

export const UserRoutes = router;
