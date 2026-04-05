import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "vbsk.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE trainers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'trainer',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    trainer_id INTEGER NOT NULL,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id)
  );

  CREATE TABLE hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'regulier',
    substitute_for_id INTEGER,
    schedule_id INTEGER,
    remark TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ingediend',
    reject_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trainer_id) REFERENCES trainers(id),
    FOREIGN KEY (substitute_for_id) REFERENCES trainers(id),
    FOREIGN KEY (schedule_id) REFERENCES schedule(id)
  );

  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'overig',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ingediend',
    reject_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trainer_id) REFERENCES trainers(id)
  );
`);

// Trainers uit het VBSK overzicht (rooster m.i.v. 15 september 2025)
const insertTrainer = db.prepare(
  "INSERT INTO trainers (name, pin, role) VALUES (?, ?, ?)"
);
// id=1: Admin
insertTrainer.run("Admin", "0000", "admin");
// Vaste trainers
insertTrainer.run("Digna", "1001", "trainer");       // id=2
insertTrainer.run("Gino", "1002", "trainer");         // id=3
insertTrainer.run("Gilbert", "1003", "trainer");      // id=4
insertTrainer.run("Jörgen", "1004", "trainer");       // id=5
insertTrainer.run("Keyona", "1005", "trainer");       // id=6
insertTrainer.run("Pete", "1006", "trainer");         // id=7
insertTrainer.run("Richey", "1007", "trainer");       // id=8
// Invalpool
insertTrainer.run("Adriaan", "2001", "trainer");      // id=9
insertTrainer.run("Emiles", "2002", "trainer");       // id=10
insertTrainer.run("Mathijs", "2003", "trainer");      // id=11
insertTrainer.run("Ali", "2004", "trainer");          // id=12
insertTrainer.run("Ruben", "2005", "trainer");        // id=13
insertTrainer.run("Paul", "2006", "trainer");         // id=14
insertTrainer.run("Raymundo", "2007", "trainer");     // id=15
insertTrainer.run("Juul", "2008", "trainer");         // id=16
insertTrainer.run("Thijs", "2009", "trainer");        // id=17

// Rooster m.i.v. 15 september 2025
const insertSchedule = db.prepare(
  "INSERT INTO schedule (day_of_week, start_time, end_time, location, trainer_id) VALUES (?, ?, ?, ?, ?)"
);

// MAANDAG
insertSchedule.run(1, "17:00", "18:00", "VBSK", 6);  // Keyona - Junioren
insertSchedule.run(1, "18:00", "19:00", "VBSK", 6);  // Keyona - Recreanten
insertSchedule.run(1, "18:00", "19:00", "VBSK", 7);  // Pete - Box basis
insertSchedule.run(1, "19:15", "20:15", "VBSK", 7);  // Pete - All levels/Hy box
insertSchedule.run(1, "19:15", "20:45", "VBSK", 4);  // Gilbert - Techniek en sparren

// DINSDAG
insertSchedule.run(2, "17:15", "18:15", "VBSK", 3);  // Gino - Junioren/jeugd
insertSchedule.run(2, "17:15", "18:15", "VBSK", 7);  // Pete - Heavy bag
insertSchedule.run(2, "18:30", "20:00", "VBSK", 3);  // Gino - Wedstrijd (met Pete)
insertSchedule.run(2, "18:30", "20:00", "VBSK", 7);  // Pete - Wedstrijd (met Gino)
insertSchedule.run(2, "20:15", "21:15", "VBSK", 3);  // Gino - Recreanten
insertSchedule.run(2, "18:30", "20:00", "VBSK", 5);  // Jörgen - Techniek en sparren

// WOENSDAG
insertSchedule.run(3, "07:00", "08:00", "VBSK", 2);  // Digna - Pad-sessie (met Pete)
insertSchedule.run(3, "07:00", "08:00", "VBSK", 7);  // Pete - Pad-sessie (met Digna)
insertSchedule.run(3, "08:00", "09:00", "VBSK", 7);  // Pete - Heavy-bag
insertSchedule.run(3, "17:30", "18:30", "VBSK", 3);  // Gino - Junioren
insertSchedule.run(3, "18:15", "19:15", "VBSK", 2);  // Digna - Recreanten
insertSchedule.run(3, "19:30", "21:00", "VBSK", 2);  // Digna - Competitie (met Pete en Gino)
insertSchedule.run(3, "19:30", "21:00", "VBSK", 3);  // Gino - Competitie (met Pete en Digna)
insertSchedule.run(3, "19:30", "21:00", "VBSK", 7);  // Pete - Competitie (met Digna en Gino)

// DONDERDAG
insertSchedule.run(4, "17:30", "18:30", "VBSK", 2);  // Digna - Junioren
insertSchedule.run(4, "17:30", "18:30", "VBSK", 7);  // Pete - Recreanten
insertSchedule.run(4, "18:45", "20:15", "VBSK", 2);  // Digna - Competitie (met Pete)
insertSchedule.run(4, "18:45", "20:15", "VBSK", 7);  // Pete - Competitie (met Digna)
insertSchedule.run(4, "20:45", "21:45", "VBSK", 8);  // Richey - Senioren

// VRIJDAG
insertSchedule.run(5, "18:00", "19:00", "VBSK", 3);  // Gino - Recreanten
insertSchedule.run(5, "19:15", "20:15", "VBSK", 3);  // Gino - Heavy bag

// ZATERDAG
insertSchedule.run(6, "09:45", "10:45", "VBSK", 2);  // Digna - Recreanten
insertSchedule.run(6, "11:00", "12:00", "VBSK", 2);  // Digna - Wedstrijd

console.log("✅ Database geseeded met echte VBSK trainers en rooster (m.i.v. 15 sept 2025).");
db.close();
