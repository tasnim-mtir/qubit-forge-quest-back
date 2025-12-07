import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";
import RoleRequest from "../models/RoleRequest.js";
import RoleChangeLog from "../models/RoleChangeLog.js";

const router = express.Router();

// ===========================
// USER ENDPOINTS
// ===========================

/**
 * POST /role-request/create
 * User creates a request to upgrade their role
 * Only users with role = "user" can request
 * Can only request "creator" or "investor"
 */
router.post("/role-request/create", authMiddleware, async (req, res) => {
  try {
    const { requestedRole, message } = req.body;
    const userId = req.user.id;

    // ===== VALIDATION =====

    // 1. User must have role = "user"
    if (req.user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Only users with 'user' role can request a role upgrade"
      });
    }

    // 2. Requested role must be creator or investor
    if (!["creator", "investor"].includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Can only request 'creator' or 'investor' role"
      });
    }

    // 3. User cannot request the same role they have
    if (req.user.role === requestedRole) {
      return res.status(400).json({
        success: false,
        message: `You already have the '${requestedRole}' role`
      });
    }

    // 4. Check if user already has a pending request
    const existingRequest = await RoleRequest.findOne({
      userId,
      status: "pending"
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending role request. Please wait for admin approval."
      });
    }

    // 5. Check if user has been rejected recently (optional: prevent spam)
    const recentRejection = await RoleRequest.findOne({
      userId,
      status: "rejected",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    if (recentRejection) {
      return res.status(400).json({
        success: false,
        message: "Your recent request was rejected. Please try again later."
      });
    }

    // ===== CREATE REQUEST =====

    const newRequest = await RoleRequest.create({
      userId,
      requestedRole,
      message: message || null
    });

    // ===== POPULATE USER INFO =====
    await newRequest.populate("userId", "email role");

    res.status(201).json({
      success: true,
      message: `Role request to become '${requestedRole}' submitted successfully`,
      roleRequest: {
        _id: newRequest._id,
        userId: newRequest.userId._id,
        userEmail: newRequest.userId.email,
        requestedRole: newRequest.requestedRole,
        message: newRequest.message,
        status: newRequest.status,
        createdAt: newRequest.createdAt
      }
    });

  } catch (err) {
    console.error("CREATE ROLE REQUEST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * GET /role-request/my-request
 * User views their own role request
 */
router.get("/role-request/my-request", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const roleRequest = await RoleRequest.findOne({ userId })
      .populate("userId", "email role")
      .populate("reviewedBy", "email");

    if (!roleRequest) {
      return res.json({
        success: true,
        message: "No role request found",
        roleRequest: null
      });
    }

    res.json({
      success: true,
      roleRequest: {
        _id: roleRequest._id,
        requestedRole: roleRequest.requestedRole,
        message: roleRequest.message,
        status: roleRequest.status,
        createdAt: roleRequest.createdAt,
        reviewedAt: roleRequest.reviewedAt,
        reviewedBy: roleRequest.reviewedBy ? roleRequest.reviewedBy.email : null,
        rejectionReason: roleRequest.rejectionReason
      }
    });

  } catch (err) {
    console.error("GET MY REQUEST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ===========================
// ADMIN ENDPOINTS
// ===========================

/**
 * GET /role-request/pending
 * Admin views all pending role requests
 * Includes pagination and user info
 */
router.get("/role-request/pending", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Fetch pending requests
    const requests = await RoleRequest.find({ status: "pending" })
      .populate("userId", "email role createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Total count
    const total = await RoleRequest.countDocuments({ status: "pending" });

    res.json({
      success: true,
      requests: requests.map(req => ({
        _id: req._id,
        userId: req.userId._id,
        userEmail: req.userId.email,
        userCurrentRole: req.userId.role,
        userCreatedAt: req.userId.createdAt,
        requestedRole: req.requestedRole,
        message: req.message,
        status: req.status,
        createdAt: req.createdAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (err) {
    console.error("GET PENDING REQUESTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * PUT /role-request/:requestId/approve
 * Admin approves a role request
 * Updates user role and marks request as approved
 */
router.put("/role-request/:requestId/approve", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.id;

    // ===== VALIDATION =====

    // 1. Find the request
    const roleRequest = await RoleRequest.findById(requestId).populate("userId");

    if (!roleRequest) {
      return res.status(404).json({
        success: false,
        message: "Role request not found"
      });
    }

    // 2. Can only approve pending requests
    if (roleRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve a ${roleRequest.status} request`
      });
    }

    // ===== UPDATE USER ROLE =====

    const oldRole = roleRequest.userId.role;
    const newRole = roleRequest.requestedRole;

    const updatedUser = await User.findByIdAndUpdate(
      roleRequest.userId._id,
      { role: newRole },
      { new: true }
    );

    // ===== UPDATE ROLE REQUEST =====

    roleRequest.status = "approved";
    roleRequest.reviewedBy = adminId;
    roleRequest.reviewedAt = new Date();
    await roleRequest.save();

    // ===== LOG THE ACTION =====

    await RoleChangeLog.create({
      userId: roleRequest.userId._id,
      adminId,
      roleRequestId: roleRequest._id,
      oldRole,
      newRole,
      action: "approved"
    });

    res.json({
      success: true,
      message: `Role request approved. User ${roleRequest.userId.email} is now a ${newRole}`,
      updatedUser: {
        id: updatedUser._id,
        email: updatedUser.email,
        oldRole,
        newRole: updatedUser.role,
        approvedAt: new Date()
      }
    });

  } catch (err) {
    console.error("APPROVE ROLE REQUEST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * PUT /role-request/:requestId/reject
 * Admin rejects a role request
 * Marks request as rejected, does NOT change user role
 */
router.put("/role-request/:requestId/reject", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    // ===== VALIDATION =====

    // 1. Find the request
    const roleRequest = await RoleRequest.findById(requestId).populate("userId");

    if (!roleRequest) {
      return res.status(404).json({
        success: false,
        message: "Role request not found"
      });
    }

    // 2. Can only reject pending requests
    if (roleRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${roleRequest.status} request`
      });
    }

    // ===== UPDATE ROLE REQUEST =====

    roleRequest.status = "rejected";
    roleRequest.reviewedBy = adminId;
    roleRequest.reviewedAt = new Date();
    roleRequest.rejectionReason = rejectionReason || "No reason provided";
    await roleRequest.save();

    // ===== LOG THE ACTION =====

    await RoleChangeLog.create({
      userId: roleRequest.userId._id,
      adminId,
      roleRequestId: roleRequest._id,
      oldRole: roleRequest.userId.role,
      newRole: null,
      action: "rejected",
      reason: rejectionReason || "No reason provided"
    });

    res.json({
      success: true,
      message: `Role request rejected. User ${roleRequest.userId.email} was notified.`,
      updatedRequest: {
        _id: roleRequest._id,
        status: roleRequest.status,
        rejectionReason: roleRequest.rejectionReason,
        rejectedAt: roleRequest.reviewedAt
      }
    });

  } catch (err) {
    console.error("REJECT ROLE REQUEST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * GET /role-request/count
 * Admin dashboard: Get count of pending requests
 */
router.get("/role-request/count", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const pendingCount = await RoleRequest.countDocuments({ status: "pending" });

    res.json({
      success: true,
      pendingRequests: pendingCount,
      message: `${pendingCount} pending role request${pendingCount !== 1 ? "s" : ""}`
    });

  } catch (err) {
    console.error("GET COUNT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * GET /role-request/history
 * Admin views all role change history
 * Shows approvals and rejections
 */
router.get("/role-request/history", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20, action } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Filter
    const filter = {};
    if (action && ["approved", "rejected"].includes(action)) {
      filter.action = action;
    }

    // Fetch history
    const logs = await RoleChangeLog.find(filter)
      .populate("userId", "email")
      .populate("adminId", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await RoleChangeLog.countDocuments(filter);

    res.json({
      success: true,
      logs: logs.map(log => ({
        _id: log._id,
        userId: log.userId._id,
        userEmail: log.userId.email,
        adminEmail: log.adminId.email,
        oldRole: log.oldRole,
        newRole: log.newRole,
        action: log.action,
        reason: log.reason,
        timestamp: log.createdAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (err) {
    console.error("GET HISTORY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

export default router;
