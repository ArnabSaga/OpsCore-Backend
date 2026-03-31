import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, oAuthProxy } from "better-auth/plugins";
import { SystemRole } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { sendEmail } from "../utils/email";
import { prisma } from "./prisma";

const sendOtpEmail = async (options: {
  email: string;
  name: string;
  otp: string;
  subject: string;
}) => {
  await sendEmail({
    to: options.email,
    subject: options.subject,
    templateName: "otp",
    templateData: {
      name: options.name,
      otp: options.otp,
      expiryMinutes: 3,
      appName: "OpsCore",
    },
    text: `Your OTP is ${options.otp}. It expires in 3 minutes.`,
  });
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: envVars.BETTER_AUTH_URL,
  trustedOrigins: [envVars.FRONTEND_URL],

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
    oAuthProxy(),
    emailOTP({
      overrideDefaultEmailVerification: true,

      async sendVerificationOTP({ email, otp, type }) {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              name: true,
              emailVerified: true,
              systemRole: true,
            },
          });

          if (!user) {
            console.error(`User not found for OTP email: ${email}`);
            return;
          }

          if (user.systemRole === SystemRole.SUPER_ADMIN) {
            return;
          }

          if (type === "email-verification" && !user.emailVerified) {
            await sendOtpEmail({
              email,
              name: user.name,
              otp,
              subject: "Verify your email with OpsCore",
            });
          }

          if (type === "forget-password") {
            await sendOtpEmail({
              email,
              name: user.name,
              otp,
              subject: "Password Reset OTP",
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
    cookies: {
      session_token: {
        name: "opscore_session",
        attributes: {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
        },
      },
    },
  },
});
