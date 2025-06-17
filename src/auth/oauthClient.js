const { google } = require('googleapis');
const config = require('../config/environment');
const logger = require('../utils/logger');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

// Google Drive API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Generate authorization URL
function generateAuthUrl(state, codeVerifier = null) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent', // Force consent screen to get refresh token
    ...(codeVerifier && { code_challenge: codeVerifier, code_challenge_method: 'S256' })
  });

  logger.debug('Generated OAuth URL', { state, hasCodeVerifier: !!codeVerifier });
  return authUrl;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, codeVerifier = null) {
  try {
    const tokenResponse = await oauth2Client.getToken(code, codeVerifier);
    const { tokens } = tokenResponse;

    logger.info('Successfully exchanged code for tokens', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    return tokens;
  } catch (error) {
    logger.error('Failed to exchange code for tokens', { error: error.message });
    throw new Error(`Token exchange failed: ${error.message}`);
  }
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    logger.info('Successfully refreshed access token', {
      expiresIn: credentials.expires_in
    });

    return credentials;
  } catch (error) {
    logger.error('Failed to refresh access token', { error: error.message });
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

// Set credentials for API calls
function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
  logger.debug('OAuth2 client credentials set');
}

// Get user info from Google
async function getUserInfo(accessToken) {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    
    const userInfo = await oauth2.userinfo.get();
    
    logger.info('Retrieved user info', { 
      email: userInfo.data.email,
      id: userInfo.data.id 
    });

    return userInfo.data;
  } catch (error) {
    logger.error('Failed to get user info', { error: error.message });
    throw new Error(`Failed to get user info: ${error.message}`);
  }
}

// Check if token is expired
function isTokenExpired(expiryDate) {
  if (!expiryDate) return true;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const buffer = 5 * 60 * 1000; // 5 minutes buffer
  
  return now.getTime() + buffer > expiry.getTime();
}

// Generate PKCE code verifier
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Generate PKCE code challenge
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256');
  hash.update(verifier);
  return base64URLEncode(hash.digest());
}

// Base64URL encoding
function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Revoke tokens
async function revokeTokens(accessToken) {
  try {
    await oauth2Client.revokeToken(accessToken);
    logger.info('Successfully revoked access token');
  } catch (error) {
    logger.error('Failed to revoke token', { error: error.message });
    throw new Error(`Token revocation failed: ${error.message}`);
  }
}

module.exports = {
  oauth2Client,
  SCOPES,
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  setCredentials,
  getUserInfo,
  isTokenExpired,
  generateCodeVerifier,
  generateCodeChallenge,
  revokeTokens
}; 