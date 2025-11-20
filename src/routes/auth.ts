import express, {Request, Response, NextFunction} from 'express';
import { authValidator } from '../validators/authValidator';
import { Users } from '../models/userModel';
import { AppError } from '../utils/errors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';

const router = express.Router();

router.post('/register', authValidator, async (req: Request, res: Response, next: NextFunction) => {
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

router.post('/login', authValidator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const user = await Users.findOne({ username }).select('+password');

    if (!user)
      return next(new AppError(`User not found`, 404));

    if (!(await bcrypt.compare(password, user.password)))
      return next(new AppError(`Invalid credentials`, 401));

    const token = jwt.sign({ userId: user._id }, config.SECRET_KEY, { expiresIn: "6h" });
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.status(200).json({ msg: "Logged in", userWithoutPassword, token });
  } catch (err) {
    next(new AppError(`Can't login: ${err}`, 500));
  }
});


export default router;
