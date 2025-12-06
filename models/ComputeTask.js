import mongoose from "mongoose";

const computeTaskSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    taskName: {
      type: String,
      required: true
    },
    taskDescription: {
      type: String,
      default: ""
    },
    computeCostCC: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedDuration: {
      type: Number,
      default: 3600,
      description: "Estimated duration in seconds"
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },
    taskType: {
      type: String,
      enum: ["DataAnalysis", "Training", "Processing", "General", "Other"],
      default: "General"
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      default: "queued"
    },
    // ===== NEW EXECUTION TRACKING FIELDS =====
    startedAt: {
      type: Date,
      default: null,
      description: "Timestamp when task started executing"
    },
    finishedAt: {
      type: Date,
      default: null,
      description: "Timestamp when task completed or failed"
    },
    actualDuration: {
      type: Number,
      default: null,
      description: "Actual execution duration in seconds"
    },
    executionLog: [
      {
        timestamp: { type: Date, default: Date.now },
        event: String,
        details: mongoose.Schema.Types.Mixed
      }
    ],
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    // ===== AUTO-EXECUTION TRACKING =====
    autoExecutedAt: {
      type: Date,
      default: null,
      description: "When the auto-executor picked up this task"
    },
    executionAttempts: {
      type: Number,
      default: 0,
      description: "Number of times this task has been attempted"
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster queries in task processor
computeTaskSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("ComputeTask", computeTaskSchema);
