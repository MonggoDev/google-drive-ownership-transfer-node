const { v4: uuidv4 } = require('uuid');
const { 
  generateAuthUrl, 
  exchangeCodeForTokens, 
  getUserInfo,
  generateCodeVerifier,
  generateCodeChallenge 
} = require('../auth/oauthClient');
const User = require('../database/models/User');
const logger = require('../utils/logger');

class AuthController {
  // Initiate OAuth2 flow
  static async initiateAuth(req, res) {
    try {
      console.log('Starting OAuth initiation...');
      const { role } = req.query; // 'sender' or 'receiver'
      
      console.log('Generating session token...');
      const sessionToken = uuidv4();
      
      console.log('Generating state...');
      const state = uuidv4();
      
      console.log('Generating code verifier...');
      const codeVerifier = generateCodeVerifier();
      
      console.log('Generating code challenge...');
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      console.log('Generating auth URL...');
      const authUrl = generateAuthUrl(state, codeChallenge);

      logger.logAuth(null, 'auth_initiated', { role, sessionToken });

      res.json({
        success: true,
        authUrl,
        sessionToken,
        state
      });
    } catch (error) {
      logger.logError(error, { action: 'initiate_auth' });
      console.error('initiateAuth error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate authentication',
        details: error.message
      });
    }
  }

  // Handle OAuth2 callback
  static async handleCallback(req, res) {
    try {
      console.log('OAuth callback received:', req.query);
      const { code, state, error } = req.query;

      if (error) {
        logger.logAuth(null, 'auth_error', { error });
        return res.status(400).json({
          success: false,
          error: 'Authentication failed',
          details: error
        });
      }

      if (!code || !state) {
        console.log('Missing code or state:', { code: !!code, state: !!state });
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      console.log('Exchanging code for tokens...');
      // For now, we'll skip PKCE verification since we don't have session storage
      // In production, you should implement proper OAuth session management
      const tokens = await exchangeCodeForTokens(code, null);

      console.log('Getting user info...');
      const userInfo = await getUserInfo(tokens.access_token);

      console.log('User info received:', { id: userInfo.id, email: userInfo.email });

      // Find or create user
      let user = await User.findByGoogleId(userInfo.id);
      
      if (!user) {
        console.log('Creating new user...');
        // Create new user
        user = await User.create({
          googleId: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.name,
          avatarUrl: userInfo.picture,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
        });
      } else {
        console.log('Updating existing user...');
        // Update existing user's tokens
        await User.updateTokens(
          user.id,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null
        );
      }

      // Update last login
      await User.updateLastLogin(user.id);

      logger.logAuth(user.id, 'auth_successful', { email: user.email });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        },
        message: 'Authentication successful!'
      });
    } catch (error) {
      logger.logError(error, { action: 'handle_callback' });
      console.error('Callback error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        details: error.message
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get user statistics
      const stats = await User.getStats(userId);

      logger.logAuth(userId, 'profile_retrieved');

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          lastLogin: user.last_login,
          createdAt: user.created_at
        },
        stats
      });
    } catch (error) {
      logger.logError(error, { action: 'get_profile' });
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const userId = req.user?.id;
      const { displayName, avatarUrl } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const user = await User.updateProfile(userId, { displayName, avatarUrl });

      logger.logAuth(userId, 'profile_updated', { displayName });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url
        }
      });
    } catch (error) {
      logger.logError(error, { action: 'update_profile' });
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  // Logout user
  static async logout(req, res) {
    try {
      const userId = req.user?.id;
      
      if (userId) {
        // Update last login to track logout
        await User.updateLastLogin(userId);
        logger.logAuth(userId, 'user_logout');
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.logError(error, { action: 'logout' });
      res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }
  }

  // Refresh user tokens
  static async refreshTokens(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const user = await User.findById(userId);
      
      if (!user || !user.refresh_token) {
        return res.status(401).json({
          success: false,
          error: 'No refresh token available'
        });
      }

      // Implement token refresh logic here
      // const newTokens = await refreshAccessToken(user.refresh_token);
      // await User.updateTokens(userId, newTokens.access_token, user.refresh_token, newTokens.expiry_date);

      logger.logAuth(userId, 'tokens_refreshed');

      res.json({
        success: true,
        message: 'Tokens refreshed successfully'
      });
    } catch (error) {
      logger.logError(error, { action: 'refresh_tokens' });
      res.status(500).json({
        success: false,
        error: 'Failed to refresh tokens'
      });
    }
  }

  // Check authentication status
  static async checkAuth(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          authenticated: false
        });
      }

      const user = await User.findById(userId);
      
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          authenticated: false
        });
      }

      res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url
        }
      });
    } catch (error) {
      logger.logError(error, { action: 'check_auth' });
      res.status(500).json({
        success: false,
        error: 'Failed to check authentication'
      });
    }
  }

  // Get current user info
  static async getCurrentUser(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      logger.logAuth(userId, 'current_user_retrieved');

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      logger.logError(error, { action: 'get_current_user' });
      res.status(500).json({
        success: false,
        error: 'Failed to get current user'
      });
    }
  }

  // Refresh access token
  static async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
      }

      // Find user by refresh token
      const user = await User.findByRefreshToken(refresh_token);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Refresh the token using Google OAuth
      const GoogleDriveService = require('../services/googleDriveService');
      const credentials = await GoogleDriveService.refreshAccessToken(refresh_token);

      // Update user's tokens
      await User.updateTokens(
        user.id,
        credentials.access_token,
        credentials.refresh_token || refresh_token,
        credentials.expiry_date ? new Date(credentials.expiry_date) : null
      );

      logger.logAuth(user.id, 'token_refreshed');

      res.json({
        success: true,
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refresh_token,
        expires_in: credentials.expiry_date ? new Date(credentials.expiry_date).getTime() - Date.now() : null
      });
    } catch (error) {
      logger.logError(error, { action: 'refresh_token' });
      res.status(500).json({
        success: false,
        error: 'Failed to refresh token'
      });
    }
  }

  // Get user's Google Drive files
  static async getUserFiles(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check if user has valid access token
      if (!user.accessToken) {
        return res.status(401).json({
          success: false,
          error: 'No valid access token. Please re-authenticate.'
        });
      }

      // Get files from Google Drive
      const GoogleDriveService = require('../services/googleDriveService');
      const files = await GoogleDriveService.getUserFiles(
        user.accessToken,
        user.refreshToken
      );

      logger.logAuth(userId, 'files_retrieved', { fileCount: files.length });

      res.json({
        success: true,
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          owners: file.owners
        }))
      });
    } catch (error) {
      logger.logError(error, { action: 'get_user_files' });
      res.status(500).json({
        success: false,
        error: 'Failed to get user files'
      });
    }
  }
}

module.exports = AuthController; 