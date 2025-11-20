import {Schema} from 'mongoose';
import { IPayment } from '../interfaces';
import { AppError } from '../utils/errors';
import { PaymentCategory } from '../config/constants';

export const paymentSchema = new Schema<IPayment>(
  {
    listId: {
      type: Schema.Types.ObjectId,
      ref: "List",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentFor: {
      type: String,
      trim: true
    },
    isEquallyPaid: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      enum: Object.values(PaymentCategory),
      required: true
    },
    paidBy: [
      {
        member: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        },
      },
    ],
  },
  { timestamps: true }
);

// ONLY schema-level validation, NO business logic
paymentSchema.pre("save", async function (next) {
  try {
    if (!this.paymentFor || this.paymentFor.trim().length === 0) {
      this.paymentFor = this.category;
    }
    next();
  } catch (err) {
    next(new AppError(`Can't save payment: ${err}`, 500));
  }
});