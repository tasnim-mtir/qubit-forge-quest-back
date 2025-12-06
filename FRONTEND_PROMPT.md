# 🎨 FRONTEND IMPLEMENTATION PROMPT - Qubitium Protocol

You are building the **Qubitium Protocol Frontend** - a decentralized compute marketplace with three distinct dashboards: Creator, Investor, and Admin.

---

## 🎯 YOUR PROJECT MISSION

Build a **production-ready React/Vue frontend** that interfaces with the Qubitium Protocol backend API at `http://localhost:3000/api/protocol/` to enable users to:

1. **Creators:** Submit compute tasks, monitor execution, track CC balance
2. **Investors:** Create resource leases, browse marketplace, calculate ROI
3. **Admins:** Govern the network, manage parameters, audit changes

---

## 🔑 CRITICAL REQUIREMENTS

### Authentication & Authorization
- Implement JWT token-based authentication
- Store tokens securely (localStorage/sessionStorage)
- Auto-redirect to login if token expired (401 error)
- Implement token refresh mechanism
- Display different UI based on user role (user, creator, investor, admin)
- Show "Access Denied" for insufficient permissions (403 error)

### API Integration
- **Base URL:** `http://localhost:3000/api/protocol/`
- **Header Required:** `Authorization: Bearer {jwt_token}`
- **Content-Type:** `application/json`
- All endpoints return: `{ success: true/false, data: {...}, message: "..." }`
- Handle all error codes: 400 (validation), 401 (auth), 403 (permission), 404 (not found), 500 (server)

### Data Formatting
- **Dates:** Display as "Dec 6, 2024 10:30 AM" (human-readable)
- **Numbers:** Use thousand separators (1,000 / 1,500,000)
- **CC/QX Amounts:** Always show 2 decimal places (100.50 CC)
- **Percentages:** Show 1 decimal place (92.5%)
- **Time Duration:** Show as "2 hours", "3 days", "30 minutes"

---

## 🏗️ PROJECT STRUCTURE

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── Toast.jsx
│   │   ├── auth/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── creator/
│   │   │   ├── CreatorDashboard.jsx
│   │   │   ├── CreateTaskForm.jsx
│   │   │   ├── TaskHistory.jsx
│   │   │   ├── QueueStatus.jsx
│   │   │   └── CCBalance.jsx
│   │   ├── investor/
│   │   │   ├── InvestorDashboard.jsx
│   │   │   ├── CreateLeaseForm.jsx
│   │   │   ├── LeaseHistory.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   └── ROICalculator.jsx
│   │   └── admin/
│   │       ├── AdminDashboard.jsx
│   │       ├── StakesManager.jsx
│   │       ├── TasksMonitor.jsx
│   │       ├── ParameterManager.jsx
│   │       └── AuditLog.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── CreatorPage.jsx
│   │   ├── InvestorPage.jsx
│   │   └── AdminPage.jsx
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   └── protocolService.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useFetch.js
│   │   └── usePagination.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── constants.js
│   ├── App.jsx
│   └── main.jsx
├── public/
├── package.json
└── vite.config.js
```

---

## 🔐 AUTHENTICATION FLOW

### Login Implementation
```javascript
// 1. User enters credentials
// 2. POST /api/auth/login with { email, password }
// 3. Receive { success: true, token: "jwt_token", user: {...} }
// 4. Store token in localStorage: localStorage.setItem('token', token)
// 5. Redirect to dashboard based on user.role
```

### Token Management
```javascript
// Every API request must include header:
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
}

// If 401 response:
// 1. Clear token: localStorage.removeItem('token')
// 2. Redirect to login page
// 3. Show: "Session expired. Please login again"

