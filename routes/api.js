const express = require('express');
const { contentService, markdownService, searchService, mediaService, authService } = require('../services');
const { uploadLimiter, uploadSecurityCheck } = require('../middleware/security');
const { 
  validatePage, 
  validateSearch, 
  validatePagination, 
  validateSlug, 
  validateFilename, 
  validateApiRequest,
  validateContentType,
  validateFileUpload
} = require('../middleware/validation');

const router = express.Router();


// Content API endpoints

/**
 * Get all pages with pagination and filtering
 */
router.get('/pages', validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 items
    const search = req.query.search || '';
    const template = req.query.template;
    const sortBy = req.query.sort || 'date';
    const sortOrder = req.query.order || 'desc';
    
    const result = await contentService.listPages({
      page,
      limit,
      search,
      template,
      sortBy,
      sortOrder
    });
    
    // Process pages for API response
    const apiPages = await Promise.all(result.pages.map(async (pageData) => {
      const htmlContent = await markdownService.render(pageData.content);
      const metadata = markdownService.extractMetadata(pageData.content);
      
      return {
        slug: pageData.slug,
        title: pageData.metadata.title,
        description: pageData.metadata.description,
        content: pageData.content,
        html: htmlContent,
        metadata: {
          ...pageData.metadata,
          ...metadata
        },
        lastModified: pageData.lastModified,
        url: `/${pageData.slug}`
      };
    }));
    
    res.json({
      success: true,
      data: {
        pages: apiPages,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('API error listing pages:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve pages'
    });
  }
});

/**
 * Get a specific page by slug
 */
router.get('/pages/:slug', validateSlug, async (req, res) => {
  try {
    const { slug } = req.params;
    const includeHtml = req.query.html !== 'false';
    
    const page = await contentService.getPage(slug);
    
    if (!page) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Page "${slug}" not found`
      });
    }
    
    let htmlContent = null;
    if (includeHtml) {
      htmlContent = await markdownService.render(page.content);
    }
    
    const metadata = markdownService.extractMetadata(page.content);
    
    const apiPage = {
      slug: page.slug,
      title: page.metadata.title,
      description: page.metadata.description,
      content: page.content,
      html: htmlContent,
      metadata: {
        ...page.metadata,
        ...metadata
      },
      lastModified: page.lastModified,
      url: `/${page.slug}`
    };
    
    res.json({
      success: true,
      data: apiPage
    });
  } catch (error) {
    console.error('API error getting page:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve page'
    });
  }
});

/**
 * Create a new page (protected)
 */
router.post('/pages', validateApiRequest, validateContentType(['application/json']), validatePage, async (req, res) => {
  try {
    const { slug, title, content, description, template, date } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title and content are required'
      });
    }
    
    // Create slug from title if not provided
    const finalSlug = slug || contentService.createSlug(title);
    
    // Check if slug exists
    const slugExists = await contentService.slugExists(finalSlug);
    if (slugExists) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A page with this slug already exists',
        suggestion: contentService.createSlug(`${title}-${Date.now()}`)
      });
    }
    
    // Prepare metadata
    const metadata = {
      title,
      description: description || '',
      template: template || 'default',
      date: date || new Date().toISOString().split('T')[0]
    };
    
    const savedPage = await contentService.savePage(finalSlug, metadata, content);
    const htmlContent = await markdownService.render(savedPage.content);
    const extractedMetadata = markdownService.extractMetadata(savedPage.content);
    
    const apiPage = {
      slug: savedPage.slug,
      title: savedPage.metadata.title,
      description: savedPage.metadata.description,
      content: savedPage.content,
      html: htmlContent,
      metadata: {
        ...savedPage.metadata,
        ...extractedMetadata
      },
      lastModified: savedPage.lastModified,
      url: `/${savedPage.slug}`
    };
    
    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      data: apiPage
    });
  } catch (error) {
    console.error('API error creating page:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create page'
    });
  }
});

/**
 * Update an existing page (protected)
 */
router.put('/pages/:slug', validateApiRequest, validateSlug, validateContentType(['application/json']), validatePage, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content, description, template, date, newSlug } = req.body;
    
    // Check if page exists
    const existingPage = await contentService.getPage(slug);
    if (!existingPage) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Page "${slug}" not found`
      });
    }
    
    if (!title || !content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title and content are required'
      });
    }
    
    // Use new slug if provided, otherwise keep existing
    const finalSlug = newSlug || slug;
    
    // Check if new slug conflicts (if slug is changing)
    if (finalSlug !== slug) {
      const slugExists = await contentService.slugExists(finalSlug);
      if (slugExists) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A page with this slug already exists'
        });
      }
    }
    
    // Prepare metadata
    const metadata = {
      title,
      description: description || '',
      template: template || 'default',
      date: date || existingPage.metadata.date
    };
    
    const savedPage = await contentService.savePage(finalSlug, metadata, content);
    
    // If slug changed, delete the old page
    if (finalSlug !== slug) {
      await contentService.deletePage(slug);
    }
    
    const htmlContent = await markdownService.render(savedPage.content);
    const extractedMetadata = markdownService.extractMetadata(savedPage.content);
    
    const apiPage = {
      slug: savedPage.slug,
      title: savedPage.metadata.title,
      description: savedPage.metadata.description,
      content: savedPage.content,
      html: htmlContent,
      metadata: {
        ...savedPage.metadata,
        ...extractedMetadata
      },
      lastModified: savedPage.lastModified,
      url: `/${savedPage.slug}`
    };
    
    res.json({
      success: true,
      message: 'Page updated successfully',
      data: apiPage
    });
  } catch (error) {
    console.error('API error updating page:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update page'
    });
  }
});

