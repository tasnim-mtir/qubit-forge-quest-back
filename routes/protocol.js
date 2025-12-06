import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";
import Stake from "../models/Stake.js";
import ComputeVault from "../models/ComputeVault.js";
import ComputeTask from "../models/ComputeTask.js";
import Lease from "../models/Lease.js";

const router = express.Router();

const QX_TO_CC_RATIO = 100; // 1 QX = 100 CC

// -------------------------------------------------------
// A. STAKING LOGIC
// -------------------------------------------------------

// POST /stake - Create a stake
router.post("/stake", authMiddleware, async (req, res) => {
  try {
    const { amountQX, lockPeriod } = req.body;

    // Validate input
    if (!amountQX || !lockPeriod) {
      return res.status(400).json({ message: "amountQX and lockPeriod are required" });
    }

    if (amountQX <= 0) {
      return res.status(400).json({ message: "amountQX must be greater than 0" });
    }

    if (lockPeriod <= 0) {
      return res.status(400).json({ message: "lockPeriod must be greater than 0 days" });
    }

    // Calculate CC received (1 QX = 100 CC)
    const computeCreditsReceived = amountQX * QX_TO_CC_RATIO;

    // Create stake
    const stake = await Stake.create({
      userId: req.user.id,
      amountQX,
      computeCreditsReceived,
      lockPeriod,
      status: "active"
    });

    // Update vault
    let vault = await ComputeVault.findOne();
    if (!vault) {
      vault = await ComputeVault.create({});
    }
    vault.totalLockedQX += amountQX;
    vault.totalComputeCredits += computeCreditsReceived;
    await vault.save();

    res.status(201).json({
      success: true,
      message: `Staked ${amountQX} QX and received ${computeCreditsReceived} CC`,
      stake,
      computeCreditsReceived
    });
  } catch (err) {
    console.error("STAKE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /stake/user/:id - Get user's stakes
router.get("/stake/user/:id", authMiddleware, async (req, res) => {
  try {
    const stakes = await Stake.find({ userId: req.params.id }).populate("userId", "email role");

    if (!stakes) {
      return res.status(404).json({ message: "No stakes found" });
    }

    const totalStaked = stakes.reduce((sum, stake) => sum + stake.amountQX, 0);
    const totalCC = stakes.reduce((sum, stake) => sum + stake.computeCreditsReceived, 0);

    res.json({
      success: true,
      stakes,
      summary: {
        totalStaked,
        totalCC,
        activeStakes: stakes.filter(s => s.status === "active").length
      }
    });
  } catch (err) {
    console.error("GET USER STAKES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /stake/all - Get all stakes (admin only)
router.get("/stake/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Stake.countDocuments();
    const stakes = await Stake.find()
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      stakes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET ALL STAKES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /vault/stats - Get vault statistics
router.get("/vault/stats", authMiddleware, async (req, res) => {
  try {
    let vault = await ComputeVault.findOne();
    if (!vault) {
      vault = await ComputeVault.create({});
    }

    const totalStakers = await Stake.distinct("userId");
    const activeStakes = await Stake.countDocuments({ status: "active" });
    const totalTasksQueued = await ComputeTask.countDocuments({ status: "queued" });
    const totalTasksCompleted = await ComputeTask.countDocuments({ status: "completed" });

    res.json({
      success: true,
      vault: {
        totalLockedQX: vault.totalLockedQX,
        totalComputeCredits: vault.totalComputeCredits,
        totalTasksExecuted: vault.totalTasksExecuted,
        rewardPool: vault.rewardPool
      },
      stats: {
        totalStakers: totalStakers.length,
        activeStakes,
        totalTasksQueued,
        totalTasksCompleted,
        ccPerQX: QX_TO_CC_RATIO
      }
    });
  } catch (err) {
    console.error("GET VAULT STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// B. COMPUTE TASK EXECUTION
// -------------------------------------------------------

// POST /compute-task/create - Create compute task (creators only)
router.post("/compute-task/create", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const { taskName, computeCostCC } = req.body;

    // Validate input
    if (!taskName || !computeCostCC) {
      return res.status(400).json({ message: "taskName and computeCostCC are required" });
    }

    if (computeCostCC <= 0) {
      return res.status(400).json({ message: "computeCostCC must be greater than 0" });
    }

    // Check user's total CC from stakes
    const userStakes = await Stake.find({ userId: req.user.id, status: "active" });
    const userTotalCC = userStakes.reduce((sum, stake) => sum + stake.computeCreditsReceived, 0);

    // Get user's used CC from completed tasks
    const userTasks = await ComputeTask.find({ creatorId: req.user.id });
    const usedCC = userTasks.reduce((sum, task) => {
      return sum + (task.status === "completed" || task.status === "running" ? task.computeCostCC : 0);
    }, 0);

    const availableCC = userTotalCC - usedCC;

    if (availableCC < computeCostCC) {
      return res.status(400).json({
        message: `Insufficient CC. Available: ${availableCC}, Required: ${computeCostCC}`
      });
    }

    // Create task
    const task = await ComputeTask.create({
      creatorId: req.user.id,
      taskName,
      computeCostCC,
      status: "queued"
    });

    res.status(201).json({
      success: true,
      message: "Compute task created successfully",
      task,
      userCCStatus: {
        totalCC: userTotalCC,
        usedCC: usedCC + computeCostCC,
        availableCC: availableCC - computeCostCC
      }
    });
  } catch (err) {
    console.error("CREATE COMPUTE TASK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /compute-task/my-tasks - Get user's compute tasks
router.get("/compute-task/my-tasks", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await ComputeTask.countDocuments({ creatorId: req.user.id });
    const tasks = await ComputeTask.find({ creatorId: req.user.id })
      .populate("creatorId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const statusCount = {
      queued: tasks.filter(t => t.status === "queued").length,
      running: tasks.filter(t => t.status === "running").length,
      completed: tasks.filter(t => t.status === "completed").length,
      failed: tasks.filter(t => t.status === "failed").length
    };

    res.json({
      success: true,
      tasks,
      statusCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET MY TASKS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /compute-task/all - Get all compute tasks (admin only)
router.get("/compute-task/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (status && ["queued", "running", "completed", "failed"].includes(status)) {
      filter.status = status;
    }

    const totalCount = await ComputeTask.countDocuments(filter);
    const tasks = await ComputeTask.find(filter)
      .populate("creatorId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET ALL TASKS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /compute-task/simulate-complete - Simulate task completion (admin only)
router.put("/compute-task/simulate-complete", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { taskId, result } = req.body;

    if (!taskId) {
      return res.status(400).json({ message: "taskId is required" });
    }

    const task = await ComputeTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.status === "completed" || task.status === "failed") {
      return res.status(400).json({ message: "Task already finalized" });
    }

    // Update task
    task.status = "completed";
    task.result = result || { simulationData: "Task executed successfully" };
    await task.save();

    // Update vault
    let vault = await ComputeVault.findOne();
    if (!vault) {
      vault = await ComputeVault.create({});
    }
    vault.totalTasksExecuted += 1;
    await vault.save();

    res.json({
      success: true,
      message: "Task completed successfully",
      task
    });
  } catch (err) {
    console.error("SIMULATE COMPLETE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// C. LEASING LOGIC FOR INVESTORS
// -------------------------------------------------------

// POST /lease - Create lease (investors only)
router.post("/lease", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const { computeAmount, costCC, duration } = req.body;

    // Validate input
    if (!computeAmount || !costCC || !duration) {
      return res.status(400).json({ message: "computeAmount, costCC, and duration are required" });
    }

    if (computeAmount <= 0 || costCC <= 0 || duration <= 0) {
      return res.status(400).json({ message: "All amounts must be greater than 0" });
    }

    // Create lease
    const lease = await Lease.create({
      investorId: req.user.id,
      computeAmount,
      costCC,
      duration,
      status: "active"
    });

    res.status(201).json({
      success: true,
      message: "Lease created successfully",
      lease
    });
  } catch (err) {
    console.error("CREATE LEASE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /lease/user/:id - Get user's leases
router.get("/lease/user/:id", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Lease.countDocuments({ investorId: req.params.id });
    const leases = await Lease.find({ investorId: req.params.id })
      .populate("investorId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const summary = {
      totalComputeLeased: leases.reduce((sum, lease) => sum + lease.computeAmount, 0),
      totalCostCC: leases.reduce((sum, lease) => sum + lease.costCC, 0),
      activeLeases: leases.filter(l => l.status === "active").length
    };

    res.json({
      success: true,
      leases,
      summary,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET USER LEASES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /lease/all - Get all leases (admin only)
router.get("/lease/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (status && ["active", "expired", "cancelled"].includes(status)) {
      filter.status = status;
    }

    const totalCount = await Lease.countDocuments(filter);
    const leases = await Lease.find(filter)
      .populate("investorId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      leases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET ALL LEASES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
