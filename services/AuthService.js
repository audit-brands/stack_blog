const bcrypt = require('bcrypt');
const config = require('../config/default');

class AuthService {
  constructor() {
    this.saltRounds = 12;
  }

  /**
   * Hash a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Stored password hash
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw new Error('Password verification failed');
    }
  }

  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} User object if authenticated, null otherwise
   */
  async authenticateUser(username, password) {
    try {
      // Check if username matches configured admin user
      if (username !== config.admin.username) {
        return null;
      }

      // Check if password hash is configured
      if (!config.admin.passwordHash) {
        throw new Error('Admin password not configured. Please set ADMIN_PASSWORD_HASH environment variable.');
      }

      // Verify password against stored hash
      const isValid = await this.verifyPassword(password, config.admin.passwordHash);
      
      if (isValid) {
        return {
          username: config.admin.username,
          role: 'admin',
          authenticatedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Generate a secure session token
   * @returns {string} Random session token
   */
  generateSessionToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Check if user is authenticated based on session
   * @param {Object} session - Express session object
   * @returns {boolean} True if authenticated
   */
  isAuthenticated(session) {
    return !!(session && session.user && session.user.username);
  }

  /**
   * Get authenticated user from session
   * @param {Object} session - Express session object
   * @returns {Object|null} User object or null
   */
  getAuthenticatedUser(session) {
    if (this.isAuthenticated(session)) {
      return session.user;
    }
    return null;
  }

  /**
   * Login user and create session
   * @param {Object} session - Express session object
   * @param {Object} user - Authenticated user object
   */
  loginUser(session, user) {
    session.user = {
      ...user,
      sessionToken: this.generateSessionToken(),
      loginTime: new Date()
    };
  }

  /**
   * Logout user and destroy session
   * @param {Object} session - Express session object
   * @returns {Promise} Promise that resolves when session is destroyed
   */
  logoutUser(session) {
    return new Promise((resolve, reject) => {
      session.destroy((error) => {
        if (error) {
          console.error('Session destruction error:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Middleware to require authentication
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  requireAuth(req, res, next) {
    if (this.isAuthenticated(req.session)) {
      return next();
    }

    // Store the original URL for redirect after login
    req.session.redirectUrl = req.originalUrl;

    // For API requests, return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        error: 'Authentication required',
        redirectUrl: '/admin/login'
      });
    }

    // For regular requests, redirect to login
    res.redirect('/admin/login');
  }

  /**
   * Middleware to redirect authenticated users
   * (useful for login page when user is already logged in)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  redirectIfAuthenticated(req, res, next) {
    if (this.isAuthenticated(req.session)) {
      const redirectUrl = req.session.redirectUrl || '/admin';
      delete req.session.redirectUrl;
      return res.redirect(redirectUrl);
    }
    next();
  }

  /**
   * Create a utility for generating password hashes
   * This is mainly for setup/configuration purposes
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password for storing in config
   */
  async createPasswordHash(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    return await this.hashPassword(password);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validatePassword(password) {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AuthService;