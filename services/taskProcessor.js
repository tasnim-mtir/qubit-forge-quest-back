/**
 * ⚙️ AUTOMATIC COMPUTE TASK PROCESSOR - PARALLEL EXECUTION
 * 
 * This service automatically executes queued compute tasks without any admin interaction.
 * 
 * Features:
 * ✅ Picks ALL queued tasks at once
 * ✅ Runs tasks in parallel (concurrent execution)
 * ✅ Each task executes independently in its own async context
 * ✅ Simulates task execution with realistic timing
 * ✅ Auto-completes with 90% success rate / 10% failure rate
 * ✅ Tracks execution time and updates vault stats
 * ✅ Handles server restarts gracefully
 * ✅ Logs all execution events for debugging
 */

import ComputeTask from "../models/ComputeTask.js";
import ComputeVault from "../models/ComputeVault.js";

// ===========================
// CONFIGURATION
// ===========================

// How often to check for queued tasks (in milliseconds)
const PROCESSOR_INTERVAL = 5000; // 5 seconds

// Min and max execution time range (in seconds)
const MIN_EXECUTION_TIME = 3;
const MAX_EXECUTION_TIME = 8;

// Success rate percentage (90% success, 10% failure)
const SUCCESS_RATE = 90;

// ===========================
// STATE MANAGEMENT
// ===========================

let processorInterval = null;

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Generate random execution time between min and max
 */
function getRandomExecutionTime() {
  return Math.floor(Math.random() * (MAX_EXECUTION_TIME - MIN_EXECUTION_TIME + 1)) + MIN_EXECUTION_TIME;
}

/**
 * Determine if task should succeed or fail
 */
function shouldTaskSucceed() {
  return Math.random() * 100 < SUCCESS_RATE;
}

/**
 * Add an event to task's execution log
 */
async function addExecutionLog(task, event, details = {}) {
  task.executionLog.push({
    timestamp: new Date(),
    event,
    details
  });
  await task.save();
}

/**
 * Recovery: Reset "running" tasks back to "queued" on startup
 * (Handles server restarts mid-execution)
 */
async function recoverStrandedTasks() {
  try {
    console.log("\n🔍 Checking for stranded tasks from previous server instance...");
    
    const strandedTasks = await ComputeTask.find({ status: "running" });
    
    if (strandedTasks.length > 0) {
      console.log(`⚠️  Found ${strandedTasks.length} stranded task(s). Resetting to queued...\n`);
      
      for (const task of strandedTasks) {
        task.status = "queued";
        task.startedAt = null;
        task.executionAttempts = (task.executionAttempts || 0) + 1;
        await addExecutionLog(task, "RECOVERED", {
          reason: "Server restarted while task was running",
          recoveryTime: new Date()
        });
        console.log(`✓ Recovered task: ${task.taskName} (ID: ${task._id})`);
      }
    } else {
      console.log("✓ No stranded tasks found\n");
    }
  } catch (err) {
    console.error("❌ Error during task recovery:", err.message);
  }
}

/**
 * STEP 1: Find all queued tasks
 */
async function pickAllQueuedTasks() {
  try {
    const tasks = await ComputeTask.find({ status: "queued" })
      .sort({ createdAt: 1 })
      .exec();
    
    return tasks;
  } catch (err) {
    console.error("❌ Error picking queued tasks:", err.message);
    return [];
  }
}


/**
 * STEP 2: Start executing a task
 */
async function startTaskExecution(task) {
  try {
    task.status = "running";
    task.startedAt = new Date();
    task.autoExecutedAt = new Date();
    task.executionAttempts = (task.executionAttempts || 0) + 1;
    
    await addExecutionLog(task, "STARTED", {
      executionAttempt: task.executionAttempts,
      estimatedDuration: task.estimatedDuration
    });
    
    console.log(`\n⚡ TASK STARTED: "${task.taskName}" (ID: ${task._id})`);
    console.log(`   Creator: ${task.creatorId}`);
    console.log(`   Cost: ${task.computeCostCC} CC`);
    console.log(`   Estimated Duration: ${task.estimatedDuration}s`);
    
    return task;
  } catch (err) {
    console.error("❌ Error starting task execution:", err.message);
    return null;
  }
}

/**
 * STEP 3: Simulate task execution (wait and then complete/fail)
 */
async function simulateTaskExecution(task) {
  try {
    // Determine execution time
    let executionTime;
    
    if (task.estimatedDuration) {
      // Use estimated duration with ±30% variance
      const variance = task.estimatedDuration * 0.3;
      executionTime = Math.floor(
        task.estimatedDuration + 
        (Math.random() * 2 - 1) * variance
      );
      // Clamp to minimum 1 second
      executionTime = Math.max(1, executionTime);
    } else {
      // Use random time between MIN and MAX
      executionTime = getRandomExecutionTime();
    }
    
    console.log(`   ⏳ Simulating execution... (${executionTime}s)`);
    
    // Wait for the simulated execution time
    await new Promise(resolve => setTimeout(resolve, executionTime * 1000));
    
    // Determine success/failure
    const success = shouldTaskSucceed();
    
    return {
      success,
      executionTime,
      completedAt: new Date()
    };
  } catch (err) {
    console.error("❌ Error during task simulation:", err.message);
    return null;
  }
}
/**
 * STEP 4A: Mark task as completed
 */
