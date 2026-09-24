import mongoose from "mongoose";

import logger from "./logger.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.fatal({ err: error }, "Database connection failed");
    process.exit(1);
  }
};

export default connectDB;