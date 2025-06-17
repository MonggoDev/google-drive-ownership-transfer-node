const logger = require('../utils/logger');

// Use SQLite for development (easier setup on Windows)
const sqliteConnection = require('./connection-sqlite');

// For production, you can switch to PostgreSQL
// const pgConnection = require('./connection-pg');

// Export the SQLite connection as default
module.exports = sqliteConnection; 