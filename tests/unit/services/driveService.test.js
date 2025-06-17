const { google } = require('googleapis');
const DriveService = require('../../../src/services/driveService');
const logger = require('../../../src/utils/logger');
const { oauth2Client } = require('../../../src/auth/oauthClient'); // Import oauth2Client

jest.mock('googleapis', () => {
  const mockFiles = {
    list: jest.fn(),
    get: jest.fn(),
  };
  const mockPermissions = {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  };
  const mockDriveInstance = {
    files: mockFiles,
    permissions: mockPermissions,
  };

  return {
    google: {
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getClient: jest.fn().mockResolvedValue('mocked-auth-client'),
        })),
        // OAuth2 is now imported and mocked separately if needed, not part of google.auth mock here
      },
      drive: jest.fn(() => mockDriveInstance),
    },
  };
});

// Mock the oauthClient module separately
jest.mock('../../../src/auth/oauthClient', () => ({
  oauth2Client: {
    setCredentials: jest.fn(),
    generateAuthUrl: jest.fn(),
    getToken: jest.fn().mockResolvedValue({ tokens: {} }),
    refreshAccessToken: jest.fn().mockResolvedValue({ credentials: {} }),
    revokeToken: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../src/utils/logger');

describe('DriveService', () => {
  let driveService;
  let mockDrive;

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // Re-initialize DriveService and capture the mocked drive instance
    driveService = new DriveService();
    // Initialize the drive service with a mocked access token
    driveService.initialize('mocked-access-token');
    mockDrive = driveService.drive; // Capture the mocked drive instance
  });

  describe('initialization', () => {
    it('should initialize with access token', async () => {
      // The constructor is called in beforeEach, so we just need to check the instance
      expect(driveService).toBeInstanceOf(DriveService);
      // Check if setCredentials was called on the mocked oauth2Client
      expect(oauth2Client.setCredentials).toHaveBeenCalledWith({ access_token: 'mocked-access-token' });
      // Check if google.drive was called with the correct version and auth client
      expect(google.drive).toHaveBeenCalledWith({ version: 'v3', auth: oauth2Client });
      // Removed incorrect expectation for google.auth.GoogleAuth
    });
  });

  describe('getUserFiles', () => {
    it('should retrieve user files successfully', async () => {
      const mockFiles = [{ id: 'file1', name: 'Test File 1' }, { id: 'file2', name: 'Test File 2' }];
      // Mock the successful response for files.list
      mockDrive.files.list.mockResolvedValue({ data: { files: mockFiles, nextPageToken: null } });

      const result = await driveService.getUserFiles();

      expect(mockDrive.files.list).toHaveBeenCalledWith({
        pageSize: 50,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, createdTime, modifiedTime, webViewLink)',
        q: "'me' in owners and trashed = false",
        orderBy: 'modifiedTime desc',
      });
      expect(result.files).toEqual(mockFiles);
      expect(result.nextPageToken).toBeNull();
    });

    it('should handle pagination correctly', async () => {
      const mockFilesPage1 = [{ id: 'file1', name: 'Page 1 File 1' }];
      const mockFilesPage2 = [{ id: 'file2', name: 'Page 2 File 1' }];
      const nextPageToken = 'next-page-token';

      // Mock responses for two pages - the test will call getUserFiles twice
      mockDrive.files.list
        .mockResolvedValueOnce({ data: { files: mockFilesPage1, nextPageToken: nextPageToken } })
        .mockResolvedValueOnce({ data: { files: mockFilesPage2, nextPageToken: null } });

      // First call
      const result1 = await driveService.getUserFiles();
      expect(mockDrive.files.list).toHaveBeenCalledWith(expect.objectContaining({
        pageToken: undefined,
      }));
      expect(result1.files).toEqual(mockFilesPage1);
      expect(result1.nextPageToken).toBe(nextPageToken);

      // Second call with page token
      const result2 = await driveService.getUserFiles(result1.nextPageToken);
      expect(mockDrive.files.list).toHaveBeenCalledWith(expect.objectContaining({
        pageToken: nextPageToken,
      }));
      expect(result2.files).toEqual(mockFilesPage2);
      expect(result2.nextPageToken).toBeNull();

      expect(mockDrive.files.list).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('API Error');
      // Mock the rejection specifically for this test
      mockDrive.files.list.mockRejectedValue(mockError);

      await expect(driveService.getUserFiles()).rejects.toThrow('Failed to retrieve files: API Error');
      expect(logger.error).toHaveBeenCalledWith('Failed to get user files', { error: 'API Error' });
    });
  });

  describe('getFileDetails', () => {
    it('should retrieve file details successfully', async () => {
      const fileId = 'test-file-id';
      const mockFileDetails = { id: fileId, name: 'Test File', mimeType: 'text/plain' };
      // Mock the successful response for files.get
      mockDrive.files.get.mockResolvedValue({ data: mockFileDetails });

      const fileDetails = await driveService.getFileDetails(fileId);

      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: fileId,
        fields: 'id, name, mimeType, size, owners, createdTime, modifiedTime, webViewLink, permissions',
      });
      expect(fileDetails).toEqual(mockFileDetails);
    });

    it('should handle file not found', async () => {
      const fileId = 'non-existent-file-id';
      const mockError = new Error('File not found');
      mockError.code = 404; // Simulate a 404 error
      mockDrive.files.get.mockRejectedValue(mockError);

      await expect(driveService.getFileDetails(fileId)).rejects.toThrow('Failed to get file details: File not found');
      expect(logger.error).toHaveBeenCalledWith('Failed to get file details', { error: 'File not found', fileId });
    });
  });

  describe('transferOwnership', () => {
    const fileId = 'test-file-id';
    const newOwnerEmail = 'newowner@example.com';

    it('should transfer ownership successfully', async () => {
      // Mock the successful response for permissions.list
      mockDrive.permissions.list.mockResolvedValue({ data: { permissions: [] } }); // Mock no existing permission
      // Mock the successful response for permissions.create
      mockDrive.permissions.create.mockResolvedValue({ data: { id: 'new-permission-id' } });
      // Mock the successful response for permissions.update
      mockDrive.permissions.update.mockResolvedValue({ data: { id: 'new-permission-id', role: 'owner' } });

      await driveService.transferOwnership(fileId, newOwnerEmail);

      expect(mockDrive.permissions.list).toHaveBeenCalledWith({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role, type)',
      });
      expect(mockDrive.permissions.create).toHaveBeenCalledWith({
        fileId: fileId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: newOwnerEmail,
        },
        fields: 'id',
      });
      expect(mockDrive.permissions.update).toHaveBeenCalledWith({
        fileId: fileId,
        permissionId: 'new-permission-id',
        requestBody: {
          role: 'owner',
        },
        transferOwnership: true,
        fields: 'id, role, emailAddress',
      });
      expect(logger.info).toHaveBeenCalledWith('File ownership transferred successfully', { fileId, newOwnerEmail, permissionId: 'new-permission-id' });
    });

    it('should handle transfer errors', async () => {
      const mockError = new Error('Transfer failed');
      // Mock the rejection for permissions.list to simulate an error early in the process
      mockDrive.permissions.list.mockRejectedValue(mockError);

      await expect(driveService.transferOwnership(fileId, newOwnerEmail)).rejects.toThrow('Failed to transfer ownership: Transfer failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to transfer file ownership', { error: 'Transfer failed', fileId, newOwnerEmail });
    });
  });

  describe('canTransferFile', () => {
    const fileId = 'test-file-id';

    it('should return true for transferable files', async () => {
      // Spy on getFileDetails and mock its resolution
      jest.spyOn(driveService, 'getFileDetails').mockResolvedValue({
        owners: [{ me: true }],
        driveId: undefined,
      });

      const result = await driveService.canTransferFile(fileId);

      expect(driveService.getFileDetails).toHaveBeenCalledWith(fileId);
      expect(result.canTransfer).toBe(true);
      expect(result.reason).toBeUndefined();

      jest.restoreAllMocks();
    });

    it('should return false for non-owner files', async () => {
      // Spy on getFileDetails and mock its resolution
      jest.spyOn(driveService, 'getFileDetails').mockResolvedValue({
        owners: [{ me: false }],
        driveId: undefined,
      });

      const result = await driveService.canTransferFile(fileId);

      expect(driveService.getFileDetails).toHaveBeenCalledWith(fileId);
      expect(result.canTransfer).toBe(false);
      expect(result.reason).toBe('User is not the owner of this file');

      jest.restoreAllMocks();
    });

    it('should return false for shared drive files', async () => {
      // Spy on getFileDetails and mock its resolution
      jest.spyOn(driveService, 'getFileDetails').mockResolvedValue({
        owners: [{ me: true }],
        driveId: 'shared-drive-id',
      });

      const result = await driveService.canTransferFile(fileId);

      expect(driveService.getFileDetails).toHaveBeenCalledWith(fileId);
      expect(result.canTransfer).toBe(false);
      expect(result.reason).toBe('Cannot transfer files in shared drives');

      jest.restoreAllMocks();
    });

    it('should handle errors when checking transfer permission', async () => {
      const mockError = new Error('Failed to get file details: API Error');
      // Spy on getFileDetails and mock its rejection
      jest.spyOn(driveService, 'getFileDetails').mockRejectedValue(mockError);

      const result = await driveService.canTransferFile(fileId);

      expect(driveService.getFileDetails).toHaveBeenCalledWith(fileId);
      expect(result.canTransfer).toBe(false);
      expect(result.reason).toBe(`Error checking permissions: ${mockError.message}`);
      expect(logger.error).toHaveBeenCalledWith('Failed to check transfer permission', { error: mockError.message, fileId });

      jest.restoreAllMocks();
    });
  });

  describe('batchTransferOwnership', () => {
    const files = [{ id: 'file1', name: 'File 1' }, { id: 'file2', name: 'File 2' }];
    const newOwnerEmail = 'newowner@example.com';

    it('should transfer multiple files successfully', async () => {
      // Spy on transferOwnership and mock its resolution for both files
      jest.spyOn(driveService, 'transferOwnership')
        .mockResolvedValueOnce({ id: 'file1', role: 'owner' })
        .mockResolvedValueOnce({ id: 'file2', role: 'owner' });

      const result = await driveService.batchTransferOwnership(files, newOwnerEmail);

      expect(driveService.transferOwnership).toHaveBeenCalledTimes(2);
      expect(driveService.transferOwnership).toHaveBeenCalledWith('file1', newOwnerEmail);
      expect(driveService.transferOwnership).toHaveBeenCalledWith('file2', newOwnerEmail);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.results[0].status).toBe('success');
      expect(result.results[0].fileId).toBe('file1');
      expect(result.results[1].status).toBe('success');
      expect(result.results[1].fileId).toBe('file2');

      jest.restoreAllMocks();
    });

    it('should handle partial failures', async () => {
      // Spy on transferOwnership and mock success for the first file and failure for the second
      jest.spyOn(driveService, 'transferOwnership')
        .mockResolvedValueOnce({ id: 'file1', role: 'owner' })
        .mockRejectedValueOnce(new Error('Transfer failed for file2'));

      const result = await driveService.batchTransferOwnership(files, newOwnerEmail);

      expect(driveService.transferOwnership).toHaveBeenCalledTimes(2);
      expect(driveService.transferOwnership).toHaveBeenCalledWith('file1', newOwnerEmail);
      expect(driveService.transferOwnership).toHaveBeenCalledWith('file2', newOwnerEmail);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.results[0].status).toBe('success');
      expect(result.results[0].fileId).toBe('file1');
      expect(result.errors[0].fileId).toBe('file2');
      expect(result.errors[0].error).toBe('Transfer failed for file2');

      jest.restoreAllMocks();
    });
  });

  describe('searchFiles', () => {
    it('should search files by name', async () => {
      const query = 'test document';
      const mockFiles = [{ id: 'file1', name: 'My test document' }];
      // Mock the successful response for files.list with search query
      mockDrive.files.list.mockResolvedValue({ data: { files: mockFiles, nextPageToken: null } });

      const result = await driveService.searchFiles(query);

      expect(mockDrive.files.list).toHaveBeenCalledWith({
        pageSize: 50,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, createdTime, modifiedTime)',
        q: `name contains '${query}' and 'me' in owners and trashed = false`,
        orderBy: 'modifiedTime desc',
      });
      expect(result.files).toEqual(mockFiles);
      expect(result.nextPageToken).toBeNull();
    });

    it('should handle empty search results', async () => {
      const query = 'non-existent file';
      // Mock an empty response
      mockDrive.files.list.mockResolvedValue({ data: { files: [], nextPageToken: null } });

      const result = await driveService.searchFiles(query);

      expect(mockDrive.files.list).toHaveBeenCalledWith({
        pageSize: 50,
        fields: 'nextPageToken, files(id, name, mimeType, size, owners, createdTime, modifiedTime)',
        q: `name contains '${query}' and 'me' in owners and trashed = false`,
        orderBy: 'modifiedTime desc',
      });
      expect(result.files).toEqual([]);
      expect(result.nextPageToken).toBeNull();
    });

    it('should handle errors during search', async () => {
      const query = 'test';
      const mockError = new Error('API Error');
      mockDrive.files.list.mockRejectedValue(mockError);

      await expect(driveService.searchFiles(query)).rejects.toThrow('Failed to search files: API Error');
      expect(logger.error).toHaveBeenCalledWith('Failed to search files', { error: 'API Error', query });
    });
  });

  describe('verifyFileAccess', () => {
    const fileId = 'test-file-id';

    it('should return true for accessible files', async () => {
      // Mock files.get to return a file object (indicating access)
      mockDrive.files.get.mockResolvedValue({ data: { id: fileId, name: 'Test File' } });

      const result = await driveService.verifyFileAccess(fileId);

      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: fileId,
        fields: 'id, name',
      });
      expect(result).toBe(true);
    });

    it('should return false for inaccessible files', async () => {
      const mockError = new Error('The user does not have sufficient permissions for this file.');
      mockError.code = 403; // Simulate a 403 Forbidden error
      // Mock files.get to reject with a 403 error
      mockDrive.files.get.mockRejectedValue(mockError);

      const result = await driveService.verifyFileAccess(fileId);

      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: fileId,
        fields: 'id, name',
      });
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('File access verification failed', { error: mockError.message, fileId });
    });

    it('should handle other errors during access verification', async () => {
      const mockError = new Error('Some other API error');
      // Mock files.get to reject with a different error
      mockDrive.files.get.mockRejectedValue(mockError);

      await expect(driveService.verifyFileAccess(fileId)).rejects.toThrow('File access verification failed: Some other API error');
      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: fileId,
        fields: 'id, name',
      });
      expect(logger.error).toHaveBeenCalledWith('File access verification failed', { error: 'Some other API error', fileId });
    });
  });
});