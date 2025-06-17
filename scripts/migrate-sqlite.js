const path = require('path');
const logger = require('../src/utils/logger');

// Add the src directory to the module path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigrations() {
  try {
    logger.info('Starting SQLite database migration...');
    
    // Import the database connection
    const db = require('../src/database/connection');
    
    // Initialize database tables
    await db.initializeDatabase();
    
    logger.info('SQLite database migration completed successfully!');
    
    // Close the database connection
    await db.close();
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations; 