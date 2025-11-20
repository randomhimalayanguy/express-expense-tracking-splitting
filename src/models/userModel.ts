import { model } from 'mongoose';
import { IUser } from '../interfaces';
import { userSchema } from '../schemas/userSchema';


export const Users = model<IUser>("User", userSchema);
