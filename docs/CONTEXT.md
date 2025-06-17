# Google Drive Ownership Transfer App

> A Node.js application for transferring ownership of Google Drive files between Google accounts

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Drive API](https://img.shields.io/badge/Google%20Drive%20API-v3-blue.svg)](https://developers.google.com/drive/api)

## 🎯 Purpose

This application provides a clean, secure, and focused solution for transferring ownership of Google Drive files (Docs, Sheets, Slides, etc.) from one Google account to another. Built entirely with **Node.js** and the **Google Drive API v3**, it eliminates the need for Google Apps Script or complex multi-language setups.

### Key Features
- 🔐 **Dual OAuth2 Authentication** - Secure login for both sender and receiver accounts
- 📁 **File Discovery** - List and select files owned by the sender
- 🔄 **Ownership Transfer** - Seamless transfer using Google Drive API
- 📊 **Comprehensive Logging** - Detailed operation logs and error handling
- 🚀 **Node.js Only** - No external dependencies on other languages or platforms

## 🛠️ Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 18+ |
| **Google API** | Google Drive API | v3 |
| **Authentication** | OAuth2 | 2.0 |
| **HTTP Client** | googleapis (Node.js SDK) | Latest |

## 📋 Requirements

- Node.js 18 or higher
- Google Cloud Project with Drive API enabled
- OAuth2 credentials (Client ID and Client Secret)
- Valid Google accounts for both sender and receiver

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/google-drive-ownership-transfer-node.git
cd google-drive-ownership-transfer-node
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Google OAuth credentials:
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

### 4. Run the Application
```bash
npm start
```

## 📁 Project Structure

```
google-drive-ownership-transfer-node/
├── README.md                 # This file
├── package.json             # Dependencies and scripts
├── .env.example            # Environment variables template
├── index.js                # Application entry point
├── auth/
│   └── oauthClient.js      # OAuth2 authentication logic
├── services/
│   └── driveService.js     # Google Drive API operations
├── utils/
│   └── logger.js           # Logging utilities
└── docs/
    └── CONTEXT.md          # Project context and documentation
```

## 🗄️ Database Schema

### Overview
The application uses a lightweight database to track transfer operations, user sessions, and audit logs. The schema is designed for PostgreSQL but can be adapted for other SQL databases.

### Core Tables

#### 1. `users` Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

#### 2. `transfer_sessions` Table
```sql
CREATE TABLE transfer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    sender_user_id UUID REFERENCES users(id),
    receiver_user_id UUID REFERENCES users(id),
    status ENUM('pending', 'authenticated', 'file_selected', 'transferring', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    metadata JSONB
);
```

#### 3. `file_transfers` Table
```sql
CREATE TABLE file_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES transfer_sessions(id) ON DELETE CASCADE,
    google_file_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    original_owner_id UUID REFERENCES users(id),
    new_owner_id UUID REFERENCES users(id),
    status ENUM('pending', 'transferring', 'completed', 'failed', 'skipped') DEFAULT 'pending',
    transfer_started_at TIMESTAMP,
    transfer_completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. `audit_logs` Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id UUID REFERENCES transfer_sessions(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. `oauth_sessions` Table
```sql
CREATE TABLE oauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    state VARCHAR(255) NOT NULL,
    code_verifier VARCHAR(255),
    redirect_uri TEXT,
    scope TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false
);
```

### Indexes for Performance
```sql
-- Users table indexes
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Transfer sessions indexes
CREATE INDEX idx_transfer_sessions_token ON transfer_sessions(session_token);
CREATE INDEX idx_transfer_sessions_sender ON transfer_sessions(sender_user_id);
CREATE INDEX idx_transfer_sessions_receiver ON transfer_sessions(receiver_user_id);
CREATE INDEX idx_transfer_sessions_status ON transfer_sessions(status);
CREATE INDEX idx_transfer_sessions_expires ON transfer_sessions(expires_at);

-- File transfers indexes
CREATE INDEX idx_file_transfers_session ON file_transfers(session_id);
CREATE INDEX idx_file_transfers_google_id ON file_transfers(google_file_id);
CREATE INDEX idx_file_transfers_status ON file_transfers(status);
CREATE INDEX idx_file_transfers_owners ON file_transfers(original_owner_id, new_owner_id);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- OAuth sessions indexes
CREATE INDEX idx_oauth_sessions_token ON oauth_sessions(session_token);
CREATE INDEX idx_oauth_sessions_user ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires ON oauth_sessions(expires_at);
```

### Database Configuration
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB for PostgreSQL
-- (Already available in PostgreSQL 9.4+)

-- Set timezone
SET timezone = 'UTC';
```

## 📂 Optimal Folder Structure

