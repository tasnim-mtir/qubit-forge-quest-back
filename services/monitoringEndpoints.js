/**
 * 🔍 TASK PROCESSOR MONITORING ENDPOINT
 * 
 * This file should be added to routes/protocol.js
 * Add this code at the END of the protocol.js file, before the final export
 */

// ===========================
// TASK PROCESSOR MONITORING (NEW)
// ===========================

// Import at the top of protocol.js:
// import { getProcessorStats } from "../services/taskProcessor.js";

/**
 * GET /processor/status - Check task processor status and queue
 * Access: Any authenticated user
 */
export const monitoringEndpoint = (router) => {
  router.get("/processor/status", async (req, res) => {
    try {
      // Import here to avoid circular dependencies
      const { getProcessorStats } = await import("../services/taskProcessor.js");
      
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
  
  /**
   * GET /processor/detailed-queue - See all queued tasks with details
   * Access: Admin and Creators
   */
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
        queueTime: Math.floor((new Date() - task.createdAt) / 1000) // seconds in queue
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
  
  /**
   * GET /processor/execution-history/:taskId - See full execution history of a task
   * Access: Creators (own tasks), Admins (all tasks)
   */
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
};
