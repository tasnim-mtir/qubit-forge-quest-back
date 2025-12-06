# 🚀 AUTOMATIC COMPUTE TASK PROCESSOR GUIDE

## 📋 Overview

Your backend now includes a **fully automatic compute task execution engine** that:

✅ Runs **24/7 without admin interaction**  
✅ Processes tasks **one-by-one sequentially** (no parallel execution)  
✅ **Simulates realistic execution** (3-8 second duration or task's estimatedDuration)  
✅ **Auto-completes** with 90% success / 10% failure rates  
✅ **Survives server restarts** (recovery system built-in)  
✅ **Tracks everything** with detailed execution logs  
✅ **Updates vault statistics** automatically  

---

## 🏗️ ARCHITECTURE

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND SERVER                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌─────────────────────────┐            │
│  │ Creators     │───→│  POST /compute-task     │            │
│  │ Create Tasks │    │  create → queued        │            │
│  └──────────────┘    └──────────┬──────────────┘            │
│                                  │                           │
│                                  ▼                           │
│  ┌──────────────────────────────────────────────┐            │
│  │  🔄 AUTOMATIC TASK PROCESSOR                 │            │
│  │  (Runs every 5 seconds)                      │            │
│  │                                              │            │
│  │  1. Pick oldest queued task                  │            │
│  │  2. Mark as "running" + startedAt timestamp  │            │
│  │  3. Simulate execution (3-8 seconds)         │            │
│  │  4. Randomly decide: succeed (90%) or fail   │            │
│  │  5. Update task + vault stats                │            │
│  │  6. Log all events                           │            │
│  └──────────────┬───────────────────────────────┘            │
│                 │                                            │
│         ┌───────┴────────┐                                   │
│         ▼                ▼                                   │
│    ┌─────────┐      ┌────────┐                              │
│    │completed│      │ failed │                              │
│    └─────────┘      └────────┘                              │
│         │                │                                  │
│         └────────┬───────┘                                  │
│                  ▼                                          │
│         ┌─────────────────┐                                │
│         │ Vault Updated   │                                │
│         │totalTasksExecuted++                              │
│         └─────────────────┘                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 FILE STRUCTURE

### New/Updated Files

```
backend/
├── server.js                         [UPDATED] ← Start processor on boot
├── models/
│   └── ComputeTask.js               [UPDATED] ← Added execution fields
├── services/
│   └── taskProcessor.js             [NEW] ← Core processor engine
└── routes/
    └── protocol.js                  [UPDATED] ← Added monitoring endpoints
```

---

## 🔧 HOW IT WORKS

### Phase 1: Server Startup

```javascript
// server.js starts up
MongoDB connects ✓

// Automatic recovery (if server crashed mid-task)
Stranded tasks found: 3
Reset those tasks: "running" → "queued" ✓

// Start the processor
🚀 Starting automatic compute task processor...
✓ Task processor is now running

// Every 5 seconds...
Check for queued tasks
```

### Phase 2: Task Execution

```
CYCLE 1 (5 seconds):
┌─────────────────────────────────────────┐
│ Task "DataAnalysis-2024" found (queued)│
│ ✓ Mark as "running"                    │
│ ✓ startedAt = NOW                      │
│ ✓ Wait 5.2 seconds (simulated)         │
│ ✓ Random check: SUCCEEDED (90% chance) │
│ ✓ Mark as "completed"                  │
│ ✓ finishedAt = NOW                     │
│ ✓ actualDuration = 5.2s                │
│ ✓ Vault: totalTasksExecuted++          │
│ ✓ Save execution log with events       │
└─────────────────────────────────────────┘

CYCLE 2 (5 seconds):
┌─────────────────────────────────────────┐
│ Next task found (queued)                │
│ Repeat the same process...              │
└─────────────────────────────────────────┘
```

### Phase 3: Server Shutdown

```javascript
// When you press Ctrl+C or server crashes
🛑 Shutting down server...

// Cleanup
✓ Task processor stopped
✓ Server closed
✓ MongoDB connection closed

// Next restart will run recovery
```

---

## 📊 TASK MODEL ENHANCEMENTS

### New Fields Added to ComputeTask

```javascript
{
  // Existing fields
  taskName: String,
  computeCostCC: Number,
  status: "queued" | "running" | "completed" | "failed",

  // NEW EXECUTION TRACKING FIELDS ✨
  startedAt: Date,              // When task started
  finishedAt: Date,             // When task ended
  actualDuration: Number,       // Seconds actually taken
  executionLog: [               // Complete event history
    {
      timestamp: Date,
      event: String,            // "STARTED", "COMPLETED", "FAILED", etc
      details: Object
    }
  ],
  errorMessage: String,         // Failure reason if failed
  autoExecutedAt: Date,         // When auto-executor picked it up
  executionAttempts: Number     // Retry count
}
```

---

## ⚙️ CONFIGURATION

Edit `services/taskProcessor.js` to customize:

```javascript
// How often to check for tasks (default: 5 seconds)
const PROCESSOR_INTERVAL = 5000;

// Execution time range (default: 3-8 seconds)
const MIN_EXECUTION_TIME = 3;
const MAX_EXECUTION_TIME = 8;

// Success rate (default: 90% success, 10% failure)
const SUCCESS_RATE = 90;
```

### Example: Change to 10-second check interval

```javascript
// Line 12
const PROCESSOR_INTERVAL = 10000; // ← Change to 10 seconds
```

---

## 🔍 MONITORING & DEBUGGING

### 1. Check Processor Status

```bash
GET http://localhost:3000/api/protocol/processor/status
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "processorStatus": {
    "processorActive": true,
    "isCurrentlyProcessing": false,
    "taskCounts": {
      "queued": 12,
      "running": 0,
      "completed": 45,
      "failed": 3,
      "total": 60
    },
    "processorConfig": {
      "checkInterval": "5s",
      "executionTimeRange": "3-8s",
      "successRate": "90%"
    }
  }
}
```

### 2. View Queued Tasks

```bash
GET http://localhost:3000/api/protocol/processor/detailed-queue
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "queuedTasks": [
    {
      "position": 1,
      "taskId": "507f1f77bcf86cd799439011",
      "taskName": "DataAnalysis-2024",
      "creatorEmail": "creator@example.com",
      "costCC": 500,
      "estimatedDuration": 10,
      "priority": "High",
      "createdAt": "2024-12-06T10:30:00Z",
      "queueTime": 120
    }
  ],
  "totalQueued": 1,
  "estimatedProcessingTime": "10 seconds"
}
```

### 3. View Task Execution History

```bash
GET http://localhost:3000/api/protocol/processor/execution-history/:taskId
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "task": {
    "taskId": "507f1f77bcf86cd799439011",
    "taskName": "DataAnalysis-2024",
    "status": "completed",
    "costCC": 500,
    "createdAt": "2024-12-06T10:30:00Z",
    "startedAt": "2024-12-06T10:35:02Z",
    "finishedAt": "2024-12-06T10:35:07Z",
    "actualDuration": 5,
    "executionAttempts": 1,
    "errorMessage": null
  },
  "executionLog": [
    {
      "timestamp": "2024-12-06T10:35:02Z",
      "event": "STARTED",
      "details": {
        "executionAttempt": 1,
        "estimatedDuration": 10
      }
    },
    {
      "timestamp": "2024-12-06T10:35:07Z",
      "event": "COMPLETED",
      "details": {
        "duration": 5,
        "result": { ... }
      }
    }
  ],
  "result": {
    "simulationData": "Task executed successfully",
    "executionTime": 5,
    "completedAt": "2024-12-06T10:35:07Z",
    "computeCostCC": 500
  }
}
```

### 4. Server Logs

When your server runs, you'll see:

```
✓ MongoDB connected
✓ Server running on port 3000

🚀 Starting automatic compute task processor...
🔍 Checking for stranded tasks from previous server instance...
✓ No stranded tasks found

⏰ Task processor will check for queued tasks every 5s

✅ Automatic task processor started successfully!

--- (5 seconds later) ---

⚡ TASK STARTED: "DataAnalysis-2024" (ID: 507f1f77bcf86cd799439011)
   Creator: user@example.com
   Cost: 500 CC
   Estimated Duration: 10s
   ⏳ Simulating execution... (5s)
   ✅ COMPLETED in 5s
   📊 Vault updated: totalTasksExecuted = 46
   📝 Execution log saved with 2 entries
```

---

## 🧪 TESTING WITH POSTMAN

### Test Scenario: Full Task Lifecycle

#### Step 1: Admin Login

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Save the token from response → use as Bearer token for all requests**

#### Step 2: Create a Compute Task

```
POST http://localhost:3000/api/protocol/compute-task/create
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "taskName": "Test Task 1",
  "taskDescription": "Testing automatic processor",
  "computeCostCC": 100,
  "estimatedDuration": 5,
  "priority": "Medium",
  "taskType": "DataAnalysis"
}
```

**Response will include taskId**

#### Step 3: Check Processor Status (Immediate)

```
GET http://localhost:3000/api/protocol/processor/status
Authorization: Bearer <YOUR_TOKEN>
```

**You should see:**
```json
{
  "taskCounts": {
    "queued": 1,        // Your task is here
    "running": 0,
    "completed": 0,
    "failed": 0
  }
}
```

#### Step 4: Wait 5-10 seconds, Check Again

```
GET http://localhost:3000/api/protocol/processor/status
Authorization: Bearer <YOUR_TOKEN>
```

**Now you should see:**
```json
{
  "taskCounts": {
    "queued": 0,        // Task moved out of queue
    "running": 0,
    "completed": 1,     // Task completed!
    "failed": 0
  }
}
```

#### Step 5: View Task Details

```
GET http://localhost:3000/api/protocol/processor/execution-history/<TASK_ID>
Authorization: Bearer <YOUR_TOKEN>
```

**You'll see the complete execution log:**
- When it started
- How long it took
- Whether it succeeded/failed
- Full result data

#### Step 6: Create Multiple Tasks and Watch Them Process

```
POST http://localhost:3000/api/protocol/compute-task/create
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "taskName": "Batch Task 1",
  "computeCostCC": 50,
  "estimatedDuration": 3
}
```

Create 5-10 tasks rapidly. Watch them process one by one!

```
GET http://localhost:3000/api/protocol/processor/status
```

You'll see them move from `queued` → `completed`/`failed`

---

## 🛡️ RECOVERY SYSTEM

### What Happens if Server Crashes During Task Execution?

**Scenario:**
- Task is running (status = "running")
- Server crashes 💥
- Server restarts ✓

**Automatic Recovery:**

```javascript
// On server restart:
🔍 Checking for stranded tasks from previous server instance...
⚠️  Found 1 stranded task(s). Resetting to queued...

✓ Recovered task: "DataAnalysis-2024" (ID: 507f...)
   Reason: Server restarted while task was running
   Recovery Time: 2024-12-06T10:45:30Z

Execution log updated with RECOVERED event
Task status: "running" → "queued"
executionAttempts: 1 → 2

// Now processor will pick it up again in next cycle
```

**The task is NOT lost. It gets:**
- Reset to "queued" status
- Given another attempt
- Logged in its executionLog

---

## 📈 PERFORMANCE CONSIDERATIONS

### Sequential Processing Benefits

✅ **No overlapping tasks** - Only one task runs at a time  
✅ **Lower CPU usage** - No race conditions  
✅ **Easier debugging** - Clear execution order  
✅ **Predictable results** - No concurrency issues  

### If You Ever Need Parallel Processing

Later, you can modify `taskProcessor.js`:

```javascript
// Change from sequential to parallel
const MAX_CONCURRENT_TASKS = 5; // Run 5 tasks simultaneously
```

For now, it's optimized for sequential safety.

---

## 🚨 TROUBLESHOOTING

### Issue: Tasks not executing

**Check:**
1. Is processor running? `GET /processor/status`
2. Are there queued tasks? `GET /processor/detailed-queue`
3. Check server logs for errors
4. Verify ComputeVault exists in MongoDB

### Issue: Tasks stuck in "running"

**Check:**
1. Restart server (automatic recovery will fix)
2. Look for errors in execution log: `GET /processor/execution-history/:taskId`

### Issue: Processor seems slow

**Check:**
1. Is `PROCESSOR_INTERVAL` too high? (default: 5 seconds)
2. Is a task taking too long to simulate?
3. Check MongoDB performance

### Issue: Success rate not 90/10

**Note:** It's random! With only a few tasks, you might see different ratios.
Over 100 tasks, you should converge to ~90/10 split.

---

## 🎯 WORKFLOW SUMMARY

### For Creators Using Your System

```
1. Creator creates task → POST /compute-task/create
2. Task queued automatically ✓
3. Processor picks it up in 5 seconds ✓
4. Task executed automatically ✓
5. Creator can check status → GET /processor/status
6. Creator views execution → GET /processor/execution-history/:taskId
```

### No Admin Needed! 🎉

The entire process is:
- ✅ Automatic
- ✅ No manual intervention
- ✅ Runs 24/7
- ✅ Survives restarts
- ✅ Fully tracked

---

## 📚 API REFERENCE

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---|
| `/processor/status` | GET | Check processor & queue stats | ✅ |
| `/processor/detailed-queue` | GET | See all queued tasks | ✅ |
| `/processor/execution-history/:taskId` | GET | View task execution log | ✅ |
| `/compute-task/create` | POST | Create new task | Creator |
| `/compute-task/my-tasks` | GET | View creator's tasks | Creator |
| `/compute-task/:taskId/cancel` | POST | Cancel queued task | Creator |

---

## 🔐 SECURITY NOTES

✅ Only authenticated users can access monitoring endpoints  
✅ Creators can only see their own task histories  
✅ Admins can see all tasks  
✅ No endpoints expose sensitive vault data  
✅ Task processor runs internally (no API endpoints trigger it)  

---

## 🎓 NEXT STEPS

1. **Test locally** - Create tasks and watch them execute
2. **Customize** - Adjust `PROCESSOR_INTERVAL`, success rate, execution time
3. **Monitor** - Use the monitoring endpoints to track performance
4. **Deploy** - The processor will work the same in production!

---

## 📞 SUPPORT

If issues arise:

1. Check server logs for errors
2. View `executionLog` in task details
3. Use `GET /processor/status` to check system health
4. Verify MongoDB connection is stable

---

**Your automatic task execution engine is now live! 🚀**

Tasks will execute automatically, 24/7, without any admin interaction.

