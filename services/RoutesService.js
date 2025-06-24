const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class RoutesService {
  constructor() {
    this.routes = null;
    this.collections = {};
    this.redirects = {};
  }

  /**
   * Load and parse routes.yaml from active theme
   */
  async loadRoutes(themePath) {
    try {
      const routesPath = path.join(themePath, 'routes.yaml');
      
      // Check if routes.yaml exists
      try {
        await fs.access(routesPath);
      } catch (error) {
        // No routes.yaml file - use defaults
        this.routes = this.getDefaultRoutes();
        return this.routes;
      }

      const routesContent = await fs.readFile(routesPath, 'utf-8');
      const parsedRoutes = yaml.load(routesContent);
      
      this.routes = this.processRoutes(parsedRoutes);
      return this.routes;
    } catch (error) {
      console.error('Error loading routes.yaml:', error);
      this.routes = this.getDefaultRoutes();
      return this.routes;
    }
  }

  /**
   * Process and validate routes configuration
   */
  processRoutes(routesConfig) {
    const processed = {
      routes: {},
      collections: {},
      taxonomies: {}
    };

    // Process routes section
    if (routesConfig.routes) {
      for (const [pattern, config] of Object.entries(routesConfig.routes)) {
        processed.routes[pattern] = this.processRoute(pattern, config);
      }
    }

    // Process collections section
    if (routesConfig.collections) {
      for (const [path, config] of Object.entries(routesConfig.collections)) {
        processed.collections[path] = this.processCollection(path, config);
      }
    }

    // Process taxonomies section
    if (routesConfig.taxonomies) {
      processed.taxonomies = routesConfig.taxonomies;
    }

    return processed;
  }

  /**
   * Process individual route configuration
   */
  processRoute(pattern, config) {
    if (typeof config === 'string') {
      // Simple template assignment
      return {
        template: config,
        controller: 'page'
      };
    }

    return {
      template: config.template || 'index',
      controller: config.controller || 'page',
      filter: config.filter || null,
      data: config.data || null
    };
  }

  /**
   * Process collection configuration
   */
  processCollection(path, config) {
    return {
      permalink: config.permalink || `/${path}/{slug}/`,
      template: config.template || 'post',
      filter: config.filter || null,
      data: config.data || null,
      sort: config.sort || '-published_at',
      limit: config.limit || null
    };
  }

  /**
   * Get default routes configuration
   */
  getDefaultRoutes() {
    return {
      routes: {
        '/': {
          template: 'index',
          controller: 'index'
        },
        '/page/{page}/': {
          template: 'index',
          controller: 'index'
        }
      },
      collections: {
        '/': {
          permalink: '/{slug}/',
          template: 'post'
        }
      },
      taxonomies: {
        tag: '/tag/{slug}/',
        author: '/author/{slug}/'
      }
    };
  }

  /**
   * Match a URL path against routes
   */
  matchRoute(urlPath) {
    if (!this.routes) {
      return null;
    }

    // Remove trailing slash for matching
    const cleanPath = urlPath === '/' ? '/' : urlPath.replace(/\/$/, '');

    // Check exact routes first
    for (const [pattern, config] of Object.entries(this.routes.routes)) {
      const match = this.matchPattern(cleanPath, pattern);
      if (match) {
        return {
          type: 'route',
          template: config.template,
          controller: config.controller,
          params: match.params,
          config: config
        };
      }
    }

    // Check collection routes
    for (const [collectionPath, config] of Object.entries(this.routes.collections)) {
      const permalink = config.permalink;
      const match = this.matchPattern(cleanPath, permalink);
      if (match) {
        return {
          type: 'collection',
          template: config.template,
          controller: 'post',
          params: match.params,
          config: config
        };
      }
    }

    // Check taxonomy routes
    if (this.routes.taxonomies) {
      for (const [taxonomy, pattern] of Object.entries(this.routes.taxonomies)) {
        const match = this.matchPattern(cleanPath, pattern);
        if (match) {
          return {
            type: 'taxonomy',
            taxonomy: taxonomy,
            template: `tag`, // Default template for taxonomies
            controller: 'tag',
            params: match.params,
            config: { taxonomy }
          };
        }
      }
    }

    return null;
  }

  /**
   * Match URL pattern with parameters
   */
  matchPattern(path, pattern) {
    // Convert Ghost pattern to regex
    // {slug} -> ([^/]+)
    // {page} -> (\d+)
    // {year} -> (\d{4})
    // {month} -> (\d{2})
    // {day} -> (\d{2})
    
    const paramNames = [];
    let regexPattern = pattern.replace(/\{([^}]+)\}/g, (match, paramName) => {
      paramNames.push(paramName);
      
      switch (paramName) {
        case 'page':
          return '(\\d+)';
        case 'year':
          return '(\\d{4})';
        case 'month':
          return '(\\d{2})';
        case 'day':
          return '(\\d{2})';
        case 'slug':
        default:
          return '([^/]+)';
      }
    });

    // Escape special regex characters except our patterns
    regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regexPattern = regexPattern.replace(/\\([()])/g, '$1'); // Unescape our capture groups
    
    // Make sure pattern matches exactly
    regexPattern = `^${regexPattern}$`;
    
    const regex = new RegExp(regexPattern);
    const match = path.match(regex);
    
    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      
      return { params };
    }
    
    return null;
  }

  /**
   * Generate URL for a post/page based on routes
   */
  generateUrl(type, data) {
    if (!this.routes) {
      return `/${data.slug}/`;
    }

    switch (type) {
      case 'post':
        // Find matching collection
        for (const [collectionPath, config] of Object.entries(this.routes.collections)) {
          const permalink = config.permalink;
          return this.interpolatePermalink(permalink, data);
        }
        return `/${data.slug}/`;

      case 'tag':
        const tagPattern = this.routes.taxonomies?.tag || '/tag/{slug}/';
        return this.interpolatePermalink(tagPattern, data);

      case 'author':
        const authorPattern = this.routes.taxonomies?.author || '/author/{slug}/';
        return this.interpolatePermalink(authorPattern, data);

      default:
        return `/${data.slug}/`;
    }
  }

  /**
   * Interpolate permalink pattern with data
   */
  interpolatePermalink(pattern, data) {
    return pattern.replace(/\{([^}]+)\}/g, (match, paramName) => {
      switch (paramName) {
        case 'slug':
          return data.slug || '';
        case 'year':
          return data.published_at ? new Date(data.published_at).getFullYear() : new Date().getFullYear();
        case 'month':
          return data.published_at ? 
            String(new Date(data.published_at).getMonth() + 1).padStart(2, '0') : 
            String(new Date().getMonth() + 1).padStart(2, '0');
        case 'day':
          return data.published_at ? 
            String(new Date(data.published_at).getDate()).padStart(2, '0') : 
            String(new Date().getDate()).padStart(2, '0');
        case 'id':
          return data.id || '';
        default:
          return data[paramName] || '';
      }
    });
  }

  /**
   * Get routes configuration for debugging
   */
  getRoutes() {
    return this.routes;
  }

  /**
   * Validate routes.yaml syntax
   */
  async validateRoutes(themePath) {
    try {
      const routesPath = path.join(themePath, 'routes.yaml');
      
      try {
        await fs.access(routesPath);
      } catch (error) {
        return { valid: true, message: 'No routes.yaml file found - using defaults' };
      }

      const routesContent = await fs.readFile(routesPath, 'utf-8');
      const parsedRoutes = yaml.load(routesContent);
      
      // Basic validation
      const errors = [];
      
      if (parsedRoutes.routes) {
        for (const [pattern, config] of Object.entries(parsedRoutes.routes)) {
          if (!pattern.startsWith('/')) {
            errors.push(`Route pattern "${pattern}" must start with /`);
          }
        }
      }
      
      if (parsedRoutes.collections) {
        for (const [path, config] of Object.entries(parsedRoutes.collections)) {
          if (!config.permalink) {
            errors.push(`Collection "${path}" must have a permalink`);
          }
        }
      }
      
      if (errors.length > 0) {
        return { valid: false, errors };
      }
      
      return { valid: true, message: 'Routes configuration is valid' };
    } catch (error) {
      return { 
        valid: false, 
        errors: [`YAML parsing error: ${error.message}`] 
      };
    }
  }
}

module.exports = RoutesService;