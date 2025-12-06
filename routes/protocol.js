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
const REWARD_RATE = 5; // 5% annual rewards
const MIN_TASK_COST = 1; // Minimum CC per task
const MAX_TASK_COST = 10000; // Maximum CC per task
const DEFAULT_TASK_TIMEOUT = 3600; // seconds (1 hour)
const MIN_LEASE_DURATION = 7; // days
const MAX_LEASE_DURATION = 365; // days
const LEASE_RENEWAL_INCENTIVE = 3; // 3% discount

// ===========================
// DASHBOARD OVERVIEW ENDPOINTS
// ===========================

// GET /dashboard/creator-overview - Creator dashboard summary
router.get("/dashboard/creator-overview", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's tasks
    const allTasks = await ComputeTask.find({ creatorId: userId });
    const queuedTasks = allTasks.filter(t => t.status === "queued").length;
    const runningTasks = allTasks.filter(t => t.status === "running").length;
    const completedTasks = allTasks.filter(t => t.status === "completed").length;
    const failedTasks = allTasks.filter(t => t.status === "failed").length;

    // Calculate metrics
    const totalCCSpent = allTasks.reduce((sum, task) => sum + task.computeCostCC, 0);
    const successRate = allTasks.length > 0 ? ((completedTasks / allTasks.length) * 100).toFixed(2) : 0;
    const avgExecutionTime = completedTasks > 0 
      ? Math.round(allTasks.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTasks / 1000)
      : 0;

    // Get CC balance
    const stakes = await Stake.find({ userId, status: "active" });
    const totalCC = stakes.reduce((sum, stake) => sum + stake.computeCreditsReceived, 0);
    const usedCC = allTasks.filter(t => t.status === "completed" || t.status === "running").reduce((sum, t) => sum + t.computeCostCC, 0);
    const ccBalance = totalCC - usedCC;

    res.json({
      success: true,
      overview: {
        taskMetrics: {
          queued: queuedTasks,
          running: runningTasks,
          completed: completedTasks,
          failed: failedTasks,
          total: allTasks.length
        },
        performanceMetrics: {
          successRate: parseFloat(successRate),
          avgExecutionTime,
          totalCCSpent
        },
        ccMetrics: {
          totalCC,
          usedCC,
          available: ccBalance,
          balance: ccBalance
        }
      }
    });
  } catch (err) {
    console.error("CREATOR OVERVIEW ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /dashboard/investor-overview - Investor dashboard summary
router.get("/dashboard/investor-overview", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const userId = req.user.id;

    const leases = await Lease.find({ investorId: userId });
    const activeLeases = leases.filter(l => l.status === "active").length;
    const totalComputeLeased = leases.reduce((sum, lease) => sum + lease.computeAmount, 0);
    const totalCostCC = leases.reduce((sum, lease) => sum + lease.costCC, 0);
    const avgLeaseDuration = leases.length > 0 ? Math.round(leases.reduce((sum, l) => sum + l.duration, 0) / leases.length) : 0;

    // Calculate monthly spending (estimate based on total)
    const monthlySpending = leases.length > 0 ? Math.round((totalCostCC / leases.length) * (activeLeases / leases.length)) : 0;

    res.json({
      success: true,
      overview: {
        leaseMetrics: {
          active: activeLeases,
          total: leases.length,
          expired: leases.filter(l => l.status === "expired").length,
          cancelled: leases.filter(l => l.status === "cancelled").length
        },
        resourceMetrics: {
          totalComputeLeased,
          totalCostCC,
          monthlySpending,
          avgLeaseDuration
        }
      }
    });
  } catch (err) {
    console.error("INVESTOR OVERVIEW ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /dashboard/admin-overview - Admin dashboard summary
router.get("/dashboard/admin-overview", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const stakes = await Stake.find();
    const tasks = await ComputeTask.find();
    let vault = await ComputeVault.findOne();
    if (!vault) vault = await ComputeVault.create({});

    const activeStakes = stakes.filter(s => s.status === "active").length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const failedTasks = tasks.filter(t => t.status === "failed").length;
    const successRate = tasks.length > 0 ? (((completedTasks / tasks.length) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      overview: {
        stakingMetrics: {
          totalQXLocked: vault.totalLockedQX,
          totalCCDistributed: vault.totalComputeCredits,
          activeStakes,
          avgStakeAmount: activeStakes > 0 ? Math.round(vault.totalLockedQX / activeStakes) : 0
        },
        taskMetrics: {
          totalExecuted: vault.totalTasksExecuted,
          completed: completedTasks,
          failed: failedTasks,
          successRate: parseFloat(successRate)
        },
        poolMetrics: {
          rewardPool: vault.rewardPool,
          ccPerQX: QX_TO_CC_RATIO
        }
      }
    });
  } catch (err) {
    console.error("ADMIN OVERVIEW ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// A. STAKING LOGIC (Enhanced)
// ===========================

// POST /stake - Create a stake
router.post("/stake", authMiddleware, async (req, res) => {
  try {
    const { amountQX, lockPeriod } = req.body;

    if (!amountQX || !lockPeriod) {
      return res.status(400).json({ message: "amountQX and lockPeriod are required" });
    }

    if (amountQX <= 0) {
      return res.status(400).json({ message: "amountQX must be greater than 0" });
    }

    if (lockPeriod <= 0) {
      return res.status(400).json({ message: "lockPeriod must be greater than 0 days" });
    }

    const computeCreditsReceived = amountQX * QX_TO_CC_RATIO;

    const stake = await Stake.create({
      userId: req.user.id,
      amountQX,
      computeCreditsReceived,
      lockPeriod,
      status: "active"
    });

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

// GET /stake/user/:id - Get user's stakes with detailed analytics
router.get("/stake/user/:id", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Stake.countDocuments({ userId: req.params.id });
    const stakes = await Stake.find({ userId: req.params.id })
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalStaked = stakes.reduce((sum, stake) => sum + stake.amountQX, 0);
    const totalCC = stakes.reduce((sum, stake) => sum + stake.computeCreditsReceived, 0);
    const activeStakes = stakes.filter(s => s.status === "active").length;

    // Calculate unlock dates
    const stakesWithDates = stakes.map(stake => ({
      ...stake.toObject(),
      unlockDate: new Date(stake.createdAt.getTime() + stake.lockPeriod * 24 * 60 * 60 * 1000)
    }));

    res.json({
      success: true,
      stakes: stakesWithDates,
      summary: {
        totalStaked,
        totalCC,
        activeStakes,
        avgStakeAmount: stakes.length > 0 ? Math.round(totalStaked / stakes.length) : 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET USER STAKES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /stake/all - Get all stakes (admin only) with advanced filtering
router.get("/stake/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { status, minAmount, maxAmount, page = 1, limit = 20, sortBy = "createdAt" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (status && ["active", "released", "claimed"].includes(status)) {
      filter.status = status;
    }
    if (minAmount) filter.amountQX = { ...filter.amountQX, $gte: parseFloat(minAmount) };
    if (maxAmount) filter.amountQX = { ...filter.amountQX, $lte: parseFloat(maxAmount) };

    const totalCount = await Stake.countDocuments(filter);
    const stakes = await Stake.find(filter)
      .populate("userId", "email role")
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(limitNum);

    // Add unlock dates
    const stakesWithDates = stakes.map(stake => ({
      ...stake.toObject(),
      unlockDate: new Date(stake.createdAt.getTime() + stake.lockPeriod * 24 * 60 * 60 * 1000)
    }));

    const totalQXLocked = stakes.reduce((sum, s) => sum + s.amountQX, 0);
    const totalCCDistributed = stakes.reduce((sum, s) => sum + s.computeCreditsReceived, 0);

    res.json({
      success: true,
      stakes: stakesWithDates,
      summary: {
        totalQXLocked,
        totalCCDistributed,
        avgStakeAmount: stakes.length > 0 ? Math.round(totalQXLocked / stakes.length) : 0
      },
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

// PUT /stake/:stakeId/adjust-lock-period - Admin adjust lock period
router.put("/stake/:stakeId/adjust-lock-period", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { newLockPeriod, reason } = req.body;

    if (!newLockPeriod || !reason) {
      return res.status(400).json({ message: "newLockPeriod and reason are required" });
    }

    if (newLockPeriod <= 0) {
      return res.status(400).json({ message: "Lock period must be positive" });
    }

    const stake = await Stake.findById(req.params.stakeId);
    if (!stake) {
      return res.status(404).json({ message: "Stake not found" });
    }

    const oldLockPeriod = stake.lockPeriod;
    stake.lockPeriod = newLockPeriod;
    await stake.save();

    res.json({
      success: true,
      message: "Lock period adjusted successfully",
      change: {
        oldValue: oldLockPeriod,
        newValue: newLockPeriod,
        reason,
        admin: req.user.email,
        timestamp: new Date()
      },
      stake
    });
  } catch (err) {
    console.error("ADJUST LOCK PERIOD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /vault/stats - Get vault statistics with detailed metrics
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
    const totalTasksFailed = await ComputeTask.countDocuments({ status: "failed" });

    const successRate = (vault.totalTasksExecuted > 0) 
      ? ((totalTasksCompleted / vault.totalTasksExecuted) * 100).toFixed(2)
      : 0;

    // Calculate utilization
    const ccUtilization = vault.totalComputeCredits > 0 
      ? Math.round(((vault.totalTasksExecuted * 100) / vault.totalComputeCredits) * 100) / 100
      : 0;

    let poolHealth = "Healthy";
    if (ccUtilization > 80) poolHealth = "Critical";
    else if (ccUtilization > 50) poolHealth = "Warning";

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
        totalTasksFailed,
        successRate: parseFloat(successRate),
        ccPerQX: QX_TO_CC_RATIO,
        ccUtilization,
        poolHealth
      }
    });
  } catch (err) {
    console.error("GET VAULT STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// B. COMPUTE TASK EXECUTION (Enhanced)
// ===========================

// POST /compute-task/create - Create compute task with detailed specs
router.post("/compute-task/create", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const { taskName, taskDescription, computeCostCC, estimatedDuration, priority = "Medium", taskType } = req.body;

    // Validation
    if (!taskName || !computeCostCC) {
      return res.status(400).json({ message: "taskName and computeCostCC are required" });
    }

    if (computeCostCC < MIN_TASK_COST) {
      return res.status(400).json({ message: `Minimum task cost is ${MIN_TASK_COST} CC` });
    }

    if (computeCostCC > MAX_TASK_COST) {
      return res.status(400).json({ message: `Maximum task cost is ${MAX_TASK_COST} CC` });
    }

    // Check CC balance
    const userStakes = await Stake.find({ userId: req.user.id, status: "active" });
    const userTotalCC = userStakes.reduce((sum, stake) => sum + stake.computeCreditsReceived, 0);

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
      taskDescription: taskDescription || "",
      computeCostCC,
      estimatedDuration: estimatedDuration || DEFAULT_TASK_TIMEOUT,
      priority: priority || "Medium",
      taskType: taskType || "General",
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

// GET /compute-task/my-tasks - Get user's compute tasks with analytics
router.get("/compute-task/my-tasks", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status: statusFilter } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = { creatorId: req.user.id };
    if (statusFilter && ["queued", "running", "completed", "failed"].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const totalCount = await ComputeTask.countDocuments(filter);
    const tasks = await ComputeTask.find(filter)
      .populate("creatorId", "email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const allTasks = await ComputeTask.find({ creatorId: req.user.id });
    const statusCount = {
      queued: allTasks.filter(t => t.status === "queued").length,
      running: allTasks.filter(t => t.status === "running").length,
      completed: allTasks.filter(t => t.status === "completed").length,
      failed: allTasks.filter(t => t.status === "failed").length
    };

    const completedTasks = allTasks.filter(t => t.status === "completed");
    const avgExecutionTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTasks.length / 1000)
      : 0;

    res.json({
      success: true,
      tasks,
      statusCount,
      analytics: {
        avgExecutionTime,
        successRate: allTasks.length > 0 ? ((completedTasks.length / allTasks.length) * 100).toFixed(2) : 0,
        totalCCSpent: allTasks.reduce((sum, t) => sum + t.computeCostCC, 0)
      },
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

// GET /compute-task/all - Get all compute tasks (admin only) with advanced filtering
router.get("/compute-task/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { status, minCost, maxCost, page = 1, limit = 20, sortBy = "createdAt" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (status && ["queued", "running", "completed", "failed"].includes(status)) {
      filter.status = status;
    }
    if (minCost) filter.computeCostCC = { ...filter.computeCostCC, $gte: parseFloat(minCost) };
    if (maxCost) filter.computeCostCC = { ...filter.computeCostCC, $lte: parseFloat(maxCost) };

    const totalCount = await ComputeTask.countDocuments(filter);
    const tasks = await ComputeTask.find(filter)
      .populate("creatorId", "email role")
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(limitNum);

    const allTasks = await ComputeTask.find(filter);
    const completedTasks = allTasks.filter(t => t.status === "completed");
    const failedTasks = allTasks.filter(t => t.status === "failed");

    const avgExecutionTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTasks.length / 1000)
      : 0;

    res.json({
      success: true,
      tasks,
      summary: {
        queued: allTasks.filter(t => t.status === "queued").length,
        running: allTasks.filter(t => t.status === "running").length,
        completed: completedTasks.length,
        failed: failedTasks.length,
        totalCCSpent: allTasks.reduce((sum, t) => sum + t.computeCostCC, 0),
        avgExecutionTime,
        successRate: allTasks.length > 0 ? ((completedTasks.length / allTasks.length) * 100).toFixed(2) : 0
      },
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

// PUT /compute-task/:taskId/simulate-complete - Simulate task completion (admin)
router.put("/compute-task/:taskId/simulate-complete", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { result, reason } = req.body;

    const task = await ComputeTask.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.status === "completed" || task.status === "failed") {
      return res.status(400).json({ message: "Task already finalized" });
    }

    task.status = "completed";
    task.result = result || { simulationData: "Task executed successfully", reason: reason || "Admin simulation" };
    await task.save();

    let vault = await ComputeVault.findOne();
    if (!vault) vault = await ComputeVault.create({});
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

// PUT /compute-task/:taskId/force-fail - Force fail a task (admin)
router.put("/compute-task/:taskId/force-fail", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { reason } = req.body;

    const task = await ComputeTask.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.status === "completed" || task.status === "failed") {
      return res.status(400).json({ message: "Task already finalized" });
    }

    task.status = "failed";
    task.result = { error: reason || "Task forcefully failed by admin" };
    await task.save();

    res.json({
      success: true,
      message: "Task marked as failed",
      task
    });
  } catch (err) {
    console.error("FORCE FAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// C. LEASING LOGIC FOR INVESTORS (Enhanced)
// ===========================

// POST /lease - Create lease with detailed specifications
router.post("/lease", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const { computeAmount, costCC, duration, paymentPlan = "monthly" } = req.body;

    // Validation
    if (!computeAmount || !costCC || !duration) {
      return res.status(400).json({ message: "computeAmount, costCC, and duration are required" });
    }

    if (computeAmount <= 0 || costCC <= 0 || duration <= 0) {
      return res.status(400).json({ message: "All amounts must be greater than 0" });
    }

    if (duration < MIN_LEASE_DURATION) {
      return res.status(400).json({ message: `Minimum lease duration is ${MIN_LEASE_DURATION} days` });
    }

    if (duration > MAX_LEASE_DURATION) {
      return res.status(400).json({ message: `Maximum lease duration is ${MAX_LEASE_DURATION} days` });
    }

    const lease = await Lease.create({
      investorId: req.user.id,
      computeAmount,
      costCC,
      duration,
      paymentPlan,
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

// GET /lease/user/:id - Get user's leases with analytics
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

    // Calculate end dates
    const leasesWithEndDates = leases.map(lease => ({
      ...lease.toObject(),
      endDate: new Date(lease.createdAt.getTime() + lease.duration * 24 * 60 * 60 * 1000),
      daysRemaining: Math.ceil((new Date(lease.createdAt.getTime() + lease.duration * 24 * 60 * 60 * 1000) - new Date()) / (1000 * 60 * 60 * 24))
    }));

    const summary = {
      totalComputeLeased: leases.reduce((sum, lease) => sum + lease.computeAmount, 0),
      totalCostCC: leases.reduce((sum, lease) => sum + lease.costCC, 0),
      activeLeases: leases.filter(l => l.status === "active").length,
      expiredLeases: leases.filter(l => l.status === "expired").length,
      avgLeaseDuration: leases.length > 0 ? Math.round(leases.reduce((sum, l) => sum + l.duration, 0) / leases.length) : 0
    };

    res.json({
      success: true,
      leases: leasesWithEndDates,
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

// GET /lease/all - Get all leases (admin only) with advanced filtering
router.get("/lease/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { status, minCost, maxCost, page = 1, limit = 20, sortBy = "createdAt" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (status && ["active", "expired", "cancelled"].includes(status)) {
      filter.status = status;
    }
    if (minCost) filter.costCC = { ...filter.costCC, $gte: parseFloat(minCost) };
    if (maxCost) filter.costCC = { ...filter.costCC, $lte: parseFloat(maxCost) };

    const totalCount = await Lease.countDocuments(filter);
    const leases = await Lease.find(filter)
      .populate("investorId", "email role")
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(limitNum);

    const allLeases = await Lease.find(filter);

    res.json({
      success: true,
      leases,
      summary: {
        active: allLeases.filter(l => l.status === "active").length,
        expired: allLeases.filter(l => l.status === "expired").length,
        cancelled: allLeases.filter(l => l.status === "cancelled").length,
        totalCostCC: allLeases.reduce((sum, l) => sum + l.costCC, 0),
        totalComputeLeased: allLeases.reduce((sum, l) => sum + l.computeAmount, 0)
      },
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

// PUT /lease/:leaseId/extend - Extend an active lease
router.put("/lease/:leaseId/extend", authMiddleware, async (req, res) => {
  try {
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      return res.status(400).json({ message: "additionalDays must be greater than 0" });
    }

    const lease = await Lease.findById(req.params.leaseId);
    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    if (lease.status !== "active") {
      return res.status(400).json({ message: "Only active leases can be extended" });
    }

    const newDuration = lease.duration + additionalDays;
    if (newDuration > MAX_LEASE_DURATION) {
      return res.status(400).json({ message: `Total duration cannot exceed ${MAX_LEASE_DURATION} days` });
    }

    // Calculate renewal discount
    const renewalDiscount = (lease.costCC * LEASE_RENEWAL_INCENTIVE) / 100;
    const additionalCost = (lease.costCC / lease.duration) * additionalDays * (1 - LEASE_RENEWAL_INCENTIVE / 100);

    lease.duration = newDuration;
    lease.costCC += additionalCost;
    await lease.save();

    res.json({
      success: true,
      message: `Lease extended by ${additionalDays} days with ${LEASE_RENEWAL_INCENTIVE}% renewal discount`,
      lease,
      renewalDetails: {
        originalCost: lease.costCC - additionalCost,
        renewalDiscount,
        additionalCost,
        newTotalCost: lease.costCC
      }
    });
  } catch (err) {
    console.error("EXTEND LEASE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// PROTOCOL PARAMETERS (Admin Only)
// ===========================

// GET /parameters - Get all protocol parameters
router.get("/parameters", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    res.json({
      success: true,
      parameters: {
        ccToQX: {
          name: "CC to QX Conversion Rate",
          description: "Number of Compute Credits awarded per staked QX",
          currentValue: QX_TO_CC_RATIO,
          impact: "Affects all future stakes"
        },
        rewardRate: {
          name: "Annual Reward Rate",
          description: "Percentage rewards earned on staked amounts per year",
          currentValue: REWARD_RATE,
          unit: "%"
        },
        taskParameters: {
          minTaskCost: {
            name: "Minimum Task Cost",
            currentValue: MIN_TASK_COST,
            unit: "CC"
          },
          maxTaskCost: {
            name: "Maximum Task Cost",
            currentValue: MAX_TASK_COST,
            unit: "CC"
          },
          defaultTimeout: {
            name: "Default Task Timeout",
            currentValue: DEFAULT_TASK_TIMEOUT,
            unit: "seconds"
          }
        },
        leaseParameters: {
          minDuration: {
            name: "Minimum Lease Duration",
            currentValue: MIN_LEASE_DURATION,
            unit: "days"
          },
          maxDuration: {
            name: "Maximum Lease Duration",
            currentValue: MAX_LEASE_DURATION,
            unit: "days"
          },
          renewalIncentive: {
            name: "Lease Renewal Incentive",
            currentValue: LEASE_RENEWAL_INCENTIVE,
            unit: "%",
            description: "Discount for auto-renewing leases"
          }
        }
      }
    });
  } catch (err) {
    console.error("GET PARAMETERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
