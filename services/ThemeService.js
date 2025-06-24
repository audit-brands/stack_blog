const fs = require('fs').promises;
const path = require('path');
const exphbs = require('express-handlebars');

class ThemeService {
  constructor(app) {
    this.app = app;
    this.themesPath = path.join(process.cwd(), 'themes');
    this.activeTheme = null;
    this.engine = 'nunjucks'; // default
    this.handlebarsEngine = null;
    
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

      // Ghost head helper (basic implementation)
      ghost_head: function() {
        const context = this;
        let html = '';
        
        // Basic meta tags
        if (context.page && context.page.metadata) {
          if (context.page.metadata.title) {
            html += `<meta property="og:title" content="${context.page.metadata.title}">\n`;
          }
          if (context.page.metadata.description) {
            html += `<meta property="og:description" content="${context.page.metadata.description}">\n`;
            html += `<meta name="description" content="${context.page.metadata.description}">\n`;
          }
        }
        
        // Canonical URL
        if (context.canonical) {
          html += `<link rel="canonical" href="${context.canonical}">\n`;
        }
        
        // Return safe string for Handlebars
        return { string: html };
      },

      // Ghost foot helper (basic implementation)
      ghost_foot: function() {
        // Basic analytics or tracking code can be added here
        return { string: '' };
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
        
        // Serve theme assets
        this.app.use(`/themes/${themeName}`, require('express').static(themePath));
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
              // Check for index.njk (Nunjucks theme)
              try {
                await fs.access(path.join(themePath, 'index.njk'));
                metadata.engine = 'nunjucks';
              } catch (error) {
                metadata.engine = 'unknown';
              }
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
        const template = await fs.readFile(templatePath, 'utf-8');
        const compiled = this.handlebarsEngine.handlebars.compile(template);
        return compiled(context);
      } catch (error) {
        console.error('Error rendering Handlebars template:', error);
        throw error;
      }
    }
    
    // Fall back to default Nunjucks rendering
    throw new Error('Nunjucks rendering not implemented in ThemeService');
  }
}

module.exports = ThemeService;