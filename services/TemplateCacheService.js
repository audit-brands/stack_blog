const fs = require('fs').promises;
const path = require('path');

class TemplateCacheService {
  constructor() {
    this.templateCache = new Map();
    this.helperCache = new Map();
    this.partialCache = new Map();
    this.compiledTemplateCache = new Map();
    
    // Cache configuration
    this.maxCacheSize = 100; // Maximum number of cached items
    this.defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.enabled = process.env.NODE_ENV === 'production';
    
    // Performance tracking
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0,
      evictions: 0
    };
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clearAll();
    }
  }

  /**
   * Get template content with caching
   */
  async getTemplate(templatePath, forceRefresh = false) {
    if (!this.enabled && !forceRefresh) {
      return await this.readTemplateFile(templatePath);
    }

    const cacheKey = this.getCacheKey(templatePath);
    
    if (!forceRefresh && this.templateCache.has(cacheKey)) {
      const cached = this.templateCache.get(cacheKey);
      if (this.isValidCacheEntry(cached)) {
        this.stats.hits++;
        this.updateAccessTime(this.templateCache, cacheKey);
        return cached.content;
      } else {
        this.templateCache.delete(cacheKey);
      }
    }

    // Cache miss - read from file
    this.stats.misses++;
    const content = await this.readTemplateFile(templatePath);
    
    if (this.enabled) {
      this.cacheTemplate(cacheKey, content, templatePath);
    }
    
    return content;
  }

  /**
   * Get compiled template with caching
   */
  async getCompiledTemplate(templatePath, compiler, forceRefresh = false) {
    if (!this.enabled && !forceRefresh) {
      const content = await this.getTemplate(templatePath, forceRefresh);
      this.stats.compilations++;
      return compiler(content);
    }

    const cacheKey = `compiled:${this.getCacheKey(templatePath)}`;
    
    if (!forceRefresh && this.compiledTemplateCache.has(cacheKey)) {
      const cached = this.compiledTemplateCache.get(cacheKey);
      if (this.isValidCacheEntry(cached)) {
        this.stats.hits++;
        this.updateAccessTime(this.compiledTemplateCache, cacheKey);
        return cached.content;
      } else {
        this.compiledTemplateCache.delete(cacheKey);
      }
    }

    // Cache miss - compile template
    this.stats.misses++;
    this.stats.compilations++;
    
    const templateContent = await this.getTemplate(templatePath, forceRefresh);
    const compiled = compiler(templateContent);
    
    if (this.enabled) {
      this.cacheCompiledTemplate(cacheKey, compiled, templatePath);
    }
    
    return compiled;
  }

  /**
   * Get partial template with caching
   */
  async getPartial(partialName, partialsDir, forceRefresh = false) {
    const partialPath = path.join(partialsDir, `${partialName}.hbs`);
    
    if (!this.enabled && !forceRefresh) {
      return await this.readTemplateFile(partialPath);
    }

    const cacheKey = `partial:${this.getCacheKey(partialPath)}`;
    
    if (!forceRefresh && this.partialCache.has(cacheKey)) {
      const cached = this.partialCache.get(cacheKey);
      if (this.isValidCacheEntry(cached)) {
        this.stats.hits++;
        this.updateAccessTime(this.partialCache, cacheKey);
        return cached.content;
      } else {
        this.partialCache.delete(cacheKey);
      }
    }

    // Cache miss - read partial
    this.stats.misses++;
    const content = await this.readTemplateFile(partialPath);
    
    if (this.enabled) {
      this.cachePartial(cacheKey, content, partialPath);
    }
    
    return content;
  }

  /**
   * Cache helper function results
   */
  getCachedHelper(helperName, args, fn, ttl = this.defaultTTL) {
    if (!this.enabled) {
      return fn();
    }

    const cacheKey = `helper:${helperName}:${this.hashArgs(args)}`;
    
    if (this.helperCache.has(cacheKey)) {
      const cached = this.helperCache.get(cacheKey);
      if (this.isValidCacheEntry(cached)) {
        this.stats.hits++;
        this.updateAccessTime(this.helperCache, cacheKey);
        return cached.content;
      } else {
        this.helperCache.delete(cacheKey);
      }
    }

    // Cache miss - execute helper
    this.stats.misses++;
    const result = fn();
    
    this.cacheHelper(cacheKey, result, ttl);
    return result;
  }

  /**
   * Invalidate templates for a specific theme
   */
  invalidateTheme(themeName) {
    const themePrefix = `theme:${themeName}:`;
    
    this.invalidateCacheByPrefix(this.templateCache, themePrefix);
    this.invalidateCacheByPrefix(this.compiledTemplateCache, themePrefix);
    this.invalidateCacheByPrefix(this.partialCache, themePrefix);
  }

  /**
   * Invalidate specific template
   */
  invalidateTemplate(templatePath) {
    const cacheKey = this.getCacheKey(templatePath);
    const compiledKey = `compiled:${cacheKey}`;
    
    this.templateCache.delete(cacheKey);
    this.compiledTemplateCache.delete(compiledKey);
  }

  /**
   * Preload templates for a theme
   */
  async preloadTheme(themePath, themeName) {
    if (!this.enabled) {
      return;
    }

    try {
      const templates = await this.findTemplateFiles(themePath);
      const preloadPromises = templates.map(async (templateFile) => {
        try {
          await this.getTemplate(templateFile);
        } catch (error) {
          console.warn(`Failed to preload template ${templateFile}:`, error.message);
        }
      });

      await Promise.all(preloadPromises);
      console.log(`Preloaded ${templates.length} templates for theme ${themeName}`);
    } catch (error) {
      console.error(`Error preloading theme ${themeName}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: {
        templates: this.templateCache.size,
        compiled: this.compiledTemplateCache.size,
        partials: this.partialCache.size,
        helpers: this.helperCache.size,
        total: this.templateCache.size + this.compiledTemplateCache.size + 
               this.partialCache.size + this.helperCache.size
      },
      enabled: this.enabled,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.templateCache.clear();
    this.compiledTemplateCache.clear();
    this.partialCache.clear();
    this.helperCache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0,
      evictions: 0
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpired() {
    const now = Date.now();
    let cleared = 0;

    const clearExpiredFromCache = (cache) => {
      for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) {
          cache.delete(key);
          cleared++;
        }
      }
    };

    clearExpiredFromCache(this.templateCache);
    clearExpiredFromCache(this.compiledTemplateCache);
    clearExpiredFromCache(this.partialCache);
    clearExpiredFromCache(this.helperCache);

    return cleared;
  }

  // Private methods

  async readTemplateFile(templatePath) {
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template not found: ${templatePath}`);
      }
      throw error;
    }
  }

  getCacheKey(templatePath) {
    // Create a cache key that includes file modification time for invalidation
    const relativePath = path.relative(process.cwd(), templatePath);
    return `template:${relativePath}`;
  }

  async getFileModTime(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime.getTime();
    } catch (error) {
      return 0;
    }
  }

  cacheTemplate(cacheKey, content, templatePath) {
    this.ensureCacheSpace(this.templateCache);
    
    this.templateCache.set(cacheKey, {
      content,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.defaultTTL,
      accessedAt: Date.now(),
      filePath: templatePath
    });
  }

  cacheCompiledTemplate(cacheKey, compiled, templatePath) {
    this.ensureCacheSpace(this.compiledTemplateCache);
    
    this.compiledTemplateCache.set(cacheKey, {
      content: compiled,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.defaultTTL,
      accessedAt: Date.now(),
      filePath: templatePath
    });
  }

  cachePartial(cacheKey, content, partialPath) {
    this.ensureCacheSpace(this.partialCache);
    
    this.partialCache.set(cacheKey, {
      content,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.defaultTTL,
      accessedAt: Date.now(),
      filePath: partialPath
    });
  }

  cacheHelper(cacheKey, result, ttl) {
    this.ensureCacheSpace(this.helperCache);
    
    this.helperCache.set(cacheKey, {
      content: result,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessedAt: Date.now()
    });
  }

  ensureCacheSpace(cache) {
    if (cache.size >= this.maxCacheSize) {
      // Remove oldest entries (LRU)
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].accessedAt - b[1].accessedAt);
      
      const toRemove = Math.floor(this.maxCacheSize * 0.2); // Remove 20%
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
        this.stats.evictions++;
      }
    }
  }

  isValidCacheEntry(entry) {
    return Date.now() < entry.expiresAt;
  }

  updateAccessTime(cache, cacheKey) {
    const entry = cache.get(cacheKey);
    if (entry) {
      entry.accessedAt = Date.now();
    }
  }

  invalidateCacheByPrefix(cache, prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  hashArgs(args) {
    // Simple hash function for arguments
    return JSON.stringify(args).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash; // Convert to 32bit integer
    }, 0).toString();
  }

  async findTemplateFiles(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
          await this.findTemplateFiles(fullPath, files);
        } else if (entry.isFile() && (entry.name.endsWith('.hbs') || entry.name.endsWith('.html'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${dir}:`, error.message);
    }
    
    return files;
  }
}

module.exports = TemplateCacheService;