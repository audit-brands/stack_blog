const express = require('express');
const csrf = require('csurf');
const { authService, contentService, mediaService, cacheService, pluginService } = require('../services');

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
router.post('/pages/save', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
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
router.post('/media/upload', authService.requireAuth.bind(authService), csrfProtection, async (req, res) => {
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
    csrfToken: req.csrfToken(),
    currentPath: req.path
  });
});

/**
 * Clear cache
 */
router.post('/cache/clear', authService.requireAuth.bind(authService), csrfProtection, (req, res) => {
  try {
    cacheService.clear();
    
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.json({
        success: true,
        message: 'Cache cleared successfully'
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

module.exports = router;