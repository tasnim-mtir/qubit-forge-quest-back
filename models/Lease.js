import mongoose from "mongoose";

const leaseSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    computeAmount: {
      type: Number,
      required: true,
      min: 0
    },
    costCC: {
      type: Number,
      required: true,
      min: 0
    },
    duration: {
      type: Number, // in days
      required: true
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Lease", leaseSchema);
