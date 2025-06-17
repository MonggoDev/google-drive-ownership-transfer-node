const express = require('express');
const { body, query, validationResult } = require('express-validator');
const TransferController = require('../controllers/transferController');
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

// Create a new transfer session
router.post('/session', [
  body('receiver_email').isEmail().withMessage('Valid receiver email is required'),
  body('files').isArray({ min: 1 }).withMessage('At least one file must be selected'),
  body('files.*.file_id').notEmpty().withMessage('File ID is required for each file'),
  body('files.*.file_name').notEmpty().withMessage('File name is required for each file'),
  handleValidationErrors
], TransferController.createTransferSession);

// Get transfer session status
router.get('/session/:sessionId', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.getTransferSession);

// Accept transfer session (receiver)
router.post('/session/:sessionId/accept', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.acceptTransferSession);

// Reject transfer session (receiver)
router.post('/session/:sessionId/reject', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.rejectTransferSession);

// Start file transfer
router.post('/session/:sessionId/start', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.startTransfer);

// Get transfer progress
router.get('/session/:sessionId/progress', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.getTransferProgress);

// Cancel transfer session
router.post('/session/:sessionId/cancel', [
  query('session_token').notEmpty().withMessage('Session token is required'),
  handleValidationErrors
], TransferController.cancelTransferSession);

// Get user's transfer history
router.get('/history', TransferController.getTransferHistory);

module.exports = router; 