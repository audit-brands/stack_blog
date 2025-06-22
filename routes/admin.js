const express = require('express');
const csrf = require('csurf');
const { authService } = require('../services');

const router = express.Router();

// CSRF protection for forms
const csrfProtection = csrf({ cookie: false });

/**
 * Admin login page
 */
router.get('/login', authService.redirectIfAuthenticated.bind(authService), csrfProtection, (req, res) => {
  res.render('admin/login', {
    page: {
      metadata: {
        title: 'Admin Login'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    csrfToken: req.csrfToken(),
    error: req.query.error,
    currentPath: req.path
  });
});

/**
 * Admin login form handler
 */
router.post('/login', authService.redirectIfAuthenticated.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/admin/login?error=missing_credentials');
    }

    const user = await authService.authenticateUser(username, password);
    
    if (user) {
      // Login successful
      authService.loginUser(req.session, user);
      
      // Redirect to originally requested URL or admin dashboard
      const redirectUrl = req.session.redirectUrl || '/admin';
      delete req.session.redirectUrl;
      
      res.redirect(redirectUrl);
    } else {
      // Login failed
      res.redirect('/admin/login?error=invalid_credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/admin/login?error=server_error');
  }
});

/**
 * Admin logout
 */
router.post('/logout', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    await authService.logoutUser(req.session);
    res.redirect('/admin/login');
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/admin');
  }
});

/**
 * Admin dashboard - protected route
 */
router.get('/', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  
  res.render('admin/dashboard', {
    page: {
      metadata: {
        title: 'Admin Dashboard'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    user,
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Password utility route (for generating hashes during setup)
 * This should only be used during initial setup and then removed
 */
router.post('/setup-password', csrfProtection, async (req, res) => {
  // Only allow this in development mode and if no password is already set
  if (process.env.NODE_ENV === 'production' || process.env.ADMIN_PASSWORD_HASH) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const validation = authService.validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Password validation failed',
        details: validation.errors 
      });
    }

    const hash = await authService.createPasswordHash(password);
    
    res.json({ 
      success: true, 
      hash,
      message: 'Add this hash to your .env file as ADMIN_PASSWORD_HASH'
    });
  } catch (error) {
    console.error('Password setup error:', error);
    res.status(500).json({ error: 'Password setup failed' });
  }
});

/**
 * Setup page for initial configuration
 */
router.get('/setup', (req, res) => {
  // Only show setup page if no password is configured
  if (process.env.ADMIN_PASSWORD_HASH) {
    return res.redirect('/admin/login');
  }

  res.render('admin/setup', {
    page: {
      metadata: {
        title: 'Admin Setup'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Initial Setup'
    },
    currentPath: req.path
  });
});

module.exports = router;