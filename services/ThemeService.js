const fs = require('fs').promises;
const path = require('path');
const exphbs = require('express-handlebars');

class ThemeService {
  constructor(app, templateCacheService = null) {
    this.app = app;
    this.themesPath = path.join(process.cwd(), 'themes');
    this.activeTheme = null;
    this.engine = 'handlebars'; // default
    this.handlebarsEngine = null;
    this.templateCacheService = templateCacheService;
    
    // Initialize themes directory
    this.initializeThemesDirectory();
  }

  /**
   * Initialize themes directory structure
   */
  async initializeThemesDirectory() {
    try {
      await fs.mkdir(this.themesPath, { recursive: true });
      
      // Create default theme directory structure
      const defaultThemePath = path.join(this.themesPath, 'default');
      await fs.mkdir(defaultThemePath, { recursive: true });
      await fs.mkdir(path.join(defaultThemePath, 'assets'), { recursive: true });
      await fs.mkdir(path.join(defaultThemePath, 'partials'), { recursive: true });
      
      console.log('Themes directory initialized');
    } catch (error) {
      console.error('Error initializing themes directory:', error);
    }
  }

  /**
   * Configure Handlebars engine for Ghost themes
   */
  configureHandlebarsEngine() {
    if (this.handlebarsEngine) return this.handlebarsEngine;

    const activeThemePath = this.getActiveThemePath();
    const partialsDir = activeThemePath ? path.join(activeThemePath, 'partials') : path.join(this.themesPath, 'default', 'partials');

    // Create Handlebars instance with Ghost-compatible helpers
    this.handlebarsEngine = exphbs.create({
      defaultLayout: false, // We'll handle layouts manually
      extname: '.hbs',
      partialsDir: partialsDir,
      helpers: this.getGhostHelpers(),
      runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
      }
    });

