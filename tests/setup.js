// Test setup configuration
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Mock Google APIs for testing
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url.com'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        }),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-mock-access-token',
            expiry_date: Date.now() + 3600000
          }
        }),
        setCredentials: jest.fn(),
        revokeToken: jest.fn().mockResolvedValue({})
      }))
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-user-id',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg'
          }
        })
      }
    }),
    drive: jest.fn().mockReturnValue({
      files: {
        list: jest.fn().mockResolvedValue({
          data: {
            files: [
              {
                id: 'mock-file-id',
                name: 'Test Document',
                mimeType: 'application/vnd.google-apps.document',
                size: '1024',
                owners: [{ me: true }],
                createdTime: '2023-01-01T00:00:00Z',
                modifiedTime: '2023-01-01T00:00:00Z'
              }
            ],
            nextPageToken: null
          }
        }),
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-file-id',
            name: 'Test Document',
            mimeType: 'application/vnd.google-apps.document',
            size: '1024',
            owners: [{ me: true }],
            permissions: []
          }
        })
      },
      permissions: {
        list: jest.fn().mockResolvedValue({
          data: {
            permissions: []
          }
        }),
        create: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-permission-id'
          }
        }),
        update: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-permission-id',
            role: 'owner',
            emailAddress: 'newowner@example.com'
          }
        })
      }
    })
  }
}));

// Mock database connection for testing
jest.mock('../src/database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  pool: {
    end: jest.fn()
  }
}));

// Mock logger for testing
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logTransfer: jest.fn(),
  logAuth: jest.fn(),
  logError: jest.fn(),
  logApi: jest.fn(),
  stream: {
    write: jest.fn()
  }
}));

// Global test utilities
global.testUtils = {
  // Mock user data
  mockUser: {
    id: 'test-user-id',
    google_id: 'mock-google-id',
    email: 'test@example.com',
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_expiry: new Date(Date.now() + 3600000),
    created_at: new Date(),
    updated_at: new Date(),
    last_login: new Date(),
    is_active: true
  },

  // Mock file data
  mockFile: {
    id: 'mock-file-id',
    name: 'Test Document',
    mimeType: 'application/vnd.google-apps.document',
    size: '1024',
    owners: [{ me: true }],
    createdTime: '2023-01-01T00:00:00Z',
    modifiedTime: '2023-01-01T00:00:00Z'
  },

  // Mock transfer session
  mockTransferSession: {
    id: 'test-session-id',
    session_token: 'test-session-token',
    sender_user_id: 'sender-user-id',
    receiver_user_id: 'receiver-user-id',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: new Date(Date.now() + 3600000),
    metadata: {}
  },

  // Helper to create mock request
  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    path: '/test',
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null,
    startTime: Date.now(),
    ip: '127.0.0.1',
    get: jest.fn(),
    ...overrides
  }),

  // Helper to create mock response
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  },

  // Helper to create mock next function
  createMockNext: () => jest.fn(),

  // Clean up mocks
  cleanupMocks: () => {
    jest.clearAllMocks();
  }
};

// Before each test
beforeEach(() => {
  testUtils.cleanupMocks();
});

// After all tests
afterAll(() => {
  // Clean up any remaining handles
  jest.restoreAllMocks();
}); 