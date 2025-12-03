import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();

// ------------------------------
// GOOGLE OAUTH CLIENT (FIXED)
// ------------------------------
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);



// ------------------------------
// REGISTER
// ------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashed,
    });

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: newUser._id, email: newUser.email },
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// LOGIN
// ------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, email: user.email },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GET CURRENT USER
// ------------------------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------
// GOOGLE OAUTH - START
// ------------------------------
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

// ------------------------------
// GOOGLE OAUTH - CALLBACK (FULLY FIXED)
// ------------------------------
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
      console.error("GOOGLE ERROR: No id_token");
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
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.redirect(
  `${process.env.FRONTEND_URL}/auth?token=${token}&user=${encodeURIComponent(
    JSON.stringify({ id: user._id, email: user.email })
  )}`
);


  } catch (err) {
    console.error("GOOGLE LOGIN ERROR:", err.response?.data || err);
    res.status(500).json({ message: "Google authentication failed" });
  }
});
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);


export default router;
