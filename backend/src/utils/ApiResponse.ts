import type { Response } from "express";
import type { ResponseMeta } from "../types/index.js";

interface ResponseBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

class ApiResponse<T = unknown> {
  public readonly success = true;

  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly data: T = null as T,
    public readonly meta?: ResponseMeta
  ) {}

  toJSON(): ResponseBody<T> {
    const body: ResponseBody<T> = {
      success: this.success,
      message: this.message,
      data: this.data,
    };
    if (this.meta !== undefined) body.meta = this.meta;
    return body;
  }

  static send<T>(
    res: Response,
    statusCode: number,
    message: string,
    data: T = null as T,
    meta?: ResponseMeta
  ): Response {
    const payload = new ApiResponse<T>(statusCode, message, data, meta);
    return res.status(statusCode).json(payload.toJSON());
  }
}

export default ApiResponse;
