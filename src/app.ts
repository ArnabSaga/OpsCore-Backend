import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import { envVars } from "./app/config/env";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";

const app: Application = express();

// parsers
app.use(express.json());
app.use(
  cors({
    origin: [envVars.FRONTEND_URL, envVars.BETTER_AUTH_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());

//* application routes
app.use("/api/v1", router);

//* Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello from OpsCore World!");
});

//! global error handler
app.use(globalErrorHandler);

//! not found route
app.use(notFound);

export default app;
