# Endpoint Reference Matrix

## Quick Lookup Table

### Authentication (Auth Routes)
| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/api/auth/register` | ❌ | - | Register new user |
| POST | `/api/auth/login` | ❌ | - | Login user |
| GET | `/api/auth/me` | ✅ | Any | Get current user |
| POST | `/api/auth/admin/login` | ❌ | - | Admin login |
| GET | `/api/auth/admin/users` | ✅ | Admin | List users |
| GET | `/api/auth/admin/users/:userId` | ✅ | Admin | Get user details |
| POST | `/api/auth/admin/users` | ✅ | Admin | Create user |
| PUT | `/api/auth/admin/users/:userId` | ✅ | Admin | Update user |
| DELETE | `/api/auth/admin/users/:userId` | ✅ | Admin | Delete user |

---

### Dashboard Overview (Protocol Routes)
| Method | Endpoint | Auth | Role | Purpose | Returns |
|--------|----------|------|------|---------|---------|
| GET | `/api/protocol/dashboard/creator-overview` | ✅ | Creator | Creator dashboard summary | Tasks, metrics, CC balance |
| GET | `/api/protocol/dashboard/investor-overview` | ✅ | Investor | Investor dashboard summary | Leases, resources, metrics |
| GET | `/api/protocol/dashboard/admin-overview` | ✅ | Admin | Admin dashboard summary | Stakes, tasks, pool metrics |

---

### Staking System
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| POST | `/api/protocol/stake` | ✅ | Any | Create stake | - |
| GET | `/api/protocol/stake/user/:userId` | ✅ | Any | Get user stakes | page, limit |
| GET | `/api/protocol/stake/all` | ✅ | Admin | List all stakes | status, minAmount, maxAmount, page, limit, sortBy |
| PUT | `/api/protocol/stake/:stakeId/adjust-lock-period` | ✅ | Admin | Adjust lock period | - |
| GET | `/api/protocol/vault/stats` | ✅ | Any | Vault statistics | - |

---

### Compute Tasks
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| POST | `/api/protocol/compute-task/create` | ✅ | Creator | Create task | - |
| GET | `/api/protocol/compute-task/my-tasks` | ✅ | Creator | Get creator's tasks | status, page, limit |
| GET | `/api/protocol/compute-task/all` | ✅ | Admin | List all tasks | status, minCost, maxCost, page, limit, sortBy |
| PUT | `/api/protocol/compute-task/:taskId/simulate-complete` | ✅ | Admin | Complete task | - |
| PUT | `/api/protocol/compute-task/:taskId/force-fail` | ✅ | Admin | Force fail task | - |
| POST | `/api/protocol/compute-task/:taskId/cancel` | ✅ | Creator | Cancel queued task | - |
| GET | `/api/protocol/compute-task/queue/status` | ✅ | Creator | Get queue status | - |

---

### Leasing System
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| POST | `/api/protocol/lease` | ✅ | Investor | Create lease | - |
| GET | `/api/protocol/lease/user/:userId` | ✅ | Any | Get investor's leases | page, limit |
| GET | `/api/protocol/lease/all` | ✅ | Admin | List all leases | status, minCost, maxCost, page, limit, sortBy |
| PUT | `/api/protocol/lease/:leaseId/extend` | ✅ | Any | Extend lease | - |
| POST | `/api/protocol/lease/:leaseId/cancel` | ✅ | Investor | Cancel lease | - |

---

### Protocol Parameters & Management
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| GET | `/api/protocol/parameters` | ✅ | Admin | View all parameters | - |
| PUT | `/api/protocol/parameters/:paramName` | ✅ | Admin | Update parameter | - |
| GET | `/api/protocol/parameters/audit-log` | ✅ | Admin | View audit log | page, limit |

---

### Marketplace
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| GET | `/api/protocol/marketplace/compute` | ✅ | Investor | Browse compute marketplace | minCompute, maxCompute, minCost, maxCost, minDuration, maxDuration, sortBy, page, limit |

---

### Analytics & Metrics
| Method | Endpoint | Auth | Role | Purpose | Query Params |
|--------|----------|------|------|---------|--------------|
| GET | `/api/protocol/analytics/cc-price-history` | ✅ | Any | Historical CC pricing | timeframe (24h, 7d, 30d, all) |
| GET | `/api/protocol/analytics/network-metrics` | ✅ | Any | Global network metrics | - |
| GET | `/api/protocol/analytics/creator-performance` | ✅ | Creator | Creator performance stats | - |
| GET | `/api/protocol/analytics/investor-roi` | ✅ | Investor | Investor ROI analysis | - |

---

### User Management
| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| PUT | `/api/protocol/users/:userId/ban` | ✅ | Admin | Ban user |
| PUT | `/api/protocol/users/:userId/unban` | ✅ | Admin | Unban user |

---

## Endpoint Count Summary

| Category | Count |
|----------|-------|
| Authentication | 9 |
| Dashboard | 3 |
| Staking | 5 |
| Tasks | 7 |
| Leasing | 5 |
| Parameters | 3 |
| Marketplace | 1 |
| Analytics | 4 |
| User Mgmt | 2 |
| **TOTAL** | **39** |

---

## By HTTP Method

| Method | Count | Examples |
|--------|-------|----------|
| GET | 16 | Dashboard, List endpoints, Metrics |
| POST | 10 | Create task, Create lease, Create stake, Cancel operations |
| PUT | 8 | Update parameters, Extend lease, Adjust stake, Complete task |
| DELETE | 1 | Delete user |
| **TOTAL** | **35** | - |

---

## By Role Access

| Role | Endpoints | Example |
|------|-----------|---------|
| User (Any) | 8 | Get stakes, dashboard endpoints, analytics |
| Creator | 15 | + Task creation, queue status |
| Investor | 14 | + Lease management, marketplace |
| Admin | 35+ | All endpoints + parameter management, audit logs |

---

## By Data Type

### Staking Operations
- Create new stake
- View user stakes
- View all stakes (admin)
- Adjust lock periods (admin)
- View vault statistics

### Task Operations
- Create task
- Get my tasks
- Get all tasks (admin)
- Complete task (admin)
- Force fail task (admin)
- Cancel task
- Check queue status

### Lease Operations
- Create lease
- Get my leases
- Get all leases (admin)
- Extend lease
- Cancel lease

### Analytics
- CC price history
- Network metrics
- Creator performance
- Investor ROI

### Admin Controls
- View/modify parameters
- Audit parameter changes
- Ban/unban users
- Force complete/fail tasks
- Adjust stake terms

---

## Typical Response Times

| Endpoint Type | Expected Time |
|---------------|---------------|
| Dashboard (overview) | 50-100ms |
| List endpoints (paginated) | 100-200ms |
| Create operations | 200-300ms |
| Modify operations | 200-300ms |
| Analytics calculations | 150-250ms |
| Parameter changes | 50-100ms |

---

## Rate Limit Recommendations

| Endpoint Type | Recommended Limit |
|---------------|-------------------|
| Create operations | 100 per minute per user |
| List operations | 1000 per minute per user |
| Read operations | Unlimited |
| Parameter changes | 10 per minute per admin |
| Audit log access | 100 per minute |

---

## Testing Checklist

### Happy Paths
- [ ] Creator: Stake → Create task → Complete task
- [ ] Investor: Create lease → Extend lease → Cancel lease
- [ ] Admin: Modify parameter → View audit log → Ban user

### Error Cases
- [ ] Insufficient CC for task
- [ ] Invalid role access
- [ ] Expired JWT token
- [ ] Duplicate email registration
- [ ] Non-existent resource

### Edge Cases
- [ ] Zero CC balance
- [ ] Lease duration limits
- [ ] Task cost limits
- [ ] Parameter boundaries
- [ ] Concurrent operations

---

## Frontend Implementation Order

### Phase 1: Authentication
1. Register form
2. Login form
3. JWT storage
4. Token refresh logic

### Phase 2: Creator Dashboard
1. Display creator overview
2. Create task form
3. Task history table
4. Queue status
5. Performance metrics

### Phase 3: Investor Dashboard
1. Display investor overview
2. Create lease form
3. Leases table
4. Marketplace browser
5. ROI calculator

### Phase 4: Admin Dashboard
1. Display admin overview
2. Stakes management
3. Tasks monitoring
4. Parameters editor
5. Audit log viewer

### Phase 5: Polish
1. Error handling
2. Loading states
3. Notifications
4. Responsive design
5. Performance optimization

---

## Common Query Patterns

### Get paginated list with filtering
```
GET /api/protocol/compute-task/all?status=completed&minCost=10&maxCost=100&page=1&limit=20&sortBy=createdAt
```

### Get user's resources with pagination
```
GET /api/protocol/stake/user/:userId?page=1&limit=10
GET /api/protocol/lease/user/:userId?page=1&limit=10
GET /api/protocol/compute-task/my-tasks?status=running&page=1&limit=10
```

### Admin monitoring
```
GET /api/protocol/dashboard/admin-overview
GET /api/protocol/analytics/network-metrics
GET /api/protocol/stake/all?status=active&sortBy=amountQX
GET /api/protocol/compute-task/all?sortBy=createdAt
```

### Analytics & Reporting
```
GET /api/protocol/analytics/cc-price-history?timeframe=7d
GET /api/protocol/analytics/creator-performance
GET /api/protocol/analytics/investor-roi
```

---

## API Documentation Files

| File | Purpose |
|------|---------|
| `API_ENDPOINTS_COMPLETE.md` | Comprehensive endpoint reference with full response examples |
| `FRONTEND_IMPLEMENTATION_GUIDE.md` | Frontend-focused guide with UI/UX recommendations |
| `IMPLEMENTATION_SUMMARY.md` | Backend implementation details and features |
| `QUICK_REFERENCE.md` | Quick lookup guide for common tasks |
| `ENDPOINT_REFERENCE_MATRIX.md` | This file - quick endpoint lookup |

---

