import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(AuthValidation.registerSchema), AuthController.register);

router.post("/login", validateRequest(AuthValidation.loginSchema), AuthController.login);

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

export const AuthRoutes = router;
