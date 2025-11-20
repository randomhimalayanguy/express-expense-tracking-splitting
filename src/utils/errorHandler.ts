import { AppError } from "./errors";
import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.log(`${err.statusCode}: ${err.message}`);
  res.status(err.statusCode).json({ Error: err.message });
};