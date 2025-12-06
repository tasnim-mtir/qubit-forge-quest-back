# FRONTEND IMPLEMENTATION GUIDE - Qubitium Compute Protocol

## Project Overview
You are building a decentralized compute marketplace dashboard for the Qubitium blockchain launchpad. The platform has three main user roles: **Creators**, **Investors**, and **Admins**. Each role has specific dashboards and features powered by the backend API at `http://localhost:3000/api/protocol/`.

**Authentication:** All requests require a JWT token in the `Authorization: Bearer {token}` header.

---

## FOR CREATORS

### 1. Create Compute Task
**Purpose:** Creators can submit compute tasks and spend their Compute Credits (CC).

**API Endpoint:**
```
POST /api/protocol/compute-task/create
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "taskName": "Data Analysis Task",
  "computeCostCC": 50
}
```

**Response:**
```json
{
  "success": true,
  "message": "Compute task created successfully",
  "task": {
    "_id": "task_id_123",
    "creatorId": "user_id",
    "taskName": "Data Analysis Task",
    "computeCostCC": 50,
    "status": "queued",
    "result": null,
    "timestamp": "2024-12-06T10:30:00Z",
    "createdAt": "2024-12-06T10:30:00Z"
  },
  "userCCStatus": {
    "totalCC": 1000,
    "usedCC": 150,
    "availableCC": 850
  }
}
```

**UI Components Needed:**
- Task name input field
- CC cost input (slider or number input)
- Available CC display (real-time update)
- Submit button with validation
- Error handling for insufficient CC
- Success notification

---

### 2. Task History
**Purpose:** View all submitted tasks and their execution status.

**API Endpoint:**
```
GET /api/protocol/compute-task/my-tasks?page=1&limit=10
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "_id": "task_123",
      "taskName": "Data Analysis",
      "computeCostCC": 50,
      "status": "completed",
      "result": { "simulationData": "Task executed successfully" },
      "timestamp": "2024-12-05T15:20:00Z",
      "createdAt": "2024-12-05T15:20:00Z"
    },
    {
      "_id": "task_124",
      "taskName": "ML Model Training",
      "computeCostCC": 200,
      "status": "running",
      "result": null,
      "timestamp": "2024-12-06T10:00:00Z",
      "createdAt": "2024-12-06T10:00:00Z"
    }
  ],
  "statusCount": {
    "queued": 2,
    "running": 1,
    "completed": 5,
    "failed": 0
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "pages": 1
  }
}
```

**UI Components Needed:**
- Table with columns: Task Name, CC Cost, Status, Date
- Status badges (queued: yellow, running: blue, completed: green, failed: red)
- Pagination controls
- Filter by status (optional)
- Expandable row showing task result
- Sorting by date or cost

---

### 3. CC Balance Dashboard
**Purpose:** Display creator's total, used, and available Compute Credits.

**API Endpoint:**
```
GET /api/protocol/stake/user/{userId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "stakes": [
    {
      "_id": "stake_123",
      "userId": { "email": "creator@example.com", "role": "creator" },
      "amountQX": 10,
      "computeCreditsReceived": 1000,
      "lockPeriod": 30,
      "status": "active",
      "timestamp": "2024-12-01T00:00:00Z"
    }
  ],
  "summary": {
    "totalStaked": 10,
    "totalCC": 1000,
    "activeStakes": 1
  }
}
```

**UI Components Needed:**
- Large CC balance display (primary metric)
- Breakdown card showing:
  - Total CC (from all stakes)
  - Used CC (from active tasks)
  - Available CC (total - used)
- Staking details card with lock period and unlock date
- "Stake More" button linking to staking interface
- Visual progress bar showing CC utilization

---

### 4. Queue Status
**Purpose:** Real-time view of task execution queue.

**API Endpoint:**
```
GET /api/protocol/compute-task/my-tasks?page=1&limit=5
Authorization: Bearer {token}
```

**UI Components Needed:**
- Queue position counter (e.g., "Position 3 in queue")
- Estimated wait time (based on tasks ahead)
- Live status indicator with animation
- Task progress visualization (linear or circular progress bar)
- Estimated completion time
- Cancel task button (if queued)

---

## FOR INVESTORS

### 1. Leasing Dashboard
**Purpose:** Manage and monitor compute resource leases.

**API Endpoint:**
```
GET /api/protocol/lease/user/{userId}?page=1&limit=10
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "leases": [
    {
      "_id": "lease_123",
      "investorId": { "email": "investor@example.com", "role": "investor" },
      "computeAmount": 500,
      "costCC": 100,
      "duration": 30,
      "status": "active",
      "createdAt": "2024-12-01T00:00:00Z",
      "updatedAt": "2024-12-06T10:00:00Z"
    }
  ],
  "summary": {
    "totalComputeLeased": 1500,
    "totalCostCC": 300,
    "activeLeases": 3
  }
}
```

