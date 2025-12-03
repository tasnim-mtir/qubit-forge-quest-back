// 🔹 Load environment variables FIRST
import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";

const app = express();

// 🔹 Basic middleware
app.use(cors());
app.use(express.json());

// 🔹 Debug: check all important env vars
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("DATABASE_NAME:", process.env.DATABASE_NAME);
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

const PORT = process.env.PORT || 3000;

// 🔹 Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DATABASE_NAME,
  })
  .then(() => {
    console.log("MongoDB connected");

    // 🔹 Start server only after DB is connected
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB Error:", err);
  });

// 🔹 Routes
app.use("/api/auth", authRoutes);
