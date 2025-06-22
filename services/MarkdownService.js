const MarkdownIt = require('markdown-it');

class MarkdownService {
  constructor(cacheService = null, pluginService = null, options = {}) {
    this.cache = cacheService;
    this.plugins = pluginService;
    
    // Initialize markdown-it with sensible defaults
    this.md = new MarkdownIt({
      html: true,           // Enable HTML tags in source
      linkify: true,        // Autoconvert URL-like text to links
      typographer: true,    // Enable smartquotes and other typographic replacements
      breaks: true,         // Convert '\n' in paragraphs into <br>
      ...options
    });

    // Add any custom plugins or rules here
    this.setupPlugins();
  }

  /**
   * Set up markdown-it plugins
   */
  setupPlugins() {
    // Example: Add custom container plugin for callouts
    // this.md.use(require('markdown-it-container'), 'callout');
    
    // Add anchor links to headings
    this.md.renderer.rules.heading_open = (tokens, idx, options, env, renderer) => {
      const token = tokens[idx];
      const nextToken = tokens[idx + 1];
      
      if (nextToken && nextToken.type === 'inline') {
        const slug = this.createSlug(nextToken.content);
        token.attrSet('id', slug);
      }
      
      return renderer.renderToken(tokens, idx, options);
    };
  }

  /**
   * Convert markdown to HTML
   * @param {string} markdown - The markdown content
   * @returns {string} HTML output
   */
  async render(markdown) {
    if (!markdown) return '';
    
    // Execute before render hook
    if (this.plugins) {
      const hookData = await this.plugins.beforeMarkdownRender(markdown);
      markdown = hookData.markdown || markdown;
    }
    
    let html;
    
    // Use cache if available
    if (this.cache) {
      const cacheKey = this.cache.generateKey(`markdown:${markdown}`);
      html = await this.cache.cached(cacheKey, () => {
        return this.md.render(markdown);
      }, 10 * 60 * 1000); // 10 minutes TTL for rendered markdown
    } else {
      html = this.md.render(markdown);
    }
    
    // Execute after render hook
    if (this.plugins) {
      html = await this.plugins.afterMarkdownRender(html, markdown);
    }
    
    return html;
  }

  /**
   * Parse markdown without rendering (for analysis)
   * @param {string} markdown - The markdown content
   * @returns {Array} Array of tokens
   */
  parse(markdown) {
    if (!markdown) return [];
    return this.md.parse(markdown, {});
  }

  /**
   * Extract metadata from markdown content
   * @param {string} markdown - The markdown content
   * @returns {Object} Extracted metadata
   */
  extractMetadata(markdown) {
    const tokens = this.parse(markdown);
    const metadata = {
      headings: [],
      images: [],
      links: [],
      wordCount: 0,
      readingTime: 0
    };

    // Extract headings
    let headingLevel = 0;
    tokens.forEach((token, idx) => {
      if (token.type === 'heading_open') {
        headingLevel = parseInt(token.tag.substr(1));
      } else if (token.type === 'inline' && headingLevel > 0) {
        metadata.headings.push({
          level: headingLevel,
          text: token.content,
          slug: this.createSlug(token.content)
        });
        headingLevel = 0;
      }
    });

    // Extract text content for word count
    const textContent = markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`.*?`/g, '')          // Remove inline code
      .replace(/!?\[.*?\]\(.*?\)/g, '') // Remove links and images
      .replace(/[#*_~`]/g, '')        // Remove markdown syntax
      .trim();

    // Calculate word count and reading time
    metadata.wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    metadata.readingTime = Math.ceil(metadata.wordCount / 200); // 200 words per minute

    return metadata;
  }

  /**
   * Create a URL-safe slug from text
   * @param {string} text - The text to slugify
   * @returns {string} URL-safe slug
   */
  createSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Render a preview of markdown content
   * @param {string} markdown - The markdown content
   * @param {number} length - Maximum length of preview
   * @returns {string} Plain text preview
   */
  renderPreview(markdown, length = 160) {
    if (!markdown) return '';

    // Strip markdown syntax and HTML
    const plainText = markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`.*?`/g, '')          // Remove inline code
      .replace(/!?\[.*?\]\(.*?\)/g, '') // Remove links and images
      .replace(/[#*_~`]/g, '')        // Remove markdown syntax
      .replace(/<[^>]*>/g, '')        // Remove HTML tags
      .replace(/\n+/g, ' ')           // Replace newlines with spaces
      .trim();

    // Truncate and add ellipsis if needed
    if (plainText.length <= length) {
      return plainText;
    }

    return plainText.substr(0, length).trim() + '...';
  }
}

module.exports = MarkdownService;