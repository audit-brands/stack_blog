const express = require('express');
const csrf = require('csurf');
const { authService, contentService, mediaService, cacheService, pluginService, searchService, getThemeService, themeValidationService, templateCacheService } = require('../services');
const { authLimiter, uploadLimiter, uploadSecurityCheck } = require('../middleware/security');
const { validateLogin, validatePage, validateSlug, validatePlugin, validatePassword } = require('../middleware/validation');

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
    
    res.render('admin/pages', {
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
    res.status(500).render('admin/error', {
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
  
  res.render('admin/page-edit', {
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
      return res.status(404).render('admin/error', {
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
    
    res.render('admin/page-edit', {
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
    res.status(500).render('admin/error', {
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
    
    res.status(500).render('admin/error', {
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
    
    res.render('admin/media', {
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
      currentPath: req.path,
      formatFileSize: mediaService.formatFileSize.bind(mediaService)
    });
  } catch (error) {
    console.error('Error loading media:', error);
    res.status(500).render('admin/error', {
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
  
  res.render('admin/cache', {
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
  
  res.render('admin/search', {
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
  
  res.render('admin/themes', {
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