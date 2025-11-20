import { model } from 'mongoose';
import { IPayment } from '../interfaces';
import { paymentSchema } from '../schemas/paymentSchema';

export const Payment = model<IPayment>("Payment", paymentSchema);