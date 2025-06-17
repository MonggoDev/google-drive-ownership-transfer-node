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
| **Database** | PostgreSQL | 12+ |
| **HTTP Client** | googleapis (Node.js SDK) | Latest |

## 📋 Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher
- Google Cloud Project with Drive API enabled
- OAuth2 credentials (Client ID and Client Secret)

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

### 3. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/auth/callback` (for development)
     - `https://yourdomain.com/auth/callback` (for production)
5. Note down your Client ID and Client Secret

### 4. Set Up Database

1. Create a PostgreSQL database:
```sql
CREATE DATABASE drive_transfer_db;
```

2. Run the migrations:
```bash
npm run migrate
```

### 5. Configure Environment

1. Copy the environment template:
```bash
cp env.example .env
```

2. Edit `.env` with your configuration:
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
```

### 6. Run the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📊 API Endpoints

### Authentication
- `GET /api/auth/initiate` - Start OAuth2 flow
- `GET /api/auth/callback` - Handle OAuth2 callback
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/check` - Check authentication status

### File Management
- `GET /api/files` - List user's files
- `GET /api/files/:id` - Get file details
- `GET /api/files/search` - Search files

### Transfer Operations
- `POST /api/transfer/session` - Create transfer session
- `POST /api/transfer/execute` - Execute file transfer
- `GET /api/transfer/status/:sessionId` - Get transfer status
- `GET /api/transfer/history` - Get transfer history

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

Logs are stored in the `logs/` directory:
- `app.log` - All application logs
- `error.log` - Error logs only

## 🔒 Security Considerations

- **OAuth2 Flow**: Secure authentication using Google's official SDK
- **Token Management**: Automatic token refresh and secure storage
- **API Permissions**: Minimal required scopes for operation
- **Error Handling**: Secure error messages without exposing sensitive data
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **CORS**: Configurable CORS settings for security

## 🚧 Limitations

- **File Types**: Some Google Workspace files may have transfer restrictions
- **Shared Drives**: Ownership transfer may not work on shared drives
- **Permissions**: Requires appropriate Google Drive API permissions
- **Rate Limits**: Subject to Google Drive API rate limiting

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📦 Production Deployment

1. **Environment Setup**:
   - Set `NODE_ENV=production`
   - Configure production database
   - Set up SSL certificates
   - Configure reverse proxy (nginx)

2. **Process Management**:
   - Use PM2 or similar process manager
   - Set up log rotation
   - Configure monitoring

3. **Security**:
   - Use environment variables for secrets
   - Enable HTTPS
   - Configure firewall rules
   - Regular security updates

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

## 📈 Roadmap

- [ ] Web-based UI for file selection
- [ ] Batch transfer operations
- [ ] Transfer scheduling
- [ ] Email notifications
- [ ] Advanced file filtering
- [ ] Transfer templates
- [ ] API rate limit optimization
- [ ] Mobile app support

---

**Made with ❤️ using Node.js and Google Drive API** 