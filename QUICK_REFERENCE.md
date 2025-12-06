# Quick Reference Guide - Qubitium Protocol API

## Server Setup

```bash
# Start the backend server
npm start

# Server runs on http://localhost:3000
# Base API path: /api/protocol/
```

---

## Authentication

All requests except `/admin/login` and `/register` require:
```
Authorization: Bearer {jwt_token}
```

Store token in `localStorage` or session:
```javascript
localStorage.setItem('token', response.token);
```

---

## Role Types

| Role | Access | Key Features |
|------|--------|--------------|
| user | Read own data | View stakes, tasks |
| creator | Submit tasks | Create tasks, view performance |
| investor | Lease resources | Create leases, browse marketplace |
| admin | Full access | Manage all, modify parameters |

---

## Common Request/Response Patterns

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

### Paginated Response
```json
{
  "success": true,
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

---

## Top 10 Most-Used Endpoints

### Creator
1. **Create Task**
   ```
   POST /api/protocol/compute-task/create
   Body: { taskName, computeCostCC }
   ```

2. **View My Tasks**
   ```
   GET /api/protocol/compute-task/my-tasks?page=1&limit=10
   ```

3. **Dashboard Overview**
   ```
   GET /api/protocol/dashboard/creator-overview
   ```

### Investor
4. **Create Lease**
   ```
   POST /api/protocol/lease
   Body: { computeAmount, costCC, duration }
   ```

5. **Browse Marketplace**
   ```
   GET /api/protocol/marketplace/compute?sortBy=cost
   ```

6. **Dashboard Overview**
   ```
   GET /api/protocol/dashboard/investor-overview
   ```

### Admin
7. **View All Stakes**
   ```
   GET /api/protocol/stake/all?page=1&limit=20
   ```

8. **Modify Parameters**
   ```
   PUT /api/protocol/parameters/QX_TO_CC_RATIO
   Body: { newValue: 120, reason: "..." }
   ```

9. **View Network Metrics**
   ```
   GET /api/protocol/analytics/network-metrics
   ```

10. **Dashboard Overview**
    ```
    GET /api/protocol/dashboard/admin-overview
    ```

---

## Parameter Configuration

### Current Defaults
```javascript
QX_TO_CC_RATIO: 100          // 1 QX = 100 CC
REWARD_RATE: 5               // 5% annual
MIN_TASK_COST: 1             // CC minimum
MAX_TASK_COST: 10000         // CC maximum
DEFAULT_TASK_TIMEOUT: 3600   // seconds
MIN_LEASE_DURATION: 7        // days
MAX_LEASE_DURATION: 365      // days
LEASE_RENEWAL_INCENTIVE: 3   // % discount
MIN_COMPUTE_AMOUNT: 10       // units
MAX_COMPUTE_AMOUNT: 10000    // units
```

### Adjust Parameter
```bash
PUT /api/protocol/parameters/QX_TO_CC_RATIO
{
  "newValue": 120,
  "reason": "Increased due to network growth"
}
```

---

## Common Queries

### Filter by Status
```
GET /api/protocol/compute-task/all?status=completed
GET /api/protocol/lease/all?status=active
GET /api/protocol/stake/all?status=active
```

### Filter by Cost Range
```
GET /api/protocol/compute-task/all?minCost=10&maxCost=100
GET /api/protocol/lease/all?minCost=50&maxCost=500
```

### Sort Results
```
GET /api/protocol/stake/all?sortBy=createdAt
GET /api/protocol/compute-task/all?sortBy=computeCostCC
GET /api/protocol/lease/all?sortBy=duration
```

### Pagination
```
GET /api/protocol/...?page=1&limit=10
GET /api/protocol/...?page=2&limit=20
```

---

## Task Workflow (Creator)

```
1. Get CC balance
   GET /api/protocol/stake/user/{userId}
   
2. Create task
   POST /api/protocol/compute-task/create
   
3. Check queue position
   GET /api/protocol/compute-task/queue/status
   
4. View task status
   GET /api/protocol/compute-task/my-tasks
   
5. Check performance
   GET /api/protocol/analytics/creator-performance
```

---

## Lease Workflow (Investor)

```
1. Browse marketplace
   GET /api/protocol/marketplace/compute
   
