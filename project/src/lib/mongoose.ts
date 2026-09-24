import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI não definido no ambiente");
}

const uri = process.env.MONGODB_URI;

const globalForMongoose = globalThis as unknown as {
  _mongooseConn?: Promise<typeof mongoose>;
};

export function connectDB() {
  globalForMongoose._mongooseConn ??= mongoose.connect(uri);
  return globalForMongoose._mongooseConn;
}
