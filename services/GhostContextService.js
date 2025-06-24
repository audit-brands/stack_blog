const path = require('path');

class GhostContextService {
  constructor(contentService, markdownService) {
    this.contentService = contentService;
    this.markdownService = markdownService;
  }

  /**
   * Convert Stack Blog page to Ghost post format
   */
  async pageToPost(page, baseUrl = '') {
    if (!page) return null;

    // Generate excerpt if not provided
    const metadata = page.metadata || {};
    let excerpt = metadata.description || metadata.excerpt;
    if (!excerpt && page.content) {
      excerpt = this.markdownService.renderPreview(page.content, 160);
    }

    // Convert Stack Blog page to Ghost post structure
    const post = {
      // Core fields
      id: this.generateId(page.slug),
      uuid: this.generateUuid(page.slug),
      title: metadata.title || 'Untitled',
      slug: page.slug,
      url: `${baseUrl}/${page.slug}`,
      
      // Content
      html: await this.markdownService.render(page.content),
      content: await this.markdownService.render(page.content), // Ghost uses 'content' in some contexts
      plaintext: this.markdownService.renderPreview(page.content, 500),
      excerpt: excerpt,
      
      // Metadata
      meta_title: metadata.meta_title || metadata.title,
      meta_description: metadata.meta_description || excerpt,
      
      // Dates
      created_at: this.parseDate(metadata.date) || new Date(),
      updated_at: page.lastModified || new Date(),
      published_at: this.parseDate(metadata.date) || new Date(),
      
      // Status
      status: metadata.status || 'published',
      visibility: metadata.visibility || 'public',
      featured: metadata.featured || false,
      
      // Authors (simplified - single author)
      authors: [{
        id: 1,
        name: metadata.author || 'Admin',
        slug: this.slugify(metadata.author || 'admin'),
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        accessibility: null,
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        url: `${baseUrl}/author/${this.slugify(metadata.author || 'admin')}/`
      }],
      
      // Tags
      tags: this.parseTags(metadata.tags, baseUrl),
      
      // Images
      feature_image: metadata.feature_image || metadata.image || null,
      feature_image_alt: metadata.feature_image_alt || null,
      feature_image_caption: metadata.feature_image_caption || null,
      
      // Reading time
      reading_time: this.calculateReadingTime(page.content),
      
      // Template
      custom_template: metadata.template !== 'default' ? metadata.template : null,
      
      // Additional metadata for helpers
      comment_id: this.generateId(page.slug),
      canonical_url: metadata.canonical_url || null
    };

    return post;
  }

  /**
   * Convert multiple pages to Ghost posts array
   */
  async pagesToPosts(pages, baseUrl = '') {
    const posts = [];
    for (const page of pages) {
      const post = await this.pageToPost(page, baseUrl);
      if (post) {
        posts.push(post);
      }
    }
    return posts;
  }

  /**
   * Generate Ghost-style pagination object
   */
  generatePagination(currentPage, totalPages, baseUrl = '', pathPrefix = '') {
    if (totalPages <= 1) return null;

    const pagination = {
      page: currentPage,
      pages: totalPages,
      limit: 10, // TODO: Make configurable
      total: totalPages * 10, // Approximation
      
      // URLs
      next: currentPage < totalPages ? `${baseUrl}${pathPrefix}/page/${currentPage + 1}/` : null,
      prev: currentPage > 1 ? (currentPage === 2 ? `${baseUrl}${pathPrefix}/` : `${baseUrl}${pathPrefix}/page/${currentPage - 1}/`) : null
    };

    return pagination;
  }

  /**
   * Generate Ghost-style site context
   */
  generateSiteContext(config = {}) {
    return {
      '@site': {
        title: config.title || 'Stack Blog',
        description: config.description || 'A flat-file CMS built with Node.js',
        url: config.url || 'http://localhost:3000',
        logo: config.logo || null,
        icon: config.icon || null,
        cover_image: config.cover_image || null,
        
        // Social
        facebook: config.facebook || null,
        twitter: config.twitter || null,
        
        // Settings
        lang: config.lang || 'en',
        timezone: config.timezone || 'UTC',
        codeinjection_head: config.codeinjection_head || null,
        codeinjection_foot: config.codeinjection_foot || null,
        
        // Navigation (basic implementation)
        navigation: config.navigation || [
          { label: 'Home', url: '/' },
          { label: 'About', url: '/about' },
          { label: 'Blog', url: '/blog' }
        ],
        
        // Secondary navigation
        secondary_navigation: config.secondary_navigation || []
      }
    };
  }

