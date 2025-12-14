require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./data.json";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ adminPasscode: "vinesadmin", resetToken: null })
  );
}

// Read data
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

// Write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Email transporter (Gmail App Password later)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Health check
app.get("/", (req, res) => {
  res.send("Vines LeadSecure Backend is running");
});

// Validate admin passcode
app.post("/validate-passcode", (req, res) => {
  const { passcode } = req.body;
  const data = readData();
  res.json({ valid: passcode === data.adminPasscode });
});

// Change admin passcode
app.post("/change-passcode", async (req, res) => {
  const { oldPasscode, newPasscode } = req.body;
  const data = readData();

  if (oldPasscode !== data.adminPasscode) {
    return res.status(401).json({ error: "Invalid current passcode" });
  }

  data.adminPasscode = newPasscode;
  writeData(data);

  if (process.env.SMTP_PASS) {
    await transporter.sendMail({
      to: ADMIN_EMAIL,
      subject: "Vines LeadSecure – Passcode Changed",
      text: "Your admin passcode has been changed successfully.",
    });
  }

  res.json({ success: true });
});

// Request passcode reset
app.post("/request-reset", async (req, res) => {
  const token = uuidv4();
  const data = readData();
  data.resetToken = token;
  writeData(data);

  if (process.env.SMTP_PASS) {
    await transporter.sendMail({
      to: ADMIN_EMAIL,
      subject: "Vines LeadSecure – Passcode Reset",
      text: `Use this token to reset your passcode: ${token}`,
    });
  }

  res.json({ success: true });
});

// Reset passcode
app.post("/reset-passcode", (req, res) => {
  const { token, newPasscode } = req.body;
  const data = readData();

  if (token !== data.resetToken) {
    return res.status(401).json({ error: "Invalid reset token" });
  }

  data.adminPasscode = newPasscode;
  data.resetToken = null;
  writeData(data);

  res.json({ success: true });
});

// START SERVER (Render-safe)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vines LeadSecure backend running on port ${PORT}`);
});
