// 🔹 Load environment variables FIRST
import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import protocolRoutes from "./routes/protocol.js";

const app = express();

// 🔹 CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Routes
app.use("/api/auth", authRoutes);
app.use("/api/protocol", protocolRoutes);

// 🔹 Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 🔹 Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DATABASE_NAME,
  })
  .then(() => {
    console.log("✓ MongoDB connected");
    
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    });
  })
  .catch((err) => {
    console.error("✗ MongoDB connection failed:", err.message);
    process.exit(1);
  });
