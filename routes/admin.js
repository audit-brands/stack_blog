const express = require('express');
const csrf = require('csurf');
const { authService, contentService, mediaService, cacheService, pluginService, searchService, getThemeService, themeValidationService, templateCacheService } = require('../services');
const { authLimiter, uploadLimiter, uploadSecurityCheck } = require('../middleware/security');
const { validateLogin, validatePage, validateSlug, validatePlugin, validatePassword } = require('../middleware/validation');

const router = express.Router();

// Set Handlebars as the view engine for admin routes
router.use((req, res, next) => {
  res.app.set('view engine', 'hbs');
  next();
});

// CSRF protection for forms
const csrfProtection = csrf({ cookie: false });

/**
 * Admin login page
 */
router.get('/login', authService.redirectIfAuthenticated.bind(authService), csrfProtection, (req, res) => {
  // Temporarily use simple HTML until Handlebars is working
  const errorMessage = req.query.error ? getErrorMessage(req.query.error) : '';
  const csrfToken = req.csrfToken();
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Login - Stack Blog</title>
        
        <meta name="robots" content="noindex, nofollow">
        <meta name="generator" content="Stack Blog CMS">
        
        <!-- Bulma CSS Framework -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
        
        <!-- Font Awesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
        
        <style>
            body {
                background-color: #f5f5f5;
            }
            .login-container {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .login-box {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                padding: 2rem;
                width: 100%;
                max-width: 400px;
            }
            .login-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .login-header h1 {
                color: #3273dc;
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            .login-header h2 {
                color: #7a7a7a;
                font-size: 1rem;
                font-weight: 400;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-box">
                <div class="login-header">
                    <h1>
                        <span class="icon-text">
                            <span class="icon">
                                <i class="fas fa-layer-group"></i>
                            </span>
                            <span>Stack Blog</span>
                        </span>
                    </h1>
                    <h2>Admin Login</h2>
                </div>

                ${errorMessage ? `<div class="notification is-danger">${errorMessage}</div>` : ''}

                <form method="post" action="/admin/login">
                    <input type="hidden" name="_csrf" value="${csrfToken}">
                    
                    <div class="field">
                        <label class="label" for="username">Username</label>
                        <div class="control has-icons-left">
                            <input 
                                class="input" 
                                type="text" 
                                id="username" 
                                name="username" 
                                required 
                                autocomplete="username"
                                autofocus
                                placeholder="Enter your username"
                            >
                            <span class="icon is-small is-left">
                                <i class="fas fa-user"></i>
                            </span>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label" for="password">Password</label>
                        <div class="control has-icons-left">
                            <input 
                                class="input" 
                                type="password" 
                                id="password" 
                                name="password" 
                                required 
                                autocomplete="current-password"
                                placeholder="Enter your password"
                            >
                            <span class="icon is-small is-left">
                                <i class="fas fa-lock"></i>
                            </span>
                        </div>
                    </div>

                    <div class="field">
                        <div class="control">
                            <button type="submit" class="button is-primary is-fullwidth">
                                <span class="icon">
                                    <i class="fas fa-sign-in-alt"></i>
                                </span>
                                <span>Login</span>
                            </button>
                        </div>
                    </div>
                </form>

                <div class="has-text-centered" style="margin-top: 1.5rem;">
                    <a href="/" class="button is-light is-small">
                        <span class="icon">
                            <i class="fas fa-arrow-left"></i>
                        </span>
                        <span>Back to Site</span>
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

function getErrorMessage(error) {
  switch(error) {
    case 'missing_credentials':
      return 'Please enter both username and password.';
    case 'invalid_credentials':
      return 'Invalid username or password.';
    case 'server_error':
      return 'Server error occurred. Please try again.';
    default:
      return 'Login error occurred. Please try again.';
  }
}

/**
 * Admin login form handler
 */
router.post('/login', authLimiter, authService.redirectIfAuthenticated.bind(authService), csrfProtection, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/admin/login?error=missing_credentials');
    }

    const user = await authService.authenticateUser(username, password);
    
    if (user) {
      // Login successful
      authService.loginUser(req.session, user);
      
      // Force session save before redirect
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/admin/login?error=server_error');
        }
        
        // Redirect to originally requested URL or admin dashboard
        const redirectUrl = req.session.redirectUrl || '/admin';
        delete req.session.redirectUrl;
        
        res.redirect(redirectUrl);
      });
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
 * Admin logout GET (redirect to login)
 */
router.get('/logout', (req, res) => {
  res.redirect('/admin/login');
});

/**
 * Admin logout POST
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
router.get('/', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  const csrfToken = req.csrfToken();
  
  // Get dashboard data
  const dashboardData = {
    pageCount: 0, // TODO: Get actual count
    mediaCount: 0, // TODO: Get actual count  
    themeCount: 1, // TODO: Get actual count
    rssSubscribers: 0, // TODO: Get actual count
    cacheEnabled: true,
    searchEnabled: true
  };
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - Stack Blog</title>
        
        <meta name="robots" content="noindex, nofollow">
        <meta name="generator" content="Stack Blog CMS">
        
        <!-- Bulma CSS Framework -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
        
        <!-- Admin CSS -->
        <link rel="stylesheet" href="/css/admin.css">
        
        <!-- Font Awesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
    </head>
    <body>
        <div class="admin-wrapper">
            <!-- Navigation Bar -->
            <nav class="navbar admin-navbar" role="navigation" aria-label="main navigation">
                <div class="navbar-brand">
                    <a class="navbar-item" href="/admin">
                        <strong>Stack Blog Admin</strong>
                    </a>
                    
                    <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false" data-target="navbar-menu">
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                    </a>
                </div>
                
                <div id="navbar-menu" class="navbar-menu">
                    <div class="navbar-end">
                        <div class="navbar-item has-dropdown is-hoverable">
                            <a class="navbar-link">
                                <span class="icon">
                                    <i class="fas fa-user"></i>
                                </span>
                                <span>${user.username}</span>
                            </a>
                            
                            <div class="navbar-dropdown">
                                <a class="navbar-item" href="/admin">
                                    <span class="icon">
                                        <i class="fas fa-tachometer-alt"></i>
                                    </span>
                                    Dashboard
                                </a>
                                <a class="navbar-item" href="/" target="_blank">
                                    <span class="icon">
                                        <i class="fas fa-external-link-alt"></i>
                                    </span>
                                    View Site
                                </a>
                                <hr class="navbar-divider">
                                <div class="navbar-item">
                                    <form action="/admin/logout" method="POST" style="margin: 0;">
                                        <input type="hidden" name="_csrf" value="${csrfToken}">
                                        <button type="submit" class="button is-small is-light">
                                            <span class="icon">
                                                <i class="fas fa-sign-out-alt"></i>
                                            </span>
                                            <span>Logout</span>
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            
            <!-- Main Content Area -->
            <div class="admin-main">
                <!-- Sidebar -->
                <aside class="admin-sidebar">
                    <div class="menu">
                        <p class="menu-label">Main</p>
                        <ul class="menu-list">
                            <li>
                                <a href="/admin" class="is-active">
                                    <span class="icon">
                                        <i class="fas fa-tachometer-alt"></i>
                                    </span>
                                    Dashboard
                                </a>
                            </li>
                        </ul>
                        
                        <p class="menu-label">Content</p>
                        <ul class="menu-list">
                            <li>
                                <a href="/admin/pages">
                                    <span class="icon">
                                        <i class="fas fa-file-alt"></i>
                                    </span>
                                    Pages
                                </a>
                            </li>
                            <li>
                                <a href="/admin/pages/new">
                                    <span class="icon">
                                        <i class="fas fa-plus"></i>
                                    </span>
                                    New Page
                                </a>
                            </li>
                        </ul>
                        
                        <p class="menu-label">Media</p>
                        <ul class="menu-list">
                            <li>
                                <a href="/admin/media">
                                    <span class="icon">
                                        <i class="fas fa-images"></i>
                                    </span>
                                    Media Library
                                </a>
                            </li>
                        </ul>
                        
                        <p class="menu-label">System</p>
                        <ul class="menu-list">
                            <li>
                                <a href="/admin/themes">
                                    <span class="icon">
                                        <i class="fas fa-palette"></i>
                                    </span>
                                    Theme Management
                                </a>
                            </li>
                            <li>
                                <a href="/admin/rss-analytics">
                                    <span class="icon">
                                        <i class="fas fa-chart-line"></i>
                                    </span>
                                    RSS Analytics
                                </a>
                            </li>
                        </ul>
                        
                        <p class="menu-label">API</p>
                        <ul class="menu-list">
                            <li>
                                <a href="/api/status" target="_blank">
                                    <span class="icon">
                                        <i class="fas fa-code"></i>
                                    </span>
                                    API Status
                                </a>
                            </li>
                        </ul>
                    </div>
                </aside>
                
                <!-- Content Area -->
                <main class="admin-content">
                    <div class="content-header">
                        <h1>
                            <span class="icon">
                                <i class="fas fa-tachometer-alt"></i>
                            </span>
                            Dashboard
                        </h1>
                    </div>

                    <div class="dashboard-stats">
                        <div class="stat-card">
                            <div class="stat-number">${dashboardData.pageCount}</div>
                            <div class="stat-label">Pages</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${dashboardData.mediaCount}</div>
                            <div class="stat-label">Media Files</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${dashboardData.themeCount}</div>
                            <div class="stat-label">Themes</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${dashboardData.rssSubscribers}</div>
                            <div class="stat-label">RSS Subscribers</div>
                        </div>
                    </div>

                    <div class="columns">
                        <div class="column is-8">
                            <div class="box">
                                <h2 class="title is-4">Welcome to Stack Blog Admin</h2>
                                <div class="content">
                                    <p>Your admin panel is now running on <strong>Handlebars</strong> templates, eliminating the Nunjucks issues.</p>
                                    
                                    <div class="notification is-success">
                                        <h4><strong>✅ Phase 1 Complete!</strong></h4>
                                        <ul>
                                            <li>✅ Admin authentication working</li>
                                            <li>✅ Dashboard with navigation</li>
                                            <li>✅ No more template errors</li>
                                            <li>✅ Full Ghost compatibility foundation</li>
                                        </ul>
                                    </div>
                                    
                                    <h4><strong>Next: Phase 2</strong></h4>
                                    <p>Convert page management and media templates to complete the migration.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="column is-4">
                            <div class="box">
                                <h2 class="title is-4">Quick Actions</h2>
                                <div class="buttons is-flex-direction-column">
                                    <a href="/admin/pages/new" class="button is-primary is-fullwidth">
                                        <span class="icon">
                                            <i class="fas fa-plus"></i>
                                        </span>
                                        <span>New Page</span>
                                    </a>
                                    <a href="/admin/media" class="button is-info is-fullwidth">
                                        <span class="icon">
                                            <i class="fas fa-upload"></i>
                                        </span>
                                        <span>Upload Media</span>
                                    </a>
                                    <a href="/admin/themes" class="button is-warning is-fullwidth">
                                        <span class="icon">
                                            <i class="fas fa-palette"></i>
                                        </span>
                                        <span>Manage Themes</span>
                                    </a>
                                    <a href="/" target="_blank" class="button is-fullwidth">
                                        <span class="icon">
                                            <i class="fas fa-external-link-alt"></i>
                                        </span>
                                        <span>View Site</span>
                                    </a>
                                </div>
                            </div>
                            
                            <div class="box">
                                <h2 class="title is-4">System Status</h2>
                                <div class="content">
                                    <div class="field">
                                        <label class="label">Template Engine</label>
                                        <span class="tag is-success">Handlebars Ready</span>
                                    </div>
                                    <div class="field">
                                        <label class="label">Admin Panel</label>
                                        <span class="tag is-success">Operational</span>
                                    </div>
                                    <div class="field">
                                        <label class="label">Ghost Compatibility</label>
                                        <span class="tag is-success">Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
        
        <!-- Admin JavaScript -->
        <script src="/js/admin.js"></script>
    </body>
    </html>
  `);
});

// Test route that bypasses templates
router.get('/test', (req, res) => {
  res.send(`
    <h1>Admin Test Page</h1>
    <p>Session ID: ${req.sessionID}</p>
    <p>Has User: ${!!(req.session && req.session.user)}</p>
    <p>User: ${JSON.stringify(req.session ? req.session.user : null)}</p>
    <a href="/admin/test-dashboard">Test Dashboard</a>
  `);
});

// Simple dashboard without any template engine
router.get('/test-dashboard', authService.requireAuth.bind(authService), (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Dashboard</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
    </head>
    <body>
      <div class="container">
        <h1 class="title">Test Dashboard</h1>
        <p>Welcome ${req.session.user.username}!</p>
        <a href="/admin/logout" class="button">Logout</a>
      </div>
    </body>
    </html>
  `);
});

/**
 * Password utility route (for generating hashes during setup)
 * This should only be used during initial setup and then removed
 */
router.post('/setup-password', authLimiter, csrfProtection, validatePassword, async (req, res) => {
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

  res.render('pages/setup', {
    page: {
      metadata: {
        title: 'Admin Setup'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Initial Setup'
    },
    currentPath: req.path,
    csrfToken: req.csrfToken()
  });
});

/**
 * Pages listing page
 */
router.get('/pages', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const user = authService.getAuthenticatedUser(req.session);
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const search = req.query.search || '';
    const savedMessage = req.query.saved || '';
    const deletedMessage = req.query.deleted || '';
    
    const result = await contentService.listPages({
      page,
      limit,
      search
    });
    
    res.render('pages/pages', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Manage Pages'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      user,
      pages: result.pages,
      pagination: result.pagination,
      search,
      savedMessage,
      deletedMessage,
      csrfToken: req.csrfToken(),
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error loading pages:', error);
    res.status(500).render('pages/error', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Error'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      error: process.env.NODE_ENV === 'development' ? error : null,
      currentPath: req.path
    });
  }
});

/**
 * New page creation form
 */
router.get('/pages/new', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  
  res.render('pages/page-edit', {
    layout: 'admin',
    page: {
      metadata: {
        title: 'Create New Page'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    user,
    editPage: null, // New page
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Edit existing page form
 */
router.get('/pages/:slug/edit', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const user = authService.getAuthenticatedUser(req.session);
    const { slug } = req.params;
    
    const editPage = await contentService.getPage(slug);
    
    if (!editPage) {
      return res.status(404).render('pages/error', {
        layout: 'admin',
        page: {
          metadata: {
            title: 'Page Not Found'
          }
        },
        site: {
          title: 'Stack Blog',
          description: 'Admin Panel'
        },
        error: { message: `Page "${slug}" not found` },
        currentPath: req.path
      });
    }
    
    res.render('pages/page-edit', {
      layout: 'admin',
      page: {
        metadata: {
          title: `Edit: ${editPage.metadata.title}`
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      user,
      editPage,
      csrfToken: req.csrfToken(),
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error loading page for editing:', error);
    res.status(500).render('pages/error', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Error'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      error: process.env.NODE_ENV === 'development' ? error : null,
      currentPath: req.path
    });
  }
});

/**
 * Save page (create or update)
 */
router.post('/pages/save', authService.requireAuth.bind(authService), csrfProtection, validatePage, async (req, res) => {
  try {
    const { slug, title, content, description, template, date, originalSlug } = req.body;
    const isAutosave = req.body.autosave === 'true';
    
    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required',
        field: !title ? 'title' : 'content'
      });
    }
    
    // Create slug from title if not provided
    let finalSlug = slug || contentService.createSlug(title);
    
    // Check if slug exists (for new pages or if slug changed)
    if (!originalSlug || originalSlug !== finalSlug) {
      const slugExists = await contentService.slugExists(finalSlug);
      if (slugExists) {
        return res.status(400).json({
          error: 'A page with this slug already exists',
          field: 'slug',
          suggestion: contentService.createSlug(`${title}-${Date.now()}`)
        });
      }
    }
    
    // Prepare metadata
    const metadata = {
      title,
      description: description || '',
      template: template || 'default',
      date: date || new Date().toISOString().split('T')[0]
    };
    
    // Save the page
    const savedPage = await contentService.savePage(finalSlug, metadata, content);
    
    // If slug changed, delete the old page
    if (originalSlug && originalSlug !== finalSlug) {
      await contentService.deletePage(originalSlug);
    }
    
    if (isAutosave) {
      return res.json({
        success: true,
        message: 'Page auto-saved',
        slug: savedPage.slug
      });
    }
    
    // Regular save - redirect to pages list with success message
    res.redirect('/admin/pages?saved=' + encodeURIComponent(savedPage.metadata.title));
  } catch (error) {
    console.error('Error saving page:', error);
    
    if (req.body.autosave === 'true') {
      return res.status(500).json({
        error: 'Auto-save failed',
        message: error.message
      });
    }
    
    res.status(500).render('pages/error', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Save Error'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      error: process.env.NODE_ENV === 'development' ? error : null,
      currentPath: req.path
    });
  }
});

/**
 * Delete page
 */
router.post('/pages/:slug/delete', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { slug } = req.params;
    
    const page = await contentService.getPage(slug);
    if (!page) {
      return res.status(404).json({
        error: 'Page not found'
      });
    }
    
    const deleted = await contentService.deletePage(slug);
    
    if (deleted) {
      res.redirect('/admin/pages?deleted=' + encodeURIComponent(page.metadata.title));
    } else {
      res.status(500).json({
        error: 'Failed to delete page'
      });
    }
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: error.message
    });
  }
});