```
google-drive-ownership-transfer-node/
├── 📄 README.md                          # Project documentation
├── 📄 package.json                       # Dependencies and scripts
├── 📄 package-lock.json                  # Locked dependencies
├── 📄 .env.example                       # Environment variables template
├── 📄 .env                               # Local environment variables (gitignored)
├── 📄 .gitignore                         # Git ignore rules
├── 📄 .eslintrc.js                       # ESLint configuration
├── 📄 .prettierrc                        # Prettier configuration
├── 📄 jest.config.js                     # Jest test configuration
├── 📄 tsconfig.json                      # TypeScript configuration
├── 📄 nodemon.json                       # Nodemon configuration
│
├── 🚀 src/                               # Source code directory
│   ├── 📄 index.js                       # Application entry point
│   ├── 📄 app.js                         # Express app configuration
│   │
│   ├── 🔐 auth/                          # Authentication module
│   │   ├── 📄 oauthClient.js             # OAuth2 client configuration
│   │   ├── 📄 authMiddleware.js          # Authentication middleware
│   │   ├── 📄 sessionManager.js          # Session management
│   │   └── 📄 tokenManager.js            # Token refresh and storage
│   │
│   ├── 🗄️ database/                      # Database layer
│   │   ├── 📄 connection.js              # Database connection
│   │   ├── 📄 migrations/                # Database migrations
│   │   │   ├── 📄 001_create_users.sql
│   │   │   ├── 📄 002_create_sessions.sql
│   │   │   ├── 📄 003_create_transfers.sql
│   │   │   ├── 📄 004_create_audit_logs.sql
│   │   │   └── 📄 005_create_oauth_sessions.sql
│   │   ├── 📄 models/                    # Database models
│   │   │   ├── 📄 User.js
│   │   │   ├── 📄 TransferSession.js
│   │   │   ├── 📄 FileTransfer.js
│   │   │   ├── 📄 AuditLog.js
│   │   │   └── 📄 OAuthSession.js
│   │   └── 📄 queries/                   # SQL queries
│   │       ├── 📄 userQueries.js
│   │       ├── 📄 sessionQueries.js
│   │       ├── 📄 transferQueries.js
│   │       └── 📄 auditQueries.js
│   │
│   ├── 🎯 controllers/                   # Request handlers
│   │   ├── 📄 authController.js          # Authentication endpoints
│   │   ├── 📄 transferController.js      # Transfer operation endpoints
│   │   ├── 📄 fileController.js          # File management endpoints
│   │   └── 📄 sessionController.js       # Session management endpoints
│   │
│   ├── 🛠️ services/                      # Business logic layer
│   │   ├── 📄 driveService.js            # Google Drive API operations
│   │   ├── 📄 transferService.js         # Transfer orchestration
│   │   ├── 📄 userService.js             # User management
│   │   ├── 📄 sessionService.js          # Session handling
│   │   └── 📄 notificationService.js     # Email/notification handling
│   │
│   ├── 🛣️ routes/                        # API route definitions
│   │   ├── 📄 index.js                   # Route aggregator
│   │   ├── 📄 auth.js                    # Authentication routes
│   │   ├── 📄 transfer.js                # Transfer routes
│   │   ├── 📄 files.js                   # File routes
│   │   └── 📄 session.js                 # Session routes
│   │
│   ├── 🔧 middleware/                    # Express middleware
│   │   ├── 📄 errorHandler.js            # Global error handling
│   │   ├── 📄 requestLogger.js           # Request logging
│   │   ├── 📄 rateLimiter.js             # Rate limiting
│   │   ├── 📄 cors.js                    # CORS configuration
│   │   └── 📄 validation.js              # Request validation
│   │
│   ├── 📊 utils/                         # Utility functions
│   │   ├── 📄 logger.js                  # Logging configuration
│   │   ├── 📄 constants.js               # Application constants
│   │   ├── 📄 helpers.js                 # Helper functions
│   │   ├── 📄 validators.js              # Validation utilities
│   │   └── 📄 formatters.js              # Data formatting utilities
│   │
│   ├── 📋 config/                        # Configuration files
│   │   ├── 📄 database.js                # Database configuration
│   │   ├── 📄 google.js                  # Google API configuration
│   │   ├── 📄 app.js                     # Application configuration
│   │   └── 📄 environment.js             # Environment-specific configs
│   │
│   └── 📝 types/                         # TypeScript type definitions
│       ├── 📄 user.types.js
│       ├── 📄 transfer.types.js
│       ├── 📄 session.types.js
│       └── 📄 api.types.js
│
├── 🧪 tests/                             # Test files
│   ├── 📄 setup.js                       # Test setup configuration
│   ├── 📄 teardown.js                    # Test cleanup
│   │
│   ├── 🔬 unit/                          # Unit tests
│   │   ├── 📄 services/
│   │   │   ├── 📄 driveService.test.js
│   │   │   ├── 📄 transferService.test.js
│   │   │   └── 📄 userService.test.js
│   │   ├── 📄 controllers/
│   │   │   ├── 📄 authController.test.js
│   │   │   └── 📄 transferController.test.js
│   │   └── 📄 utils/
│   │       ├── 📄 helpers.test.js
│   │       └── 📄 validators.test.js
│   │
│   ├── 🔗 integration/                   # Integration tests
│   │   ├── 📄 auth.integration.test.js
│   │   ├── 📄 transfer.integration.test.js
│   │   └── 📄 api.integration.test.js
│   │
│   └── 🧪 e2e/                           # End-to-end tests
│       ├── 📄 auth.e2e.test.js
│       └── 📄 transfer.e2e.test.js
│
├── 📚 docs/                              # Documentation
│   ├── 📄 CONTEXT.md                     # This file
│   ├── 📄 API.md                         # API documentation
│   ├── 📄 DEPLOYMENT.md                  # Deployment guide
│   ├── 📄 SECURITY.md                    # Security considerations
│   └── 📄 TROUBLESHOOTING.md             # Troubleshooting guide
│
├── 🐳 docker/                            # Docker configuration
│   ├── 📄 Dockerfile                     # Application Dockerfile
│   ├── 📄 docker-compose.yml             # Development environment
│   ├── 📄 docker-compose.prod.yml        # Production environment
│   └── 📄 .dockerignore                  # Docker ignore rules
│
├── 📦 scripts/                           # Build and deployment scripts
│   ├── 📄 build.js                       # Build script
│   ├── 📄 deploy.js                      # Deployment script
│   ├── 📄 migrate.js                     # Database migration script
│   └── 📄 seed.js                        # Database seeding script
│
├── 🔧 tools/                             # Development tools
│   ├── 📄 lint.js                        # Linting script
│   ├── 📄 format.js                      # Code formatting script
│   └── 📄 generate-docs.js               # Documentation generator
│
└── 📁 logs/                              # Application logs (gitignored)
    ├── 📄 app.log                        # Application logs
    ├── 📄 error.log                      # Error logs
    └── 📄 access.log                     # Access logs
```

