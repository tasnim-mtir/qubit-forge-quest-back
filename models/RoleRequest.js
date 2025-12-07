import mongoose from "mongoose";

const roleRequestSchema = new mongoose.Schema(
  {
    // Reference to the user requesting the role change
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // The role user is requesting
    requestedRole: {
      type: String,
      enum: ["creator", "investor"],
      required: true
    },

    // Optional message from user explaining why they want the role
    message: {
      type: String,
      default: null,
      maxlength: 500
    },

    // Status of the request
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },

    // Admin who approved/rejected (if applicable)
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Timestamp when admin reviewed
    reviewedAt: {
      type: Date,
      default: null
    },

    // Admin's reason for rejection (if rejected)
    rejectionReason: {
      type: String,
      default: null,
      maxlength: 200
    }
  },
  { timestamps: true }
);

// Index for efficient queries
roleRequestSchema.index({ userId: 1, status: 1 });
roleRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("RoleRequest", roleRequestSchema);
