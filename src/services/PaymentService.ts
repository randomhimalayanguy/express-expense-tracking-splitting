import { Types } from 'mongoose';
import { Payment } from '../models/paymentModel';
import { IList, IPaidBy, IPayment } from '../interfaces';
import { AppError } from '../utils/errors';

export const PaymentService = {
  async createPayment(list: IList, body: any) {
    const { amount, isEquallyPaid, paidBy, category, paymentFor } = body;

    let finalPaidBy: IPaidBy[] = [];

    if (isEquallyPaid) {
      // Divide equally among all list members
      if (list.members.length === 0)
        throw new AppError(`Cannot split payment: list has no members`, 400);

      const splitAmount = parseFloat((amount / list.members.length).toFixed(2));
      finalPaidBy = list.members.map(member => ({
        member,
        amount: splitAmount
      }));
    } else {
      // Validate paidBy members are in the list
      const invalidMembers = this.validatePaidMembers(paidBy, list.members);
      if (invalidMembers.length > 0)
        throw new AppError(`Some members are not part of this list`, 400);

      // Validate that paidBy amounts add up to total amount
      const totalPaid = paidBy.reduce((sum : number, p : IPaidBy) => sum + p.amount, 0);
      if (Math.abs(amount - totalPaid) > 0.01)
        throw new AppError(`Payment amounts don't add up to total (${totalPaid} vs ${amount})`, 400);

      finalPaidBy = paidBy;
    }

    // Create payment document
    const payment = new Payment({
      listId: list._id,
      amount,
      paymentFor,
      isEquallyPaid,
      category,
      paidBy: finalPaidBy
    });

    await payment.save();
    return payment;
  },

  async updatePayment(list: IList, payment: IPayment, updates: any) {
    const { paidBy, isEquallyPaid } = updates;

    // Business logic: validate if paidBy is being updated
    if (paidBy || isEquallyPaid === false) {
      const updatedPaidBy = paidBy ?? payment.paidBy;
      const invalidMembers = this.validatePaidMembers(updatedPaidBy, list.members);
      if (invalidMembers.length > 0)
        throw new AppError(`Some members are not part of this list`, 400);
    }

    // Only update allowed fields
    const allowedFields = ['amount', 'paymentFor', 'isEquallyPaid', 'category', 'paidBy'];
    allowedFields.forEach(field => {
      if (field in updates) {
        (payment as any)[field] = updates[field];
      }
    });

    await payment.save();
    return payment;
  },

  validatePaidMembers(paidBy: IPaidBy[], listMembers: Types.ObjectId[]) {
    const paidMembers = paidBy.map(p => p.member.toString());
    const listMemberIds = listMembers.map(m => m.toString());

    return paidMembers.filter(memberId => !listMemberIds.includes(memberId));
  }
};
