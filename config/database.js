const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/school.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('📊 Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Students registration table
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT NOT NULL,
        student_age INTEGER NOT NULL,
        parent_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        section TEXT NOT NULL,
        payment_plan TEXT NOT NULL,
        comments TEXT,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Contact messages table
      `CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Sections information table
      `CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        capacity INTEGER DEFAULT 50,
        current_enrollment INTEGER DEFAULT 0,
        fee_termly DECIMAL(10,2),
        fee_annual DECIMAL(10,2),
        age_min INTEGER,
        age_max INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Payment records table
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method TEXT,
        payment_reference TEXT,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        academic_term TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Insert default sections
    await this.insertDefaultSections();
    
    // Create default admin user
    await this.createDefaultAdmin();
    
    console.log('✅ Database tables created successfully');
  }

  async insertDefaultSections() {
    const sections = [
      {
        name: 'Nursery',
        description: 'Early childhood Islamic education for ages 3-5',
        capacity: 30,
        fee_termly: 12000,
        fee_annual: 32000,
        age_min: 3,
        age_max: 5
      },
      {
        name: 'Primary School',
        description: 'Primary education with Islamic values integration',
        capacity: 40,
        fee_termly: 15000,
        fee_annual: 40000,
        age_min: 6,
        age_max: 12
      },
      {
        name: 'Islamiyya',
        description: 'Foundational Islamic studies program',
        capacity: 50,
        fee_termly: 10000,
        fee_annual: 28000,
        age_min: 7,
        age_max: 16
      },
      {
        name: 'Tahfiz',
        description: 'Quran memorization program',
        capacity: 25,
        fee_termly: 18000,
        fee_annual: 48000,
        age_min: 8,
        age_max: 18
      },
      {
        name: 'Higher Islamic',
        description: 'Advanced Islamic studies for older students',
        capacity: 35,
        fee_termly: 20000,
        fee_annual: 55000,
        age_min: 16,
        age_max: 25
      },
      {
        name: 'Mosque/Majlis',
        description: 'Community programs and adult education',
        capacity: 100,
        fee_termly: 5000,
        fee_annual: 15000,
        age_min: 18,
        age_max: 100
      }
    ];

    for (const section of sections) {
      await this.run(
        `INSERT OR IGNORE INTO sections (name, description, capacity, fee_termly, fee_annual, age_min, age_max) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [section.name, section.description, section.capacity, section.fee_termly, section.fee_annual, section.age_min, section.age_max]
      );
    }
  }

  async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await this.run(
      `INSERT OR IGNORE INTO admin_users (username, email, password_hash, role) 
       VALUES (?, ?, ?, ?)`,
      ['admin', process.env.ADMIN_EMAIL || 'admin@musabmemorial.edu.ng', hashedPassword, 'super_admin']
    );
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Database get error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database all error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new Database();