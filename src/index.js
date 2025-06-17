const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

const config = require('./config/environment');
const logger = require('./utils/logger');

// Import routes (we'll create these next)
// const authRoutes = require('./routes/auth');
// const transferRoutes = require('./routes/transfer');
// const fileRoutes = require('./routes/files');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow * 60 * 1000, // Convert minutes to milliseconds
  max: config.security.rateLimitMaxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env
  });
});

// API routes
app.use('/api/auth', (req, res) => {
  res.json({ message: 'Auth routes will be implemented' });
});

app.use('/api/transfer', (req, res) => {
  res.json({ message: 'Transfer routes will be implemented' });
});

app.use('/api/files', (req, res) => {
  res.json({ message: 'File routes will be implemented' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  const duration = Date.now() - req.startTime;
  
  logger.logError(error, {
    method: req.method,
    path: req.path,
    duration,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't expose internal errors in production
  const isDevelopment = config.app.env === 'development';
  const errorMessage = isDevelopment ? error.message : 'Internal server error';
  const errorStack = isDevelopment ? error.stack : undefined;

  res.status(error.status || 500).json({
    success: false,
    error: errorMessage,
    ...(errorStack && { stack: errorStack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = config.app.port;
app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: config.app.env,
    nodeVersion: process.version
  });
  
  console.log(`
🚀 Google Drive Ownership Transfer App
📡 Server running on port ${PORT}
🌍 Environment: ${config.app.env}
📊 Log level: ${config.app.logLevel}
🔗 Health check: http://localhost:${PORT}/health
  `);
});

module.exports = app; 