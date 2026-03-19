import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { uploadProfilePhoto } from "../../middlewares/uploadProfilePhoto";
import validateRequest from "../../middlewares/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.use(requireAuth);

router.get("/profile", UserController.getProfile);

router.patch(
  "/profile",
  uploadProfilePhoto,
  validateRequest(UserValidation.updateProfileSchema),
  UserController.updateProfile
);

export const UserRoutes = router;
