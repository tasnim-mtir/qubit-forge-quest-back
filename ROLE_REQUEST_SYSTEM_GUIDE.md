# 🎯 ROLE REQUEST SYSTEM - COMPLETE DOCUMENTATION

## 📋 Overview

A complete **Role Request & Approval System** for your backend where:
- ✅ Users (role="user") can request to become creators or investors
- ✅ Admins review and approve/reject requests
- ✅ User roles update automatically on approval
- ✅ Full activity logging for auditing
- ✅ Prevents duplicate pending requests
- ✅ Real-time pending count for admin dashboard

---

## 🏗️ NEW FILES CREATED

### 1. `models/RoleRequest.js` - Role Request Schema
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  requestedRole: "creator" | "investor",
  message: String (optional),
  status: "pending" | "approved" | "rejected",
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  rejectionReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. `models/RoleChangeLog.js` - Activity Log
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  adminId: ObjectId (ref: User),
  roleRequestId: ObjectId (ref: RoleRequest),
  oldRole: String,
  newRole: String | null,
  action: "approved" | "rejected",
  reason: String,
  ipAddress: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 3. `routes/roleRequest.js` - All Role Request Routes

### 4. **Updated**: `server.js` - Added role request routes

---

## 📡 API ENDPOINTS

### USER ENDPOINTS (Authenticated)

#### 1. CREATE ROLE REQUEST
```
POST /api/role-request/create
Authorization: Bearer <TOKEN>
Content-Type: application/json

Request Body:
{
  "requestedRole": "creator",  // or "investor"
  "message": "I want to create ML models"  // optional
}

Success Response (201):
{
  "success": true,
  "message": "Role request to become 'creator' submitted successfully",
  "roleRequest": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "userEmail": "user@example.com",
    "requestedRole": "creator",
    "message": "I want to create ML models",
    "status": "pending",
    "createdAt": "2024-12-07T10:30:00Z"
  }
}

Error Responses:
- 403: "Only users with 'user' role can request a role upgrade"
- 400: "Can only request 'creator' or 'investor' role"
- 400: "You already have a pending role request. Please wait for admin approval."
- 400: "Your recent request was rejected. Please try again later."
```

#### 2. GET MY REQUEST
```
GET /api/role-request/my-request
Authorization: Bearer <TOKEN>

Success Response (200):
{
  "success": true,
  "roleRequest": {
    "_id": "507f1f77bcf86cd799439011",
    "requestedRole": "creator",
    "message": "I want to create ML models",
    "status": "pending",
    "createdAt": "2024-12-07T10:30:00Z",
    "reviewedAt": null,
    "reviewedBy": null,
    "rejectionReason": null
  }
}

If No Request Found (200):
{
  "success": true,
  "message": "No role request found",
  "roleRequest": null
}
```

---

### ADMIN ENDPOINTS (Admin Role Required)

#### 1. GET PENDING REQUESTS
```
GET /api/role-request/pending?page=1&limit=10
Authorization: Bearer <ADMIN_TOKEN>

Success Response (200):
{
  "success": true,
  "requests": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "userEmail": "user@example.com",
      "userCurrentRole": "user",
      "userCreatedAt": "2024-12-01T00:00:00Z",
      "requestedRole": "creator",
      "message": "I want to create ML models",
      "status": "pending",
      "createdAt": "2024-12-07T10:30:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439020",
      "userId": "507f1f77bcf86cd799439021",
      "userEmail": "another@example.com",
      "userCurrentRole": "user",
      "userCreatedAt": "2024-12-02T00:00:00Z",
      "requestedRole": "investor",
      "message": null,
      "status": "pending",
      "createdAt": "2024-12-07T11:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "pages": 1
  }
}
```

#### 2. APPROVE REQUEST
```
PUT /api/role-request/:requestId/approve
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

Success Response (200):
{
  "success": true,
  "message": "Role request approved. User user@example.com is now a creator",
  "updatedUser": {
    "id": "507f1f77bcf86cd799439012",
    "email": "user@example.com",
    "oldRole": "user",
    "newRole": "creator",
    "approvedAt": "2024-12-07T14:22:00Z"
  }
}

Error Responses:
- 404: "Role request not found"
- 400: "Cannot approve a rejected request"
```

#### 3. REJECT REQUEST
```
PUT /api/role-request/:requestId/reject
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

Request Body:
{
  "rejectionReason": "Insufficient portfolio samples"  // optional
}

Success Response (200):
{
  "success": true,
  "message": "Role request rejected. User user@example.com was notified.",
  "updatedRequest": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "rejected",
    "rejectionReason": "Insufficient portfolio samples",
    "rejectedAt": "2024-12-07T14:25:00Z"
  }
}

Error Responses:
- 404: "Role request not found"
- 400: "Cannot reject an approved request"
```

#### 4. PENDING COUNT (Dashboard)
```
GET /api/role-request/count
Authorization: Bearer <ADMIN_TOKEN>

Success Response (200):
{
  "success": true,
  "pendingRequests": 5,
  "message": "5 pending role requests"
}
```

