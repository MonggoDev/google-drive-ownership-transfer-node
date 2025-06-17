const { google } = require('googleapis');
const { oauth2Client } = require('../auth/oauthClient');
const logger = require('../utils/logger');

class DriveService {
  constructor() {
    this.drive = null;
  }

  // Initialize Drive API with user credentials
  initialize(accessToken) {
    oauth2Client.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    logger.debug('Drive API initialized with user credentials');
  }

  // Get user's files (owned by the user)
  async getUserFiles(pageToken = null, pageSize = 50) {
    try {
      const params = {
        pageSize: pageSize,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, createdTime, modifiedTime, webViewLink)',
        q: "'me' in owners and trashed = false",
        orderBy: 'modifiedTime desc'
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await this.drive.files.list(params);
      
      logger.info('Retrieved user files', {
        fileCount: response.data.files.length,
        hasNextPage: !!response.data.nextPageToken
      });

      return {
        files: response.data.files,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      logger.error('Failed to get user files', { error: error.message });
      throw new Error(`Failed to retrieve files: ${error.message}`);
    }
  }

  // Get file details
  async getFileDetails(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, owners, createdTime, modifiedTime, webViewLink, permissions'
      });

      logger.debug('Retrieved file details', { fileId, fileName: response.data.name });
      return response.data;
    } catch (error) {
      logger.error('Failed to get file details', { error: error.message, fileId });
      throw new Error(`Failed to get file details: ${error.message}`);
    }
  }

  // Transfer file ownership
  async transferOwnership(fileId, newOwnerEmail) {
    try {
      // First, get current file permissions
      const permissionsResponse = await this.drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role, type)'
      });

      // Find the new owner's permission or create one
      let newOwnerPermission = permissionsResponse.data.permissions.find(
        p => p.emailAddress === newOwnerEmail && p.type === 'user'
      );

      if (!newOwnerPermission) {
        // Create permission for new owner
        const createPermissionResponse = await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: newOwnerEmail
          },
          fields: 'id'
        });
        newOwnerPermission = { id: createPermissionResponse.data.id };
      }

      // Transfer ownership
      const transferResponse = await this.drive.permissions.update({
        fileId: fileId,
        permissionId: newOwnerPermission.id,
        requestBody: {
          role: 'owner'
        },
        transferOwnership: true,
        fields: 'id, role, emailAddress'
      });

      logger.info('File ownership transferred successfully', {
        fileId,
        newOwnerEmail,
        permissionId: transferResponse.data.id
      });

      return transferResponse.data;
    } catch (error) {
      logger.error('Failed to transfer file ownership', {
        error: error.message,
        fileId,
        newOwnerEmail
      });
      throw new Error(`Failed to transfer ownership: ${error.message}`);
    }
  }

  // Batch transfer multiple files
  async batchTransferOwnership(files, newOwnerEmail) {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.transferOwnership(file.id, newOwnerEmail);
        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'success',
          result
        });
      } catch (error) {
        errors.push({
          fileId: file.id,
          fileName: file.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    logger.info('Batch transfer completed', {
      totalFiles: files.length,
      successful: results.length,
      failed: errors.length
    });

    return { results, errors };
  }

  // Check if user has permission to transfer file
  async canTransferFile(fileId) {
    try {
      const file = await this.getFileDetails(fileId);
      
      // Check if current user is the owner
      const isOwner = file.owners.some(owner => owner.me === true);
      
      if (!isOwner) {
        return {
          canTransfer: false,
          reason: 'User is not the owner of this file'
        };
      }

      // Check if file is in a shared drive (which may have restrictions)
      if (file.driveId) {
        return {
          canTransfer: false,
          reason: 'Cannot transfer files in shared drives'
        };
      }

      return { canTransfer: true };
    } catch (error) {
      logger.error('Failed to check transfer permission', { error: error.message, fileId });
      return {
        canTransfer: false,
        reason: `Error checking permissions: ${error.message}`
      };
    }
  }

  // Get file permissions
  async getFilePermissions(fileId) {
    try {
      const response = await this.drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role, type, displayName)'
      });

      return response.data.permissions;
    } catch (error) {
      logger.error('Failed to get file permissions', { error: error.message, fileId });
      throw new Error(`Failed to get permissions: ${error.message}`);
    }
  }

  // Search files by name
  async searchFiles(query, pageToken = null, pageSize = 50) {
    try {
      const params = {
        pageSize: pageSize,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, createdTime, modifiedTime)',
        q: `name contains '${query}' and 'me' in owners and trashed = false`,
        orderBy: 'modifiedTime desc'
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await this.drive.files.list(params);
      
      logger.info('Searched files', {
        query,
        fileCount: response.data.files.length,
        hasNextPage: !!response.data.nextPageToken
      });

      return {
        files: response.data.files,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      logger.error('Failed to search files', { error: error.message, query });
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  // Get file content (for verification)
  async getFileContent(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get file content', { error: error.message, fileId });
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // Verify file exists and is accessible
  async verifyFileAccess(fileId) {
    try {
      await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name'
      });
      return true;
    } catch (error) {
      logger.error('File access verification failed', { error: error.message, fileId });
      return false;
    }
  }
}

module.exports = DriveService; 