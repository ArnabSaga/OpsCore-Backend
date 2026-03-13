import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";

const app: Application = express();

// parsers
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// application routes
// app.use('/api/v1', router);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Apollo Gears World!");
});

// global error handler

// not found route

export default app;