/**
 * Delete a page (protected)
 */
router.delete('/pages/:slug', validateApiRequest, validateSlug, async (req, res) => {
  try {
    const { slug } = req.params;
    
    const page = await contentService.getPage(slug);
    if (!page) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Page "${slug}" not found`
      });
    }
    
    const deleted = await contentService.deletePage(slug);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Page deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete page'
      });
    }
  } catch (error) {
    console.error('API error deleting page:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete page'
    });
  }
});

// Search API endpoints

/**
 * Search content
 */
router.get('/search', validateSearch, async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 results
    const sortBy = req.query.sort || 'relevance';
    
    const searchResults = await searchService.search(query, {
      page,
      limit,
      sortBy,
      filters: {
        template: req.query.template,
        dateFrom: req.query.from,
        dateTo: req.query.to
      }
    });
    
    res.json({
      success: true,
      data: {
        query,
        results: searchResults.results,
        pagination: searchResults.pagination,
        searchTime: searchResults.searchTime,
        indexSize: searchResults.indexSize
      }
    });
  } catch (error) {
    console.error('API search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Search failed'
    });
  }
});

/**
 * Get search suggestions
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const suggestions = await searchService.getSuggestions(q, parseInt(limit) || 5);
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('API suggestions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get suggestions'
    });
  }
});

// Media API endpoints

/**
 * Get media files
 */
router.get('/media', validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items
    const search = req.query.search || '';
    const type = req.query.type || 'all';
    
    const result = await mediaService.listFiles({
      page,
      limit,
      search,
      type
    });
    
    res.json({
      success: true,
      data: {
        files: result.files,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('API error listing media:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve media files'
    });
  }
});

/**
 * Get media file info
 */
router.get('/media/:filename', validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    const fileInfo = await mediaService.getFileInfo(filename);
    
    if (!fileInfo) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'File not found'
      });
    }
    
    res.json({
      success: true,
      data: fileInfo
    });
  } catch (error) {
    console.error('API error getting file info:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get file info'
    });
  }
});

/**
 * Upload media files (protected)
 */
router.post('/media/upload', uploadLimiter, validateApiRequest, uploadSecurityCheck, async (req, res) => {
  try {
    const upload = mediaService.getMulterConfig();
    const uploadMultiple = upload.array('files', 10);
    
    uploadMultiple(req, res, async (err) => {
      if (err) {
        console.error('API upload error:', err);
        return res.status(400).json({
          error: 'Bad Request',
          message: err.message
        });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No files uploaded'
        });
      }
      
      const processedFiles = [];
      
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
            url: `/media/${file.filename}`,
            processed: processResult
          });
        } catch (processError) {
          console.error('Error processing file:', processError);
        }
      }
      
      res.status(201).json({
        success: true,
        message: `${processedFiles.length} file(s) uploaded successfully`,
        data: {
          files: processedFiles
        }
      });
    });
  } catch (error) {
    console.error('API upload handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Upload failed'
    });
  }
});

/**
 * Delete media file (protected)
 */
router.delete('/media/:filename', validateApiRequest, validateFilename, async (req, res) => {
  try {
    const { filename } = req.params;
    
    const fileInfo = await mediaService.getFileInfo(filename);
    if (!fileInfo) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'File not found'
      });
    }
    
    const deleted = await mediaService.deleteFile(filename);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete file'
      });
    }
  } catch (error) {
    console.error('API error deleting file:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete file'
    });
  }
});

// System API endpoints

/**
 * Get API status and system info
 */
router.get('/status', async (req, res) => {
  try {
    const searchStats = searchService.getStats();
    
    res.json({
      success: true,
      data: {
        status: 'operational',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        search: searchStats,
        endpoints: {
          pages: '/api/pages',
          search: '/api/search',
          media: '/api/media',
          status: '/api/status'
        }
      }
    });
  } catch (error) {
    console.error('API status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get system status'
    });
  }
});

// Error handling middleware for API routes
router.use((error, req, res, next) => {
  console.error('API Error:', error);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;