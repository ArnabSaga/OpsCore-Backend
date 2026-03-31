import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { uploadProfilePhoto } from "../../uploads/user/uploadProfilePhoto";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import { SystemRole } from "../../constants/role";

const router = Router();
const platformRouter = Router();

// Individual user management (mapped to /users)
router.use(requireAuth);
router.patch(
  "/password",
  validateRequest(UserValidation.updatePasswordValidationSchema),
  UserController.updatePassword
);

// Platform administration (mapped to /platform/users)
platformRouter.use(requireAuth);
platformRouter.use(requireSystemRole(SystemRole.SUPER_ADMIN));

platformRouter.get("/", UserController.getPlatformUsers);

export const UserRoutes = router;
export const PlatformUserRoutes = platformRouter;
