import ejs from "ejs";
import status from "http-status";
import nodemailer from "nodemailer";
import path from "path";
import { envVars } from "../config/env";
import AppError from "../errors/AppError";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, any>;
  attachments?: EmailAttachment[];
  from?: string;
  text?: string;
}

const smtpPort = Number(envVars.EMAIL_SENDER.SMTP_PORT);

const transporter = nodemailer.createTransport({
  host: envVars.EMAIL_SENDER.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: envVars.EMAIL_SENDER.SMTP_USER,
    pass: envVars.EMAIL_SENDER.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("[EMAIL] SMTP verify failed:", error);
  } else {
    console.log("[EMAIL] SMTP server is ready:", success);
  }
});

export const sendEmail = async ({
  to,
  subject,
  templateName,
  templateData,
  attachments,
  from,
  text,
}: SendEmailOptions): Promise<void> => {
  try {
    const templatePath = path.join(process.cwd(), "src", "app", "templates", `${templateName}.ejs`);

    console.log("[EMAIL] Sending email with config:", {
      host: envVars.EMAIL_SENDER.SMTP_HOST,
      port: envVars.EMAIL_SENDER.SMTP_PORT,
      user: envVars.EMAIL_SENDER.SMTP_USER,
      from: from ?? envVars.EMAIL_SENDER.SMTP_FROM,
      to,
      templatePath,
      subject,
    });

    const html = await ejs.renderFile(templatePath, templateData, {
      async: true,
    });

    const info = await transporter.sendMail({
      from: from ?? envVars.EMAIL_SENDER.SMTP_FROM,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });

    console.log(`[EMAIL] Email sent successfully: ${info.messageId}`);
  } catch (error: any) {
    console.error("[EMAIL] Email sending error FULL:", {
      message: error?.message,
      code: error?.code,
      command: error?.command,
      response: error?.response,
      responseCode: error?.responseCode,
      stack: error?.stack,
    });

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send email");
  }
};
