import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // ROLE FIELD
    role: {
      type: String,
      enum: ["user", "admin", "creator", "investor"],
      default: "user"
    },

    // STATUS FIELD
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
