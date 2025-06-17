const fs = require('fs').promises;
const path = require('path');
const { query } = require('../src/database/connection');
const logger = require('../src/utils/logger');

// Load environment variables
require('dotenv').config();

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../src/database/migrations');
    this.migrationsTable = 'schema_migrations';
  }

  async init() {
    try {
      // Create migrations table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await query(createTableSQL);
      logger.info('Migration system initialized');
    } catch (error) {
      logger.error('Failed to initialize migration system', { error: error.message });
      throw error;
    }
  }

  async getExecutedMigrations() {
    try {
      const result = await query(`SELECT migration_name FROM ${this.migrationsTable} ORDER BY id`);
      return result.rows.map(row => row.migration_name);
    } catch (error) {
      logger.error('Failed to get executed migrations', { error: error.message });
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure correct order
    } catch (error) {
      logger.error('Failed to read migration files', { error: error.message });
      throw error;
    }
  }

  async readMigrationFile(filename) {
    try {
      const filePath = path.join(this.migrationsPath, filename);
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      logger.error('Failed to read migration file', { error: error.message, filename });
      throw error;
    }
  }

  async executeMigration(filename, sql) {
    try {
      // Split SQL by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          await query(statement);
        }
      }

      // Record the migration as executed
      await query(
        `INSERT INTO ${this.migrationsTable} (migration_name) VALUES ($1)`,
        [filename]
      );

      logger.info('Migration executed successfully', { filename });
    } catch (error) {
      logger.error('Failed to execute migration', { error: error.message, filename });
      throw error;
    }
  }

  async runMigrations() {
    try {
      logger.info('Starting database migrations...');

      // Initialize migration system
      await this.init();

      // Get executed and available migrations
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        file => !executedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Execute pending migrations
      for (const filename of pendingMigrations) {
        logger.info(`Executing migration: ${filename}`);
        
        const sql = await this.readMigrationFile(filename);
        await this.executeMigration(filename, sql);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  }

  async rollbackMigration(migrationName) {
    try {
      logger.info(`Rolling back migration: ${migrationName}`);

      // Check if migration was executed
      const result = await query(
        `SELECT id FROM ${this.migrationsTable} WHERE migration_name = $1`,
        [migrationName]
      );

      if (result.rows.length === 0) {
        logger.warn('Migration not found in executed migrations', { migrationName });
        return;
      }

      // Remove from executed migrations
      await query(
        `DELETE FROM ${this.migrationsTable} WHERE migration_name = $1`,
        [migrationName]
      );

      logger.info('Migration rolled back successfully', { migrationName });
    } catch (error) {
      logger.error('Failed to rollback migration', { error: error.message, migrationName });
      throw error;
    }
  }

  async showStatus() {
    try {
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();

      console.log('\n📊 Migration Status:');
      console.log('===================\n');

      for (const file of migrationFiles) {
        const status = executedMigrations.includes(file) ? '✅ Executed' : '⏳ Pending';
        console.log(`${status} - ${file}`);
      }

      console.log(`\nTotal: ${migrationFiles.length} migrations`);
      console.log(`Executed: ${executedMigrations.length}`);
      console.log(`Pending: ${migrationFiles.length - executedMigrations.length}\n`);
    } catch (error) {
      logger.error('Failed to show migration status', { error: error.message });
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const runner = new MigrationRunner();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'run':
        await runner.runMigrations();
        break;
      
      case 'status':
        await runner.showStatus();
        break;
      
      case 'rollback':
        const migrationName = process.argv[3];
        if (!migrationName) {
          console.error('Usage: npm run migrate rollback <migration_name>');
          process.exit(1);
        }
        await runner.rollbackMigration(migrationName);
        break;
      
      default:
        console.log(`
🔧 Database Migration Tool

Usage:
  npm run migrate run      - Run all pending migrations
  npm run migrate status   - Show migration status
  npm run migrate rollback <migration_name> - Rollback specific migration

Examples:
  npm run migrate run
  npm run migrate status
  npm run migrate rollback 001_create_users.sql
        `);
        break;
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner; 