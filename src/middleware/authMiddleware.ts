import { Response, NextFunction } from 'express';
import { AuthRequest } from "../interfaces";
import { AppError } from '../utils/errors';
import { config } from '../config/environment';
import jwt from 'jsonwebtoken';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return next(new AppError(`No token provided`, 401));

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.SECRET_KEY) as { userId: string };
    req.user = decoded;
    next();
  } catch (err) {
    next(new AppError(`Can't authenticate: ${err}`, 401));
  }
};