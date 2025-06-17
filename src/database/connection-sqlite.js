const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Create database file in the project root
const dbPath = path.join(__dirname, '../../database.sqlite');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Error opening database', err);
  } else {
    logger.info('Connected to SQLite database');
  }
});

// Helper function to run queries
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        logger.error('Query error', { sql, error: err.message });
        reject(err);
      } else {
        logger.debug('Executed query', { sql, rows: rows.length });
        resolve({ rows, rowCount: rows.length });
      }
    });
  });
}

// Helper function to run single row queries
function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        logger.error('Query error', { sql, error: err.message });
        reject(err);
      } else {
        logger.debug('Executed query', { sql });
        resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
      }
    });
  });
}

// Helper function to run insert/update/delete queries
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        logger.error('Query error', { sql, error: err.message });
        reject(err);
      } else {
        logger.debug('Executed query', { sql, changes: this.changes });
        resolve({ 
          rows: [{ id: this.lastID }], 
          rowCount: this.changes,
          lastID: this.lastID 
        });
      }
    });
  });
}

// Transaction helper
function transaction(callback) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      callback(db)
        .then(result => {
          db.run('COMMIT');
          resolve(result);
        })
        .catch(error => {
          db.run('ROLLBACK');
          reject(error);
        });
    });
  });
}

// Initialize database tables
async function initializeDatabase() {
  try {
    // Enable foreign keys
    await run('PRAGMA foreign_keys = ON');
    
    // Create users table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);

    // Create transfer_sessions table
    await run(`
      CREATE TABLE IF NOT EXISTS transfer_sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        sender_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        receiver_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authenticated', 'file_selected', 'transferring', 'completed', 'failed', 'cancelled')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        metadata TEXT
      )
    `);

    // Create oauth_sessions table
    await run(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        state TEXT NOT NULL,
        code_verifier TEXT,
        redirect_uri TEXT,
        scope TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        is_used INTEGER DEFAULT 0
      )
    `);

    // Create file_transfers table
    await run(`
      CREATE TABLE IF NOT EXISTS file_transfers (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES transfer_sessions(id) ON DELETE CASCADE,
        google_file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        original_owner_id TEXT REFERENCES users(id),
        new_owner_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transferring', 'completed', 'failed', 'skipped')),
        transfer_started_at TEXT,
        transfer_completed_at TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create audit_logs table
    await run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        session_id TEXT REFERENCES transfer_sessions(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await run('CREATE INDEX IF NOT EXISTS idx_transfer_sessions_token ON transfer_sessions(session_token)');
    await run('CREATE INDEX IF NOT EXISTS idx_file_transfers_session ON file_transfers(session_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');

    logger.info('Database tables initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
}

// Close database connection
function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error('Error closing database', err);
        reject(err);
      } else {
        logger.info('Database connection closed');
        resolve();
      }
    });
  });
}

// Test database connection
async function testConnection() {
  try {
    await query('SELECT 1 as test');
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    throw error;
  }
}

module.exports = {
  query,
  queryOne,
  run,
  transaction,
  initializeDatabase,
  close,
  testConnection,
  db
}; 