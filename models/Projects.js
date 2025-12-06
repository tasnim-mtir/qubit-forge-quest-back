import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    logoUrl: { type: String, required: false },

    // IDO financial information
    targetRaise: { type: Number, required: true }, // total amount required
    tokenPrice: { type: Number, required: true },  // price per token, example: 0.01

    // IDO timeline
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Project status
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "live", "ended"],
      default: "pending"
    },

    // Optional: creator reference
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
