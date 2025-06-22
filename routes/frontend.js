const express = require('express');
const { contentService, markdownService } = require('../services');
const config = require('../config/default');

const router = express.Router();

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
    const htmlContent = markdownService.render(page.content);
    
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