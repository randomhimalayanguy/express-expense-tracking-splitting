import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export const validationChecker = (req: Request, res: Response, next: NextFunction) => {
  const error = validationResult(req);
  if (!error.isEmpty())
    return next(new AppError(error.array().map(e => e.msg).join(', '), 400));
  next();
}