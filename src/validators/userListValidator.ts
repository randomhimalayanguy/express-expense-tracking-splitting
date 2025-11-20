import { AuthRequest } from "../interfaces";
import { Users } from "../models/userModel";
import { AppError } from "../utils/errors";
import { Lists } from "../models/listModel";


export async function validateUserAndList(req: AuthRequest) {
  const user = await Users.findById(req.user?.userId);
  if (!user)
    throw new AppError(`User doesn't exist`, 404);

  const listId = req.params.listId;
  const list = await Lists.findOne({ _id: listId, members: user._id });
  if (!list)
    throw new AppError(`List does not exist or you don't have authorization`, 403);

  return { user, list };
}