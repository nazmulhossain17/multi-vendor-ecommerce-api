import express, { Request, Response } from "express";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(express.json());

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("Working!");
});

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
