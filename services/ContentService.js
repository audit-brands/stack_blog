const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const config = require('../config/default');

class ContentService {
  constructor(cacheService = null) {
    this.contentPath = config.paths.content;
    this.cache = cacheService;
  }

  /**
   * Get a page by its slug
   * @param {string} slug - The page slug (folder name)
   * @returns {Promise<Object|null>} Page object with metadata and content
   */
  async getPage(slug) {
    try {
      const pagePath = path.join(this.contentPath, slug, 'index.md');
      
      // Use cache if available
      if (this.cache) {
        return await this.cache.cacheContent(pagePath, async () => {
          return await this._loadPage(slug, pagePath);
        });
      }
      
      return await this._loadPage(slug, pagePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Internal method to load page from disk
   */
  async _loadPage(slug, pagePath) {
    try {
      const fileContent = await fs.readFile(pagePath, 'utf-8');
      const { data, content } = matter(fileContent);
      
      return {
        slug,
        path: pagePath,
        metadata: data,
        content,
        exists: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all pages from the content directory
   * @param {Object} options - Options for listing pages
   * @param {number} options.page - Page number for pagination
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search term
   * @returns {Promise<Object>} Object with pages array and pagination info
   */
  async listPages(options = {}) {
    try {
      const { page = 1, limit = 10, search = '' } = options;
      const entries = await fs.readdir(this.contentPath, { withFileTypes: true });
      const allPages = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pageData = await this.getPage(entry.name);
          if (pageData) {
            // Add file stats for sorting
            const filePath = path.join(this.contentPath, entry.name, 'index.md');
            try {
              const stats = await fs.stat(filePath);
              pageData.lastModified = stats.mtime;
              pageData.created = stats.birthtime;
            } catch (statError) {
              pageData.lastModified = new Date();
              pageData.created = new Date();
            }
            allPages.push(pageData);
          }
        }
      }

      // Filter pages based on search term
      let filteredPages = allPages;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPages = allPages.filter(page => {
          const title = (page.metadata.title || '').toLowerCase();
          const content = (page.content || '').toLowerCase();
          const slug = (page.slug || '').toLowerCase();
          return title.includes(searchLower) || 
                 content.includes(searchLower) || 
                 slug.includes(searchLower);
        });
      }

      // Sort by last modified date (newest first)
      filteredPages.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      // Calculate pagination
      const total = filteredPages.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedPages = filteredPages.slice(offset, offset + limit);

      return {
        pages: paginatedPages,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        }
      };
    } catch (error) {
      console.error('Error listing pages:', error);
      return {
        pages: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          total: 0,
          limit,
          hasNext: false,
          hasPrev: false,
          nextPage: null,
          prevPage: null
        }
      };
    }
  }

  /**
   * Save a page (create or update)
   * @param {string} slug - The page slug
   * @param {Object} metadata - The page frontmatter data
   * @param {string} content - The markdown content
   * @returns {Promise<Object>} The saved page object
   */
  async savePage(slug, metadata, content) {
    try {
      const pagePath = path.join(this.contentPath, slug);
      const filePath = path.join(pagePath, 'index.md');

      // Ensure directory exists
      await fs.mkdir(pagePath, { recursive: true });

      // Ensure metadata has required fields
      if (!metadata.title) {
        throw new Error('Page title is required');
      }

      // Add default metadata if not present
      metadata.date = metadata.date || new Date().toISOString().split('T')[0];
      metadata.template = metadata.template || config.content.defaultTemplate;

      // Create file content with frontmatter
      const fileContent = matter.stringify(content, metadata);

      // Write file
      await fs.writeFile(filePath, fileContent, 'utf-8');

      // Invalidate cache for this page and page listings
      if (this.cache) {
        this.cache.invalidatePattern(`.*${slug}.*`);
        this.cache.invalidatePattern('.*listPages.*');
      }

      return await this.getPage(slug);
    } catch (error) {
      console.error('Error saving page:', error);
      throw error;
    }
  }

  /**
   * Delete a page
   * @param {string} slug - The page slug to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deletePage(slug) {
    try {
      const pagePath = path.join(this.contentPath, slug);
      
      // Check if directory exists
      const stats = await fs.stat(pagePath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Remove directory and all contents
      await fs.rm(pagePath, { recursive: true, force: true });
      
      // Invalidate cache for this page and page listings
      if (this.cache) {
        this.cache.invalidatePattern(`.*${slug}.*`);
        this.cache.invalidatePattern('.*listPages.*');
      }
      
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a slug from a title
   * @param {string} title - The page title
   * @returns {string} URL-safe slug
   */
  createSlug(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Check if a slug already exists
   * @param {string} slug - The slug to check
   * @returns {Promise<boolean>} True if exists
   */
  async slugExists(slug) {
    try {
      const pagePath = path.join(this.contentPath, slug);
      const stats = await fs.stat(pagePath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get page hierarchy (for navigation)
   * @returns {Promise<Object>} Nested page structure
   */
  async getPageHierarchy() {
    const result = await this.listPages({ limit: 1000 }); // Get all pages
    const pages = result.pages;
    
    // Sort pages by title
    pages.sort((a, b) => {
      const titleA = a.metadata.title || a.slug;
      const titleB = b.metadata.title || b.slug;
      return titleA.localeCompare(titleB);
    });

    return pages;
  }
}

module.exports = ContentService;