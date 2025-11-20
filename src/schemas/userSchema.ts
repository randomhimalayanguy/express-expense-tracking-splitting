import {Schema} from 'mongoose';
import { IUser } from '../interfaces';
import bcrypt from 'bcrypt';
import { AppError } from '../utils/errors';

export const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    minlength: 6,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  nickname: {
    type: String,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    trim: true,
    select: false
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    if (!this.nickname || !this.nickname.trim())
      this.nickname = this.username;
    next();
  } catch (err) {
    next(new AppError(`Can't save the user: ${err}`, 500));
  }
});