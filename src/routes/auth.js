const express = require('express');
const { body, query, validationResult } = require('express-validator');
const AuthController = require('../controllers/authController');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Initiate OAuth2 flow
router.get('/initiate', [
  query('role').isIn(['sender', 'receiver']).withMessage('Role must be either "sender" or "receiver"'),
  handleValidationErrors
], AuthController.initiateAuth);

// OAuth2 callback
router.get('/callback', [
  query('code').notEmpty().withMessage('Authorization code is required'),
  query('state').notEmpty().withMessage('State parameter is required'),
  handleValidationErrors
], AuthController.handleCallback);

// Get current user info
router.get('/me', AuthController.getCurrentUser);

// Refresh access token
router.post('/refresh', [
  body('refresh_token').notEmpty().withMessage('Refresh token is required'),
  handleValidationErrors
], AuthController.refreshToken);

// Logout
router.post('/logout', AuthController.logout);

// Get user's Google Drive files
router.get('/files', AuthController.getUserFiles);

module.exports = router; 