async function completeTask(task, executionData) {
  try {
    task.status = "completed";
    task.finishedAt = executionData.completedAt;
    task.actualDuration = executionData.executionTime;
    task.result = {
      simulationData: "Task executed successfully",
      executionTime: executionData.executionTime,
      completedAt: executionData.completedAt,
      computeCostCC: task.computeCostCC
    };

    await addExecutionLog(task, "COMPLETED", {
      duration: executionData.executionTime,
      result: task.result
    });

    await task.save();

    // ------------------------------
    // ⭐ UPDATE COMPUTE VAULT
    // ------------------------------
    let vault = await ComputeVault.findOne();
    if (!vault) {
      vault = await ComputeVault.create({});
    }

    // Increase executed count
    vault.totalTasksExecuted = (vault.totalTasksExecuted || 0) + 1;

    // ⭐ ADD REWARD TO POOL
    const REWARD_RATE = 5; // or use your protocolParams
    const reward = task.computeCostCC * (REWARD_RATE / 100);

    vault.rewardPool = (vault.rewardPool || 0) + reward;

    await vault.save();

    console.log(`   💰 Reward added to pool: +${reward} CC`);
    console.log(`   🏦 New Reward Pool Balance: ${vault.rewardPool} CC`);
    console.log(`   📊 Vault updated: totalTasksExecuted = ${vault.totalTasksExecuted}`);

    return task;
  } catch (err) {
    console.error("❌ Error completing task:", err.message);
    return null;
  }
}


/**
 * STEP 4B: Mark task as failed
 */
async function failTask(task, executionData) {
  try {
    task.status = "failed";
    task.finishedAt = executionData.completedAt;
    task.actualDuration = executionData.executionTime;
    
    const failureReasons = [
      "Simulated network timeout",
      "Simulated resource unavailable",
      "Simulated computation error",
      "Simulated memory allocation failed",
      "Simulated execution timeout"
    ];
    
    const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
    
    task.errorMessage = failureReason;
    task.result = {
      error: failureReason,
      failedAt: executionData.completedAt,
      attemptedDuration: executionData.executionTime
    };
    
    await addExecutionLog(task, "FAILED", {
      duration: executionData.executionTime,
      reason: failureReason
    });
    
    await task.save();
    
    console.log(`   ❌ FAILED after ${executionData.executionTime}s`);
    console.log(`   Reason: ${failureReason}`);
    
    return task;
  } catch (err) {
    console.error("❌ Error failing task:", err.message);
    return null;
  }
}

/**
 * MAIN PROCESSOR FUNCTION: Execute all queued tasks in parallel
 */
async function processAllQueuedTasks() {
  try {
    // Step A: Pick all queued tasks
    const queuedTasks = await pickAllQueuedTasks();
    
    if (queuedTasks.length === 0) {
      // Queue is empty
      return;
    }
    
    console.log(`\n🚀 Processing ${queuedTasks.length} task(s) in parallel...\n`);
    
    // Step B: Execute all tasks in parallel using Promise.all
    const executionPromises = queuedTasks.map(async (task) => {
      try {
        // Start execution
        let runningTask = await startTaskExecution(task);
        if (!runningTask) {
          return;
        }
        
        // Simulate execution
        const executionData = await simulateTaskExecution(runningTask);
        if (!executionData) {
          return;
        }
        
        // Mark as completed or failed
        if (executionData.success) {
          await completeTask(runningTask, executionData);
        } else {
          await failTask(runningTask, executionData);
        }
        
        console.log(`   📝 Execution log saved with ${runningTask.executionLog.length} entries\n`);
        
      } catch (err) {
        console.error("❌ ERROR processing task:", err.message);
      }
    });
    
    // Wait for ALL tasks to complete in parallel
    await Promise.all(executionPromises);
    
    console.log(`✅ Completed processing ${queuedTasks.length} task(s)\n`);
    
  } catch (err) {
    console.error("❌ CRITICAL ERROR in task processor:", err.message);
    console.error("Stack:", err.stack);
  }
}

// ===========================
// PUBLIC API
// ===========================

/**
 * Start the automatic task processor
 * Call this in server.js after MongoDB connects
 */
export async function startComputeTaskProcessor() {
  try {
    // Recovery: Fix any stranded tasks from previous restart
    await recoverStrandedTasks();
    
    // Start the processor loop
    console.log(`⏰ Task processor will check for queued tasks every ${PROCESSOR_INTERVAL / 1000}s\n`);
    
    processorInterval = setInterval(async () => {
      await processAllQueuedTasks();
    }, PROCESSOR_INTERVAL);
    
    console.log("✅ Automatic task processor started successfully!");
    
  } catch (err) {
    console.error("❌ Failed to start task processor:", err.message);
    throw err;
  }
}

/**
 * Stop the automatic task processor
 * Call this during graceful shutdown
 */
export function stopComputeTaskProcessor() {
  try {
    if (processorInterval) {
      clearInterval(processorInterval);
      processorInterval = null;
      console.log("✓ Task processor stopped");
    }
  } catch (err) {
    console.error("❌ Error stopping task processor:", err.message);
  }
}

/**
 * Get processor statistics (for debugging)
 */
export async function getProcessorStats() {
  try {
    const queuedCount = await ComputeTask.countDocuments({ status: "queued" });
    const runningCount = await ComputeTask.countDocuments({ status: "running" });
    const completedCount = await ComputeTask.countDocuments({ status: "completed" });
    const failedCount = await ComputeTask.countDocuments({ status: "failed" });
    
    return {
      processorActive: processorInterval !== null,
      isCurrentlyProcessing: isProcessing,
      taskCounts: {
        queued: queuedCount,
        running: runningCount,
        completed: completedCount,
        failed: failedCount,
        total: queuedCount + runningCount + completedCount + failedCount
      },
      processorConfig: {
        checkInterval: `${PROCESSOR_INTERVAL / 1000}s`,
        executionTimeRange: `${MIN_EXECUTION_TIME}-${MAX_EXECUTION_TIME}s`,
        successRate: `${SUCCESS_RATE}%`
      }
    };
  } catch (err) {
    console.error("❌ Error getting processor stats:", err.message);
    return null;
  }
}
