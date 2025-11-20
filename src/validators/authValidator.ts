import { body } from "express-validator";
import { validationChecker } from "./validationChecker";

export const authValidator = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .toLowerCase()
    .withMessage('Username should be a string with at least 6 characters'),

  body('nickname')
    .optional()
    .isString()
    .trim()
    .withMessage('Nickname must be a string'),

  body('password')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password should be a string with at least 6 characters'),

  validationChecker
];