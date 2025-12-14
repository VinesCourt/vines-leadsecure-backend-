const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./leads.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite database");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      phone TEXT,
      email TEXT,
      budget TEXT,
      location TEXT,
      property_type TEXT,
      purpose TEXT,
      temperature TEXT,
      assigned_client TEXT,
      source TEXT,
      status TEXT,
      created_at TEXT
    )
  `);
});

module.exports = db;
