import express, {Request, Response, NextFunction} from 'express';
import { Types } from 'mongoose';
import { Lists } from '../models/listModel';
import { Payment } from '../models/paymentModel';
import { AppError } from '../utils/errors';
import { AuthRequest } from '../interfaces';
import { ListService } from '../services/ListService';
import { PaymentService } from '../services/PaymentService';
import { authenticate } from '../middleware/authMiddleware';
import { validateUserAndList } from '../validators/userListValidator';
import { validateName } from '../validators/listValidator';
import { validatePayment, validatePaymentEdit } from '../validators/paymentValidator';


const router = express.Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const lists = await Lists.find({ members: req.user!.userId })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('members', 'username nickname')
      .populate('payments');

    res.status(200).json({ msg: "Lists retrieved", lists });
  } catch (err) {
    next(new AppError(`Can't retrieve data: ${err}`, 500));
  }
});

router.get('/:listId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);

    await list.populate('members', 'username nickname');
    await list.populate({
      path: 'payments',
      populate: {
        path: 'paidBy.member',
        model: 'User',
        select: 'username nickname'
      }
    });

    res.status(200).json({ msg: "List retrieved", list });
  } catch (err) {
    next(new AppError(`Can't retrieve list: ${err}`, 500));
  }
});

router.get('/:listId/spend', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    const ans = await ListService.getAggregatedPayments(list._id as Types.ObjectId);
    res.status(200).json({ msg: "Payment by each member", ans });
  } catch (err) {
    next(new AppError(`Can't retrieve spending: ${err}`, 500));
  }
});

router.get('/:listId/payable', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    const result = await ListService.getAggregatedPayments(list._id as Types.ObjectId);
    const transactions = ListService.calculatePayables(result);
    res.status(200).json({ msg: "Payment to each other", transactions });
  } catch (err) {
    next(new AppError(`Can't load payable: ${err}`, 500));
  }
});

router.post('/', validateName, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const newList = new Lists({ name, creator: req.user!.userId });
    await newList.save();
    res.status(201).json({ msg: "List created", newList });
  } catch (err) {
    next(new AppError(`Can't create list: ${err}`, 500));
  }
});

router.post('/:code/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = req.params.code;
    const list = await Lists.findOne({ shareCode: code });
    if (!list)
      return next(new AppError(`No list with this code`, 404));

    if (list.members.includes(new Types.ObjectId(req.user!.userId))) {
      return res.status(200).json({ msg: "Already member", list });
    }

    list.members.push(new Types.ObjectId(req.user!.userId));
    await list.save();

    res.status(200).json({ msg: "Joined the list", list });
  } catch (err) {
    next(new AppError(`Can't join list: ${err}`, 500));
  }
});


router.patch('/:listId', validateName, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    list.name = req.body.name;
    await list.save();
    res.status(200).json({ msg: "List updated", list });
  } catch (err) {
    next(new AppError(`Can't edit list: ${err}`, 500));
  }
});


router.delete('/:listId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listId = req.params.listId;
    const list = await Lists.findOne({ _id: listId, creator: req.user!.userId });
    if (!list)
      return next(new AppError(`No authorization to delete list`, 403));

    await list.deleteOne();
    res.status(200).json({ msg: "List deleted" });
  } catch (err) {
    next(new AppError(`Can't delete list: ${err}`, 500));
  }
});


router.post('/:listId/payment', validatePayment, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);

    // Service layer handles ALL business logic
    const payment = await PaymentService.createPayment(list, req.body);

    list.payments.push(payment._id as Types.ObjectId);
    await list.save();

    res.status(201).json({ msg: "Payment created", payment });
  } catch (err) {
    next(new AppError(`Can't post payment: ${err}`, 500));
  }
});


router.patch('/:listId/payment/:paymentId', authenticate, validatePaymentEdit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);

    const paymentId = req.params.paymentId;
    const payment = await Payment.findById(paymentId);
    if (!payment || !list.payments.includes(payment._id as Types.ObjectId))
      return next(new AppError(`Payment doesn't exist`, 404));

    // Service layer handles validation and update logic
    const updatedPayment = await PaymentService.updatePayment(list, payment, req.body);

    res.status(200).json({ msg: "Payment updated", updatedPayment });
  } catch (err) {
    next(new AppError(`Can't edit payment: ${err}`, 500));
  }
});



router.delete('/:listId/payment/:paymentId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    const paymentId = req.params.paymentId;
    const payment = await Payment.findById(paymentId);

    if (!payment || !list.payments.includes(payment._id as Types.ObjectId))
      return next(new AppError(`No payment with this id`, 404));

    await Lists.findByIdAndUpdate(list._id, [
      { $set: { totalAmount: { $max: [{ $subtract: ["$totalAmount", payment.amount] }, 0] } } }
    ]);

    await payment.deleteOne();
    res.status(200).json({ msg: "Payment deleted" });
  } catch (err) {
    next(new AppError(`Can't delete payment: ${err}`, 500));
  }
});



export default router;