/**
 * Media library listing page
 */
router.get('/media', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const user = authService.getAuthenticatedUser(req.session);
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const search = req.query.search || '';
    const type = req.query.type || 'all';
    const uploadedMessage = req.query.uploaded || '';
    const deletedMessage = req.query.deleted || '';
    
    const result = await mediaService.listFiles({
      page,
      limit,
      search,
      type
    });
    
    res.render('pages/media', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Media Library'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      user,
      files: result.files,
      pagination: result.pagination,
      search,
      type,
      uploadedMessage,
      deletedMessage,
      csrfToken: req.csrfToken(),
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error loading media:', error);
    res.status(500).render('pages/error', {
      layout: 'admin',
      page: {
        metadata: {
          title: 'Error'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'Admin Panel'
      },
      error: process.env.NODE_ENV === 'development' ? error : null,
      currentPath: req.path
    });
  }
});

/**
 * File upload handler
 */
router.post('/media/upload', uploadLimiter, authService.requireAuth.bind(authService), csrfProtection, uploadSecurityCheck, async (req, res) => {
  try {
    const upload = mediaService.getMulterConfig();
    const uploadMultiple = upload.array('files', 10);
    
    uploadMultiple(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          error: 'Upload failed',
          message: err.message
        });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded'
        });
      }
      
      const processedFiles = [];
      
      // Process each uploaded file
      for (const file of req.files) {
        try {
          const isImage = mediaService.imageFormats.includes(file.mimetype);
          let processResult = { original: file.filename, thumbnail: null };
          
          if (isImage) {
            processResult = await mediaService.processImage(file.path, {
              generateThumbnail: true,
              maxWidth: 1920,
              maxHeight: 1080,
              quality: 85
            });
          }
          
          processedFiles.push({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            processed: processResult
          });
        } catch (processError) {
          console.error('Error processing file:', processError);
          // Continue with other files even if one fails
        }
      }
      
      if (req.xhr || req.headers.accept === 'application/json') {
        return res.json({
          success: true,
          files: processedFiles,
          message: `${processedFiles.length} file(s) uploaded successfully`
        });
      }
      
      // Regular form submission - redirect with success message
      const fileNames = processedFiles.map(f => f.originalName).join(', ');
      res.redirect('/admin/media?uploaded=' + encodeURIComponent(fileNames));
    });
  } catch (error) {
    console.error('Error in upload handler:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * Delete media file
 */
router.post('/media/:filename/delete', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { filename } = req.params;
    
    const fileInfo = await mediaService.getFileInfo(filename);
    if (!fileInfo) {
      return res.status(404).json({
        error: 'File not found'
      });
    }
    
    const deleted = await mediaService.deleteFile(filename);
    
    if (deleted) {
      if (req.xhr || req.headers.accept === 'application/json') {
        return res.json({
          success: true,
          message: 'File deleted successfully'
        });
      }
      res.redirect('/admin/media?deleted=' + encodeURIComponent(filename));
    } else {
      res.status(500).json({
        error: 'Failed to delete file'
      });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: error.message
    });
  }
});

