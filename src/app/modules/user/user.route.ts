import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { uploadProfilePhoto } from "../../uploads/user/uploadProfilePhoto";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.use(requireAuth);

router.get("/profile", UserController.getProfile);

router.patch(
  "/profile",
  uploadProfilePhoto.single("photo"),
  validateRequest(UserValidation.updateProfileValidationSchema),
  UserController.updateProfile
);

export const UserRoutes = router;