// If 403 response:
// Show: "You don't have permission to access this"
```

---

## 📊 CREATOR DASHBOARD

### Components to Build

#### 1. Dashboard Overview Card
**Display:**
- Total tasks created (number)
- Success rate (percentage, color-coded: green >80%, yellow 50-80%, red <50%)
- Average execution time (human readable: "45 minutes")
- CC balance (large prominent display)

**API Endpoint:** `GET /api/protocol/dashboard/creator-overview`

**Response Includes:**
```javascript
{
  taskMetrics: {queued, running, completed, failed, total},
  performanceMetrics: {successRate, avgExecutionTime, totalCCSpent},
  ccMetrics: {totalCC, usedCC, available, balance}
}
```

**UI Elements:**
- 4 metric cards in grid layout
- Color-coded status indicators
- Refresh button (poll every 30 seconds)
- Visual progress bar for CC utilization

#### 2. Create Task Form
**Fields:**
- Task Name (text input, required, max 100 chars)
- Description (textarea, optional, max 500 chars)
- CC Cost (number input, required, min 1, max 10,000)
- Priority (dropdown: Low, Medium, High)
- Task Type (dropdown: DataAnalysis, Training, Processing, Other)
- Estimated Duration (number input, optional, in seconds)

**Validation:**
- Show error: "Insufficient CC. Available: X, Required: Y"
- Show error: "Task cost must be between 1 and 10,000 CC"
- Disable submit if CC insufficient
- Show remaining CC after input

**API Endpoint:** `POST /api/protocol/compute-task/create`

**Request:**
```javascript
{
  taskName: "string",
  taskDescription: "string",
  computeCostCC: number,
  estimatedDuration: number,
  priority: "string",
  taskType: "string"
}
```

**Response Shows:**
- Success toast: "Task created successfully! Task ID: xyz"
- Updated CC balance
- Task added to history

**UI Elements:**
- Form with validation feedback
- Real-time CC balance display
- Submit button with loading state
- Cancel button

#### 3. Task History Table
**Columns:**
- Task Name | CC Cost | Status (badge) | Created Date | Duration | Result

**Status Badges:**
- Queued (yellow) | Running (blue) | Completed (green) | Failed (red)

**Features:**
- Sortable columns (click header to sort)
- Filter by status (dropdown: All, Queued, Running, Completed, Failed)
- Pagination (10/25/50 items per page)
- Expandable rows showing full task details & result
- "Cancel" button visible only for queued tasks
- Relative time display ("2 hours ago", "3 days ago")

**API Endpoint:** `GET /api/protocol/compute-task/my-tasks?page=1&limit=10&status=filter`

**Pagination:**
- Show "Page X of Y"
- Previous/Next buttons
- Jump to page input

**UI Elements:**
- DataTable with sorting/filtering
- Status filter dropdown
- Pagination controls
- Expandable detail rows

#### 4. Queue Status Panel
**Display:**
- Current queue position (e.g., "Position 3 in queue")
- Global queue size (e.g., "45 total tasks in queue")
- Estimated wait time (e.g., "~30 minutes")
- Your queued tasks list with positions

**API Endpoint:** `GET /api/protocol/compute-task/queue/status`

**Response Includes:**
```javascript
{
  userQueuedCount: number,
  globalQueuedCount: number,
  userTasks: [{taskId, taskName, position}],
  estimatedWaitTime: "string"
}
```

**UI Elements:**
- Large number display for position
- Progress bar showing queue depth
- Countdown timer for estimated completion
- Task list with positions
- Auto-refresh every 10 seconds

#### 5. CC Balance Widget
**Display:**
- Total CC (large number, colored icon)
- Used CC (percentage, pie chart)
- Available CC (large number, highlight)
- Utilization percentage (progress bar)

**API Endpoint:** `GET /api/protocol/stake/user/:userId`

**Includes:**
- All active stakes
- Unlock dates for each stake
- Summary: totalCC, usedCC, activeStakes

**UI Elements:**
- 3-section pie chart (total, used, available)
- Stats cards
- Unlock date for each stake
- "Stake More" button (links to staking form)
- Auto-refresh every 60 seconds

#### 6. Performance Analytics
**Metrics:**
- Success Rate (%) - gauge chart or circle
- Avg Execution Time - timeline
- Total CC Spent - bar chart
- Task Breakdown - donut chart (queued/running/completed/failed)

**API Endpoint:** `GET /api/protocol/analytics/creator-performance`

**Response Includes:**
```javascript
{
  taskStats: {total, completed, failed, queued, running},
  qualityMetrics: {successRate, avgExecutionTime, avgCCPerTask, totalCCSpent},
  resourceMetrics: {totalCC, usedCC, available, utilizationPercent}
}
```

**UI Elements:**
- Multiple chart types
- Color-coded metrics
- Trend indicators
- Export data button

---

## 💰 INVESTOR DASHBOARD

### Components to Build

#### 1. Dashboard Overview Card
**Display:**
- Active Leases (number)
- Total Compute Leased (units)
- Total Cost (CC)
- Monthly Spending (CC)
- Avg Lease Duration (days)

**API Endpoint:** `GET /api/protocol/dashboard/investor-overview`

**UI Elements:**
- 5 metric cards
- Color-coded status
- Refresh button
- Monthly trend indicator

#### 2. Lease History Table
**Columns:**
- Compute Amount | Cost (CC) | Duration | Status (badge) | Created | Days Left | Actions

**Status Badges:**
- Active (green) | Expired (gray) | Cancelled (red)

**Actions:**
- Extend (button for active leases)
- Cancel (button for active leases)
- View Details (expandable row)

**Features:**
- Sortable columns
- Filter by status
- Pagination
- Show end date & days remaining
- Relative date formatting

**API Endpoints:**
- List: `GET /api/protocol/lease/user/:userId?page=1&limit=10`
- Extend: `PUT /api/protocol/lease/:leaseId/extend`
- Cancel: `POST /api/protocol/lease/:leaseId/cancel`

**UI Elements:**
- DataTable with sorting
- Status filter dropdown
- Extend modal with days input
- Cancel confirmation dialog
- Pagination controls

#### 3. Compute Marketplace
**Display:**
- Grid or list of available compute packages
- Each package shows:
  - Compute amount (units)
  - Cost (CC)
  - Duration (days)
  - Provider reputation (stars: 1-5)
  - Available quantity
  - "Lease Now" button

**Filters:**
- Compute Amount (slider: 10-10,000)
- Cost per day (slider: min-max)
- Duration (slider: 7-365 days)
- Reputation (dropdown: 1+, 2+, 3+, 4+, 5 stars)

**Sorting:**
- Price (low to high, high to low)
- Reputation (highest first)
- Newest first
- Best value

**Features:**
- Search by provider name
- Pagination
- Infinite scroll option
- Add to comparison (checkbox)
- View details modal

**API Endpoint:** `GET /api/protocol/marketplace/compute?minCompute=X&maxCompute=Y&minCost=A&maxCost=B&minDuration=C&maxDuration=D&sortBy=cost&page=1&limit=20`

**Response Includes:**
```javascript
{
  packages: [{id, computeAmount, costCC, duration, provider, reputation, available}],
  filters: {minComputeAvailable, maxComputeAvailable, minDurationAvailable, maxDurationAvailable},
  pagination: {page, limit, total, pages}
}
```

**UI Elements:**
- Responsive grid layout
- Advanced filter panel
- Sort dropdown
- Product cards with all info
- Comparison feature
- Lease button

#### 4. ROI Calculator
**Displays:**
- Total Invested (CC)
- Projected Monthly Return (CC)
- ROI Percentage (%)
- Payback Period (months)
- Lease Breakdown (active, expired, cancelled)

**Calculations:**
- ROI = 5% × activeLeases.length
- Projected Return = totalCost × 0.05 / 12 (monthly)
- Payback = projectedMonthlyReturn / totalInvested

**API Endpoint:** `GET /api/protocol/analytics/investor-roi`

**Response Includes:**
```javascript
{
  portfolio: {totalInvestedCC, activeLeases, completedLeases, totalComputeLeased},
  returns: {roiPercent, projectedMonthlyReturn, avgLeaseDuration},
  leaseBreakdown: {active, expired, cancelled}
}
```

**UI Elements:**
- Large ROI percentage display with color
- Donut chart for lease breakdown
- Growth projection chart
- Summary cards
- Auto-refresh every 60 seconds

#### 5. CC Price Chart
**Display:**
- Line chart showing CC price over time
- Timeframe selector (24h, 7d, 30d, All)
- Current price display
- 24h change (% and arrow)
- High/Low price

**API Endpoint:** `GET /api/protocol/analytics/cc-price-history?timeframe=7d`

**Response Includes:**
```javascript
{
  priceData: [{timestamp, price, cc}],
  summary: {current, change24h, high, low, volume}
}
```

**UI Elements:**
- Line chart (Chart.js or similar)
- Timeframe buttons
- Price statistics panel
- Auto-refresh every 5 minutes
- Export chart option

#### 6. Lease Extension Modal
**When:** User clicks "Extend" on active lease

**Fields:**
- Additional Days (number input, 1-365)
- Renewal Discount (auto-calculated, 3%)
- New Total Cost (auto-calculated)
- New End Date (display, calculated)

**Calculation:**
- discountAmount = (costCC × 3) / 100
- additionalCost = (costCC / duration) × additionalDays × 0.97
- newEndDate = currentEndDate + additionalDays

**Buttons:**
- Confirm button
- Cancel button

**After Confirm:**
- Show success toast: "Lease extended by X days with 3% discount"
- Update lease in table
- Recalculate ROI

**API Endpoint:** `PUT /api/protocol/lease/:leaseId/extend`

**Request:** `{ additionalDays: number }`

**UI Elements:**
- Modal with form
- Auto-calculated fields
- Confirmation buttons
- Loading state on submit

---

## 👥 ADMIN DASHBOARD

### Components to Build

#### 1. Dashboard Overview Card
**Display:**
- Total QX Locked (number)
- Total CC Distributed (number)
- Active Stakes (number)
- Tasks Completed (number)
- Success Rate (%)
- Pool Health (colored badge: Healthy/Warning/Critical)

**API Endpoint:** `GET /api/protocol/dashboard/admin-overview`

**UI Elements:**
- 6 metric cards
- Color-coded health status
- Trend indicators
- Refresh button

#### 2. Stakes Manager Table
**Columns:**
- User Email | Amount QX | CC Received | Lock Period | Status | Unlock Date | Actions

**Status Badges:**
- Active (green) | Released (blue) | Claimed (gray)

**Actions:**
- Adjust Lock Period (button for active stakes)
- View Details (expandable row)

**Features:**
- Sortable columns (click header)
- Filter by status (dropdown)
- Filter by amount range (min-max inputs)
- Date range filter (from-to)
- Pagination (20 items per page default)
- Search by email

**API Endpoint:** `GET /api/protocol/stake/all?status=active&minAmount=0&maxAmount=1000&page=1&limit=20&sortBy=createdAt`

**Response Includes:**
```javascript
{
  stakes: [{...}],
  summary: {totalQXLocked, totalCCDistributed, avgStakeAmount},
  pagination: {page, limit, total, pages}
}
```

**UI Elements:**
- DataTable with sorting/filtering
- Filter panel with multiple criteria
- Adjust modal
- Pagination controls
- Summary stats

#### 3. Adjust Lock Period Modal
**When:** Admin clicks "Adjust Lock Period" on a stake

**Fields:**
- Current Lock Period (display, read-only)
- New Lock Period (number input, >0)
- Reason (textarea, required)

**Validation:**
- newLockPeriod > 0
- Reason not empty

**Buttons:**
- Confirm (with warning: "This will extend/reduce the unlock date")
- Cancel

**After Confirm:**
- Show success toast: "Lock period adjusted from X to Y days"
- Update table
- Show audit entry

**API Endpoint:** `PUT /api/protocol/stake/:stakeId/adjust-lock-period`

**Request:**
```javascript
{
  newLockPeriod: number,
  reason: "string"
}
```

**UI Elements:**
- Modal with form
- Read-only display of current value
- Reason textarea
- Confirmation buttons
- Loading state

#### 4. Tasks Monitor Table
**Columns:**
- Task Name | Creator | Cost | Status | Created | Duration | Actions

**Status Badges:**
- Queued (yellow) | Running (blue) | Completed (green) | Failed (red)

**Actions:**
- Complete (button for queued/running tasks)
- Force Fail (button for queued/running tasks)
- View Details (expandable row)

**Features:**
- Sortable columns
- Filter by status
- Filter by cost range (min-max)
- Date range filter
- Search by task name or creator email
- Pagination (20 items)

**Task Details Include:**
- Full task information
- CC cost
- Estimated vs actual duration
- Result data
- Creator email

**API Endpoints:**
- List: `GET /api/protocol/compute-task/all?status=completed&minCost=0&maxCost=10000&page=1&limit=20`
- Complete: `PUT /api/protocol/compute-task/:taskId/simulate-complete`
- Force Fail: `PUT /api/protocol/compute-task/:taskId/force-fail`

**UI Elements:**
- DataTable with sorting/filtering
- Filter panel
- Action modals
- Pagination controls
- Summary cards (queued, running, completed, failed counts)

#### 5. Complete/Force Fail Modals

**Complete Task Modal:**
- Task name (display)
- Result (textarea, optional)
- Reason (textarea, optional)
- Buttons: Complete, Cancel

**Force Fail Modal:**
- Task name (display)
- Failure Reason (textarea, required)
- Buttons: Confirm, Cancel

**After Action:**
- Update table
- Show success toast
- Recalculate network metrics

#### 6. Parameter Manager
**Display:**
- List of all parameters in sections:
  - CC to QX Conversion (current value, input field, edit button)
  - Reward Rate (current value, input field, edit button)
  - Task Parameters (min cost, max cost, timeout)
  - Lease Parameters (min duration, max duration, renewal incentive)
  - Marketplace Parameters (min/max compute amount)

**For Each Parameter:**
- Current Value (display)
- Input Field (for new value)
- Reason textarea (required when editing)
- Edit Button
- Cancel Button
- History Button (shows last 5 changes)

**Edit Flow:**
1. Admin clicks Edit button
2. Input field becomes enabled
3. Admin enters new value and reason
4. Admin clicks Save
5. Show confirmation: "Parameter changed from X to Y. Reason: Z"
6. Update display
7. Add to audit log

**API Endpoints:**
- Get: `GET /api/protocol/parameters`
- Update: `PUT /api/protocol/parameters/:paramName`

**Request:**
```javascript
{
  newValue: number,
  reason: "string"
}
```

**Response:**
```javascript
{
  success: true,
  change: {parameter, oldValue, newValue, reason, admin, timestamp}
}
```

**UI Elements:**
- Organized sections
- Input fields with validation
- Reason textarea
- Save/Cancel buttons
- Confirmation dialogs
- Change history display

#### 7. Audit Log Viewer
**Display:**
- Table with columns: Timestamp | Admin | Parameter | Old Value | New Value | Reason

**Features:**
- Date range filter
- Search by admin email
- Search by parameter name
- Pagination (20 items per page)
- Export to CSV button
- Sortable by timestamp (newest first by default)
- Expandable rows for full reason text

**API Endpoint:** `GET /api/protocol/parameters/audit-log?page=1&limit=20`

**Response Includes:**
```javascript
{
  auditLog: [{timestamp, admin, parameter, oldValue, newValue, reason, id}],
  pagination: {page, limit, total, pages}
}
```

**UI Elements:**
- DataTable with sorting
- Date range filter
- Search fields
- Pagination controls
- Export button
- Expandable detail rows

#### 8. Network Metrics Panel
**Display:**
- Task Metrics:
  - Total Executed (number)
  - Success Rate (%)
  - Completed (number)
  - Failed (number)
  
- Economy Metrics:
  - Total QX Locked (number)
  - Total CC in Circulation (number)
  - CC Burn Rate (number per task)
  - Reward Pool (number)
  
- Participation Metrics:
  - Total Users (number)
  - Active Creators (number)
  - Active Investors (number)
  - Total Stakers (number)
  
- Market Metrics:
  - Active Leases (number)
  - Total Compute Available (units)
  - CC per QX (rate)

**Charts:**
- Line chart: QX locked over time
- Line chart: Tasks executed over time
- Pie chart: User breakdown (creators/investors/users)
- Gauge chart: Network success rate

**API Endpoint:** `GET /api/protocol/analytics/network-metrics`

**UI Elements:**
- Multiple metric cards
- Multiple chart types
- Auto-refresh every 60 seconds
- Export data option

#### 9. User Management
**Features:**
- Search users by email
- List all users with columns: Email | Role | Status | Created | Actions
- Ban button (for non-admin users)
- Unban button (for banned users)

**Ban Flow:**
1. Admin clicks Ban button
2. Confirmation dialog: "Ban user@example.com? They will be unable to use the platform."
3. If confirmed, user status → "banned"
4. Show success toast
5. Update table (button changes to "Unban")

**API Endpoints:**
- Ban: `PUT /api/protocol/users/:userId/ban`
- Unban: `PUT /api/protocol/users/:userId/unban`

**UI Elements:**
- User search input
- DataTable with user list
- Ban/Unban buttons
- Confirmation dialogs
- Status badges

---

## 🎨 COMMON UI COMPONENTS

### 1. Header
**Display:**
- App logo/title
- Current page title
- User profile dropdown (email, role, logout button)
- Notification bell (if needed)

**Logout Flow:**
- Clear token from localStorage
- Redirect to login
- Show message: "Logged out successfully"

### 2. Sidebar Navigation
**Links Based on Role:**
- All: Dashboard, Profile, Logout
- Creator: + Task Management, Queue Status, Performance
- Investor: + Lease Management, Marketplace
- Admin: + Stakes, Tasks, Parameters, Audit Log, Network, Users

**Features:**
- Active link highlighting
- Collapsible on mobile
- Show current role
- Show user email

### 3. Loading States
- Show spinner for initial page load
- Show skeleton screens for tables
- Show loading button state for form submissions
- Show progress indicator for long operations

### 4. Error Handling
- **Display errors:**
  - Show error toast with message from API
  - Display validation errors under form fields
  - Show 404 page for not found resources
  - Show 403 page for access denied
  - Show 500 page for server errors

- **Error Messages Should:**
  - Be user-friendly
  - Suggest action: "Insufficient CC. Stake more QX to continue."
  - Include relevant details: "Task cost must be between 1 and 10,000 CC"

### 5. Toast Notifications
- **Success:** Green background, checkmark icon, auto-dismiss 3s
- **Error:** Red background, X icon, auto-dismiss 5s
- **Info:** Blue background, info icon, auto-dismiss 4s
- **Position:** Top-right corner
- **Example:** "Task created successfully! ID: abc123"

### 6. Modals/Dialogs
- Always have close button (X in corner)
- Always have Cancel button
- Always have primary action button
- Show loading state on submit
- Disable submit while loading
- Close on successful action

### 7. Tables
- **Features:**
  - Sortable columns (click header, show sort arrow)
  - Filterable (filter icon, dropdown or input)
  - Paginated (prev/next buttons, page selector)
  - Expandable rows (show details)
  - Responsive (stack on mobile)
  - Empty state message if no data
  - Loading skeleton while fetching

### 8. Forms
- **Features:**
  - Clear labels for each field
  - Input validation feedback (show below field)
  - Required fields marked with *
  - Disabled submit if form invalid
  - Loading state on submit
  - Success/error messages
  - Clear error descriptions

### 9. Charts & Visualizations
- Use Chart.js, Recharts, or similar
- **Chart Types:**
  - Line charts: For trends (price, tasks, QX over time)
  - Pie/Donut charts: For distribution (lease breakdown, user types)
  - Bar charts: For comparisons (task costs, performance)
  - Gauge charts: For metrics (success rate, utilization)
  - Progress bars: For CC utilization, queue progress

### 10. Cards/Metric Displays
- Large number display (metric value)
- Smaller label (metric name)
- Indicator (up/down arrow or status badge)
- Subtitle (additional info)
- Icon or color coding

---

## 🔄 API INTEGRATION PATTERNS

### Making API Requests
```javascript
// 1. Get token from localStorage
const token = localStorage.getItem('token');