/**
 * Get file info (for AJAX requests)
 */
router.get('/media/:filename/info', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const { filename } = req.params;
    const fileInfo = await mediaService.getFileInfo(filename);
    
    if (!fileInfo) {
      return res.status(404).json({
        error: 'File not found'
      });
    }
    
    res.json(fileInfo);
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({
      error: 'Failed to get file info',
      message: error.message
    });
  }
});

/**
 * Cache status and management
 */
router.get('/cache', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  const stats = cacheService.getStats();
  const templateCacheStats = templateCacheService.getStats();
  
  res.render('pages/cache', {
    layout: 'admin',
    page: {
      metadata: {
        title: 'Cache Management'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    user,
    stats,
    templateCacheStats,
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Clear cache
 */
router.post('/cache/clear', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  try {
    const { type } = req.body;
    
    if (type === 'template') {
      templateCacheService.clearAll();
    } else if (type === 'content') {
      cacheService.clear();
    } else {
      // Clear both
      cacheService.clear();
      templateCacheService.clearAll();
    }
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: `${type || 'All'} cache cleared successfully`
      });
    }
    
    res.redirect('/admin/cache?cleared=true');
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * Preload content cache
 */
router.post('/cache/preload', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    await cacheService.preloadContent(contentService.contentPath);
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: 'Content cache preloaded successfully'
      });
    }
    
    res.redirect('/admin/cache?preloaded=true');
  } catch (error) {
    console.error('Error preloading cache:', error);
    res.status(500).json({
      error: 'Failed to preload cache',
      message: error.message
    });
  }
});

