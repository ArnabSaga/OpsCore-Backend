import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import notFound from './app/middlewares/notFound';
import globalErrorHandler from "./app/middlewares/globalErrorHandler";

const app: Application = express();

// parsers
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// application routes
// app.use('/api/v1', router);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from OpsCore World!");
});

// global error handler
app.use(globalErrorHandler);

// not found route
app.use(notFound);

export default app;
