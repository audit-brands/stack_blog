const express = require('express');
const { contentService, markdownService, searchService } = require('../services');
const config = require('../config/default');

const router = express.Router();

/**
 * Search page route
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const sortBy = req.query.sort || 'relevance';
    
    const searchResults = await searchService.search(query, {
      page,
      limit: 10,
      sortBy,
      filters: {
        template: req.query.template,
        dateFrom: req.query.from,
        dateTo: req.query.to
      }
    });
    
    res.render('search', {
      page: {
        metadata: {
          title: query ? `Search Results for "${query}"` : 'Search'
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'A flat-file CMS built with Node.js'
      },
      search: {
        query,
        results: searchResults.results,
        pagination: searchResults.pagination,
        searchTime: searchResults.searchTime,
        total: searchResults.pagination.total
      },
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error performing search:', error);
    next(error);
  }
});

/**
 * Search suggestions API endpoint
 */
router.get('/api/search/suggestions', async (req, res) => {
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
      error: 'Failed to get suggestions'
    });
  }
});

/**
 * Dynamic route handler for content pages
 * Maps URLs to content files in the content directory
 */
router.use(async (req, res, next) => {
  // Only handle GET requests for HTML content
  if (req.method !== 'GET') {
    return next();
  }
  try {
    // Get the page slug from the URL path
    let slug = req.path === '/' ? config.content.homeSlug : req.path.substring(1);
    
    // Remove trailing slash if present
    if (slug.endsWith('/')) {
      slug = slug.slice(0, -1);
    }

    // Handle nested paths (convert to folder structure)
    // e.g., /blog/my-post -> blog/my-post
    slug = slug.replace(/\//g, '/');

    // Try to get the page from content service
    const page = await contentService.getPage(slug);
    
    if (!page) {
      // Page not found, pass to 404 handler
      return next();
    }

    // Render the markdown content to HTML
    const htmlContent = await markdownService.render(page.content);
    
    // Extract metadata for additional template data
    const contentMetadata = markdownService.extractMetadata(page.content);
    
    // Determine which template to use
    const template = page.metadata.template || config.content.defaultTemplate;
    
    // Prepare data for template rendering
    const templateData = {
      page: {
        ...page,
        content: htmlContent,
        metadata: {
          ...page.metadata,
          ...contentMetadata
        }
      },
      site: {
        title: 'Stack Blog',
        description: 'A flat-file CMS built with Node.js'
      },
      currentPath: req.path
    };

    // Render the page using the template engine
    res.render(template, templateData);
    
  } catch (error) {
    console.error('Error rendering page:', error);
    next(error);
  }
});

module.exports = router;