2. Create lease
   POST /api/protocol/lease
   
3. View leases
   GET /api/protocol/lease/user/{userId}
   
4. Extend lease
   PUT /api/protocol/lease/{leaseId}/extend
   
5. Check ROI
   GET /api/protocol/analytics/investor-roi
```

---

## Admin Workflow

```
1. View dashboard
   GET /api/protocol/dashboard/admin-overview
   
2. Check network health
   GET /api/protocol/analytics/network-metrics
   
3. Review all stakes
   GET /api/protocol/stake/all
   
4. Adjust parameters
   PUT /api/protocol/parameters/{paramName}
   
5. View audit log
   GET /api/protocol/parameters/audit-log
```

---

## Status Enums

### Task Status
- queued
- running
- completed
- failed
- cancelled

### Lease Status
- active
- expired
- cancelled

### Stake Status
- active
- released
- claimed

### User Status
- active
- banned

---

## Calculated Fields (Auto-Generated)

These fields are calculated by the API, don't include in requests:

**Stake Endpoints:**
- `unlockDate` - Calculated from createdAt + lockPeriod

**Lease Endpoints:**
- `endDate` - Calculated from createdAt + duration
- `daysRemaining` - Calculated as days until endDate

**Task Endpoints:**
- Queue position in global queue
- Estimated wait time

**Analytics Endpoints:**
- Success rates
- Average execution times
- CC burn rate
- ROI projections

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format and parameters |
| 401 | Unauthorized | Ensure valid JWT token in header |
| 403 | Forbidden | Check user role permissions |
| 404 | Not Found | Verify resource ID exists |
| 500 | Server Error | Check server logs |

---

## Frontend Integration Checklist

- [ ] Store JWT token after login
- [ ] Include token in all requests (`Authorization: Bearer {token}`)
- [ ] Handle 401 errors with token refresh
- [ ] Display pagination controls
- [ ] Implement filtering dropdowns
- [ ] Show loading states during API calls
- [ ] Display error messages from API
- [ ] Format dates as "Dec 6, 2024 10:30 AM"
- [ ] Format numbers with thousand separators
- [ ] Display CC/QX with 2 decimal places

---

## Example: Complete Creator Flow

```javascript
// 1. Login
const loginRes = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email: 'creator@example.com', password: '12345' })
});
const { token } = await loginRes.json();
localStorage.setItem('token', token);

// 2. Get dashboard
const dashRes = await fetch('http://localhost:3000/api/protocol/dashboard/creator-overview', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const dashboard = await dashRes.json();
console.log('Overview:', dashboard.overview);

// 3. Create task
const taskRes = await fetch('http://localhost:3000/api/protocol/compute-task/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    taskName: 'Data Analysis',
    computeCostCC: 50
  })
});
const task = await taskRes.json();
console.log('Task created:', task);

// 4. Check queue status
const queueRes = await fetch('http://localhost:3000/api/protocol/compute-task/queue/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const queue = await queueRes.json();
console.log('Queue position:', queue.queueStatus.userTasks);
```

---

## Environment Variables Required

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/qubitium
JWT_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
CORS_ORIGIN=http://localhost:8081
```

---

## Performance Tips

1. **Pagination:** Always use pagination for large datasets (tasks, stakes, leases)
2. **Filtering:** Use filters to reduce result set size
3. **Caching:** Cache dashboard data for 30 seconds if possible
4. **Debouncing:** Debounce parameter changes to prevent rapid updates
5. **Lazy Loading:** Load marketplace packages incrementally

---

## Support Resources

- **Full API Docs:** `API_ENDPOINTS_COMPLETE.md`
- **Implementation Guide:** `FRONTEND_IMPLEMENTATION_GUIDE.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Backend Repo:** Check `routes/protocol.js` for endpoint logic

---

## Quick Troubleshooting

**"Token expired"** → Login again and get new token

**"Insufficient role"** → Check user role with `GET /api/auth/me`

**"Insufficient CC"** → Stake more QX first with `POST /api/protocol/stake`

**"Invalid parameter"** → Check parameter name in `GET /api/protocol/parameters`

**"Resource not found"** → Verify ID exists in database

