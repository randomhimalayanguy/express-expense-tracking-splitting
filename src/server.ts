import express, {Request, Response, NextFunction} from 'express';
import mongoose, {Schema, model, Types} from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {body, validationResult, CustomValidator} from 'express-validator';
import dotenv from 'dotenv';

//------------------- Variables ----------------------------
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoDBURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-splitter';
const SECRET_KEY = process.env.SECRET_KEY || 'Temp-Secret-Key'
//----------------------------------------------------------

// MongoDB connection
mongoose.connect(mongoDBURI)
.then(() => {
  console.log('Database connected');
  app.listen(Number(port), () => console.log(`Server started on: http://localhost:${port}`));
})
.catch((err) => {
  console.log(`Can't connect to database: ${err}`);
  process.exit(1);
});

//---------------------- AppError ----------------------------
class AppError extends Error {
  statusCode: number;
  constructor(err: string, statusCode = 500) {
    super(err);
    this.statusCode = statusCode;
  }
}
//-----------------------------------------------------------

// ===================== SCHEMAS & MODELS ===================

// Enum
enum PaymentCategory {
  Food = "food",
  Travel = "travel",
  Beverages = "beverages",
  Tickets = "tickets",
  Accommodation = "accommodation",
  Personal = "personal",
  Misc = "misc",
}

// Interfaces
interface AuthRequest extends Request {
  user?: { userId: string }
}

interface IMember {
  username: string;
  totalAmt: number;
}

interface IPayable {
  fromUser: string;
  toUser: string;
  amt: number;
}

interface IUser {
  username: string;
  nickname: string;
  password: string;
}

interface IPaidBy {
  member: Types.ObjectId;
  amount: number;
}

interface IPayment extends mongoose.Document {
  listId: Types.ObjectId;
  amount: number;
  paymentFor: string;
  category: PaymentCategory;
  isEquallyPaid: boolean;
  paidBy: IPaidBy[];
}

interface IList extends mongoose.Document {
  name: string;
  totalAmount: number;
  creator: Types.ObjectId;
  shareCode: string;
  members: Types.ObjectId[];
  payments: Types.ObjectId[];
}

// User Schema
const userSchema = new Schema<IUser>({
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

// Payment Schema - MINIMAL, only data validation
const paymentSchema = new Schema<IPayment>(
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

// List Schema
const listSchema = new Schema<IList>({
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

// Models
const Users = model<IUser>("User", userSchema);
const Lists = model<IList>("List", listSchema);
const Payment = model<IPayment>("Payment", paymentSchema);

// ===================== SERVICE LAYER ====================
// Business logic GOES HERE, not in routes or pre-hooks

const PaymentService = {
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

const ListService = {
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

// ===================== UTILITIES ====================

function generateCode(length: number): string {
  const SEQUENCE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SEQUENCE[Math.floor(Math.random() * SEQUENCE.length)];
  }
  return code;
}

async function validateUserAndList(req: AuthRequest) {
  const user = await Users.findById(req.user?.userId);
  if (!user)
    throw new AppError(`User doesn't exist`, 404);

  const listId = req.params.listId;
  const list = await Lists.findOne({ _id: listId, members: user._id });
  if (!list)
    throw new AppError(`List does not exist or you don't have authorization`, 403);

  return { user, list };
}

// ===================== MIDDLEWARE ====================

app.use(express.json());
app.use(cors());

const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return next(new AppError(`No token provided`, 401));

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: string };
    req.user = decoded;
    next();
  } catch (err) {
    next(new AppError(`Can't authenticate: ${err}`, 401));
  }
};

const validationChecker = (req: Request, res: Response, next: NextFunction) => {
  const error = validationResult(req);
  if (!error.isEmpty())
    return next(new AppError(error.array().map(e => e.msg).join(', '), 400));
  next();
}

// ===================== VALIDATORS ====================

const authValidator = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .toLowerCase()
    .withMessage('Username should be a string with at least 6 characters'),

  body('nickname')
    .optional()
    .isString()
    .trim()
    .withMessage('Nickname must be a string'),

  body('password')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password should be a string with at least 6 characters'),

  validationChecker
];

const validateName = [
  body('name').isString().trim().isLength({ min: 3 })
    .withMessage('Name is a string with at least 3 characters'),
  validationChecker
];

const validatePaidByNotEmptyUnlessEqual: CustomValidator = (value: Array<IPaidBy>, { req }) => {
  if (req.body.isEquallyPaid) return true;
  if (!Array.isArray(value) || value.length === 0)
    throw new Error('paidBy must not be empty unless isEquallyPaid is true');
  return true;
};

const validatePayment = [
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

const validatePaymentEdit = [
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

// ===================== ROUTES ====================

app.post('/register', authValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, nickname, password } = req.body;
    const user = await Users.findOne({ username });
    if (user)
      return next(new AppError(`User already exists`, 409));

    const newUser = new Users({ username, nickname, password });
    await newUser.save();

    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.status(201).json({ msg: "User created", userWithoutPassword });
  } catch (err) {
    next(new AppError(`Can't register user: ${err}`, 500));
  }
});

app.post('/login', authValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const user = await Users.findOne({ username }).select('+password');

    if (!user)
      return next(new AppError(`User not found`, 404));

    if (!(await bcrypt.compare(password, user.password)))
      return next(new AppError(`Invalid credentials`, 401));

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "6h" });
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.status(200).json({ msg: "Logged in", userWithoutPassword, token });
  } catch (err) {
    next(new AppError(`Can't login: ${err}`, 500));
  }
});

app.get('/lists', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.get('/lists/:listId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.get('/lists/:listId/spend', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    const ans = await ListService.getAggregatedPayments(list._id as Types.ObjectId);
    res.status(200).json({ msg: "Payment by each member", ans });
  } catch (err) {
    next(new AppError(`Can't retrieve spending: ${err}`, 500));
  }
});

app.get('/lists/:listId/payable', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    const result = await ListService.getAggregatedPayments(list._id as Types.ObjectId);
    const transactions = ListService.calculatePayables(result);
    res.status(200).json({ msg: "Payment to each other", transactions });
  } catch (err) {
    next(new AppError(`Can't load payable: ${err}`, 500));
  }
});

app.post('/lists', validateName, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const newList = new Lists({ name, creator: req.user!.userId });
    await newList.save();
    res.status(201).json({ msg: "List created", newList });
  } catch (err) {
    next(new AppError(`Can't create list: ${err}`, 500));
  }
});

app.post('/lists/:code/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.post('/lists/:listId/payment', validatePayment, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.patch('/lists/:listId', validateName, authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { list } = await validateUserAndList(req);
    list.name = req.body.name;
    await list.save();
    res.status(200).json({ msg: "List updated", list });
  } catch (err) {
    next(new AppError(`Can't edit list: ${err}`, 500));
  }
});

app.patch('/lists/:listId/payment/:paymentId', authenticate, validatePaymentEdit, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.delete('/lists/:listId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

app.delete('/lists/:listId/payment/:paymentId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Error Middleware
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.log(`${err.statusCode}: ${err.message}`);
  res.status(err.statusCode).json({ Error: err.message });
});