#### 5. ROLE CHANGE HISTORY
```
GET /api/role-request/history?page=1&limit=20&action=approved
Authorization: Bearer <ADMIN_TOKEN>

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20, max: 100)
- action: Filter by action ("approved" or "rejected", optional)

Success Response (200):
{
  "success": true,
  "logs": [
    {
      "_id": "607f1f77bcf86cd799439030",
      "userId": "507f1f77bcf86cd799439012",
      "userEmail": "user@example.com",
      "adminEmail": "admin@example.com",
      "oldRole": "user",
      "newRole": "creator",
      "action": "approved",
      "reason": null,
      "timestamp": "2024-12-07T14:22:00Z"
    },
    {
      "_id": "607f1f77bcf86cd799439031",
      "userId": "507f1f77bcf86cd799439021",
      "userEmail": "another@example.com",
      "adminEmail": "admin@example.com",
      "oldRole": "user",
      "newRole": null,
      "action": "rejected",
      "reason": "Insufficient portfolio",
      "timestamp": "2024-12-07T14:25:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "pages": 1
  }
}
```

---

## 🔐 VALIDATION RULES

### User Can Request If:
✅ Current role = "user"  
✅ Requested role is "creator" or "investor"  
✅ No pending request already exists  
✅ Not rejected in the last 7 days  

### User Cannot Request If:
❌ Current role ≠ "user" (already admin, creator, or investor)  
❌ Already has a pending request  
❌ Requested role is invalid  
❌ Recently rejected (7-day cooldown)  

### Admin Can Approve If:
✅ Request status = "pending"  
✅ User exists  
✅ Requested role is valid  

### Admin Can Reject If:
✅ Request status = "pending"  
✅ Can provide rejection reason  

---

## 💾 DATABASE OPERATIONS

### Create a Role Request
```javascript
const request = await RoleRequest.create({
  userId: user._id,
  requestedRole: "creator",
  message: "I want to create ML models"
});
```

### Find Pending Requests
```javascript
const pending = await RoleRequest.find({ status: "pending" })
  .populate("userId")
  .sort({ createdAt: -1 });
```

### Find User's Request
```javascript
const userRequest = await RoleRequest.findOne({ 
  userId: user._id 
}).populate("userId");
```

### Approve Request (3 Steps)
```javascript
// 1. Update user role
await User.findByIdAndUpdate(userId, { role: newRole });

// 2. Update request status
const request = await RoleRequest.findByIdAndUpdate(
  requestId,
  {
    status: "approved",
    reviewedBy: adminId,
    reviewedAt: new Date()
  },
  { new: true }
);

// 3. Log the action
await RoleChangeLog.create({
  userId,
  adminId,
  roleRequestId: requestId,
  oldRole,
  newRole,
  action: "approved"
});
```

### Get Activity Log
```javascript
const logs = await RoleChangeLog.find({ action: "approved" })
  .populate("userId", "email")
  .populate("adminId", "email")
  .sort({ createdAt: -1 })
  .limit(20);
```

---

## 🧪 POSTMAN TESTING GUIDE

### Test Scenario 1: User Creates Request

**Step 1: User Registers**
```
POST http://localhost:3000/api/auth/register
{
  "email": "creator@example.com",
  "password": "password123"
}

Response includes: token
Save this token → USER_TOKEN
```

**Step 2: User Creates Role Request**
```
POST http://localhost:3000/api/role-request/create
Authorization: Bearer USER_TOKEN
{
  "requestedRole": "creator",
  "message": "I want to create machine learning models"
}

Response: success, roleRequest with status="pending"
```

**Step 3: User Checks Their Request**
```
GET http://localhost:3000/api/role-request/my-request
Authorization: Bearer USER_TOKEN

Response: Shows pending request
```

---

### Test Scenario 2: Admin Reviews & Approves

**Step 1: Admin Logs In**
```
POST http://localhost:3000/api/auth/admin/login
{
  "email": "admin@example.com",
  "password": "admin_password"
}

Response includes: token
Save this token → ADMIN_TOKEN
```

**Step 2: Admin Views Pending Requests**
```
GET http://localhost:3000/api/role-request/pending?page=1&limit=10
Authorization: Bearer ADMIN_TOKEN

Response: List of all pending requests
Save the request _id → REQUEST_ID
```

**Step 3: Admin Approves Request**
```
PUT http://localhost:3000/api/role-request/REQUEST_ID/approve
Authorization: Bearer ADMIN_TOKEN

Response: User role changed from "user" to "creator"
```

**Step 4: Check Updated User**
```
GET http://localhost:3000/api/auth/admin/users?search=creator@example.com
Authorization: Bearer ADMIN_TOKEN

Response: User now has role="creator"
```

---

### Test Scenario 3: Admin Rejects Request

**Step 1: Create New Request (same as above)**

