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
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

/* ================= SCHEMAS ================= */
const AdminSchema = new mongoose.Schema({
  passcode: { type: String, required: true }
});

const TokenSchema = new mongoose.Schema({
  token: String,
  expiresAt: Date
});

const LeadSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    source: String
  },
  { timestamps: true }
);

/* ================= MODELS ================= */
const Admin = mongoose.model("Admin", AdminSchema);
const ResetToken = mongoose.model("ResetToken", TokenSchema);
const Lead = mongoose.model("Lead", LeadSchema);

/* ================= INIT ADMIN ================= */
async function initAdmin() {
  const admin = await Admin.findOne();
  if (!admin) {
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
  res.status(200).send("Vines LeadSecure Backend Running");
});

/* ================= CHANGE PASSCODE ================= */
app.post("/change-passcode", async (req, res) => {
  const { oldPasscode, newPasscode } = req.body;

  if (!oldPasscode || !newPasscode) {
    return res.status(400).json({ error: "Missing passcode fields" });
  }

  const admin = await Admin.findOne();
  if (!admin || admin.passcode !== oldPasscode) {
    return res.status(401).json({ error: "Invalid current passcode" });
  }

  admin.passcode = newPasscode;
  await admin.save();

  res.json({ success: true, message: "Passcode changed successfully" });
});

/* ================= REQUEST RESET TOKEN ================= */
app.post("/request-recovery", async (req, res) => {
  const token = crypto.randomBytes(20).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;

  await ResetToken.deleteMany({});
  await ResetToken.create({ token, expiresAt });

  res.json({
    success: true,
    token,
    expires: "15 minutes"
  });
});

/* ================= RESET PASSCODE ================= */
app.post("/reset-passcode", async (req, res) => {
  const { token, newPasscode } = req.body;

  if (!token || !newPasscode) {
    return res.status(400).json({ error: "Missing token or new passcode" });
  }

  const record = await ResetToken.findOne({ token });
  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const admin = await Admin.findOne();
  admin.passcode = newPasscode;
  await admin.save();

  await ResetToken.deleteMany({});

  res.json({ success: true, message: "Passcode reset successful" });
});

/* ================= CSV UPLOAD ================= */
app.post("/upload-csv", upload.single("file"), async (req, res) => {
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

/* ================= MANUAL LEAD ENTRY ================= */
app.post("/leads", async (req, res) => {
  const lead = await Lead.create(req.body);
  res.json({ success: true, lead });
});

/* ================= GET ALL LEADS ================= */
app.get("/leads", async (req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });
  res.json(leads);
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
