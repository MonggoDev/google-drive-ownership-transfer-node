const { v4: uuidv4 } = require('uuid');
const TransferSession = require('../database/models/TransferSession');
const FileTransfer = require('../database/models/FileTransfer');
const User = require('../database/models/User');
const GoogleDriveService = require('../services/googleDriveService');
const logger = require('../utils/logger');

class TransferController {
  // Create a new transfer session
  static async createTransferSession(req, res) {
    try {
      const { receiver_email, files } = req.body;
      const senderUserId = req.user.id; // From auth middleware
      
      // Find receiver user by email
      const receiverUser = await User.findByEmail(receiver_email);
      if (!receiverUser) {
        return res.status(404).json({
          success: false,
          error: 'Receiver not found. They need to authenticate first.'
        });
      }

      // Create transfer session
      const sessionId = uuidv4();
      const sessionToken = uuidv4();
      
      const transferSession = await TransferSession.create({
        id: sessionId,
        sessionToken,
        senderUserId,
        receiverUserId: receiverUser.id,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: JSON.stringify({ files })
      });

      // Create file transfer records
      for (const file of files) {
        await FileTransfer.create({
          sessionId,
          googleFileId: file.file_id,
          fileName: file.file_name,
          fileType: file.file_type,
          fileSize: file.file_size,
          originalOwnerId: senderUserId,
          newOwnerId: receiverUser.id,
          status: 'pending'
        });
      }

      logger.logTransfer(sessionId, 'session_created', { 
        senderUserId, 
        receiverUserId: receiverUser.id,
        fileCount: files.length 
      });

      res.json({
        success: true,
        sessionId,
        sessionToken,
        message: 'Transfer session created successfully'
      });
    } catch (error) {
      logger.logError(error, { action: 'create_transfer_session' });
      res.status(500).json({
        success: false,
        error: 'Failed to create transfer session'
      });
    }
  }

  // Get transfer session status
  static async getTransferSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found'
        });
      }

      const fileTransfers = await FileTransfer.findBySessionId(sessionId);

      res.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          files: fileTransfers.map(ft => ({
            id: ft.id,
            fileName: ft.fileName,
            fileType: ft.fileType,
            fileSize: ft.fileSize,
            status: ft.status,
            errorMessage: ft.errorMessage
          }))
        }
      });
    } catch (error) {
      logger.logError(error, { action: 'get_transfer_session' });
      res.status(500).json({
        success: false,
        error: 'Failed to get transfer session'
      });
    }
  }

  // Accept transfer session (receiver)
  static async acceptTransferSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;
      const receiverUserId = req.user.id;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session || session.receiverUserId !== receiverUserId) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found or unauthorized'
        });
      }

      if (session.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Transfer session cannot be accepted in current status'
        });
      }

      await TransferSession.updateStatus(sessionId, 'authenticated');

      logger.logTransfer(sessionId, 'session_accepted', { receiverUserId });

      res.json({
        success: true,
        message: 'Transfer session accepted'
      });
    } catch (error) {
      logger.logError(error, { action: 'accept_transfer_session' });
      res.status(500).json({
        success: false,
        error: 'Failed to accept transfer session'
      });
    }
  }

  // Start file transfer
  static async startTransfer(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found'
        });
      }

      if (session.status !== 'authenticated') {
        return res.status(400).json({
          success: false,
          error: 'Transfer session must be authenticated before starting'
        });
      }

      await TransferSession.updateStatus(sessionId, 'transferring');

      // Start the actual file transfer process
      const fileTransfers = await FileTransfer.findBySessionId(sessionId);
      
      // Process files in background
      setImmediate(async () => {
        try {
          await GoogleDriveService.transferFiles(sessionId, fileTransfers);
          await TransferSession.updateStatus(sessionId, 'completed');
        } catch (error) {
          logger.logError(error, { action: 'background_transfer', sessionId });
          await TransferSession.updateStatus(sessionId, 'failed');
        }
      });

      logger.logTransfer(sessionId, 'transfer_started', { fileCount: fileTransfers.length });

      res.json({
        success: true,
        message: 'File transfer started',
        fileCount: fileTransfers.length
      });
    } catch (error) {
      logger.logError(error, { action: 'start_transfer' });
      res.status(500).json({
        success: false,
        error: 'Failed to start transfer'
      });
    }
  }

  // Get transfer progress
  static async getTransferProgress(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found'
        });
      }

      const fileTransfers = await FileTransfer.findBySessionId(sessionId);
      
      const progress = {
        total: fileTransfers.length,
        completed: fileTransfers.filter(ft => ft.status === 'completed').length,
        failed: fileTransfers.filter(ft => ft.status === 'failed').length,
        pending: fileTransfers.filter(ft => ft.status === 'pending').length,
        transferring: fileTransfers.filter(ft => ft.status === 'transferring').length,
        files: fileTransfers.map(ft => ({
          fileName: ft.fileName,
          status: ft.status,
          errorMessage: ft.errorMessage
        }))
      };

      res.json({
        success: true,
        sessionStatus: session.status,
        progress
      });
    } catch (error) {
      logger.logError(error, { action: 'get_transfer_progress' });
      res.status(500).json({
        success: false,
        error: 'Failed to get transfer progress'
      });
    }
  }

  // Get user's transfer history
  static async getTransferHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const sessions = await TransferSession.findByUserId(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          status: session.status,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          role: session.senderUserId === userId ? 'sender' : 'receiver'
        }))
      });
    } catch (error) {
      logger.logError(error, { action: 'get_transfer_history' });
      res.status(500).json({
        success: false,
        error: 'Failed to get transfer history'
      });
    }
  }

  // Cancel transfer session
  static async cancelTransferSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;
      const userId = req.user.id;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session || (session.senderUserId !== userId && session.receiverUserId !== userId)) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found or unauthorized'
        });
      }

      await TransferSession.updateStatus(sessionId, 'cancelled');

      logger.logTransfer(sessionId, 'session_cancelled', { userId });

      res.json({
        success: true,
        message: 'Transfer session cancelled'
      });
    } catch (error) {
      logger.logError(error, { action: 'cancel_transfer_session' });
      res.status(500).json({
        success: false,
        error: 'Failed to cancel transfer session'
      });
    }
  }

  // Reject transfer session (receiver)
  static async rejectTransferSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { session_token } = req.query;
      const receiverUserId = req.user.id;

      const session = await TransferSession.findByToken(sessionToken);
      if (!session || session.receiverUserId !== receiverUserId) {
        return res.status(404).json({
          success: false,
          error: 'Transfer session not found or unauthorized'
        });
      }

      await TransferSession.updateStatus(sessionId, 'cancelled');

      logger.logTransfer(sessionId, 'session_rejected', { receiverUserId });

      res.json({
        success: true,
        message: 'Transfer session rejected'
      });
    } catch (error) {
      logger.logError(error, { action: 'reject_transfer_session' });
      res.status(500).json({
        success: false,
        error: 'Failed to reject transfer session'
      });
    }
  }
}

module.exports = TransferController; 