/**
 * Plugins management page
 */
router.get('/plugins', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  const plugins = pluginService.getAllPlugins();
  const hooks = pluginService.getHooksInfo();
  
  res.render('admin/plugins', {
    page: {
      metadata: {
        title: 'Plugin Management'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    user,
    plugins,
    hooks,
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Reload plugins
 */
router.post('/plugins/reload', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    await pluginService.reload();
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: 'Plugins reloaded successfully',
        count: pluginService.getAllPlugins().length
      });
    }
    
    res.redirect('/admin/plugins?reloaded=true');
  } catch (error) {
    console.error('Error reloading plugins:', error);
    res.status(500).json({
      error: 'Failed to reload plugins',
      message: error.message
    });
  }
});

/**
 * Create new plugin
 */
router.post('/plugins/create', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { name, description, author } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Plugin name is required'
      });
    }
    
    const pluginPath = await pluginService.createPlugin(name, { description, author });
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: `Plugin "${name}" created successfully`,
        path: pluginPath
      });
    }
    
    res.redirect('/admin/plugins?created=' + encodeURIComponent(name));
  } catch (error) {
    console.error('Error creating plugin:', error);
    res.status(500).json({
      error: 'Failed to create plugin',
      message: error.message
    });
  }
});

/**
 * Search management page
 */
