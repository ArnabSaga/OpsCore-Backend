import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.get("/login/google", AuthController.googleLogin);

router.get("/google/success", AuthController.googleLoginSuccess);

router.get("/oauth/error", AuthController.handleOAuthError);

router.post("/register", validateRequest(AuthValidation.registerSchema), AuthController.register);
router.get("/register", AuthController.handleRegisterGet);

router.post("/login", validateRequest(AuthValidation.loginSchema), AuthController.login);
router.get("/login", AuthController.handleLoginGet);

router.post("/logout", requireAuth, AuthController.logout);

router.get("/me", requireAuth, AuthController.getMe);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword
);

router.post(
  "/change-password",
  requireAuth,
  validateRequest(AuthValidation.changePasswordSchema),
  AuthController.changePassword
);

router.post(
  "/verify-email",
  validateRequest(AuthValidation.verifyEmailSchema),
  AuthController.verifyEmail
);

router.post(
  "/resend-verification",
  validateRequest(AuthValidation.resendVerificationSchema),
  AuthController.resendVerification
);

router.patch(
  "/workspace/switch",
  requireAuth,
  validateRequest(AuthValidation.switchWorkspaceSchema),
  AuthController.switchWorkspace
);

export const AuthRoutes = router;
