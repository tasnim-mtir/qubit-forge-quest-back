# 🚀 **Qubit-Forge-Quest**

### **A Decentralized Compute Economy for the Qubic Ecosystem**

Qubit-Forge-Quest (QFQ) is a **decentralized compute marketplace** that connects **creators needing compute**, **investors providing liquidity**, and an **automatic execution engine** managing compute tasks.
Built for the **Nostromo Launchpad Track** of the *Qubic | Hack the Future Hackathon*, the project showcases how compute can become a **fair, transparent, and scalable on-chain economy**.

---

## 🔗 **Project Links**

### 🌐 **Live Demo**

👉 [https://qubit-forge-quest-front.vercel.app/](https://qubit-forge-quest-front.vercel.app/)

### 📦 **Frontend Repository**

👉 [https://github.com/tasnim-mtir/qubit-forge-quest-front](https://github.com/tasnim-mtir/qubit-forge-quest-front)

---

## ⭐ **Table of Contents**

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [System Architecture](#system-architecture)
4. [User Roles & Dashboards](#user-roles--dashboards)
5. [Automatic Task Processor](#automatic-task-processor)
6. [Tech Stack](#tech-stack)
7. [Project Structure](#project-structure)
8. [API Overview](#api-overview)
9. [Environment Variables](#environment-variables)
10. [Local Setup](#local-setup)
11. [Deployment](#deployment)
12. [Roadmap](#roadmap)
13. [Team](#team)
14. [License](#license)

---

# 📌 **Overview**

Today, compute access is centralized, expensive, and unfair.
Qubit-Forge-Quest introduces a **compute economy** where:

* **Creators** submit compute tasks and pay in Compute Credits (CC)
* **Investors** stake QX tokens to generate CC yield
* **Processors** automatically execute tasks
* **Admins** maintain ecosystem balance

The platform implements a **fully working economic simulation**, reflecting how a real launchpad-grade protocol can function on **Qubic & Nostromo**.

---

# ✨ **Key Features**

### 🔐 **Authentication & Role Access**

* Secure login with **JWT** and **Google OAuth**
* Role-based access control (User, Creator, Investor, Admin)
* Users can **request role upgrades** (Creator / Investor)

---

### 🧪 **Creator Functionality**

* Create compute tasks with cost, priority, and metadata
* View task history (Queued, Running, Completed, Failed)
* Real-time queue status and CC balance

---

### 💰 **Investor Functionality**

* Stake QX → Generate Compute Credits (CC)
* View active stakes, yields, and credit flow
* Lease out CC to creators (simulated marketplace)

---

### ⚙️ **Admin Functionality**

* Approve or reject pending role requests
* Manage users, update roles or disable accounts
* Monitor vault metrics:

  * Total QX staked
  * Total CC minted
  * Total tasks executed
* View global system activity

---

### ⚡ **Automatic Task Processor**

A background engine that:

* Constantly scans queue
* Executes tasks with simulated processing times
* Supports FIFO and parallel execution
* Includes retry logic for failures
* Updates vault credit consumption
* Maintains realism for demo purposes

This is the *heart of the protocol* and demonstrates scalable compute automation.

---

### 🗃️ **Vault Economy**

Tracks global state:

* CC supply
* QX staked
* CC reward distribution
* Fees & consumption
* Compute throughput

---

# 🧱 **System Architecture**

```
                ┌──────────────────────────┐
                │        FRONTEND           │
                │ React + Vite + Tailwind   │
                │ Dashboards + Auth UI      │
                └─────────────┬────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │        BACKEND API        │
               │ Node.js + Express         │
               │ Auth • Tasks • Vault • Stake │
               └─────────────┬────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │       VAULT STATE         │
               │ CC Supply • Stakes • Tasks│
               └─────────────┬────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │  AUTOMATIC TASK PROCESSOR │
               │ Queue → Running → Done     │
               └─────────────┬────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │      MongoDB Atlas        │
               └──────────────────────────┘
```

---

# 🧑‍💻 **User Roles & Dashboards**

### 👨‍💻 **Creator Dashboard**

* CC balance widget
* Submit tasks
* Task queue/status
* Download results

### 💰 **Investor Dashboard**

* Create stakes
* Earn CC credits
* View returns
* Lease marketplace

### ⚙️ **Admin Dashboard**

* Approve role upgrade requests
* Edit user roles
* Global metrics dashboard
* System health monitoring

---

# ⚡ **Automatic Task Processor**

The processor is a continuously running engine:

* Picks all queued tasks
* Executes each independently
* Simulates success/failure
* Adds computed metadata
* Updates vault state

This demonstrates how a compute network on Qubic could operate.

---

# 🛠️ **Tech Stack**

| Layer            | Technology                          |
| ---------------- | ----------------------------------- |
| Frontend         | React, Vite, Tailwind, ShadCN       |
| Backend          | Node.js, Express.js                 |
| Database         | MongoDB Atlas, Mongoose             |
| Auth             | JWT, Google OAuth                   |
| Deployment       | Vercel (Frontend), Render (Backend) |
| Processor Engine | Custom Node background worker       |

---

# 📁 **Project Structure**

```
root/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── server.js
│   └── .env
├── frontend/
│   ├── src/
│   ├── public/
│   ├── index.html
│   └── .env
└── README.md
```

---

# 🔌 **API Overview**

### **Authentication**

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/google
```

### **Tasks**

```
POST /api/protocol/tasks
GET  /api/protocol/tasks
```

### **Staking**

```
POST /api/protocol/stake
GET  /api/protocol/stake
```

### **Role Requests**

```
POST /api/request-role
GET  /api/pending-requests
PUT  /api/approve-request
```

---

# 🔐 **Environment Variables**

### **Backend (.env)**

```
MONGO_URI=
DATABASE_NAME=
JWT_SECRET=
PORT=3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

FRONTEND_URL=https://your-frontend.vercel.app
```

### **Frontend (.env)**

```
VITE_API_URL=https://your-backend.onrender.com
```

---

# 🧪 **Local Setup**

### **Backend**

```bash
cd backend
npm install
npm start
```

### **Frontend**

```bash
cd frontend
npm install
npm run dev
```

---

# 🚀 **Deployment**

### **Backend (Render)**

* Create Web Service
* Add environment variables
* Deploy server.js

### **Frontend (Vercel)**

* Import GitHub repo
* Add VITE_API_URL
* Deploy instantly

---

# 🛣️ **Roadmap**

* Implement real Qubic VM execution
* Integrate smart contracts for staking logic
* Launch Nostromo-compatible token economics
* Add distributed GPU compute backend
* Multi-node processor network

---

# 👥 **Team**

**Qubitium Team**
Tasnim Mtir & Razi Ammari

---

# 📄 **License**

MIT License — free to use, modify, and expand.

---

# 🎉 **Thank You!**

If you like this project, please ⭐ star the repo and share your feedback!

---