    return this.handlebarsEngine;
  }

  /**
   * Basic Ghost helpers implementation
   */
  getGhostHelpers() {
    return {
      // Basic foreach helper (enhanced version of Handlebars each)
      foreach: function(context, options) {
        if (!context || !Array.isArray(context) || context.length === 0) {
          return options.inverse(this);
        }

        let result = '';
        for (let i = 0; i < context.length; i++) {
          const item = context[i];
          const data = {
            ...options.data,
            index: i,
            first: i === 0,
            last: i === context.length - 1,
            length: context.length
          };
          
          result += options.fn(item, { data });
        }
        return result;
      },

      // Asset helper for theme assets
      asset: function(path, options) {
        const hash = options && options.hash;
        const isMinified = process.env.NODE_ENV === 'production';
        
        // Add .min to asset path in production if available
        if (isMinified && !path.includes('.min.')) {
          const ext = path.substring(path.lastIndexOf('.'));
          const name = path.substring(0, path.lastIndexOf('.'));
          const minPath = `${name}.min${ext}`;
          // TODO: Check if minified version exists
          path = minPath;
        }
        
        return `/themes/${this.activeTheme}/assets/${path}`;
      }.bind(this),

      // Basic if/unless helpers (enhanced)
      if: function(conditional, options) {
        if (conditional) {
          return options.fn(this);
        }
        return options.inverse(this);
      },

      unless: function(conditional, options) {
        if (!conditional) {
          return options.fn(this);
        }
        return options.inverse(this);
      },

      // Enhanced ghost_head helper
      ghost_head: function() {
        const context = this;
        let html = '';
        
        // Title and description
        if (context.meta_title) {
          html += `<title>${context.meta_title}</title>\n`;
          html += `<meta property="og:title" content="${context.meta_title}">\n`;
          html += `<meta name="twitter:title" content="${context.meta_title}">\n`;
        }
        
        if (context.meta_description) {
          html += `<meta name="description" content="${context.meta_description}">\n`;
          html += `<meta property="og:description" content="${context.meta_description}">\n`;
          html += `<meta name="twitter:description" content="${context.meta_description}">\n`;
        }
        
        // Canonical URL
        if (context.canonical) {
          html += `<link rel="canonical" href="${context.canonical}">\n`;
          html += `<meta property="og:url" content="${context.canonical}">\n`;
        }
        
        // Site info
        if (context['@site']) {
          html += `<meta property="og:site_name" content="${context['@site'].title}">\n`;
          html += `<meta name="twitter:site" content="@${context['@site'].twitter || context['@site'].title}">\n`;
        }
        
        // Article specific meta for posts
        if (context.post) {
          html += `<meta property="og:type" content="article">\n`;
          html += `<meta property="article:published_time" content="${context.post.published_at}">\n`;
          html += `<meta property="article:modified_time" content="${context.post.updated_at}">\n`;
          
          if (context.post.authors && context.post.authors[0]) {
            html += `<meta property="article:author" content="${context.post.authors[0].name}">\n`;
          }
          
          if (context.post.tags) {
            context.post.tags.forEach(tag => {
              html += `<meta property="article:tag" content="${tag.name}">\n`;
            });
          }
          
          if (context.post.feature_image) {
            html += `<meta property="og:image" content="${context.post.feature_image}">\n`;
            html += `<meta name="twitter:image" content="${context.post.feature_image}">\n`;
          }
        } else {
          html += `<meta property="og:type" content="website">\n`;
        }
        
        // Twitter card type
        html += `<meta name="twitter:card" content="summary_large_image">\n`;
        
        // JSON-LD structured data
        if (context.structured_data) {
          html += `<script type="application/ld+json">\n${JSON.stringify(context.structured_data, null, 2)}\n</script>\n`;
        }
        
        // Generator meta
        html += `<meta name="generator" content="Stack Blog CMS">\n`;
        
        // Return safe string for Handlebars
        return { string: html };
      },

      // Enhanced ghost_foot helper
      ghost_foot: function() {
        const context = this;
        let html = '';
        
        // Site-level code injection
        if (context['@site'] && context['@site'].codeinjection_foot) {
          html += context['@site'].codeinjection_foot;
        }
        
        // Post-level code injection
        if (context.post && context.post.codeinjection_foot) {
          html += context.post.codeinjection_foot;
        }
        
        return { string: html };
      },

      // Navigation helper
      navigation: function(options) {
        const context = this;
        const navigation = context['@site']?.navigation || [];
        
        if (!navigation.length) {
          return options.inverse(this);
        }
        
        let result = '';
        navigation.forEach((item, index) => {
          const data = {
            ...options.data,
            index,
            first: index === 0,
            last: index === navigation.length - 1,
            current: context.canonical && item.url && context.canonical.includes(item.url)
          };
          
          result += options.fn(item, { data });
        });
        
        return result;
      },

      // Pagination helper
      pagination: function(options) {
        const context = this;
        const pagination = context.pagination;
        
        if (!pagination || pagination.pages <= 1) {
          return options.inverse(this);
        }
        
        return options.fn(pagination);
      },

      // Has helper for checking properties
      has: function(value, options) {
        const context = this;
        
        // Check for context flags
        if (typeof value === 'string') {
          if (value === 'tag' && context.tag) return options.fn(this);
          if (value === 'author' && context.author) return options.fn(this);
          if (value === 'pagination' && context.pagination) return options.fn(this);
          if (value === 'feature_image' && (context.post?.feature_image || context.page?.feature_image)) return options.fn(this);
          if (value === 'excerpt' && (context.post?.excerpt || context.page?.excerpt)) return options.fn(this);
        }
        
        return options.inverse(this);
      },

      // Is helper for context checking
      is: function(value, options) {
        const context = this;
        
        if (typeof value === 'string') {
          if (context.context && context.context.includes(value)) {
            return options.fn(this);
          }
        }
        
        return options.inverse(this);
      },

      // Date helper for formatting dates
      date: function(date, format, options) {
        if (!date) return '';
        
        const d = new Date(date);
        
        // Simple format mappings
        switch (format) {
          case 'YYYY':
            return d.getFullYear().toString();
          case 'MM':
            return (d.getMonth() + 1).toString().padStart(2, '0');
          case 'DD':
            return d.getDate().toString().padStart(2, '0');
          case 'MMMM':
            return d.toLocaleString('en-US', { month: 'long' });
          case 'MMM':
            return d.toLocaleString('en-US', { month: 'short' });
          case 'YYYY-MM-DD':
            return d.toISOString().split('T')[0];
          default:
            return d.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
        }
      },

      // Excerpt helper
      excerpt: function(options) {
        const context = this;
        const length = options.hash?.words || 50;
        
        let text = '';
        if (context.excerpt) {
          text = context.excerpt;
        } else if (context.html) {
          // Strip HTML and get first words
          text = context.html.replace(/<[^>]*>/g, '');
        }
        
        if (!text) return '';
        
        const words = text.split(' ');
        if (words.length <= length) return text;
        
        return words.slice(0, length).join(' ') + '...';
      }
    };
  }

  /**
   * Set active theme
   */
  async setActiveTheme(themeName, engine = 'handlebars') {
    try {
      const themePath = path.join(this.themesPath, themeName);
      const themeExists = await this.themeExists(themeName);
      
      if (!themeExists) {
        throw new Error(`Theme '${themeName}' not found`);
      }

      this.activeTheme = themeName;
      this.engine = engine;

      if (engine === 'handlebars') {
        // Configure Handlebars engine
        this.configureHandlebarsEngine();
        
        // Set Express to use Handlebars for this theme
        this.app.engine('hbs', this.handlebarsEngine.engine);
        this.app.set('view engine', 'hbs');
        this.app.set('views', themePath);
        
        // Preload theme templates if caching is enabled
        if (this.templateCacheService) {
          this.templateCacheService.preloadTheme(themePath, themeName);
        }
      }

      console.log(`Active theme set to '${themeName}' using ${engine} engine`);
      return true;
    } catch (error) {
      console.error('Error setting active theme:', error);
      return false;
    }
  }

  /**
   * Check if theme exists
   */
  async themeExists(themeName) {
    try {
      const themePath = path.join(this.themesPath, themeName);
      const stats = await fs.stat(themePath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get active theme path
   */
  getActiveThemePath() {
    if (!this.activeTheme) return null;
    return path.join(this.themesPath, this.activeTheme);
  }

  /**
   * Get current engine
   */
  getCurrentEngine() {
    return this.engine;
  }

  /**
   * List available themes
   */
  async listThemes() {
    try {
      const entries = await fs.readdir(this.themesPath, { withFileTypes: true });
      const themes = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const themePath = path.join(this.themesPath, entry.name);
          
          // Check for theme metadata
          let metadata = { name: entry.name, engine: 'unknown' };
          
          try {
            // Check for package.json (Ghost theme)
            const packageJsonPath = path.join(themePath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            if (packageJson.engines && packageJson.engines.ghost) {
              metadata.engine = 'ghost';
              metadata.version = packageJson.version;
              metadata.description = packageJson.description;
            }
          } catch (error) {
            // Check for index.hbs (Handlebars theme)
            try {
              await fs.access(path.join(themePath, 'index.hbs'));
              metadata.engine = 'handlebars';
            } catch (error) {
              // No Nunjucks support - mark as unknown
              metadata.engine = 'unknown';
            }
          }
          
          themes.push(metadata);
        }
      }

      return themes;
    } catch (error) {
      console.error('Error listing themes:', error);
      return [];
    }
  }

  /**
   * Render template with appropriate engine
   */
  async renderTemplate(templateName, context, engine = null) {
    const currentEngine = engine || this.engine;
    
    if (currentEngine === 'handlebars' && this.handlebarsEngine) {
      const templatePath = path.join(this.getActiveThemePath(), `${templateName}.hbs`);
      
      try {
        if (this.templateCacheService) {
          // Use cached compiled template
          const compiled = await this.templateCacheService.getCompiledTemplate(
            templatePath,
            (content) => this.handlebarsEngine.handlebars.compile(content)
          );
          return compiled(context);
        } else {
          // Direct compilation without caching
          const template = await fs.readFile(templatePath, 'utf-8');
          const compiled = this.handlebarsEngine.handlebars.compile(template);
          return compiled(context);
        }
      } catch (error) {
        console.error('Error rendering Handlebars template:', error);
        throw error;
      }
    }
    
    // Only Handlebars rendering is supported
    throw new Error('Only Handlebars (.hbs) templates are supported. Nunjucks support has been removed.');
  }

  /**
   * Set template cache service
   */
  setTemplateCacheService(templateCacheService) {
    this.templateCacheService = templateCacheService;
  }

  /**
   * Clear template cache for current theme
   */
  clearTemplateCache() {
    if (this.templateCacheService && this.activeTheme) {
      this.templateCacheService.invalidateTheme(this.activeTheme);
    }
  }

  /**
   * Get template cache statistics
   */
  getTemplateCacheStats() {
    if (this.templateCacheService) {
      return this.templateCacheService.getStats();
    }
    return null;
  }
}

module.exports = ThemeService;