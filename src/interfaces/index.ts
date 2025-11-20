import {Request} from 'express';
import mongoose, {Types} from 'mongoose';
import { PaymentCategory } from '../config/constants';

export interface AuthRequest extends Request {
  user?: { userId: string }
}

export interface IMember {
  username: string;
  totalAmt: number;
}

export interface IPayable {
  fromUser: string;
  toUser: string;
  amt: number;
}

export interface IUser {
  username: string;
  nickname: string;
  password: string;
}

export interface IPaidBy {
  member: Types.ObjectId;
  amount: number;
}

export interface IPayment extends mongoose.Document {
  listId: Types.ObjectId;
  amount: number;
  paymentFor: string;
  category: PaymentCategory;
  isEquallyPaid: boolean;
  paidBy: IPaidBy[];
}

export interface IList extends mongoose.Document {
  name: string;
  totalAmount: number;
  creator: Types.ObjectId;
  shareCode: string;
  members: Types.ObjectId[];
  payments: Types.ObjectId[];
}
