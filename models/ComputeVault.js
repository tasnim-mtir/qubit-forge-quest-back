import mongoose from "mongoose";

const computeVaultSchema = new mongoose.Schema(
  {
    totalLockedQX: {
      type: Number,
      default: 0,
      required: true
    },
    totalComputeCredits: {
      type: Number,
      default: 0,
      required: true
    },
    totalTasksExecuted: {
      type: Number,
      default: 0,
      required: true
    },
    rewardPool: {
      type: Number,
      default: 0,
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("ComputeVault", computeVaultSchema);
