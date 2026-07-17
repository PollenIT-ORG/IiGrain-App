import type { Request, Response, NextFunction, RequestHandler } from "express";
import multer from "multer";
import ApiError from "../utils/ApiError.js";

export function handleUpload(mw: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            ApiError.badRequest("File is too large. The maximum size is 5 MB.")
          );
        }
        return next(ApiError.badRequest(`Upload failed: ${err.message}.`));
      }
      if (err) return next(err);
      next();
    });
  };
}