**UI Components Needed:**
- Dashboard overview cards showing:
  - Total compute leased
  - Total cost (in CC)
  - Active leases count
  - Utilization percentage
- Active leases table with columns: Compute Amount, Cost, Duration, Status, End Date
- Lease status badges (active: green, expired: gray, cancelled: red)
- Action buttons: Renew, Extend, Cancel
- ROI calculation display
- Lease history view

---

### 2. Marketplace of Compute
**Purpose:** Browse available compute resources and create new leases.

**API Endpoint to Create Lease:**
```
POST /api/protocol/lease
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "computeAmount": 500,
  "costCC": 100,
  "duration": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lease created successfully",
  "lease": {
    "_id": "lease_124",
    "investorId": "user_id",
    "computeAmount": 500,
    "costCC": 100,
    "duration": 30,
    "status": "active",
    "createdAt": "2024-12-06T10:30:00Z"
  }
}
```

**UI Components Needed:**
- Marketplace grid/list view showing available compute packages:
  - Compute amount (e.g., "500 units")
  - Cost in CC
  - Duration in days
  - Provider reputation (stars)
  - Available quantity
- Filters:
  - Compute amount range (slider)
  - Cost range (slider)
  - Duration
  - Availability
- Sorting options: Price (low to high), Popularity, Newest
- Lease creation modal with:
  - Lease terms preview
  - Total cost calculation
  - Confirmation before purchase
  - Payment method selection
- Purchase button triggering API call
- Success/error notifications

---

### 3. CC Price Chart
**Purpose:** Monitor Compute Credit pricing trends.

**API Endpoint for Vault Stats:**
```
GET /api/protocol/vault/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "vault": {
    "totalLockedQX": 10000,
    "totalComputeCredits": 1000000,
    "totalTasksExecuted": 5432,
    "rewardPool": 50000
  },
  "stats": {
    "totalStakers": 234,
    "activeStakes": 198,
    "totalTasksQueued": 45,
    "totalTasksCompleted": 5000,
    "ccPerQX": 100
  }
}
```

**UI Components Needed:**
- Line chart showing CC price over time:
  - X-axis: Date/Time
  - Y-axis: CC Price
  - Multiple timeframes: 24h, 7d, 30d, All-time
- Price statistics panel:
  - Current price: 1 QX = 100 CC
  - 24h change (% and direction arrow)
  - High/Low price
  - Trading volume
- Market data cards:
  - Total locked QX
  - Total compute credits in circulation
  - Active stakers count
- Price prediction indicator (optional)
- Export chart as image button

---

## FOR ADMIN

### 1. View All Stakes
**Purpose:** Monitor all user staking activity.

**API Endpoint:**
```
GET /api/protocol/stake/all?page=1&limit=20
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "stakes": [
    {
      "_id": "stake_123",
      "userId": { "email": "user@example.com", "role": "creator" },
      "amountQX": 10,
      "computeCreditsReceived": 1000,
      "lockPeriod": 30,
      "status": "active",
      "timestamp": "2024-12-01T00:00:00Z",
      "createdAt": "2024-12-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "pages": 25
  }
}
```

**UI Components Needed:**
- Data table with columns:
  - User email
  - Amount QX
  - CC received
  - Lock period
  - Status
  - Created date
  - Unlock date (calculated)
- Advanced filters:
  - Status (active/released/claimed)
  - Date range
  - Min/max QX amount
- Sorting by any column
- Pagination controls
- Export to CSV button
- Action buttons: View details, Adjust lock period (admin)
- Summary statistics:
  - Total QX locked
  - Total CC distributed
  - Average stake amount

---

### 2. View All Tasks
**Purpose:** Monitor compute task execution across the network.

**API Endpoint:**
```
GET /api/protocol/compute-task/all?status=running&page=1&limit=20
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "_id": "task_123",
      "creatorId": { "email": "creator@example.com", "role": "creator" },
      "taskName": "Data Processing",
      "computeCostCC": 50,
      "status": "running",
      "result": null,
      "timestamp": "2024-12-06T10:00:00Z",
      "createdAt": "2024-12-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5432,
    "pages": 272
  }
}
```

**UI Components Needed:**
- Dashboard overview cards:
  - Queued tasks count
  - Running tasks count
  - Completed tasks count
  - Failed tasks count
- Main data table with columns:
  - Task name
  - Creator email
  - CC cost
  - Status (with color badges)
  - Timestamp
  - Execution time (if completed)
- Real-time status filters:
  - Show queued/running/completed/failed (toggle buttons)
- Advanced filters:
  - Date range
  - CC cost range
  - Creator role
- Search by task name or creator email
- Pagination
- Action buttons:
  - Force complete (simulate)
  - View task details
  - View result
- Queue visualization:
  - How many tasks ahead
  - Estimated processing time
- Performance metrics:
  - Average task execution time
  - Success rate %
  - Total CC spent

---

### 3. View Compute Pools
**Purpose:** Monitor vault and resource distribution.

