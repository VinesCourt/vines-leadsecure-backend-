const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= DATA FILES ================= */
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const adminFile = path.join(dataDir, "admin.json");
const tokenFile = path.join(dataDir, "tokens.json");
const leadsFile = path.join(dataDir, "leads.json");

const readJSON = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

if (!fs.existsSync(adminFile)) {
  writeJSON(adminFile, { passcode: "vinesadmin" });
}

/* ================= FILE UPLOAD ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("✅ Vines LeadSecure Backend (No-DB Mode)");
});

/* ================= CHANGE PASSCODE ================= */
app.post("/change-passcode", (req, res) => {
  const { oldPasscode, newPasscode } = req.body;
  const admin = readJSON(adminFile, {});

  if (oldPasscode !== admin.passcode) {
    return res.status(401).json({ error: "Invalid current passcode" });
  }

  admin.passcode = newPasscode;
  writeJSON(adminFile, admin);

  res.json({ success: true, message: "Passcode updated" });
});

/* ================= GENERATE TOKEN ================= */
app.post("/request-recovery", (req, res) => {
  const token = crypto.randomBytes(20).toString("hex");
  const expiry = Date.now() + 15 * 60 * 1000;

  writeJSON(tokenFile, { token, expiry });

  res.json({
    success: true,
    token,
    expires: "15 minutes"
  });
});

/* ================= RESET PASSCODE ================= */
app.post("/reset-passcode", (req, res) => {
  const { token, newPasscode } = req.body;
  const stored = readJSON(tokenFile, null);
  const admin = readJSON(adminFile, {});

  if (!stored || token !== stored.token || Date.now() > stored.expiry) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  admin.passcode = newPasscode;
  writeJSON(adminFile, admin);
  fs.unlinkSync(tokenFile);

  res.json({ success: true, message: "Passcode reset successful" });
});

/* ================= CSV UPLOAD ================= */
app.post("/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const existing = readJSON(leadsFile, []);
  existing.push({
    filename: req.file.originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  });

  writeJSON(leadsFile, existing);

  res.json({
    success: true,
    message: "CSV uploaded successfully"
  });
});

/* ================= LEAD CAPTURE (GOOGLE SHEETS) ================= */
app.post("/api/leads", async (req, res) => {
  try {
    const { fullName, phone, email, source } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await fetch("https://script.google.com/macros/s/AKfycbwCONkKLBeYVHfxtnlWXQtMFpLAwU9Te3bMBr_dgFMYwlFeoUOoPM5EHrlvO7KWHF9U/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email: email || "",
        source: source || "Website",
        createdAt: new Date().toISOString()
      })
    });

    res.json({ success: true, message: "Lead captured successfully" });

  } catch (error) {
    console.error("Google Sheets Error:", error);
    res.status(500).json({ success: false, error: "Lead capture failed" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (No-DB Mode)`);
});
