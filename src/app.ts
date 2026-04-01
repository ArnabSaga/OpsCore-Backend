import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import { envVars } from "./app/config/env";
import { auth } from "./app/lib/auth";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import { stripeWebhook } from './app/modules/billing/stripe.webhook';

const app: Application = express();

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates/`));

// Stripe webhook must receive the raw body before JSON parsing
app.post("/api/v1/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);


// parsers
app.use(express.json());

// origins
const allowedOrigins = [
  envVars.FRONTEND_URL,
  ...(envVars.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id", "Cookie"],
    exposedHeaders: ["Content-Type", "Set-Cookie"],
  })
);
app.use("/api/auth", toNodeHandler(auth));

app.use(cookieParser());

//* application routes
app.use("/api/v1", router);

//* Basic route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello from OpsCore World!");
});

//! global error handler
app.use(globalErrorHandler);

//! not found route
app.use(notFound);

export default app;
