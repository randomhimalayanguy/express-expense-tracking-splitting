import { body } from "express-validator";
import { validationChecker } from "./validationChecker";

export const validateName = [
  body('name').isString().trim().isLength({ min: 3 })
    .withMessage('Name is a string with at least 3 characters'),
  validationChecker
];