import {Schema, Types} from 'mongoose';
import { IList } from '../interfaces';
import { generateCode } from '../utils/helpers';
import { AppError } from '../utils/errors';

export const listSchema = new Schema<IList>({
  name: {
    type: String,
    required: true,
    minlength: 3,
    trim: true
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  shareCode: {
    type: String,
    unique: true,
    trim: true
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  members: [
    {
      type: Types.ObjectId,
      ref: "User",
      required: true
    }
  ],
  payments: [
    {
      type: Types.ObjectId,
      ref: "Payment"
    }
  ],
});

// ONLY schema-level validation, NO business logic
listSchema.pre("save", async function (next) {
  try {
    if (!this.creator)
      return next(new AppError("Creator is required", 400));

    if (this.members.length === 0) {
      this.members.push(this.creator);
    }

    if (!this.shareCode)
      this.shareCode = generateCode(6);

    // Remove duplicates
    const uniqueMembers = new Set(this.members.map(id => id.toString()));
    this.members = Array.from(uniqueMembers).map(id => new Types.ObjectId(id));

    next();
  } catch (err) {
    next(new AppError(`Can't save list: ${err}`, 500));
  }
});