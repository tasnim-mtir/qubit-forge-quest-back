import mongoose from "mongoose";

const stakeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amountQX: {
      type: Number,
      required: true,
      min: 0
    },
    computeCreditsReceived: {
      type: Number,
      required: true,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    lockPeriod: {
      type: Number, // in days
      required: true
    },
    status: {
      type: String,
      enum: ["active", "released", "claimed"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Stake", stakeSchema);
