const { v4: uuidv4 } = require('uuid');
const db = require('../connection');
const logger = require('../../utils/logger');

class FileTransfer {
  static async create(fileTransferData) {
    try {
      const id = fileTransferData.id || uuidv4();
      const now = new Date().toISOString();

      const result = await db.run(`
        INSERT INTO file_transfers (
          id, session_id, google_file_id, file_name, file_type, file_size,
          original_owner_id, new_owner_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        fileTransferData.sessionId,
        fileTransferData.googleFileId,
        fileTransferData.fileName,
        fileTransferData.fileType,
        fileTransferData.fileSize,
        fileTransferData.originalOwnerId,
        fileTransferData.newOwnerId,
        fileTransferData.status || 'pending',
        now,
        now
      ]);

      logger.debug('File transfer created', { id, fileName: fileTransferData.fileName });
      return { id, ...fileTransferData };
    } catch (error) {
      logger.error('Failed to create file transfer', error);
      throw error;
    }
  }

  static async findBySessionId(sessionId) {
    try {
      const result = await db.query(`
        SELECT * FROM file_transfers 
        WHERE session_id = ?
        ORDER BY created_at ASC
      `, [sessionId]);

      return result.rows.map(fileTransfer => ({
        id: fileTransfer.id,
        sessionId: fileTransfer.session_id,
        googleFileId: fileTransfer.google_file_id,
        fileName: fileTransfer.file_name,
        fileType: fileTransfer.file_type,
        fileSize: fileTransfer.file_size,
        originalOwnerId: fileTransfer.original_owner_id,
        newOwnerId: fileTransfer.new_owner_id,
        status: fileTransfer.status,
        transferStartedAt: fileTransfer.transfer_started_at,
        transferCompletedAt: fileTransfer.transfer_completed_at,
        errorMessage: fileTransfer.error_message,
        retryCount: fileTransfer.retry_count,
        createdAt: fileTransfer.created_at,
        updatedAt: fileTransfer.updated_at
      }));
    } catch (error) {
      logger.error('Failed to find file transfers by session ID', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await db.queryOne(`
        SELECT * FROM file_transfers WHERE id = ?
      `, [id]);

      if (result.rowCount === 0) {
        return null;
      }

      const fileTransfer = result.rows[0];
      return {
        id: fileTransfer.id,
        sessionId: fileTransfer.session_id,
        googleFileId: fileTransfer.google_file_id,
        fileName: fileTransfer.file_name,
        fileType: fileTransfer.file_type,
        fileSize: fileTransfer.file_size,
        originalOwnerId: fileTransfer.original_owner_id,
        newOwnerId: fileTransfer.new_owner_id,
        status: fileTransfer.status,
        transferStartedAt: fileTransfer.transfer_started_at,
        transferCompletedAt: fileTransfer.transfer_completed_at,
        errorMessage: fileTransfer.error_message,
        retryCount: fileTransfer.retry_count,
        createdAt: fileTransfer.created_at,
        updatedAt: fileTransfer.updated_at
      };
    } catch (error) {
      logger.error('Failed to find file transfer by ID', error);
      throw error;
    }
  }

  static async updateStatus(id, status, errorMessage = null) {
    try {
      const now = new Date().toISOString();
      let query, params;

      if (status === 'transferring') {
        query = `
          UPDATE file_transfers 
          SET status = ?, transfer_started_at = ?, updated_at = ?
          WHERE id = ?
        `;
        params = [status, now, now, id];
      } else if (status === 'completed') {
        query = `
          UPDATE file_transfers 
          SET status = ?, transfer_completed_at = ?, updated_at = ?
          WHERE id = ?
        `;
        params = [status, now, now, id];
      } else if (status === 'failed') {
        query = `
          UPDATE file_transfers 
          SET status = ?, error_message = ?, retry_count = retry_count + 1, updated_at = ?
          WHERE id = ?
        `;
        params = [status, errorMessage, now, id];
      } else {
        query = `
          UPDATE file_transfers 
          SET status = ?, updated_at = ?
          WHERE id = ?
        `;
        params = [status, now, id];
      }

      await db.run(query, params);
      logger.debug('File transfer status updated', { id, status });
    } catch (error) {
      logger.error('Failed to update file transfer status', error);
      throw error;
    }
  }

  static async findByUserId(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const result = await db.query(`
        SELECT * FROM file_transfers 
        WHERE original_owner_id = ? OR new_owner_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [userId, userId, limit, offset]);

      return result.rows.map(fileTransfer => ({
        id: fileTransfer.id,
        sessionId: fileTransfer.session_id,
        googleFileId: fileTransfer.google_file_id,
        fileName: fileTransfer.file_name,
        fileType: fileTransfer.file_type,
        fileSize: fileTransfer.file_size,
        originalOwnerId: fileTransfer.original_owner_id,
        newOwnerId: fileTransfer.new_owner_id,
        status: fileTransfer.status,
        transferStartedAt: fileTransfer.transfer_started_at,
        transferCompletedAt: fileTransfer.transfer_completed_at,
        errorMessage: fileTransfer.error_message,
        retryCount: fileTransfer.retry_count,
        createdAt: fileTransfer.created_at,
        updatedAt: fileTransfer.updated_at
      }));
    } catch (error) {
      logger.error('Failed to find file transfers by user ID', error);
      throw error;
    }
  }

  static async getStats(sessionId) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'transferring' THEN 1 ELSE 0 END) as transferring
        FROM file_transfers 
        WHERE session_id = ?
      `, [sessionId]);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get file transfer stats', error);
      throw error;
    }
  }
}

module.exports = FileTransfer; 