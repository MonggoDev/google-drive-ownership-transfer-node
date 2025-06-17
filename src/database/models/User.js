const { v4: uuidv4 } = require('uuid');
const db = require('../connection');
const logger = require('../../utils/logger');

class User {
  // Create a new user
  static async create(userData) {
    try {
      const id = userData.id || uuidv4();
      const now = new Date().toISOString();

      const result = await db.run(`
        INSERT INTO users (
          id, google_id, email, display_name, avatar_url,
          access_token, refresh_token, token_expiry,
          created_at, updated_at, last_login, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userData.googleId,
        userData.email,
        userData.displayName,
        userData.avatarUrl,
        userData.accessToken,
        userData.refreshToken,
        userData.tokenExpiry ? userData.tokenExpiry.toISOString() : null,
        now,
        now,
        now,
        1
      ]);

      logger.debug('User created', { id, email: userData.email });
      return { id, ...userData };
    } catch (error) {
      logger.error('Failed to create user', error);
      throw error;
    }
  }

  // Find user by Google ID
  static async findByGoogleId(googleId) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM users WHERE google_id = ?
      `, [googleId]);

      if (result.rowCount === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        accessToken: user.access_token,
        refreshToken: user.refresh_token,
        tokenExpiry: user.token_expiry,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isActive: user.is_active === 1
      };
    } catch (error) {
      logger.error('Failed to find user by Google ID', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM users WHERE email = ?
      `, [email]);

      if (result.rowCount === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        accessToken: user.access_token,
        refreshToken: user.refresh_token,
        tokenExpiry: user.token_expiry,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isActive: user.is_active === 1
      };
    } catch (error) {
      logger.error('Failed to find user by email', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM users WHERE id = ?
      `, [id]);

      if (result.rowCount === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        accessToken: user.access_token,
        refreshToken: user.refresh_token,
        tokenExpiry: user.token_expiry,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isActive: user.is_active === 1
      };
    } catch (error) {
      logger.error('Failed to find user by ID', error);
      throw error;
    }
  }

  // Update user tokens
  static async updateTokens(id, accessToken, refreshToken, tokenExpiry) {
    try {
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE users 
        SET access_token = ?, refresh_token = ?, token_expiry = ?, updated_at = ?
        WHERE id = ?
      `, [
        accessToken,
        refreshToken,
        tokenExpiry ? tokenExpiry.toISOString() : null,
        now,
        id
      ]);

      logger.debug('User tokens updated', { id });
    } catch (error) {
      logger.error('Failed to update user tokens', error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(id) {
    try {
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE users 
        SET last_login = ?, updated_at = ?
        WHERE id = ?
      `, [now, now, id]);

      logger.debug('User last login updated', { id });
    } catch (error) {
      logger.error('Failed to update user last login', error);
      throw error;
    }
  }

  // Update user profile
  static async updateProfile(id, profileData) {
    try {
      const now = new Date().toISOString();
      const updates = [];
      const params = [];

      if (profileData.displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(profileData.displayName);
      }

      if (profileData.avatarUrl !== undefined) {
        updates.push('avatar_url = ?');
        params.push(profileData.avatarUrl);
      }

      if (updates.length === 0) {
        return;
      }

      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      await db.run(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, params);

      logger.debug('User profile updated', { id });
    } catch (error) {
      logger.error('Failed to update user profile', error);
      throw error;
    }
  }

  // Deactivate user
  static async deactivate(id) {
    try {
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE users 
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `, [now, id]);

      logger.info('User deactivated', { id });
    } catch (error) {
      logger.error('Failed to deactivate user', error);
      throw error;
    }
  }

  // Reactivate user
  static async reactivate(id) {
    try {
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE users 
        SET is_active = 1, updated_at = ?
        WHERE id = ?
      `, [now, id]);

      logger.info('User reactivated', { id });
    } catch (error) {
      logger.error('Failed to reactivate user', error);
      throw error;
    }
  }

  // Delete user (soft delete by deactivating)
  static async delete(id) {
    try {
      await db.run(`
        DELETE FROM users WHERE id = ?
      `, [id]);

      logger.info('User deleted', { id });
    } catch (error) {
      logger.error('Failed to delete user', error);
      throw error;
    }
  }

  // Get all active users
  static async findAllActive() {
    const sql = 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC';
    
    try {
      const result = await db.query(sql);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get active users', { error: error.message });
      throw error;
    }
  }

  // Check if user exists
  static async exists(userId) {
    const sql = 'SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)';
    
    try {
      const result = await db.query(sql, [userId]);
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
      const result = await db.query(sql, [userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user stats', { error: error.message, userId });
      throw error;
    }
  }

  // Find active users
  static async findActiveUsers(options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const result = await db.query(`
        SELECT * FROM users 
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      return result.rows.map(user => ({
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }));
    } catch (error) {
      logger.error('Failed to find active users', error);
      throw error;
    }
  }

  // Find user by refresh token
  static async findByRefreshToken(refreshToken) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM users WHERE refresh_token = ?
      `, [refreshToken]);

      if (result.rowCount === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        accessToken: user.access_token,
        refreshToken: user.refresh_token,
        tokenExpiry: user.token_expiry,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login,
        isActive: user.is_active === 1
      };
    } catch (error) {
      logger.error('Failed to find user by refresh token', error);
      throw error;
    }
  }
}

module.exports = User; 