**Step 2: Reject Instead of Approve**
```
PUT http://localhost:3000/api/role-request/REQUEST_ID/reject
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
{
  "rejectionReason": "Portfolio incomplete"
}

Response: Request marked as rejected, user role unchanged
```

---

### Test Scenario 4: View Activity Log

```
GET http://localhost:3000/api/role-request/history?action=approved
Authorization: Bearer ADMIN_TOKEN

Response: All approved role changes with admin info
```

---

## 🛡️ SECURITY FEATURES

✅ **Authentication Required** - All endpoints require JWT token  
✅ **Role-Based Access** - Admin endpoints require admin role  
✅ **Validation** - Comprehensive input validation  
✅ **Duplicate Prevention** - Users can't have multiple pending requests  
✅ **Audit Logging** - All approvals/rejections logged  
✅ **Activity Trail** - Admin can see who made decisions when  
✅ **Rate Limiting** - 7-day cooldown after rejection  

---

## 📊 WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────┐
│  USER: Requests Role Upgrade                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  User (role="user")                             │
│  └─ POST /role-request/create                   │
│     ├─ requestedRole: "creator"                 │
│     └─ message: "Optional reason"               │
│                                                 │
│  Validation:                                    │
│  ├─ Must be role="user"                         │
│  ├─ No pending request exists                   │
│  └─ Requested role is "creator" or "investor"   │
│                                                 │
│  Result:                                        │
│  └─ RoleRequest created with status="pending"   │
│                                                 │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  ADMIN: Reviews Requests                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Admin (role="admin")                           │
│  └─ GET /role-request/pending                   │
│     └─ Returns list of all pending requests     │
│                                                 │
│  Shows:                                         │
│  ├─ User email                                  │
│  ├─ Current role                                │
│  ├─ Requested role                              │
│  ├─ User message                                │
│  └─ Created date                                │
│                                                 │
└─────────────────────────────────────────────────┘
           │                        │
           ▼ Approve                ▼ Reject
┌──────────────────────┐  ┌──────────────────────┐
│  APPROVE REQUEST     │  │  REJECT REQUEST      │
├──────────────────────┤  ├──────────────────────┤
│                      │  │                      │
│  PUT .../:id/approve │  │  PUT .../:id/reject  │
│                      │  │                      │
│  Updates:            │  │  Updates:            │
│  ├─ User.role        │  │  ├─ RoleRequest     │
│  │  = "creator"      │  │  │   status         │
│  ├─ Request.status   │  │  │   = "rejected"   │
│  │  = "approved"     │  │  ├─ User.role       │
│  ├─ Log action       │  │  │   UNCHANGED      │
│  └─ User promoted    │  │  ├─ Log action      │
│                      │  │  └─ User notified   │
└──────────────────────┘  └──────────────────────┘
```

---

## 📈 FEATURES INCLUDED

### Core Features
✅ Create role request (user)  
✅ View own request (user)  
✅ View pending requests (admin)  
✅ Approve request (admin)  
✅ Reject request (admin)  
✅ Pending count for dashboard  

### Bonus Features
✅ Activity log for auditing  
✅ Rejection cooldown (7 days)  
✅ Rejection reason tracking  
✅ Admin info on approvals/rejections  
✅ Role change history with filters  
✅ Pagination on all list endpoints  
✅ Comprehensive error messages  
✅ Full validation  

---

## 🔧 INTEGRATION CHECKLIST

After adding these files, verify:

- [ ] `models/RoleRequest.js` created
- [ ] `models/RoleChangeLog.js` created
- [ ] `routes/roleRequest.js` created
- [ ] `server.js` updated with roleRequestRoutes
- [ ] Restart backend server
- [ ] Test endpoints with Postman (follow guide above)
- [ ] Verify admin can see pending count
- [ ] Test approve → user role updates
- [ ] Test reject → user role unchanged
- [ ] Check activity log entries
- [ ] Verify validations (no duplicate requests, etc.)

---

## 📞 ERROR MESSAGES

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| Only users with 'user' role can request | 403 | User is not a regular user | User must have role="user" |
| Can only request 'creator' or 'investor' role | 400 | Invalid role requested | Use "creator" or "investor" |
| You already have a pending role request | 400 | Duplicate pending request | Wait for admin decision |
| Your recent request was rejected | 400 | Rejected 7 days ago | Try again after cooldown |
| Role request not found | 404 | ID doesn't exist | Check request ID |
| Cannot approve a rejected request | 400 | Invalid state | Request must be pending |
| Cannot reject an approved request | 400 | Invalid state | Request must be pending |
| Access denied. Not an admin | 403 | User is not admin | Only admins can use this |

---

## 🚀 READY TO USE!

Your complete Role Request System is now live:

1. ✅ Users can request role upgrades
2. ✅ Admins can manage requests
3. ✅ Roles update automatically
4. ✅ Everything is logged and audited
5. ✅ Full validation and error handling

**Start testing now!** 🎉

