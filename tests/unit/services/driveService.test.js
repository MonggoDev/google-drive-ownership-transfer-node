const DriveService = require('../../../src/services/driveService');

describe('DriveService', () => {
  let driveService;

  beforeEach(() => {
    driveService = new DriveService();
  });

  describe('initialization', () => {
    it('should initialize with access token', () => {
      const accessToken = 'test-access-token';
      driveService.initialize(accessToken);
      
      expect(driveService.drive).toBeDefined();
    });
  });

  describe('getUserFiles', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should retrieve user files successfully', async () => {
      const result = await driveService.getUserFiles();
      
      expect(result).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0]).toHaveProperty('id');
      expect(result.files[0]).toHaveProperty('name');
    });

    it('should handle pagination correctly', async () => {
      const pageToken = 'test-page-token';
      const pageSize = 25;
      
      const result = await driveService.getUserFiles(pageToken, pageSize);
      
      expect(result).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
    });

    it('should handle errors gracefully', async () => {
      // Mock the drive.files.list to throw an error
      driveService.drive.files.list = jest.fn().mockRejectedValue(new Error('API Error'));
      
      await expect(driveService.getUserFiles()).rejects.toThrow('Failed to retrieve files: API Error');
    });
  });

  describe('getFileDetails', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should retrieve file details successfully', async () => {
      const fileId = 'test-file-id';
      const result = await driveService.getFileDetails(fileId);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(fileId);
      expect(result.name).toBeDefined();
      expect(result.mimeType).toBeDefined();
    });

    it('should handle file not found', async () => {
      const fileId = 'non-existent-file-id';
      driveService.drive.files.get = jest.fn().mockRejectedValue(new Error('File not found'));
      
      await expect(driveService.getFileDetails(fileId)).rejects.toThrow('Failed to get file details: File not found');
    });
  });

  describe('transferOwnership', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should transfer ownership successfully', async () => {
      const fileId = 'test-file-id';
      const newOwnerEmail = 'newowner@example.com';
      
      const result = await driveService.transferOwnership(fileId, newOwnerEmail);
      
      expect(result).toBeDefined();
      expect(result.role).toBe('owner');
      expect(result.emailAddress).toBe(newOwnerEmail);
    });

    it('should handle transfer errors', async () => {
      const fileId = 'test-file-id';
      const newOwnerEmail = 'newowner@example.com';
      
      driveService.drive.permissions.update = jest.fn().mockRejectedValue(new Error('Transfer failed'));
      
      await expect(driveService.transferOwnership(fileId, newOwnerEmail)).rejects.toThrow('Failed to transfer ownership: Transfer failed');
    });
  });

  describe('canTransferFile', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should return true for transferable files', async () => {
      const fileId = 'test-file-id';
      
      const result = await driveService.canTransferFile(fileId);
      
      expect(result.canTransfer).toBe(true);
    });

    it('should return false for non-owner files', async () => {
      const fileId = 'test-file-id';
      
      // Mock file details where user is not owner
      driveService.drive.files.get = jest.fn().mockResolvedValue({
        data: {
          id: fileId,
          owners: [{ me: false }]
        }
      });
      
      const result = await driveService.canTransferFile(fileId);
      
      expect(result.canTransfer).toBe(false);
      expect(result.reason).toBe('User is not the owner of this file');
    });

    it('should return false for shared drive files', async () => {
      const fileId = 'test-file-id';
      
      // Mock file details with driveId (shared drive)
      driveService.drive.files.get = jest.fn().mockResolvedValue({
        data: {
          id: fileId,
          owners: [{ me: true }],
          driveId: 'shared-drive-id'
        }
      });
      
      const result = await driveService.canTransferFile(fileId);
      
      expect(result.canTransfer).toBe(false);
      expect(result.reason).toBe('Cannot transfer files in shared drives');
    });
  });

  describe('batchTransferOwnership', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should transfer multiple files successfully', async () => {
      const files = [
        { id: 'file1', name: 'File 1' },
        { id: 'file2', name: 'File 2' }
      ];
      const newOwnerEmail = 'newowner@example.com';
      
      const result = await driveService.batchTransferOwnership(files, newOwnerEmail);
      
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.results[0].status).toBe('success');
      expect(result.results[1].status).toBe('success');
    });

    it('should handle partial failures', async () => {
      const files = [
        { id: 'file1', name: 'File 1' },
        { id: 'file2', name: 'File 2' }
      ];
      const newOwnerEmail = 'newowner@example.com';
      
      // Mock one file to fail
      driveService.transferOwnership = jest.fn()
        .mockResolvedValueOnce({ id: 'permission1' })
        .mockRejectedValueOnce(new Error('Transfer failed'));
      
      const result = await driveService.batchTransferOwnership(files, newOwnerEmail);
      
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.results[0].status).toBe('success');
      expect(result.errors[0].status).toBe('failed');
    });
  });

  describe('searchFiles', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should search files by name', async () => {
      const query = 'test document';
      
      const result = await driveService.searchFiles(query);
      
      expect(result).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle empty search results', async () => {
      const query = 'nonexistent file';
      
      // Mock empty results
      driveService.drive.files.list = jest.fn().mockResolvedValue({
        data: {
          files: [],
          nextPageToken: null
        }
      });
      
      const result = await driveService.searchFiles(query);
      
      expect(result.files).toHaveLength(0);
    });
  });

  describe('verifyFileAccess', () => {
    beforeEach(() => {
      driveService.initialize('test-access-token');
    });

    it('should return true for accessible files', async () => {
      const fileId = 'test-file-id';
      
      const result = await driveService.verifyFileAccess(fileId);
      
      expect(result).toBe(true);
    });

    it('should return false for inaccessible files', async () => {
      const fileId = 'inaccessible-file-id';
      
      driveService.drive.files.get = jest.fn().mockRejectedValue(new Error('Access denied'));
      
      const result = await driveService.verifyFileAccess(fileId);
      
      expect(result).toBe(false);
    });
  });
}); 