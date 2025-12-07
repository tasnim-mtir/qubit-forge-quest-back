import mongoose from "mongoose";

const roleChangeLogSchema = new mongoose.Schema(
  {
    // The user whose role was changed
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // The admin who made the change
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // The role request that was processed
    roleRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoleRequest",
      required: true
    },

    // Old role before change
    oldRole: {
      type: String,
      required: true
    },

    // New role (only for approvals, null for rejections)
    newRole: {
      type: String,
      default: null
    },

    // Action taken
    action: {
      type: String,
      enum: ["approved", "rejected"],
      required: true
    },

    // Reason (if rejection)
    reason: {
      type: String,
      default: null
    },

    // IP address of admin (optional)
    ipAddress: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index for efficient queries
roleChangeLogSchema.index({ userId: 1, createdAt: -1 });
roleChangeLogSchema.index({ adminId: 1, createdAt: -1 });
roleChangeLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("RoleChangeLog", roleChangeLogSchema);
