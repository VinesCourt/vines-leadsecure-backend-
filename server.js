const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= MONGODB CONNECTION ================= */
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

/* ================= SCHEMA ================= */
const AdminSchema = new mongoose.Schema({
  passcode: { type: String, required: true },
  resetToken: String,
  tokenExpiry: Date
});

const Admin = mongoose.model("Admin", AdminSchema);

/* ================= INIT ADMIN ================= */
async function initAdmin() {
  const existing = await Admin.findOne();
  if (!existing) {
    await Admin.create({ passcode: "vinesadmin" });
    console.log("🔐 Default admin passcode created");
  }
}
initAdmin();

/* ================= FILE UPLOAD SETUP ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("Vines LeadSecure Backend Running");
});

/* ================= CHANGE PASSCODE ================= */
app.post("/change-passcode", async (req, res) => {
  const { oldPasscode, newPasscode } = req.body;

  const admin = await Admin.findOne();
  if (!admin || admin.passcode !== oldPasscode) {
    return res.status(401).json({ error: "Invalid current passcode" });
  }

  admin.passcode = newPasscode;
  await admin.save();

  res.json({ success: true, message: "Passcode changed successfully" });
});

/* ================= GENERATE RESET TOKEN ================= */
app.post("/request-recovery", async (req, res) => {
  const token = crypto.randomBytes(20).toString("hex");

  const admin = await Admin.findOne();
  admin.resetToken = token;
  admin.tokenExpiry = Date.now() + 15 * 60 * 1000;
  await admin.save();

  res.json({
    success: true,
    token,
    expires: "15 minutes"
  });
});

/* ================= RESET PASSCODE ================= */
app.post("/reset-passcode", async (req, res) => {
  const { token, newPasscode } = req.body;

  const admin = await Admin.findOne();
  if (
    !admin ||
    admin.resetToken !== token ||
    Date.now() > admin.tokenExpiry
  ) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  admin.passcode = newPasscode;
  admin.resetToken = null;
  admin.tokenExpiry = null;
  await admin.save();

  res.json({ success: true, message: "Passcode reset successful" });
});

/* ================= CSV UPLOAD ================= */
app.post("/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    success: true,
    message: "CSV received successfully",
    fileName: req.file.originalname,
    size: req.file.size
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
