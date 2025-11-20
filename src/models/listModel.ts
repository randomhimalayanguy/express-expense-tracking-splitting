import { model } from 'mongoose';
import { IList } from '../interfaces';
import { listSchema } from '../schemas/listSchema';

export const Lists = model<IList>("List", listSchema);