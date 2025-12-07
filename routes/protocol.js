import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";
import Stake from "../models/Stake.js";
import ComputeVault from "../models/ComputeVault.js";
import ComputeTask from "../models/ComputeTask.js";
import Lease from "../models/Lease.js";
import { getProcessorStats } from "../services/taskProcessor.js";

const router = express.Router();

// ===========================
// PROTOCOL PARAMETERS (Mutable)
// ===========================
let protocolParams = {
  QX_TO_CC_RATIO: 100,
  REWARD_RATE: 5,
  MIN_TASK_COST: 1,
  MAX_TASK_COST: 10000,
  DEFAULT_TASK_TIMEOUT: 3600,
  MIN_LEASE_DURATION: 7,
  MAX_LEASE_DURATION: 365,
  LEASE_RENEWAL_INCENTIVE: 3,
  MIN_COMPUTE_AMOUNT: 10,
  MAX_COMPUTE_AMOUNT: 10000
};

// Audit log for parameter changes
let parameterAuditLog = [];

// Helper function to add audit entry
const addAuditEntry = (adminEmail, paramName, oldValue, newValue, reason) => {
  parameterAuditLog.push({
    timestamp: new Date(),
    admin: adminEmail,
    parameter: paramName,
    oldValue,
    newValue,
    reason: reason || "No reason provided",
    id: Date.now() + Math.random()
  });
  // Keep only last 100 entries
  if (parameterAuditLog.length > 100) {
    parameterAuditLog = parameterAuditLog.slice(-100);
  }
};

// Destructure for backward compatibility
const {
  QX_TO_CC_RATIO,
  REWARD_RATE,
  MIN_TASK_COST,
  MAX_TASK_COST,
  DEFAULT_TASK_TIMEOUT,
  MIN_LEASE_DURATION,
  MAX_LEASE_DURATION,
  LEASE_RENEWAL_INCENTIVE,
  MIN_COMPUTE_AMOUNT,
  MAX_COMPUTE_AMOUNT
} = protocolParams;

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
// Calculate TRUE CC utilization (based on total CC spent by tasks)
const allCompletedTasks = await ComputeTask.find({ status: "completed" });


// Total CC consumed by completed tasks
const totalCCSpent = allCompletedTasks.reduce(
  (sum, task) => sum + (task.computeCostCC || 0),
  0
);

// Correct CC Utilization formula
const ccUtilization =
  vault.totalComputeCredits > 0
    ? Math.round((totalCCSpent / vault.totalComputeCredits) * 10000) / 100 // 2 decimals
    : 0;


