const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FILE SYSTEM ================= */
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const leadsFile = path.join(dataDir, "leads.json");
const adminFile = path.join(dataDir, "admin.json");

const readJSON = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : d;
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

if (!fs.existsSync(adminFile)) {
  writeJSON(adminFile, { passcode: "vinesadmin" });
}

/* ================= HEALTH ================= */
app.get("/", (_, res) => {
  res.send("✅ Vines LeadSecure Backend Live");
});

/* ================= AUTH ================= */
app.post("/api/login", (req, res) => {
  const { passcode } = req.body;
  const admin = readJSON(adminFile, {});
  if (passcode !== admin.passcode) {
    return res.status(401).json({ error: "Invalid passcode" });
  }
  res.json({ success: true });
});

/* ================= LEAD CAPTURE ================= */
app.post("/api/leads", async (req, res) => {
  try {
    const { fullName, phone, email, source } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const lead = {
      id: Date.now(),
      fullName,
      phone,
      email: email || "",
      source: source || "Website",
      date: new Date().toISOString(),
      status: "pending"
    };

    const leads = readJSON(leadsFile, []);
    leads.unshift(lead);
    writeJSON(leadsFile, leads);

    await fetch("YOUR_GOOGLE_SCRIPT_URL", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead)
    });

    res.json({ success: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Lead capture failed" });
  }
});

/* ================= VIEW LEADS ================= */
app.get("/api/leads/all", (req, res) => {
  try {
    let leads = readJSON(leadsFile, []);
    const filter = req.query.filter || "all";
    const now = new Date();

    if (filter === "today") {
      leads = leads.filter(l =>
        new Date(l.date).toDateString() === now.toDateString()
      );
    }

    if (filter === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      leads = leads.filter(l => new Date(l.date) >= start);
    }

    res.json(leads);

  } catch {
    res.status(500).json({ error: "Failed to load leads" });
  }
});

/* ================= TOGGLE STATUS ================= */
app.post("/api/leads/toggle", (req, res) => {
  const { id } = req.body;
  const leads = readJSON(leadsFile, []);

  const lead = leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  lead.status = lead.status === "approved" ? "pending" : "approved";
  writeJSON(leadsFile, leads);

  res.json({ success: true });
});

/* ================= EXPORT CSV ================= */
app.get("/api/leads/csv", (_, res) => {
  const leads = readJSON(leadsFile, []);
  let csv = "Date,Name,Phone,Email,Source,Status\n";

  leads.forEach(l => {
    csv += `${l.date},${l.fullName},${l.phone},${l.email},${l.source},${l.status}\n`;
  });

  res.header("Content-Type", "text/csv");
  res.attachment("leads.csv");
  res.send(csv);
});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on ${PORT}`)
);
