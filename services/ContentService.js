const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const config = require('../config/default');

class ContentService {
  constructor() {
    this.contentPath = config.paths.content;
  }

  /**
   * Get a page by its slug
   * @param {string} slug - The page slug (folder name)
   * @returns {Promise<Object|null>} Page object with metadata and content
   */
  async getPage(slug) {
    try {
      const pagePath = path.join(this.contentPath, slug, 'index.md');
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
   * @returns {Promise<Array>} Array of page objects
   */
  async listPages() {
    try {
      const entries = await fs.readdir(this.contentPath, { withFileTypes: true });
      const pages = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const page = await this.getPage(entry.name);
          if (page) {
            pages.push(page);
          }
        }
      }

      return pages;
    } catch (error) {
      console.error('Error listing pages:', error);
      return [];
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
    const pages = await this.listPages();
    
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