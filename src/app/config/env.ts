import dotenv from "dotenv";
import status from "http-status";
import AppError from "../errors/AppError";

dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: string;
  DATABASE_URL: string;
  // SHADOW_DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  FRONTEND_URL: string;
  EMAIL_SENDER: {
    SMTP_USER: string;
    SMTP_PASS: string;
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_FROM: string;
  };
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  STRIPE: {
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRICE_PRO_MONTHLY: string;
    STRIPE_PRICE_PRO_YEARLY: string;
    STRIPE_PRICE_ENTERPRISE_MONTHLY: string;
    STRIPE_PRICE_ENTERPRISE_YEARLY: string;
  };
  CLOUDINARY: {
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    TASK_ATTACHMENT_FOLDER: string;
    USER_PROFILE_FOLDER: string;
  };
  SUPER_ADMIN_NAME: string;
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
}

const loadEnvVariables = (): EnvConfig => {
  const requiredEnvVars = [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    // "SHADOW_DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "FRONTEND_URL",
    "EMAIL_SENDER_SMTP_USER",
    "EMAIL_SENDER_SMTP_PASS",
    "EMAIL_SENDER_SMTP_HOST",
    "EMAIL_SENDER_SMTP_PORT",
    "EMAIL_SENDER_SMTP_FROM",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    "STRIPE_PRICE_ENTERPRISE_YEARLY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "TASK_ATTACHMENT_FOLDER",
    "USER_PROFILE_FOLDER",
    "SUPER_ADMIN_NAME",
    "SUPER_ADMIN_EMAIL",
    "SUPER_ADMIN_PASSWORD",
  ];

  requiredEnvVars.forEach((variable) => {
    if (!process.env[variable]) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        `Environment variable {${variable}} is required but not defined in .env file.`
      );
    }
  });

  return {
    NODE_ENV: process.env.NODE_ENV as string,
    PORT: process.env.PORT as string,
    DATABASE_URL: process.env.DATABASE_URL as string,
    // SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL as string,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL as string,
    FRONTEND_URL: process.env.FRONTEND_URL as string,
    EMAIL_SENDER: {
      SMTP_HOST: process.env.EMAIL_SENDER_SMTP_HOST as string,
      SMTP_PORT: process.env.EMAIL_SENDER_SMTP_PORT as string,
      SMTP_USER: process.env.EMAIL_SENDER_SMTP_USER as string,
      SMTP_PASS: process.env.EMAIL_SENDER_SMTP_PASS as string,
      SMTP_FROM: process.env.EMAIL_SENDER_SMTP_FROM as string,
    },
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
    STRIPE: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string,
      STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY as string,
      STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY as string,
      STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY as string,
      STRIPE_PRICE_ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY as string,
    },
    CLOUDINARY: {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
      TASK_ATTACHMENT_FOLDER: process.env.TASK_ATTACHMENT_FOLDER as string,
      USER_PROFILE_FOLDER: process.env.USER_PROFILE_FOLDER as string,
    },
    SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME as string,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL as string,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD as string,
  };
};

export const envVars = loadEnvVariables();
