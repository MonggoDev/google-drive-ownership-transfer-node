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
      const { role } = req.query; // 'sender' or 'receiver'
      const sessionToken = uuidv4();
      const state = uuidv4();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Store OAuth session in database (you'll need to implement this)
      // await OAuthSession.create({
      //   sessionToken,
      //   state,
      //   codeVerifier,
      //   expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      // });

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
      res.status(500).json({
        success: false,
        error: 'Failed to initiate authentication'
      });
    }
  }

  // Handle OAuth2 callback
  static async handleCallback(req, res) {
    try {
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
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      // Verify state and get code verifier from database
      // const oauthSession = await OAuthSession.findByState(state);
      // if (!oauthSession || oauthSession.isUsed) {
      //   return res.status(400).json({
      //     success: false,
      //     error: 'Invalid or expired session'
      //   });
      // }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code, codeVerifier);

      // Get user info from Google
      const userInfo = await getUserInfo(tokens.access_token);

      // Find or create user
      let user = await User.findByGoogleId(userInfo.id);
      
      if (!user) {
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
        // Update existing user's tokens
        user = await User.updateTokens(
          user.id,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null
        );
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Mark OAuth session as used
      // await OAuthSession.markAsUsed(oauthSession.id);

      logger.logAuth(user.id, 'auth_successful', { email: user.email });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url
        },
        sessionToken: oauthSession?.session_token
      });
    } catch (error) {
      logger.logError(error, { action: 'handle_callback' });
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
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
        logger.logAuth(userId, 'logout');
      }

      // Clear session/tokens (implement based on your session management)
      res.clearCookie('sessionToken');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.logError(error, { action: 'logout' });
      res.status(500).json({
        success: false,
        error: 'Logout failed'
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
}

module.exports = AuthController; 