const { v4: uuidv4 } = require('uuid');
const db = require('../connection');
const logger = require('../../utils/logger');

class TransferSession {
  static async create(sessionData) {
    try {
      const id = sessionData.id || uuidv4();
      const now = new Date().toISOString();

      const result = await db.run(`
        INSERT INTO transfer_sessions (
          id, session_token, sender_user_id, receiver_user_id, 
          status, created_at, updated_at, expires_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        sessionData.sessionToken,
        sessionData.senderUserId,
        sessionData.receiverUserId,
        sessionData.status || 'pending',
        now,
        now,
        sessionData.expiresAt.toISOString(),
        sessionData.metadata
      ]);

      logger.debug('Transfer session created', { id });
      return { id, ...sessionData };
    } catch (error) {
      logger.error('Failed to create transfer session', error);
      throw error;
    }
  }

  static async findByToken(sessionToken) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM transfer_sessions 
        WHERE session_token = ? AND expires_at > datetime('now')
      `, [sessionToken]);

      if (result.rowCount === 0) {
        return null;
      }

      const session = result.rows[0];
      return {
        id: session.id,
        sessionToken: session.session_token,
        senderUserId: session.sender_user_id,
        receiverUserId: session.receiver_user_id,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at,
        metadata: session.metadata ? JSON.parse(session.metadata) : null
      };
    } catch (error) {
      logger.error('Failed to find transfer session by token', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM transfer_sessions WHERE id = ?
      `, [id]);

      if (result.rowCount === 0) {
        return null;
      }

      const session = result.rows[0];
      return {
        id: session.id,
        sessionToken: session.session_token,
        senderUserId: session.sender_user_id,
        receiverUserId: session.receiver_user_id,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at,
        metadata: session.metadata ? JSON.parse(session.metadata) : null
      };
    } catch (error) {
      logger.error('Failed to find transfer session by ID', error);
      throw error;
    }
  }

  static async updateStatus(id, status) {
    try {
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE transfer_sessions 
        SET status = ?, updated_at = ? 
        WHERE id = ?
      `, [status, now, id]);

      logger.debug('Transfer session status updated', { id, status });
    } catch (error) {
      logger.error('Failed to update transfer session status', error);
      throw error;
    }
  }

  static async findByUserId(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const result = await db.query(`
        SELECT * FROM transfer_sessions 
        WHERE sender_user_id = ? OR receiver_user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [userId, userId, limit, offset]);

      return result.rows.map(session => ({
        id: session.id,
        sessionToken: session.session_token,
        senderUserId: session.sender_user_id,
        receiverUserId: session.receiver_user_id,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at,
        metadata: session.metadata ? JSON.parse(session.metadata) : null
      }));
    } catch (error) {
      logger.error('Failed to find transfer sessions by user ID', error);
      throw error;
    }
  }

  static async deleteExpired() {
    try {
      const result = await db.run(`
        DELETE FROM transfer_sessions 
        WHERE expires_at < datetime('now')
      `);

      logger.info('Deleted expired transfer sessions', { count: result.rowCount });
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to delete expired transfer sessions', error);
      throw error;
    }
  }
}

module.exports = TransferSession; 