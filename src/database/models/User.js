const { v4: uuidv4 } = require('uuid');
const { query } = require('../connection');
const logger = require('../../utils/logger');

class User {
  // Create a new user
  static async create(userData) {
    const {
      googleId,
      email,
      displayName,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenExpiry
    } = userData;

    const sql = `
      INSERT INTO users (id, google_id, email, display_name, avatar_url, access_token, refresh_token, token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      uuidv4(),
      googleId,
      email,
      displayName,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenExpiry
    ];

    try {
      const result = await query(sql, values);
      logger.info('User created successfully', { userId: result.rows[0].id, email });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user', { error: error.message, email });
      throw error;
    }
  }

  // Find user by Google ID
  static async findByGoogleId(googleId) {
    const sql = 'SELECT * FROM users WHERE google_id = $1';
    
    try {
      const result = await query(sql, [googleId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by Google ID', { error: error.message, googleId });
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await query(sql, [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by email', { error: error.message, email });
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await query(sql, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user by ID', { error: error.message, id });
      throw error;
    }
  }

  // Update user tokens
  static async updateTokens(userId, accessToken, refreshToken, tokenExpiry) {
    const sql = `
      UPDATE users 
      SET access_token = $2, refresh_token = $3, token_expiry = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(sql, [userId, accessToken, refreshToken, tokenExpiry]);
      logger.info('User tokens updated', { userId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user tokens', { error: error.message, userId });
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(userId) {
    const sql = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(sql, [userId]);
      logger.debug('User last login updated', { userId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user last login', { error: error.message, userId });
      throw error;
    }
  }

  // Update user profile
  static async updateProfile(userId, profileData) {
    const { displayName, avatarUrl } = profileData;
    const sql = `
      UPDATE users 
      SET display_name = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(sql, [userId, displayName, avatarUrl]);
      logger.info('User profile updated', { userId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user profile', { error: error.message, userId });
      throw error;
    }
  }

  // Deactivate user
  static async deactivate(userId) {
    const sql = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(sql, [userId]);
      logger.info('User deactivated', { userId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to deactivate user', { error: error.message, userId });
      throw error;
    }
  }

  // Get all active users
  static async findAllActive() {
    const sql = 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC';
    
    try {
      const result = await query(sql);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get active users', { error: error.message });
      throw error;
    }
  }

  // Delete user (soft delete by deactivating)
  static async delete(userId) {
    return this.deactivate(userId);
  }

  // Check if user exists
  static async exists(userId) {
    const sql = 'SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)';
    
    try {
      const result = await query(sql, [userId]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Failed to check user existence', { error: error.message, userId });
      throw error;
    }
  }

  // Get user statistics
  static async getStats(userId) {
    const sql = `
      SELECT 
        COUNT(*) as total_transfers,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transfers,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transfers
      FROM file_transfers 
      WHERE original_owner_id = $1 OR new_owner_id = $1
    `;

    try {
      const result = await query(sql, [userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user stats', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = User; 