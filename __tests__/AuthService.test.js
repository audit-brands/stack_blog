const AuthService = require('../services/AuthService');

// Mock config for testing
jest.mock('../config/default', () => ({
  admin: {
    username: 'testadmin',
    passwordHash: '$2b$12$test.hash.for.testing.purposes.only'
  }
}));

describe('AuthService', () => {
  let authService;

  beforeAll(() => {
    authService = new AuthService();
  });

  describe('password hashing and verification', () => {
    test('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$12$')).toBe(true);
    });

    test('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('should handle password hashing errors gracefully', async () => {
      // Test with null password
      await expect(authService.hashPassword(null)).rejects.toThrow('Password hashing failed');
    });
  });

  describe('password validation', () => {
    test('should validate strong password', () => {
      const result = authService.validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const weakPasswords = [
        '',
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChars123'
      ];

      weakPasswords.forEach(password => {
        const result = authService.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should provide specific error messages', () => {
      const result = authService.validatePassword('weak');
      
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('session management', () => {
    test('should detect authenticated session', () => {
      const session = {
        user: {
          username: 'testadmin',
          role: 'admin'
        }
      };

      expect(authService.isAuthenticated(session)).toBe(true);
    });

    test('should detect unauthenticated session', () => {
      const sessions = [
        {},
        { user: null },
        { user: {} },
        null,
        undefined
      ];

      sessions.forEach(session => {
        expect(authService.isAuthenticated(session)).toBe(false);
      });
    });

    test('should get authenticated user', () => {
      const user = {
        username: 'testadmin',
        role: 'admin'
      };
      const session = { user };

      const result = authService.getAuthenticatedUser(session);
      expect(result).toEqual(user);
    });

    test('should return null for unauthenticated session', () => {
      const result = authService.getAuthenticatedUser({});
      expect(result).toBeNull();
    });

    test('should login user and create session', () => {
      const session = {};
      const user = {
        username: 'testadmin',
        role: 'admin',
        authenticatedAt: new Date()
      };

      authService.loginUser(session, user);

      expect(session.user).toBeDefined();
      expect(session.user.username).toBe(user.username);
      expect(session.user.role).toBe(user.role);
      expect(session.user.sessionToken).toBeDefined();
      expect(session.user.loginTime).toBeDefined();
    });
  });

  describe('middleware functions', () => {
    test('should call next() for authenticated user', () => {
      const req = {
        session: {
          user: { username: 'testadmin' }
        }
      };
      const res = {};
      const next = jest.fn();

      authService.requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should redirect unauthenticated user to login', () => {
      const req = {
        session: {},
        originalUrl: '/admin/pages',
        headers: {}
      };
      const res = {
        redirect: jest.fn()
      };
      const next = jest.fn();

      authService.requireAuth(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/admin/login');
      expect(req.session.redirectUrl).toBe('/admin/pages');
      expect(next).not.toHaveBeenCalled();
    });

    test('should return JSON error for AJAX requests', () => {
      const req = {
        session: {},
        xhr: true,
        originalUrl: '/admin/api/pages',
        headers: { accept: 'application/json' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authService.requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        redirectUrl: '/admin/login'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect authenticated user away from login page', () => {
      const req = {
        session: {
          user: { username: 'testadmin' },
          redirectUrl: '/admin/pages'
        }
      };
      const res = {
        redirect: jest.fn()
      };
      const next = jest.fn();

      authService.redirectIfAuthenticated(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/admin/pages');
      expect(req.session.redirectUrl).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('utility functions', () => {
    test('should generate session token', () => {
      const token = authService.generateSessionToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex = 64 characters
    });

    test('should generate unique session tokens', () => {
      const token1 = authService.generateSessionToken();
      const token2 = authService.generateSessionToken();
      
      expect(token1).not.toBe(token2);
    });

    test('should create password hash for setup', async () => {
      const password = 'SetupPassword123!';
      const hash = await authService.createPasswordHash(password);
      
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2b$12$')).toBe(true);
      
      // Verify the hash works
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject short passwords for setup', async () => {
      await expect(authService.createPasswordHash('short')).rejects.toThrow();
    });
  });
});