**API Endpoint:**
```
GET /api/protocol/vault/stats
Authorization: Bearer {token}
```

**UI Components Needed:**
- Compute vault summary:
  - Total locked QX (with trend)
  - Total compute credits (with trend)
  - Total tasks executed (with trend)
  - Reward pool balance
- Pie chart showing:
  - CC distribution: Used vs Available
  - User breakdown: Creators vs Investors vs Users
- Line chart showing:
  - QX locked over time
  - Tasks executed over time
- Pool allocation table:
  - Staking pool: X QX locked
  - Reward pool: X CC available
  - Active leases pool: X CC committed
- Resource utilization metrics:
  - CC utilization percentage
  - Active participants count
  - Average stake size
  - Average lease cost
- Health indicators (traffic light system):
  - Pool health (red/yellow/green)
  - CC availability level
  - Network activity level

---

### 4. Adjust Parameters (Reward Rate, CC Price)
**Purpose:** Admin controls for protocol economics.

**UI Components Needed:**
- Settings panel with sections:

#### A. CC to QX Conversion Rate:
- Current ratio display: 1 QX = 100 CC
- Input field to adjust ratio
- Preview impact on existing stakes
- Change log showing previous values with timestamps
- Warning: "This affects all future stakes"
- Apply button with confirmation dialog

#### B. Reward Rate:
- Current reward percentage per epoch (if applicable)
- Input field to adjust reward rate
- Preview annual rewards at current locked QX
- Historical chart of reward rates
- Notification when changed: "Update effective next epoch"
- Apply button with confirmation

#### C. Task Parameters:
- Min CC cost per task
- Max CC cost per task
- Default task timeout (seconds)
- Queue processing speed adjustment

#### D. Lease Parameters:
- Min lease duration (days)
- Max lease duration (days)
- Min compute amount leasable
- Lease renewal incentive percentage

#### E. Parameter History:
- Audit log showing all parameter changes
- Who changed it (admin email)
- When it was changed
- Old value → New value
- Reason/note field

**UI Components Needed:**
- Form inputs for each parameter
- Preview impact calculator
- Confirmation dialogs before applying changes
- Success notifications with confirmation
- Undo/Rollback option (within 24h)
- Export parameters as JSON
- Compare current vs recommended values

---

## COMMON UI ELEMENTS (All Roles)

### 1. Navigation Bar:
- Dashboard link
- Role-specific menu items
- User profile dropdown
- Logout button

### 2. Authentication:
- JWT token stored in localStorage
- Auto-redirect to login if unauthorized
- Token refresh on 401 error
- Session timeout warning

### 3. Error Handling:
- Display API error messages to user
- Retry button on failed requests
- Loading skeletons while fetching data
- Empty state messages

### 4. Notifications:
- Success toast: Green background, checkmark icon
- Error toast: Red background, X icon
- Info toast: Blue background, info icon
- Auto-dismiss after 5 seconds

### 5. Data Formatting:
- Numbers: Use thousand separators (1,000)
- CC/QX amounts: 2 decimal places
- Dates: Format as "Dec 6, 2024 10:30 AM"
- Timestamps: Show relative time ("2 hours ago")

---

## QUICK API REFERENCE

**Base URL:** `http://localhost:3000/api/protocol/`

**Authentication:** `Authorization: Bearer {jwt_token}`

| Feature | Method | Endpoint | Auth |
|---------|--------|----------|------|
| Create Stake | POST | `/stake` | User |
| Get User Stakes | GET | `/stake/user/:id` | User |
| Get All Stakes | GET | `/stake/all` | Admin |
| Vault Stats | GET | `/vault/stats` | User |
| Create Task | POST | `/compute-task/create` | Creator |
| Get My Tasks | GET | `/compute-task/my-tasks` | Creator |
| Get All Tasks | GET | `/compute-task/all` | Admin |
| Complete Task | PUT | `/compute-task/simulate-complete` | Admin |
| Create Lease | POST | `/lease` | Investor |
| Get My Leases | GET | `/lease/user/:id` | User |
| Get All Leases | GET | `/lease/all` | Admin |

---

## IMPLEMENTATION CHECKLIST

### Creator Dashboard
- [ ] Create Compute Task form
- [ ] Task history table with pagination
- [ ] CC balance widget
- [ ] Queue status monitor
- [ ] Real-time CC updates

### Investor Dashboard
- [ ] Leasing dashboard with active leases
- [ ] Compute marketplace view
- [ ] CC price chart with multiple timeframes
- [ ] Lease creation flow
- [ ] ROI calculator

### Admin Dashboard
- [ ] All stakes management
- [ ] All tasks monitoring
- [ ] Compute pools visualization
- [ ] Parameter adjustment settings
- [ ] Audit log viewer

### Global Features
- [ ] JWT token management
- [ ] Error handling
- [ ] Loading states
- [ ] Toast notifications
- [ ] Data export (CSV)
- [ ] Responsive design
