import { CustomValidator, body } from "express-validator";
import { IPaidBy } from "../interfaces";
import { PaymentCategory } from "../config/constants";
import { validationChecker } from "./validationChecker";

const validatePaidByNotEmptyUnlessEqual: CustomValidator = (value: Array<IPaidBy>, { req }) => {
  if (req.body.isEquallyPaid) return true;
  if (!Array.isArray(value) || value.length === 0)
    throw new Error('paidBy must not be empty unless isEquallyPaid is true');
  return true;
};

export const validatePayment = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage(`Amount should be a number greater than 0`),

  body('paymentFor')
    .optional()
    .isString()
    .trim()
    .withMessage('Payment for should be a valid string'),

  body('category')
    .isString()
    .trim()
    .isIn(Object.values(PaymentCategory))
    .withMessage('Category must be one of: ' + Object.values(PaymentCategory).join(', ')),

  body('isEquallyPaid')
    .isBoolean()
    .withMessage('isEquallyPaid must be a boolean'),

  body('paidBy')
    .custom(validatePaidByNotEmptyUnlessEqual),

  body('paidBy.*.member')
    .if((val, { req }) => !req.body.isEquallyPaid)
    .isMongoId()
    .withMessage('Member must be a proper user id'),

  body('paidBy.*.amount')
    .if((val, { req }) => !req.body.isEquallyPaid)
    .isFloat({ min: 0.01 })
    .withMessage('Amount should be larger than 0'),

  validationChecker
];

export const validatePaymentEdit = [
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage(`Amount should be a number greater than 0`),

  body('paymentFor')
    .optional()
    .isString()
    .trim()
    .withMessage('Payment for should be a valid string'),

  body('category')
    .optional()
    .isString()
    .trim()
    .isIn(Object.values(PaymentCategory))
    .withMessage('Category must be one of: ' + Object.values(PaymentCategory).join(', ')),

  body('isEquallyPaid')
    .optional()
    .isBoolean()
    .withMessage('isEquallyPaid must be a boolean'),

  body('paidBy')
    .optional()
    .custom(validatePaidByNotEmptyUnlessEqual),

  body('paidBy.*.member')
    .optional()
    .if((val, { req }) => !req.body.isEquallyPaid)
    .isMongoId()
    .withMessage('Member must be a proper user id'),

  body('paidBy.*.amount')
    .optional()
    .if((val, { req }) => !req.body.isEquallyPaid)
    .isFloat({ min: 0.01 })
    .withMessage('Amount should be larger than 0'),

  validationChecker
];