// Pool health based on utilization
let poolHealth = "Healthy";
if (ccUtilization > 80) poolHealth = "Critical";
else if (ccUtilization > 50) poolHealth = "Warning";
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
          ccPerQX: protocolParams.QX_TO_CC_RATIO
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

    const computeCreditsReceived = amountQX * protocolParams.QX_TO_CC_RATIO;

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
// GET /vault/stats - Get vault statistics with detailed metrics
router.get("/vault/stats", authMiddleware, async (req, res) => {
  try {
    // Load vault (or create)
    let vault = await ComputeVault.findOne();
    if (!vault) {
      vault = await ComputeVault.create({});
    }

    // Global stats
    const totalStakers = await Stake.distinct("userId");
    const activeStakes = await Stake.countDocuments({ status: "active" });
    const totalTasksQueued = await ComputeTask.countDocuments({ status: "queued" });
    const totalTasksCompleted = await ComputeTask.countDocuments({ status: "completed" });
    const totalTasksFailed = await ComputeTask.countDocuments({ status: "failed" });

    // Success rate
    const successRate =
      vault.totalTasksExecuted > 0
        ? ((totalTasksCompleted / vault.totalTasksExecuted) * 100).toFixed(2)
        : 0;

    // ============================
    //  CORRECT CC UTILIZATION
    // ============================

    // 1. Get all completed tasks
    const completedTasks = await ComputeTask.find({ status: "completed" });

    // 2. Total CC consumed by real task execution
    const totalCCSpent = completedTasks.reduce(
      (sum, task) => sum + (task.computeCostCC || 0),
      0
    );

    // 3. Proper utilization formula
    const ccUtilization =
      vault.totalComputeCredits > 0
        ? Math.round((totalCCSpent / vault.totalComputeCredits) * 10000) / 100 // → 2 decimal %
        : 0;

    // 4. Pool health status
    let poolHealth = "Healthy";
    if (ccUtilization > 80) poolHealth = "Critical";
    else if (ccUtilization > 50) poolHealth = "Warning";

    // Send response
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
        ccPerQX: protocolParams.QX_TO_CC_RATIO,
        totalCCSpent,
        ccUtilization, // <-- FIXED
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

    if (computeCostCC < protocolParams.MIN_TASK_COST) {
      return res.status(400).json({ message: `Minimum task cost is ${protocolParams.MIN_TASK_COST} CC` });
    }

    if (computeCostCC > protocolParams.MAX_TASK_COST) {
      return res.status(400).json({ message: `Maximum task cost is ${protocolParams.MAX_TASK_COST} CC` });
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
      estimatedDuration: estimatedDuration || protocolParams.DEFAULT_TASK_TIMEOUT,
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

// Add reward to pool
const reward = task.computeCostCC * (protocolParams.REWARD_RATE / 100);
vault.rewardPool += reward;

await vault.save();

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

    if (duration < protocolParams.MIN_LEASE_DURATION) {
      return res.status(400).json({ message: `Minimum lease duration is ${protocolParams.MIN_LEASE_DURATION} days` });
    }

    if (duration > protocolParams.MAX_LEASE_DURATION) {
      return res.status(400).json({ message: `Maximum lease duration is ${protocolParams.MAX_LEASE_DURATION} days` });
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
    if (newDuration > protocolParams.MAX_LEASE_DURATION) {
      return res.status(400).json({ message: `Total duration cannot exceed ${protocolParams.MAX_LEASE_DURATION} days` });
    }

    // Calculate renewal discount
    const renewalDiscount = (lease.costCC * protocolParams.LEASE_RENEWAL_INCENTIVE) / 100;
    const additionalCost = (lease.costCC / lease.duration) * additionalDays * (1 - protocolParams.LEASE_RENEWAL_INCENTIVE / 100);

    lease.duration = newDuration;
    lease.costCC += additionalCost;
    await lease.save();

    res.json({
      success: true,
      message: `Lease extended by ${additionalDays} days with ${protocolParams.LEASE_RENEWAL_INCENTIVE}% renewal discount`,
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
          currentValue: protocolParams.QX_TO_CC_RATIO,
          impact: "Affects all future stakes"
        },
        rewardRate: {
          name: "Annual Reward Rate",
          description: "Percentage rewards earned on staked amounts per year",
          currentValue: protocolParams.REWARD_RATE,
          unit: "%"
        },
        taskParameters: {
          minTaskCost: {
            name: "Minimum Task Cost",
            currentValue: protocolParams.MIN_TASK_COST,
            unit: "CC"
          },
          maxTaskCost: {
            name: "Maximum Task Cost",
            currentValue: protocolParams.MAX_TASK_COST,
            unit: "CC"
          },
          defaultTimeout: {
            name: "Default Task Timeout",
            currentValue: protocolParams.DEFAULT_TASK_TIMEOUT,
            unit: "seconds"
          }
        },
        leaseParameters: {
          minDuration: {
            name: "Minimum Lease Duration",
            currentValue: protocolParams.MIN_LEASE_DURATION,
            unit: "days"
          },
          maxDuration: {
            name: "Maximum Lease Duration",
            currentValue: protocolParams.MAX_LEASE_DURATION,
            unit: "days"
          },
          renewalIncentive: {
            name: "Lease Renewal Incentive",
            currentValue: protocolParams.LEASE_RENEWAL_INCENTIVE,
            unit: "%",
            description: "Discount for auto-renewing leases"
          }
        },
        computeMarketplaceParameters: {
          minComputeAmount: {
            name: "Minimum Compute Amount",
            currentValue: protocolParams.MIN_COMPUTE_AMOUNT,
            unit: "units"
          },
          maxComputeAmount: {
            name: "Maximum Compute Amount",
            currentValue: protocolParams.MAX_COMPUTE_AMOUNT,
            unit: "units"
          }
        }
      }
    });
  } catch (err) {
    console.error("GET PARAMETERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /parameters/:paramName - Update a specific parameter (Admin only)
router.put("/parameters/:paramName", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { newValue, reason } = req.body;
    const paramName = req.params.paramName;

    if (newValue === undefined || newValue === null) {
      return res.status(400).json({ message: "newValue is required" });
    }

    if (typeof newValue !== "number" || newValue <= 0) {
      return res.status(400).json({ message: "newValue must be a positive number" });
    }

    // Validate parameter exists
    const validParams = [
      "QX_TO_CC_RATIO",
      "REWARD_RATE",
      "MIN_TASK_COST",
      "MAX_TASK_COST",
      "DEFAULT_TASK_TIMEOUT",
      "MIN_LEASE_DURATION",
      "MAX_LEASE_DURATION",
      "LEASE_RENEWAL_INCENTIVE",
      "MIN_COMPUTE_AMOUNT",
      "MAX_COMPUTE_AMOUNT"
    ];

    if (!validParams.includes(paramName)) {
      return res.status(400).json({ message: `Invalid parameter name: ${paramName}` });
    }

    const oldValue = protocolParams[paramName];
    protocolParams[paramName] = newValue;

    // Add audit entry
    addAuditEntry(req.user.email, paramName, oldValue, newValue, reason);

    res.json({
      success: true,
      message: `Parameter ${paramName} updated successfully`,
      change: {
        parameter: paramName,
        oldValue,
        newValue,
        reason: reason || "No reason provided",
        admin: req.user.email,
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error("UPDATE PARAMETER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /parameters/audit-log - View parameter change history
router.get("/parameters/audit-log", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    const sortedLog = [...parameterAuditLog].reverse();
    const totalCount = sortedLog.length;
    const start = (pageNum - 1) * limitNum;
    const paginatedLog = sortedLog.slice(start, start + limitNum);

    res.json({
      success: true,
      auditLog: paginatedLog,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET AUDIT LOG ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// TASK MANAGEMENT ENHANCEMENTS
// ===========================

// POST /compute-task/:taskId/cancel - Cancel a queued task (Creator)
router.post("/compute-task/:taskId/cancel", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const task = await ComputeTask.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this task" });
    }

    if (task.status !== "queued") {
      return res.status(400).json({ message: "Only queued tasks can be cancelled" });
    }

    task.status = "cancelled";
    task.result = { cancelled: true, cancelledAt: new Date(), reason: "Cancelled by creator" };
    await task.save();

    res.json({
      success: true,
      message: "Task cancelled successfully",
      task
    });
  } catch (err) {
    console.error("CANCEL TASK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /compute-task/queue/status - Get detailed queue status for creator
router.get("/compute-task/queue/status", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const userTasks = await ComputeTask.find({ creatorId: req.user.id }).sort({ createdAt: 1 });
    const queuedTasks = userTasks.filter(t => t.status === "queued");

    // Get all queued tasks globally to determine position
    const allQueuedTasks = await ComputeTask.find({ status: "queued" }).sort({ createdAt: 1 });
    const userPositions = queuedTasks.map(task => {
      const position = allQueuedTasks.findIndex(t => t._id.toString() === task._id.toString()) + 1;
      return { taskId: task._id, taskName: task.taskName, position };
    });

    // Calculate average execution time for completed tasks
    const completedTasks = userTasks.filter(t => t.status === "completed");
    const avgExecutionTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTasks.length / 1000)
      : 0;

    res.json({
      success: true,
      queueStatus: {
        userQueuedCount: queuedTasks.length,
        globalQueuedCount: allQueuedTasks.length,
        userTasks: userPositions,
        estimatedWaitTime: userPositions.length > 0 
          ? Math.ceil((avgExecutionTime * userPositions.length) / 60) + " minutes"
          : "No tasks in queue"
      }
    });
  } catch (err) {
    console.error("GET QUEUE STATUS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// LEASE MANAGEMENT ENHANCEMENTS
// ===========================

// POST /lease/:leaseId/cancel - Cancel an active lease (Investor)
router.post("/lease/:leaseId/cancel", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const lease = await Lease.findById(req.params.leaseId);

    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    if (lease.investorId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this lease" });
    }

    if (lease.status !== "active") {
      return res.status(400).json({ message: "Only active leases can be cancelled" });
    }

    lease.status = "cancelled";
    await lease.save();

    res.json({
      success: true,
      message: "Lease cancelled successfully",
      lease
    });
  } catch (err) {
    console.error("CANCEL LEASE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// COMPUTE MARKETPLACE
// ===========================

// GET /marketplace/compute - Browse available compute packages
router.get("/marketplace/compute", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const { minCompute, maxCompute, minCost, maxCost, minDuration, maxDuration, sortBy = "cost", page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Generate marketplace packages based on protocol parameters
    const packages = [];
    
    for (let compute = protocolParams.MIN_COMPUTE_AMOUNT; compute <= protocolParams.MAX_COMPUTE_AMOUNT; compute += 50) {
      for (let duration = protocolParams.MIN_LEASE_DURATION; duration <= protocolParams.MAX_LEASE_DURATION; duration += 10) {
        const costPerDay = (compute / 100); // Simplified pricing
        const totalCost = Math.round(costPerDay * duration);
        
        packages.push({
          id: `pkg_${compute}_${duration}`,
          computeAmount: compute,
          costCC: totalCost,
          costPerDay: costPerDay.toFixed(2),
          duration,
          provider: `Provider_${Math.floor(compute / 100)}`,
          reputation: (4 + Math.random()).toFixed(1),
          available: 100,
          description: `${compute} compute units for ${duration} days`
        });
      }
    }

    // Apply filters
    let filtered = packages;

    if (minCompute) {
      filtered = filtered.filter(p => p.computeAmount >= parseInt(minCompute));
    }
    if (maxCompute) {
      filtered = filtered.filter(p => p.computeAmount <= parseInt(maxCompute));
    }
    if (minCost) {
      filtered = filtered.filter(p => p.costCC >= parseInt(minCost));
    }
    if (maxCost) {
      filtered = filtered.filter(p => p.costCC <= parseInt(maxCost));
    }
    if (minDuration) {
      filtered = filtered.filter(p => p.duration >= parseInt(minDuration));
    }
    if (maxDuration) {
      filtered = filtered.filter(p => p.duration <= parseInt(maxDuration));
    }

    // Apply sorting
    if (sortBy === "cost") {
      filtered.sort((a, b) => a.costCC - b.costCC);
    } else if (sortBy === "reputation") {
      filtered.sort((a, b) => b.reputation - a.reputation);
    } else if (sortBy === "compute") {
      filtered.sort((a, b) => b.computeAmount - a.computeAmount);
    }

    const totalCount = filtered.length;
    const paginatedPackages = filtered.slice(skip, skip + limitNum);

    res.json({
      success: true,
      packages: paginatedPackages,
      filters: {
        minComputeAvailable: protocolParams.MIN_COMPUTE_AMOUNT,
        maxComputeAvailable: protocolParams.MAX_COMPUTE_AMOUNT,
        minDurationAvailable: protocolParams.MIN_LEASE_DURATION,
        maxDurationAvailable: protocolParams.MAX_LEASE_DURATION,
        applied: {
          minCompute: minCompute ? parseInt(minCompute) : null,
          maxCompute: maxCompute ? parseInt(maxCompute) : null,
          minCost: minCost ? parseInt(minCost) : null,
          maxCost: maxCost ? parseInt(maxCost) : null,
          minDuration: minDuration ? parseInt(minDuration) : null,
          maxDuration: maxDuration ? parseInt(maxDuration) : null
        }
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error("GET MARKETPLACE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// ANALYTICS & METRICS
// ===========================

// GET /analytics/cc-price-history - Historical CC price data
router.get("/analytics/cc-price-history", authMiddleware, async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;
    
    // Generate historical data
    const now = new Date();
    const dataPoints = [];
    const intervals = timeframe === "24h" ? 24 : timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 365;
    const intervalMs = timeframe === "24h" ? 3600000 : timeframe === "7d" ? 86400000 : timeframe === "30d" ? 86400000 : 86400000;

    for (let i = intervals - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * intervalMs));
      const basePrice = protocolParams.QX_TO_CC_RATIO;
      const variation = (Math.random() - 0.5) * 20; // ±10% variation
      const price = basePrice + variation;
      
      dataPoints.push({
        timestamp: time,
        price: Math.max(80, Math.min(120, price)),
        cc: Math.round(100 / price * 100)
      });
    }

    const currentPrice = dataPoints[dataPoints.length - 1].price;
    const previousPrice = dataPoints[Math.max(0, dataPoints.length - 2)].price;
    const changePercent = ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);

    res.json({
      success: true,
      priceData: dataPoints,
      summary: {
        current: currentPrice.toFixed(2),
        change24h: changePercent,
        high: Math.max(...dataPoints.map(d => d.price)).toFixed(2),
        low: Math.min(...dataPoints.map(d => d.price)).toFixed(2),
        volume: Math.round(Math.random() * 100000)
      },
      timeframe
    });
  } catch (err) {
    console.error("GET PRICE HISTORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /analytics/network-metrics - Global network health metrics
router.get("/analytics/network-metrics", authMiddleware, async (req, res) => {
  try {
    const vault = await ComputeVault.findOne() || await ComputeVault.create({});
    const allTasks = await ComputeTask.find();
    const allStakes = await Stake.find();
    const allLeases = await Lease.find();
    const allUsers = await User.find();

    const completedTasks = allTasks.filter(t => t.status === "completed").length;
    const failedTasks = allTasks.filter(t => t.status === "failed").length;
    const totalTasks = completedTasks + failedTasks;
    const successRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

    const totalCCSpent = allTasks.reduce((sum, t) => sum + t.computeCreditsReceived, 0);
    const ccBurnRate = totalCCSpent > 0 ? (totalCCSpent / allTasks.length).toFixed(2) : 0;

    const creators = allUsers.filter(u => u.role === "creator").length;
    const investors = allUsers.filter(u => u.role === "investor").length;
    const admins = allUsers.filter(u => u.role === "admin").length;

    res.json({
      success: true,
      networkMetrics: {
        taskMetrics: {
          total: allTasks.length,
          completed: completedTasks,
          failed: failedTasks,
          queued: allTasks.filter(t => t.status === "queued").length,
          running: allTasks.filter(t => t.status === "running").length,
          successRate: parseFloat(successRate)
        },
        economyMetrics: {
          totalQXLocked: vault.totalLockedQX,
          totalCCInCirculation: vault.totalComputeCredits,
          ccBurnRate: parseFloat(ccBurnRate),
          rewardPool: vault.rewardPool,
          avgStakeSize: allStakes.length > 0 ? (vault.totalLockedQX / allStakes.length).toFixed(2) : 0
        },
        participationMetrics: {
          totalUsers: allUsers.length,
          activeCreators: creators,
          activeInvestors: investors,
          activeAdmins: admins,
          totalStakers: allStakes.length,
          activeLeasers: allLeases.filter(l => l.status === "active").length
        },
        marketMetrics: {
          activeLeases: allLeases.filter(l => l.status === "active").length,
          totalComputeAvailable: allLeases.reduce((sum, l) => sum + l.computeAmount, 0),
          ccPerQX: protocolParams.QX_TO_CC_RATIO
        }
      }
    });
  } catch (err) {
    console.error("GET NETWORK METRICS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /analytics/creator-performance - Creator performance metrics
router.get("/analytics/creator-performance", authMiddleware, requireRole("creator"), async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await ComputeTask.find({ creatorId: userId });

    const completed = tasks.filter(t => t.status === "completed").length;
    const failed = tasks.filter(t => t.status === "failed").length;
    const queued = tasks.filter(t => t.status === "queued").length;
    const running = tasks.filter(t => t.status === "running").length;

    const successRate = tasks.length > 0 ? ((completed / tasks.length) * 100).toFixed(2) : 0;
    const totalCCSpent = tasks.reduce((sum, t) => sum + t.computeCostCC, 0);
    const avgCCPerTask = tasks.length > 0 ? (totalCCSpent / tasks.length).toFixed(2) : 0;

    const completedTasks = tasks.filter(t => t.status === "completed");
    const avgExecutionTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTasks.length / 1000)
      : 0;

    // Get user stakes
    const stakes = await Stake.find({ userId });
    const totalCC = stakes.reduce((sum, s) => sum + s.computeCreditsReceived, 0);
    const usedCC = tasks.filter(t => t.status === "completed" || t.status === "running").reduce((sum, t) => sum + t.computeCostCC, 0);

    res.json({
      success: true,
      performance: {
        taskStats: {
          total: tasks.length,
          completed,
          failed,
          queued,
          running
        },
        qualityMetrics: {
          successRate: parseFloat(successRate),
          avgExecutionTime,
          avgCCPerTask: parseFloat(avgCCPerTask),
          totalCCSpent
        },
        resourceMetrics: {
          totalCC,
          usedCC,
          available: totalCC - usedCC,
          utilizationPercent: totalCC > 0 ? ((usedCC / totalCC) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (err) {
    console.error("GET CREATOR PERFORMANCE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /analytics/investor-roi - Investor ROI calculation
router.get("/analytics/investor-roi", authMiddleware, requireRole("investor"), async (req, res) => {
  try {
    const userId = req.user.id;
    const leases = await Lease.find({ investorId: userId });

    const activeLeases = leases.filter(l => l.status === "active");
    const expiredLeases = leases.filter(l => l.status === "expired");
    const totalCostCC = leases.reduce((sum, l) => sum + l.costCC, 0);
    const totalComputeLeased = leases.reduce((sum, l) => sum + l.computeAmount, 0);

    // Simplified ROI calculation: assume 5% monthly return on leased compute
    const roiPercent = (5 * activeLeases.length).toFixed(2);
    const projectedMonthlyReturn = (totalCostCC * 0.05).toFixed(2);

    const avgLeaseDuration = leases.length > 0 
      ? (leases.reduce((sum, l) => sum + l.duration, 0) / leases.length).toFixed(0)
      : 0;

    res.json({
      success: true,
      roi: {
        portfolio: {
          totalInvestedCC: totalCostCC,
          activeLeases: activeLeases.length,
          completedLeases: expiredLeases.length,
          totalComputeLeased
        },
        returns: {
          roiPercent: parseFloat(roiPercent),
          projectedMonthlyReturn: parseFloat(projectedMonthlyReturn),
          avgLeaseDuration: parseInt(avgLeaseDuration)
        },
        leaseBreakdown: {
          active: activeLeases.length,
          expired: expiredLeases.length,
          cancelled: leases.filter(l => l.status === "cancelled").length
        }
      }
    });
  } catch (err) {
    console.error("GET INVESTOR ROI ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// USER MANAGEMENT ENHANCEMENTS
// ===========================

// PUT /users/:userId/ban - Ban a user (Admin only)
router.put("/users/:userId/ban", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot ban admin users" });
    }

    user.status = "banned";
    await user.save();

    res.json({
      success: true,
      message: `User ${user.email} has been banned`,
      user
    });
  } catch (err) {
    console.error("BAN USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /users/:userId/unban - Unban a user (Admin only)
router.put("/users/:userId/unban", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "active";
    await user.save();

    res.json({
      success: true,
      message: `User ${user.email} has been unbanned`,
      user
    });
  } catch (err) {
    console.error("UNBAN USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// TASK PROCESSOR MONITORING (NEW)
// ===========================

// GET /processor/status - Check automatic task processor status
router.get("/processor/status", authMiddleware, async (req, res) => {
  try {
    const stats = await getProcessorStats();
    
    if (!stats) {
      return res.status(500).json({
        success: false,
        message: "Could not retrieve processor stats"
      });
    }
    
    res.json({
      success: true,
      processorStatus: stats
    });
  } catch (err) {
    console.error("GET PROCESSOR STATUS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /processor/detailed-queue - See all queued tasks with details
router.get("/processor/detailed-queue", authMiddleware, async (req, res) => {
  try {
    const queuedTasks = await ComputeTask.find({ status: "queued" })
      .populate("creatorId", "email role")
      .sort({ createdAt: 1 });
    
    const taskDetails = queuedTasks.map((task, index) => ({
      position: index + 1,
      taskId: task._id,
      taskName: task.taskName,
      creatorEmail: task.creatorId.email,
      costCC: task.computeCostCC,
      estimatedDuration: task.estimatedDuration,
      priority: task.priority,
      createdAt: task.createdAt,
      queueTime: Math.floor((new Date() - task.createdAt) / 1000)
    }));
    
    res.json({
      success: true,
      queuedTasks: taskDetails,
      totalQueued: queuedTasks.length,
      estimatedProcessingTime: Math.ceil(
        queuedTasks.reduce((sum, t) => sum + (t.estimatedDuration || 5), 0) / 1000
      ) + " seconds"
    });
  } catch (err) {
    console.error("GET DETAILED QUEUE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /processor/execution-history/:taskId - See full execution history
router.get("/processor/execution-history/:taskId", authMiddleware, async (req, res) => {
  try {
    const task = await ComputeTask.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    // Authorization: Creator or Admin
    if (task.creatorId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    res.json({
      success: true,
      task: {
        taskId: task._id,
        taskName: task.taskName,
        status: task.status,
        costCC: task.computeCostCC,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        actualDuration: task.actualDuration,
        executionAttempts: task.executionAttempts,
        errorMessage: task.errorMessage
      },
      executionLog: task.executionLog.map(entry => ({
        timestamp: entry.timestamp,
        event: entry.event,
        details: entry.details
      })),
      result: task.result
    });
  } catch (err) {
    console.error("GET EXECUTION HISTORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
