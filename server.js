const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");


const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DATABASE CONNECTION ================= */
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => console.error("❌ MongoDB connection error:", err));


/* ================= IN-MEMORY STORAGE ================= */
let ADMIN_PASSCODE = "vinesadmin";
let RESET_TOKEN = null;
let TOKEN_EXPIRY = null;

/* ================= FILE UPLOAD SETUP ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.status(200).send("Vines LeadSecure Backend Running");
});

/* ================= CHANGE PASSCODE ================= */
app.post("/change-passcode", (req, res) => {
  const { oldPasscode, newPasscode } = req.body;

  if (!oldPasscode || !newPasscode) {
    return res.status(400).json({ error: "Missing passcode fields" });
  }

  if (oldPasscode !== ADMIN_PASSCODE) {
    return res.status(401).json({ error: "Invalid current passcode" });
  }

  ADMIN_PASSCODE = newPasscode;
  return res.json({ success: true, message: "Passcode changed successfully" });
});

/* ================= GENERATE RESET TOKEN ================= */
app.post("/request-recovery", (req, res) => {
  RESET_TOKEN = crypto.randomBytes(20).toString("hex");
  TOKEN_EXPIRY = Date.now() + 15 * 60 * 1000;

  return res.json({
    success: true,
    token: RESET_TOKEN,
    expires: "15 minutes"
  });
});

/* ================= RESET PASSCODE ================= */
app.post("/reset-passcode", (req, res) => {
  const { token, newPasscode } = req.body;

  if (!token || !newPasscode) {
    return res.status(400).json({ error: "Missing token or new passcode" });
  }

  if (!RESET_TOKEN || Date.now() > TOKEN_EXPIRY) {
    return res.status(400).json({ error: "Token expired" });
  }

  if (token !== RESET_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  ADMIN_PASSCODE = newPasscode;
  RESET_TOKEN = null;
  TOKEN_EXPIRY = null;

  return res.json({ success: true, message: "Passcode reset successful" });
});

/* ================= CSV UPLOAD ENDPOINT ================= */
app.post("/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  return res.json({
    success: true,
    message: "CSV received successfully",
    fileName: req.file.originalname,
    size: req.file.size
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