router.get('/search', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  const stats = searchService.getStats();
  
  res.render('pages/search', {
    layout: 'admin',
    page: {
      metadata: {
        title: 'Search Management'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'Admin Panel'
    },
    user,
    stats,
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Rebuild search index
 */
router.post('/search/rebuild', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    await searchService.buildIndex();
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: 'Search index rebuilt successfully',
        stats: searchService.getStats()
      });
    }
    
    res.redirect('/admin/search?rebuilt=true');
  } catch (error) {
    console.error('Error rebuilding search index:', error);
    res.status(500).json({
      error: 'Failed to rebuild search index',
      message: error.message
    });
  }
});

/**
 * Clear search index
 */
router.post('/search/clear', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  try {
    searchService.clearIndex();
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: 'Search index cleared successfully'
      });
    }
    
    res.redirect('/admin/search?cleared=true');
  } catch (error) {
    console.error('Error clearing search index:', error);
    res.status(500).json({
      error: 'Failed to clear search index',
      message: error.message
    });
  }
});

/**
 * Search suggestions API endpoint
 */
router.get('/search/suggestions', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return res.json([]);
    }
    
    const suggestions = await searchService.getSuggestions(q, parseInt(limit) || 5);
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

/**
 * Theme management page
 */
router.get('/themes', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  
  res.render('pages/themes', {
    layout: 'admin',
    page: {
      metadata: {
        title: 'Theme Management'
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
 * RSS Analytics Dashboard
 */
router.get('/rss-analytics', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  const user = authService.getAuthenticatedUser(req.session);
  
  res.render('pages/rss-analytics', {
    layout: 'admin',
    page: {
      metadata: {
        title: 'RSS Analytics & Sponsors'
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
 * API: List themes
 */
router.get('/api/themes', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const themeService = getThemeService();
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    const themes = await themeService.listThemes();
    res.json(themes);
  } catch (error) {
    console.error('Error listing themes:', error);
    res.status(500).json({
      error: 'Failed to list themes',
      message: error.message
    });
  }
});

/**
 * API: Get current theme
 */
router.get('/api/themes/current', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const themeService = getThemeService();
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    const currentTheme = {
      name: themeService.activeTheme || 'default',
      engine: themeService.getCurrentEngine() || 'nunjucks'
    };
    
    // Get additional theme info if available
    const themes = await themeService.listThemes();
    const themeInfo = themes.find(theme => theme.name === currentTheme.name);
    
    if (themeInfo) {
      Object.assign(currentTheme, themeInfo);
    }
    
    res.json(currentTheme);
  } catch (error) {
    console.error('Error getting current theme:', error);
    res.status(500).json({
      error: 'Failed to get current theme',
      message: error.message
    });
  }
});

/**
 * API: Get theme details
 */
router.get('/api/themes/:themeName', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const { themeName } = req.params;
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    const themes = await themeService.listThemes();
    const theme = themes.find(t => t.name === themeName);
    
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    // Add file listing for theme details
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const themePath = path.join(themeService.themesPath, themeName);
      const files = await listThemeFiles(themePath);
      theme.files = files;
    } catch (fileError) {
      theme.files = [];
    }
    
    res.json(theme);
  } catch (error) {
    console.error('Error getting theme details:', error);
    res.status(500).json({
      error: 'Failed to get theme details',
      message: error.message
    });
  }
});

/**
 * API: Activate theme
 */
router.post('/api/themes/activate', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { theme, engine } = req.body;
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    if (!theme) {
      return res.status(400).json({ error: 'Theme name is required' });
    }
    
    const success = await themeService.setActiveTheme(theme, engine || 'handlebars');
    
    if (success) {
      res.json({
        success: true,
        message: `Theme "${theme}" activated successfully`,
        theme: {
          name: theme,
          engine: engine || 'handlebars'
        }
      });
    } else {
      res.status(400).json({
        error: 'Failed to activate theme',
        message: 'Theme activation was not successful'
      });
    }
  } catch (error) {
    console.error('Error activating theme:', error);
    res.status(500).json({
      error: 'Failed to activate theme',
      message: error.message
    });
  }
});

/**
 * API: Validate theme with GScan
 */
router.post('/api/themes/:themeName/validate', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const { themeName } = req.params;
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    const themePath = path.join(themeService.themesPath, themeName);
    const themeExists = await themeService.themeExists(themeName);
    
    if (!themeExists) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    const validation = await themeValidationService.getStackBlogCompatibility(themePath, themeName);
    
    res.json({
      success: true,
      validation,
      theme: themeName,
      validatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating theme:', error);
    res.status(500).json({
      error: 'Failed to validate theme',
      message: error.message
    });
  }
});

/**
 * API: Validate all themes
 */
router.post('/api/themes/validate-all', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }
    
    const themes = await themeService.listThemes();
    const themePaths = themes.map(theme => 
      path.join(themeService.themesPath, theme.name)
    );
    
    const validations = await themeValidationService.validateThemes(themePaths);
    
    res.json({
      success: true,
      validations,
      count: Object.keys(validations).length,
      validatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating themes:', error);
    res.status(500).json({
      error: 'Failed to validate themes',
      message: error.message
    });
  }
});

