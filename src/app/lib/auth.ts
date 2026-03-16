import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { SystemRole } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { sendEmail } from "../utils/email";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  socialProviders: {
    google: {
      clientId: envVars.GOOGLE_CLIENT_ID,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET,

      mapProfileToUser: () => ({
        systemRole: SystemRole.USER,
        isActive: true,
        emailVerified: true,
        isDeleted: false,
        deletedAt: null,
      }),
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },

  user: {
    additionalFields: {
      systemRole: {
        type: "string",
        required: true,
        default: SystemRole.USER,
      },
      isActive: {
        type: "boolean",
        required: true,
        default: true,
      },
      isDeleted: {
        type: "boolean",
        required: true,
        default: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        default: null,
      },
    },
  },

  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,

      async sendVerificationOTP({ email, otp, type }) {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) return;

          if (user.systemRole === SystemRole.SUPER_ADMIN) return;

          if (type === "email-verification" && !user.emailVerified) {
            await sendEmail({
              to: email,
              subject: "Verify your email with OpsCore",
              templateName: "otp",
              templateData: {
                name: user.name,
                otp,
                expiryMinutes: 3,
                appName: "OpsCore",
              },
            });
          }

          if (type === "forget-password") {
            await sendEmail({
              to: email,
              subject: "Password Reset OTP",
              templateName: "otp",
              templateData: {
                name: user.name,
                otp,
                expiryMinutes: 3,
                appName: "OpsCore",
              },
            });
          }
        } catch (error) {
          console.error("OTP sending error:", error);
        }
      },

      expiresIn: 3 * 60,
      otpLength: 6,
    }),
  ],

  redirectURLs: {
    signIn: `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
  },

  advanced: {
    useSecureCookies: envVars.NODE_ENV === "production",
  },
});
