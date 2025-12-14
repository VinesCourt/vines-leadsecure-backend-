const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const db = require("./database");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

const app = express();

// IMPORTANT MIDDLEWARE
app.use(cors());
app.use(express.json());

// ================= STORAGE =================
let ADMIN_PASSCODE = "vinesadmin";
let RESET_TOKEN = null;
let TOKEN_EXPIRY = null;

// ================= TEST ENDPOINT =================
app.get("/", (req, res) => {
  res.status(200).send("Vines LeadSecure Backend Running");
});

// ================= CHANGE PASSCODE =================
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

// ================= GENERATE RESET TOKEN =================
app.post("/request-recovery", (req, res) => {
  RESET_TOKEN = crypto.randomBytes(20).toString("hex");
  TOKEN_EXPIRY = Date.now() + 15 * 60 * 1000;

  console.log("RESET TOKEN:", RESET_TOKEN);

  return res.json({
    success: true,
    token: RESET_TOKEN,
    expires: "15 minutes"
  });
});

// ================= RESET PASSCODE =================
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
// ================= FILE UPLOAD CONFIG =================
const upload = multer({ dest: "uploads/" });

// ================= ADD MANUAL LEAD =================
app.post("/add-lead", (req, res) => {
  const lead = req.body;

  const query = `
    INSERT INTO leads 
    (full_name, phone, email, budget, location, property_type, purpose, temperature, assigned_client, source, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(query, [
    lead.full_name,
    lead.phone,
    lead.email,
    lead.budget,
    lead.location,
    lead.property_type,
    lead.purpose,
    lead.temperature,
    lead.assigned_client,
    lead.source,
    "PENDING",
    new Date().toISOString()
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: "Lead added successfully" });
  });
});

// ================= GET PENDING LEADS =================
app.get("/pending-leads", (req, res) => {
  db.all("SELECT * FROM leads WHERE status='PENDING'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================= APPROVE LEADS =================
app.post("/approve-leads", (req, res) => {
  const { ids } = req.body;

  if (!ids || !ids.length) {
    return res.status(400).json({ error: "No leads selected" });
  }

  const placeholders = ids.map(() => "?").join(",");

  db.run(
    `UPDATE leads SET status='APPROVED' WHERE id IN (${placeholders})`,
    ids,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Leads approved successfully" });
    }
  );
});

// ================= START SERVER =================
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