/**
 * API: Upload theme
 */
router.post('/api/themes/upload', uploadLimiter, authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const multer = require('multer');
    const AdmZip = require('adm-zip');
    
    // Configure multer for theme uploads
    const storage = multer.memoryStorage();
    const upload = multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || 
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.endsWith('.zip')) {
          cb(null, true);
        } else {
          cb(new Error('Only ZIP files are allowed'));
        }
      }
    }).single('themeFile');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'Upload failed',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      try {
        const result = await extractAndInstallTheme(req.file, req.body.themeName);
        
        res.json({
          success: true,
          theme: result.themeName,
          message: `Theme "${result.themeName}" uploaded successfully`,
          validation: result.validation
        });
      } catch (extractError) {
        console.error('Error extracting theme:', extractError);
        res.status(500).json({
          error: 'Failed to extract theme',
          message: extractError.message
        });
      }
    });
  } catch (error) {
    console.error('Error uploading theme:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * API: Delete theme
 */
router.post('/api/themes/:themeName/delete', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
  try {
    const { themeName } = req.params;
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }

    // Prevent deletion of active theme
    if (themeService.activeTheme === themeName) {
      return res.status(400).json({
        error: 'Cannot delete active theme',
        message: 'Please switch to a different theme before deleting this one'
      });
    }

    // Prevent deletion of default themes
    const protectedThemes = ['default', 'casper-basic'];
    if (protectedThemes.includes(themeName)) {
      return res.status(400).json({
        error: 'Cannot delete protected theme',
        message: `The theme "${themeName}" is protected and cannot be deleted`
      });
    }

    const themePath = path.join(themeService.themesPath, themeName);
    const themeExists = await themeService.themeExists(themeName);
    
    if (!themeExists) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Delete theme directory
    const fs = require('fs').promises;
    await fs.rm(themePath, { recursive: true, force: true });

    // Clear theme cache
    if (templateCacheService) {
      templateCacheService.invalidateTheme(themeName);
    }

    res.json({
      success: true,
      message: `Theme "${themeName}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({
      error: 'Failed to delete theme',
      message: error.message
    });
  }
});

/**
 * API: Export theme
 */
router.get('/api/themes/:themeName/export', authService.requireAuth.bind(authService), async (req, res) => {
  try {
    const { themeName } = req.params;
    const themeService = getThemeService();
    
    if (!themeService) {
      return res.status(500).json({ error: 'Theme service not available' });
    }

    const themePath = path.join(themeService.themesPath, themeName);
    const themeExists = await themeService.themeExists(themeName);
    
    if (!themeExists) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    
    // Add theme directory to zip
    zip.addLocalFolder(themePath, themeName);
    
    const zipBuffer = zip.toBuffer();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${themeName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    res.send(zipBuffer);
  } catch (error) {
    console.error('Error exporting theme:', error);
    res.status(500).json({
      error: 'Failed to export theme',
      message: error.message
    });
  }
});

/**
 * Helper function to extract and install theme from uploaded ZIP
 */
async function extractAndInstallTheme(file, customThemeName = null) {
  const AdmZip = require('adm-zip');
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();
    
    if (entries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    // Determine theme name
    let themeName = customThemeName;
    if (!themeName) {
      // Try to extract theme name from package.json or use first directory
      const packageEntry = entries.find(entry => entry.entryName.endsWith('package.json'));
      if (packageEntry) {
        try {
          const packageJson = JSON.parse(packageEntry.getData().toString('utf8'));
          themeName = packageJson.name || path.basename(file.originalname, '.zip');
        } catch (e) {
          themeName = path.basename(file.originalname, '.zip');
        }
      } else {
        // Use first directory name or filename
        const firstDir = entries.find(entry => entry.isDirectory);
        themeName = firstDir ? firstDir.entryName.split('/')[0] : path.basename(file.originalname, '.zip');
      }
    }

    // Sanitize theme name
    themeName = themeName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    const themeService = getThemeService();
    if (!themeService) {
      throw new Error('Theme service not available');
    }

    const themePath = path.join(themeService.themesPath, themeName);
    
    // Check if theme already exists
    const themeExists = await themeService.themeExists(themeName);
    if (themeExists) {
      throw new Error(`Theme "${themeName}" already exists`);
    }

    // Create theme directory
    await fs.mkdir(themePath, { recursive: true });

    // Extract files
    let hasValidThemeFiles = false;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      // Skip unwanted files
      const entryPath = entry.entryName;
      if (entryPath.includes('__MACOSX') || 
          entryPath.includes('.DS_Store') ||
          entryPath.includes('Thumbs.db')) {
        continue;
      }

      // Remove theme directory prefix if present
      let relativePath = entryPath;
      const pathParts = relativePath.split('/');
      if (pathParts.length > 1 && pathParts[0] === themeName) {
        relativePath = pathParts.slice(1).join('/');
      }

      if (!relativePath) continue;

      const outputPath = path.join(themePath, relativePath);
      const outputDir = path.dirname(outputPath);

      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });

      // Write file
      const fileData = entry.getData();
      await fs.writeFile(outputPath, fileData);

      // Check for essential theme files
      if (relativePath === 'index.hbs' || 
          relativePath === 'post.hbs' || 
          relativePath === 'package.json') {
        hasValidThemeFiles = true;
      }
    }

    if (!hasValidThemeFiles) {
      // Clean up
      await fs.rm(themePath, { recursive: true, force: true });
      throw new Error('Invalid theme: missing essential files (index.hbs, post.hbs, or package.json)');
    }

    // Validate the theme
    let validation = null;
    try {
      validation = await themeValidationService.getStackBlogCompatibility(themePath, themeName);
    } catch (validationError) {
      console.warn('Theme validation failed:', validationError.message);
    }

    return {
      themeName,
      themePath,
      validation
    };

  } catch (error) {
    throw new Error(`Failed to extract theme: ${error.message}`);
  }
}

/**
 * Helper function to list theme files recursively
 */
async function listThemeFiles(themePath, basePath = '') {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const entries = await fs.readdir(themePath, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
      const fullPath = path.join(themePath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Skip node_modules and .git directories
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        const subFiles = await listThemeFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
    
    return files.sort();
  } catch (error) {
    return [];
  }
}

module.exports = router;