// 2. Make request with token
const response = await fetch(
  'http://localhost:3000/api/protocol/dashboard/creator-overview',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

// 3. Check response status
if (response.status === 401) {
  // Token expired, redirect to login
  localStorage.removeItem('token');
  window.location.href = '/login';
}

if (response.status === 403) {
  // Permission denied
  showError('You do not have permission to access this');
  return;
}

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

// 4. Parse and use data
const data = await response.json();
if (data.success) {
  return data.data; // Use the data
} else {
  throw new Error(data.message);
}
```

### Pagination Pattern
```javascript
// Load page 1
GET /api/protocol/compute-task/my-tasks?page=1&limit=10

// Response includes pagination object:
{
  success: true,
  tasks: [...],
  pagination: {
    page: 1,
    limit: 10,
    total: 45,
    pages: 5
  }
}

// Next page:
GET /api/protocol/compute-task/my-tasks?page=2&limit=10
```

### Filtering Pattern
```javascript
// Filter by status:
GET /api/protocol/compute-task/all?status=completed

// Filter by range:
GET /api/protocol/stake/all?minAmount=10&maxAmount=100

// Multiple filters:
GET /api/protocol/lease/all?status=active&minCost=50&maxCost=500

// Sorting:
GET /api/protocol/stake/all?sortBy=createdAt

// All combined:
GET /api/protocol/compute-task/all?status=completed&minCost=10&maxCost=100&page=1&limit=20&sortBy=createdAt
```

---

## 📋 FEATURE CHECKLIST

### Authentication
- [ ] Login page with email & password
- [ ] Register page
- [ ] JWT token storage
- [ ] Token refresh on 401
- [ ] Logout functionality
- [ ] Protected routes (redirect to login if no token)
- [ ] Role-based route protection

### Creator Dashboard
- [ ] Overview cards (tasks, success rate, CC balance)
- [ ] Create task form with validation
- [ ] Task history table with sorting/filtering
- [ ] Queue status with position & wait time
- [ ] CC balance widget with unlock dates
- [ ] Performance analytics with charts
- [ ] Auto-refresh every 30-60 seconds

### Investor Dashboard
- [ ] Overview cards (leases, compute, cost)
- [ ] Lease history table with extend/cancel
- [ ] Marketplace browser with advanced filters
- [ ] ROI calculator with projections
- [ ] CC price chart with timeframe selector
- [ ] Lease extension modal with calculations
- [ ] Auto-refresh every 60 seconds

### Admin Dashboard
- [ ] Overview cards (stakes, tasks, pool health)
- [ ] Stakes manager table with adjust lock period
- [ ] Tasks monitor with complete/force fail actions
- [ ] Parameter manager with edit capability
- [ ] Audit log viewer with full history
- [ ] Network metrics panel with charts
- [ ] User management with ban/unban
- [ ] Export capabilities for data

### Common Features
- [ ] Error toast notifications
- [ ] Success toast notifications
- [ ] Loading states on all operations
- [ ] Empty state messages
- [ ] Responsive mobile design
- [ ] Data export (CSV for tables)
- [ ] Timezone handling
- [ ] Number formatting (thousand separators)
- [ ] Date formatting (human readable)
- [ ] Keyboard shortcuts (Enter to submit forms)

---

## 🚀 DEVELOPMENT WORKFLOW

### Phase 1: Setup (Day 1)
1. Setup React/Vue project structure
2. Install dependencies (axios, chart library, UI library)
3. Setup API service layer
4. Create authentication service
5. Setup routing

### Phase 2: Authentication (Day 1-2)
1. Build login/register forms
2. Implement JWT token storage
3. Setup protected routes
4. Implement logout

### Phase 3: Creator (Day 2-3)
1. Build dashboard overview
2. Build create task form
3. Build task history table
4. Build queue status
5. Build CC balance widget
6. Add auto-refresh

### Phase 4: Investor (Day 3-4)
1. Build dashboard overview
2. Build lease history
3. Build marketplace
4. Build ROI calculator
5. Build price chart
6. Add extend/cancel modals

### Phase 5: Admin (Day 4-5)
1. Build dashboard overview
2. Build stakes manager
3. Build tasks monitor
4. Build parameter manager
5. Build audit log
6. Build network metrics
7. Build user management

### Phase 6: Polish (Day 5-6)
1. Error handling refinement
2. Loading states
3. Mobile responsiveness
4. Performance optimization
5. Testing & bug fixes

---

## ⚠️ COMMON PITFALLS TO AVOID

1. **Forgetting token in headers** → API returns 401
2. **Not handling 401 errors** → User gets stuck on expired session
3. **Not showing loading states** → Users think app is broken
4. **Not validating form input** → Confusing error from API
5. **Not formatting numbers** → Display looks unprofessional
6. **Not handling empty states** → Table looks broken when no data
7. **Not auto-refreshing data** → User sees stale data
8. **Not showing error messages** → Users don't know what went wrong
9. **Not paginating large lists** → Performance problems
10. **Hardcoding API URL** → Can't deploy to different environments

---

## 🎯 SUCCESS CRITERIA

Your frontend is complete when:
✅ All users can authenticate  
✅ Creators can create and manage tasks  
✅ Investors can create and manage leases  
✅ Admins can manage parameters and monitor network  
✅ All data displays correctly formatted  
✅ All forms validate properly  
✅ All errors show user-friendly messages  
✅ All pages load without errors  
✅ Mobile responsiveness works  
✅ Performance is smooth (no lag)  

---

## 📞 SUPPORT RESOURCES

- **API Reference:** `/API_ENDPOINTS_COMPLETE.md`
- **Implementation Guide:** `/FRONTEND_IMPLEMENTATION_GUIDE.md`
- **Quick Reference:** `/QUICK_REFERENCE.md`
- **Endpoint Matrix:** `/ENDPOINT_REFERENCE_MATRIX.md`
- **Backend Code:** `/routes/protocol.js`

---

## 🏆 YOU'RE READY TO BUILD!

You now have everything needed to build the complete Qubitium Protocol frontend:
✅ Complete API documentation  
✅ Endpoint specifications  
✅ Response formats  
✅ Implementation checklist  
✅ UI component guide  
✅ Feature requirements  
✅ API integration patterns  

**The backend is ready. Let's build an amazing frontend! 🚀**