  /**
   * Generate complete Ghost template context
   */
  async generateContext(options = {}) {
    const {
      page,
      pages = [],
      currentPage = 1,
      totalPages = 1,
      baseUrl = '',
      pathPrefix = '',
      config = {},
      contextType = 'index', // index, post, page, tag, author
      tag = null,
      author = null
    } = options;

    // Base context
    const context = {
      ...this.generateSiteContext(config)
    };

    // Add posts if we have multiple pages
    if (pages && pages.length > 0) {
      context.posts = await this.pagesToPosts(pages, baseUrl);
      
      // Sort posts by published date (newest first) for index contexts
      if (contextType === 'index' || contextType === 'tag' || contextType === 'author') {
        context.posts.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      }
    }

    // Add current post/page
    if (page) {
      const post = await this.pageToPost(page, baseUrl);
      context.post = post;
      context.page = post; // Some themes use 'page' instead of 'post'
    }

    // Add pagination with enhanced metadata
    const pagination = this.generatePagination(currentPage, totalPages, baseUrl, pathPrefix);
    if (pagination) {
      context.pagination = pagination;
      
      // Add page numbers array for pagination helpers
      context.pagination.page_numbers = [];
      for (let i = 1; i <= totalPages; i++) {
        context.pagination.page_numbers.push({
          page: i,
          url: i === 1 ? `${baseUrl}${pathPrefix}/` : `${baseUrl}${pathPrefix}/page/${i}/`,
          current: i === currentPage
        });
      }
    }

    // Add context-specific variables and data
    context.context = [contextType];
    
    // Add tag context for tag pages
    if (contextType === 'tag' && tag) {
      context.tag = {
        id: this.generateId(tag),
        name: tag,
        slug: this.slugify(tag),
        description: `Posts tagged with ${tag}`,
        feature_image: null,
        visibility: 'public',
        url: `${baseUrl}/tag/${this.slugify(tag)}/`,
        count: { posts: pages ? pages.length : 0 }
      };
    }

    // Add author context for author pages
    if (contextType === 'author' && author) {
      context.author = {
        id: this.generateId(author),
        name: author,
        slug: this.slugify(author),
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        profile_image: null,
        cover_image: null,
        url: `${baseUrl}/author/${this.slugify(author)}/`,
        count: { posts: pages ? pages.length : 0 }
      };
    }

    // Add template helpers context
    context.canonical = page ? `${baseUrl}/${page.slug}` : baseUrl;
    
    // Add metadata for ghost_head helper
    context.meta_title = this.generateMetaTitle(contextType, page, tag, author, config);
    context.meta_description = this.generateMetaDescription(contextType, page, tag, author, config);
    
    // Add JSON-LD structured data
    context.structured_data = this.generateStructuredData(context, contextType, baseUrl);

    return context;
  }

  /**
   * Generate meta title for different context types
   */
  generateMetaTitle(contextType, page, tag, author, config) {
    const siteTitle = config.title || 'Stack Blog';
    
    switch (contextType) {
      case 'post':
      case 'page':
        return page?.metadata?.meta_title || page?.metadata?.title || siteTitle;
      case 'tag':
        return tag ? `${tag} - ${siteTitle}` : siteTitle;
      case 'author':
        return author ? `${author} - ${siteTitle}` : siteTitle;
      default:
        return siteTitle;
    }
  }

  /**
   * Generate meta description for different context types
   */
  generateMetaDescription(contextType, page, tag, author, config) {
    const siteDescription = config.description || 'A flat-file CMS built with Node.js';
    
    switch (contextType) {
      case 'post':
      case 'page':
        return page?.metadata?.meta_description || page?.metadata?.description || siteDescription;
      case 'tag':
        return tag ? `Posts tagged with ${tag}` : siteDescription;
      case 'author':
        return author ? `Posts by ${author}` : siteDescription;
      default:
        return siteDescription;
    }
  }

  /**
   * Generate JSON-LD structured data
   */
  generateStructuredData(context, contextType, baseUrl) {
    const site = context['@site'];
    
    const baseStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.title,
      description: site.description,
      url: baseUrl,
      publisher: {
        '@type': 'Organization',
        name: site.title,
        url: baseUrl
      }
    };

    if (contextType === 'post' && context.post) {
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: context.post.title,
        description: context.post.excerpt,
        url: context.post.url,
        datePublished: context.post.published_at,
        dateModified: context.post.updated_at,
        author: {
          '@type': 'Person',
          name: context.post.authors[0]?.name
        },
        publisher: baseStructuredData.publisher,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': context.post.url
        }
      };
    }

    return baseStructuredData;
  }

  /**
   * Parse tags from various formats
   */
  parseTags(tags, baseUrl = '') {
    if (!tags) return [];

    let tagArray = [];
    if (typeof tags === 'string') {
      tagArray = tags.split(',').map(tag => tag.trim());
    } else if (Array.isArray(tags)) {
      tagArray = tags;
    }

    return tagArray.map((tag, index) => ({
      id: index + 1,
      name: tag,
      slug: this.slugify(tag),
      description: null,
      feature_image: null,
      visibility: 'public',
      og_image: null,
      og_title: null,
      og_description: null,
      twitter_image: null,
      twitter_title: null,
      twitter_description: null,
      meta_title: null,
      meta_description: null,
      codeinjection_head: null,
      codeinjection_foot: null,
      canonical_url: null,
      accent_color: null,
      created_at: new Date(),
      updated_at: new Date(),
      url: `${baseUrl}/tag/${this.slugify(tag)}/`
    }));
  }

  /**
   * Calculate reading time in minutes
   */
  calculateReadingTime(content) {
    if (!content) return 0;
    
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Parse date from various formats
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Generate numeric ID from slug
   */
  generateId(slug) {
    if (!slug) return 1;
    
    // Simple hash function to generate consistent numeric ID
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      const char = slug.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate UUID from slug (simple implementation)
   */
  generateUuid(slug) {
    const id = this.generateId(slug);
    return `${id.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;
  }

  /**
   * Create URL-safe slug
   */
  slugify(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = GhostContextService;