import mongoose from "mongoose";
import { config } from "./environment";

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return; // already connected
  }

  try {
    await mongoose.connect(config.mongoDBURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection error:", err);
    throw err; // do NOT exit process in serverless environments
  }
};
