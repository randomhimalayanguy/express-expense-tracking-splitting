import { Types } from 'mongoose';
import { Lists } from '../models/listModel';
import { IMember, IPayable } from '../interfaces';

export const ListService = {
  async getAggregatedPayments(listId: Types.ObjectId) {
    const pipeline = [
      { $match: { _id: listId } },
      { $unwind: "$payments" },
      {
        $lookup: {
          from: "payments",
          localField: "payments",
          foreignField: "_id",
          as: "payment"
        }
      },
      { $unwind: "$payment" },
      { $unwind: "$payment.paidBy" },
      {
        $group: {
          _id: "$payment.paidBy.member",
          totalAmt: { $sum: "$payment.paidBy.amount" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "Payment"
        }
      },
      { $unwind: "$Payment" },
      {
        $project: {
          _id: 0,
          username: "$Payment.username",
          nickname: "$Payment.nickname",
          totalAmt: 1
        }
      },
    ];

    return Lists.aggregate(pipeline);
  },

  calculatePayables(bill: IMember[]): IPayable[] {
    const sum = bill.reduce((acc, member) => acc + member.totalAmt, 0);
    const avg = parseFloat((sum / bill.length).toFixed(2));

    const payments: IMember[] = bill.map(member => ({
      username: member.username,
      totalAmt: member.totalAmt - avg
    }));

    const creditors = payments
      .filter(member => member.totalAmt > 0)
      .sort((a, b) => b.totalAmt - a.totalAmt);

    const debtors = payments
      .filter(member => member.totalAmt < 0)
      .sort((a, b) => a.totalAmt - b.totalAmt);

    const transactions: IPayable[] = [];

    let credIndex = 0, debtIndex = 0;
    while (credIndex < creditors.length && debtIndex < debtors.length) {
      let amt = 0;

      if (creditors[credIndex].totalAmt < Math.abs(debtors[debtIndex].totalAmt)) {
        amt = creditors[credIndex].totalAmt;
        debtors[debtIndex].totalAmt += amt;
        creditors[credIndex].totalAmt = 0;
      } else {
        amt = debtors[debtIndex].totalAmt;
        creditors[credIndex].totalAmt += amt;
        debtors[debtIndex].totalAmt = 0;
      }

      transactions.push({
        fromUser: debtors[debtIndex].username,
        toUser: creditors[credIndex].username,
        amt: Math.abs(amt)
      });

      if (creditors[credIndex].totalAmt === 0) credIndex++;
      if (debtors[debtIndex].totalAmt === 0) debtIndex++;
    }

    return transactions;
  }
};