// 🔹 Load environment variables FIRST
import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import protocolRoutes from "./routes/protocol.js";
import roleRequestRoutes from "./routes/roleRequest.js";
import { startComputeTaskProcessor, stopComputeTaskProcessor } from "./services/taskProcessor.js";

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
app.use("/api", roleRequestRoutes);

// 🔹 Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 🔹 Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DATABASE_NAME,
  })
  .then(async () => {
    console.log("✓ MongoDB connected");
    
    const server = app.listen(PORT, async () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
      
      // 🔹 START AUTOMATIC TASK PROCESSOR
      console.log("\n🚀 Starting automatic compute task processor...");
      await startComputeTaskProcessor();
      console.log("✓ Compute task processor is now running\n");
    });
    
    // 🔹 GRACEFUL SHUTDOWN
    const shutdown = async () => {
      console.log("\n🛑 Shutting down server...");
      stopComputeTaskProcessor();
      server.close(() => {
        console.log("✓ Server closed");
        mongoose.connection.close();
        console.log("✓ MongoDB connection closed");
        process.exit(0);
      });
    };
    
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err) => {
    console.error("✗ MongoDB connection failed:", err.message);
    process.exit(1);
  });
