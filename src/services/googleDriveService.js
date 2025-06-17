const { google } = require('googleapis');
const config = require('../config/environment');
const logger = require('../utils/logger');

class GoogleDriveService {
  constructor() {
    this.drive = google.drive('v3');
  }

  // Create OAuth2 client for a user
  createOAuth2Client(accessToken, refreshToken = null) {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return oauth2Client;
  }

  // Get user's Google Drive files
  async getUserFiles(accessToken, refreshToken = null, pageSize = 50) {
    try {
      const oauth2Client = this.createOAuth2Client(accessToken, refreshToken);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.list({
        pageSize,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, permissions)',
        q: "'me' in owners and trashed=false"
      });

      const files = response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        owners: file.owners,
        permissions: file.permissions
      }));

      logger.debug('Retrieved user files', { count: files.length });
      return files;
    } catch (error) {
      logger.error('Failed to get user files', error);
      throw error;
    }
  }

  // Transfer file ownership
  async transferFileOwnership(fileId, newOwnerEmail, accessToken, refreshToken = null) {
    try {
      const oauth2Client = this.createOAuth2Client(accessToken, refreshToken);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // First, add the new owner as a writer
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: newOwnerEmail
        },
        fields: 'id'
      });

      // Then, transfer ownership
      const permission = await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: newOwnerEmail
        },
        transferOwnership: true,
        fields: 'id'
      });

      logger.info('File ownership transferred successfully', { 
        fileId, 
        newOwnerEmail, 
        permissionId: permission.data.id 
      });

      return permission.data;
    } catch (error) {
      logger.error('Failed to transfer file ownership', { 
        fileId, 
        newOwnerEmail, 
        error: error.message 
      });
      throw error;
    }
  }

  // Transfer multiple files
  async transferFiles(sessionId, fileTransfers) {
    try {
      logger.info('Starting file transfer process', { sessionId, fileCount: fileTransfers.length });

      for (const fileTransfer of fileTransfers) {
        try {
          // Update status to transferring
          await fileTransfer.updateStatus(fileTransfer.id, 'transferring');

          // Get the original owner's access token
          const originalOwner = await require('../database/models/User').findById(fileTransfer.originalOwnerId);
          const newOwner = await require('../database/models/User').findById(fileTransfer.newOwnerId);

          if (!originalOwner || !newOwner) {
            throw new Error('User not found');
          }

          // Transfer the file
          await this.transferFileOwnership(
            fileTransfer.googleFileId,
            newOwner.email,
            originalOwner.accessToken,
            originalOwner.refreshToken
          );

          // Update status to completed
          await fileTransfer.updateStatus(fileTransfer.id, 'completed');

          logger.info('File transfer completed', { 
            sessionId, 
            fileId: fileTransfer.googleFileId, 
            fileName: fileTransfer.fileName 
          });

        } catch (error) {
          logger.error('File transfer failed', { 
            sessionId, 
            fileId: fileTransfer.googleFileId, 
            error: error.message 
          });

          // Update status to failed
          await fileTransfer.updateStatus(fileTransfer.id, 'failed', error.message);
        }
      }

      logger.info('File transfer process completed', { sessionId });
    } catch (error) {
      logger.error('Failed to transfer files', { sessionId, error: error.message });
      throw error;
    }
  }

  // Get file details
  async getFileDetails(fileId, accessToken, refreshToken = null) {
    try {
      const oauth2Client = this.createOAuth2Client(accessToken, refreshToken);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, owners, permissions, createdTime, modifiedTime'
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
        owners: response.data.owners,
        permissions: response.data.permissions,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime
      };
    } catch (error) {
      logger.error('Failed to get file details', { fileId, error: error.message });
      throw error;
    }
  }

  // Check if user has permission to transfer file
  async checkTransferPermission(fileId, userEmail, accessToken, refreshToken = null) {
    try {
      const oauth2Client = this.createOAuth2Client(accessToken, refreshToken);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.get({
        fileId,
        fields: 'owners, permissions'
      });

      const file = response.data;
      
      // Check if user is the owner
      const isOwner = file.owners.some(owner => owner.emailAddress === userEmail);
      
      if (!isOwner) {
        return {
          canTransfer: false,
          reason: 'User is not the owner of this file'
        };
      }

      // Check if file is shared (has other permissions)
      const hasOtherPermissions = file.permissions && file.permissions.length > 1;

      return {
        canTransfer: true,
        isShared: hasOtherPermissions,
        owners: file.owners,
        permissions: file.permissions
      };
    } catch (error) {
      logger.error('Failed to check transfer permission', { fileId, userEmail, error: error.message });
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      logger.debug('Access token refreshed successfully');
      return credentials;
    } catch (error) {
      logger.error('Failed to refresh access token', error);
      throw error;
    }
  }
}

module.exports = new GoogleDriveService(); 