### Key Benefits of This Structure

1. **Separation of Concerns**: Clear separation between controllers, services, and data access layers
2. **Scalability**: Modular structure allows easy addition of new features
3. **Testability**: Dedicated test directories with unit, integration, and e2e tests
4. **Maintainability**: Logical grouping of related functionality
5. **Security**: Middleware layer for authentication, validation, and error handling
6. **Documentation**: Comprehensive documentation structure
7. **DevOps Ready**: Docker configuration and deployment scripts included

## 🔧 Development Setup

### Prerequisites
1. **Google Cloud Console Setup**
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create OAuth2 credentials
   - Configure authorized redirect URIs

2. **Local Development**
   - Install Node.js 18+
   - Clone the repository
   - Install dependencies with `npm install`

### Environment Variables
Create a `.env` file based on `.env.example`:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/drive_transfer_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=drive_transfer_db
DATABASE_USER=username
DATABASE_PASSWORD=password

# Application Settings
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Security Settings
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## 📊 API Scopes

The application requires the following Google Drive API scopes:

- `https://www.googleapis.com/auth/drive` - Full access to Google Drive
- `https://www.googleapis.com/auth/drive.file` - Access to files created by the app
- `https://www.googleapis.com/auth/userinfo.email` - Access to user email

## 🔄 Usage Flow

1. **Authentication**: Both sender and receiver authenticate via OAuth2
2. **File Discovery**: List all files owned by the sender account
3. **File Selection**: Choose specific files to transfer
4. **Ownership Transfer**: Execute transfer using Google Drive API
5. **Verification**: Confirm successful transfer with logging

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## 📝 Logging

The application provides comprehensive logging for all operations:

- **Authentication events**
- **File discovery results**
- **Transfer operations**
- **Error handling and debugging**

Log levels: `error`, `warn`, `info`, `debug`

## 🔒 Security Considerations

- **OAuth2 Flow**: Secure authentication using Google's official SDK
- **Token Management**: Automatic token refresh and secure storage
- **API Permissions**: Minimal required scopes for operation
- **Error Handling**: Secure error messages without exposing sensitive data

## 🚧 Limitations

- **File Types**: Some Google Workspace files may have transfer restrictions
- **Shared Drives**: Ownership transfer may not work on shared drives
- **Permissions**: Requires appropriate Google Drive API permissions
- **Rate Limits**: Subject to Google Drive API rate limiting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This application operates using the Google Drive API and requires appropriate OAuth2 scopes. Ownership transfer functionality is subject to Google's API limitations and restrictions. Users are responsible for ensuring they have the necessary permissions to transfer file ownership.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/google-drive-ownership-transfer-node/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/google-drive-ownership-transfer-node/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/google-drive-ownership-transfer-node/discussions)

---

**Made with ❤️ using Node.js and Google Drive API** 