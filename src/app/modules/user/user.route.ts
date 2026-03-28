import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { uploadProfilePhoto } from "../../uploads/user/uploadProfilePhoto";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import { SystemRole } from "../../constants/role";

const router = Router();

router.use(requireAuth);

router.get("/profile", UserController.getProfile);

router.get(
  "/platform/all",
  requireSystemRole(SystemRole.SUPER_ADMIN),
  UserController.getPlatformUsers
);

router.patch(
  "/profile",
  uploadProfilePhoto.single("photo"),
  validateRequest(UserValidation.updateProfileValidationSchema),
  UserController.updateProfile
);

router.patch(
  "/password",
  validateRequest(UserValidation.updatePasswordValidationSchema),
  UserController.updatePassword
);

export const UserRoutes = router;
