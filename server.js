const fetch = require("node-fetch");
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

/* ================= GOOGLE SCRIPT URL ================= */
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwI9HTVsEVX4xNtwIckjHgNZf5Yv1QjZh4045XDvYKiiuozCJCN21sgUZaNgDyQxHym/exec";

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("✅ Vines LeadSecure Backend is LIVE");
});

/* ================= LEAD CAPTURE ================= */
app.post("/api/leads", async (req, res) => {
  try {
    const { fullName, phone, email, source } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await fetch(https://script.google.com/macros/s/AKfycbwI9HTVsEVX4xNtwIckjHgNZf5Yv1QjZh4045XDvYKiiuozCJCN21sgUZaNgDyQxHym/exec, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email: email || "",
        source: source || "Website"
      })
    });

    if (!response.ok) {
      return res
        .status(500)
        .json({ success: false, error: "Google Sheets rejected request" });
    }

    res.json({ success: true, message: "Lead captured successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Lead capture failed" });
  }
});

/* ================= GET ALL LEADS (STEP 2) ================= */
app.get("/api/leads/all", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load leads" });
  }
});

/* ================= TOGGLE APPROVAL (STEP 3) ================= */
app.post("/api/leads/toggle", async (req, res) => {
  try {
    const { row } = req.body;

    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", row })
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Toggle failed" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
