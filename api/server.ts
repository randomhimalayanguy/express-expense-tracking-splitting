import serverless from "serverless-http";
import app from "../src/app";
import {Response, Request} from 'express';
import { connectDatabase } from "../src/config/database";

let connected = false;

async function connectOnce() {
  if (!connected) {
    await connectDatabase();
    connected = true;
  }
}

export const handler = async (req : Request, res : Response) => {
  await connectOnce();
  const expressHandler = serverless(app);
  return expressHandler(req, res);
};
