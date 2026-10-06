import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import env from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { broadcastLiveChanges } from "./middlewares/liveChanges.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";
import ApiResponse from "./utils/ApiResponse.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

const allowAll = env.corsOrigin === "*";
const corsOrigins = allowAll
  ? "*"
  : env.corsOrigin.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: corsOrigins,
    credentials: !allowAll,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(compression());

app.use(morgan(env.isProduction ? "combined" : "dev"));

if (env.rateLimit.enabled) {
  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
      code: "TOO_MANY_REQUESTS",
    },
  });
  app.use(env.apiPrefix || "/", limiter);
}

app.get("/", (_req: Request, res: Response) => {
  return ApiResponse.send(res, 200, "Farmer App API is running 🚜", {
    name: "farmer-app-backend",
    apiPrefix: env.apiPrefix,
    health: `${env.apiPrefix}/health`,
  });
});

app.use(env.apiPrefix || "/", broadcastLiveChanges);
app.use(env.apiPrefix || "/", apiRoutes);

app.use(notFound);

app.use(errorHandler);

export default app;
