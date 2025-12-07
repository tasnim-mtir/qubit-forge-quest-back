import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { OAuth2Client } from "google-auth-library";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// -------------------------------------------------------
// GOOGLE OAUTH CLIENT
// -------------------------------------------------------
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// -------------------------------------------------------
// ADMIN: LOGIN
// -------------------------------------------------------
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (user.role !== "admin")
      return res.status(403).json({ message: "Access denied. Not an admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

   const token = jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error", success: false });
  }
});

// -------------------------------------------------------
// ADMIN: GET ALL USERS (with filtering & pagination)
// -------------------------------------------------------
router.get("/admin/users", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    console.log("FULL URL:", req.originalUrl);
    console.log("QUERY:", req.query);

    const { search, role, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    const filter = {};

    // SEARCH by email
    if (search) {
      filter.email = { $regex: search, $options: "i" };
    }

    // STRICT & NORMALIZED ROLE FILTERING
    if (role) {
      const normalizedRole = role.toLowerCase().trim();

      if (!["user", "creator", "admin", "investor"].includes(normalizedRole)) {
        return res.status(400).json({ message: "Invalid role filter" });
      }

      filter.role = normalizedRole;

      console.log("APPLIED ROLE FILTER:", normalizedRole);
    }

    // DATE FILTER
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    console.log("FINAL FILTER:", filter);

    // PAGINATION
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// -------------------------------------------------------
// ADMIN: GET SINGLE USER
// -------------------------------------------------------
router.get("/admin/users/:userId", authMiddleware, requireRole("admin"), async (req, res) => {
  
  try {
    const user = await User.findById(req.params.userId).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, user });

  } catch (err) {
    console.error("GET SINGLE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: CREATE NEW USER
// -------------------------------------------------------
router.post("/admin/users", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { email, password, role = "user" } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    if (!["user", "creator", "admin", "investor"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashed,
      role,
      status: "active",
    });

    res.status(201).json({ success: true, user: newUser });

  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: UPDATE USER
// -------------------------------------------------------
router.put("/admin/users/:userId", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { email, role } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user.id } });
      if (emailExists)
        return res.status(400).json({ message: "Email already in use" });
      user.email = email;
    }

    if (role) {
      if (!["user", "creator", "admin", "investor"].includes(role))
        return res.status(400).json({ message: "Invalid role" });
      user.role = role;
    }

    await user.save();
    res.json({ success: true, user });

  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: DELETE USER
// -------------------------------------------------------
router.delete("/admin/users/:userId", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, message: "User deleted successfully" });

  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: PROMOTE USER TO CREATOR
// -------------------------------------------------------
router.put("/admin/users/:userId/promote-creator", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = "creator";
    await user.save();

    res.json({ success: true, user });

  } catch (err) {
    console.error("PROMOTE CREATOR ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: PROMOTE USER TO ADMIN
// -------------------------------------------------------
router.put("/admin/users/:userId/promote-admin", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = "admin";
    await user.save();

    res.json({ success: true, user });

  } catch (err) {
    console.error("PROMOTE ADMIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: REVOKE CREATOR ACCESS
// -------------------------------------------------------
router.put("/admin/users/:userId/revoke-creator", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "creator") {
      user.role = "user";
      await user.save();
    }

    res.json({ success: true, user });

  } catch (err) {
    console.error("REVOKE CREATOR ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: PROMOTE USER TO INVESTOR
// -------------------------------------------------------
router.put("/admin/users/:userId/promote-investor", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = "investor";
    await user.save();

    res.json({ success: true, message: "User promoted to investor", user });

  } catch (err) {
    console.error("PROMOTE INVESTOR ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: REVOKE INVESTOR ACCESS
// -------------------------------------------------------
router.put("/admin/users/:userId/revoke-investor", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "investor") {
      user.role = "user";
      await user.save();
    }

    res.json({ success: true, message: "Investor access revoked", user });

  } catch (err) {
    console.error("REVOKE INVESTOR ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// ADMIN: GET STATISTICS
// -------------------------------------------------------
router.get("/admin/stats", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ status: "active" }),
      bannedUsers: await User.countDocuments({ status: "banned" }),
      creators: await User.countDocuments({ role: "creator" }),
      investors: await User.countDocuments({ role: "investor" }),
      admins: await User.countDocuments({ role: "admin" }),
    };

    res.json({ success: true, stats });

  } catch (err) {
    console.error("GET STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// REGISTER
// -------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashed,
      role: "user",
    });

 const token = jwt.sign(
  { id: newUser._id, role: newUser.role },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.status(201).json({ success: true, token, user: newUser });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error", success: false });
  }
});

// -------------------------------------------------------
// LOGIN
// -------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ success: true, token, user });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error", success: false });
  }
});

// -------------------------------------------------------
// GET CURRENT USER
// -------------------------------------------------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ success: true, user });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------------------------------
// GOOGLE OAUTH - START
// -------------------------------------------------------
router.get("/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// -------------------------------------------------------
// GOOGLE OAUTH CALLBACK
// -------------------------------------------------------
router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code;

    const { tokens } = await client.getToken({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    if (!tokens.id_token) {
      return res.status(400).json({ message: "Failed to retrieve Google ID token" });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        password: "google_oauth_no_password",
        role: "user",
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth?token=${token}&user=${encodeURIComponent(
        JSON.stringify({ id: user._id, email: user.email, role: user.role })
      )}`
    );

  } catch (err) {
    res.status(500).json({ message: "Google authentication failed" });
  }
});

export default router;
