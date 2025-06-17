const { google } = require('googleapis');
const crypto = require('crypto');
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

// Generate PKCE code verifier
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate PKCE code challenge
function generateCodeChallenge(codeVerifier) {
  try {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return Buffer.from(hash).toString('base64url');
  } catch (error) {
    // Fallback for older Node.js versions
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return hash.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// Generate OAuth2 authorization URL
function generateAuthUrl(state, codeChallenge) {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'consent'
  });

  logger.debug('Generated auth URL', { state, codeChallenge });
  return authUrl;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, codeVerifier = null) {
  try {
    console.log('=== OAuth Token Exchange Debug ===');
    console.log('Code length:', code ? code.length : 'null');
    console.log('Code verifier:', codeVerifier ? 'provided' : 'not provided');
    console.log('Client ID:', config.google.clientId ? 'set' : 'missing');
    console.log('Client Secret:', config.google.clientSecret ? 'set' : 'missing');
    console.log('Redirect URI:', config.google.redirectUri);
    
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    const tokenRequest = {
      code: code,
      redirect_uri: config.google.redirectUri // Explicitly add redirect_uri to the request
    };

    // Add code_verifier only if provided (for PKCE)
    if (codeVerifier) {
      tokenRequest.code_verifier = codeVerifier;
      console.log('Using PKCE with code verifier');
    } else {
      console.log('Not using PKCE (no code verifier)');
    }

    console.log('Token request:', {
      code: code ? `${code.substring(0, 10)}...` : 'null',
      code_verifier: codeVerifier ? 'provided' : 'not provided'
    });

    const { tokens } = await oauth2Client.getToken(tokenRequest);

    console.log('Token exchange successful!');
    console.log('Has access token:', !!tokens.access_token);
    console.log('Has refresh token:', !!tokens.refresh_token);
    console.log('Expiry date:', tokens.expiry_date);
    console.log('Scope:', tokens.scope);
    console.log('=== End Debug ===');

    logger.debug('Exchanged code for tokens', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token 
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    };
  } catch (error) {
    console.log('=== OAuth Token Exchange Error ===');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    console.log('Error status:', error.status);
    console.log('Full error:', JSON.stringify(error, null, 2));
    console.log('=== End Error Debug ===');
    
    logger.error('Failed to exchange code for tokens', error);
    throw error;
  }
}

// Get user info from Google
async function getUserInfo(accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    logger.debug('Retrieved user info', { 
      id: userInfo.data.id,
      email: userInfo.data.email 
    });

    return {
      id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
      verified_email: userInfo.data.verified_email
    };
  } catch (error) {
    logger.error('Failed to get user info', error);
    throw error;
  }
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    logger.debug('Refreshed access token');

    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refreshToken,
      expiry_date: credentials.expiry_date,
      scope: credentials.scope
    };
  } catch (error) {
    logger.error('Failed to refresh access token', error);
    throw error;
  }
}

// Validate access token
async function validateAccessToken(accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    // Try to get user info to validate token
    await getUserInfo(accessToken);
    return true;
  } catch (error) {
    logger.debug('Access token validation failed', error);
    return false;
  }
}

// Set credentials for API calls
function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
  logger.debug('OAuth2 client credentials set');
}

// Check if token is expired
function isTokenExpired(expiryDate) {
  if (!expiryDate) return true;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const buffer = 5 * 60 * 1000; // 5 minutes buffer
  
  return now.getTime() + buffer > expiry.getTime();
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
  revokeTokens,
  validateAccessToken
};