const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes default TTL
    this.maxCacheSize = 100; // Maximum number of cached items
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.enabled = process.env.NODE_ENV !== 'test'; // Disable in tests
    
    // Start cleanup interval
    if (this.enabled) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute
    }
  }

  /**
   * Generate cache key from input data
   */
  generateKey(data) {
    if (typeof data === 'string') {
      return crypto.createHash('md5').update(data).digest('hex');
    }
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Set cache value with TTL
   */
  set(key, value, ttl = this.cacheTTL) {
    if (!this.enabled) return;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const expiry = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiry,
      created: Date.now(),
      accessed: Date.now(),
      hits: 0
    });
  }

  /**
   * Get cache value
   */
  get(key) {
    if (!this.enabled) return null;

    const item = this.cache.get(key);
    
    if (!item) {
      this.cacheMisses++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }

    // Update access statistics
    item.accessed = Date.now();
    item.hits++;
    this.cacheHits++;

    return item.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    if (!this.enabled) return false;

    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      return false;
    }
    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    if (!this.enabled) return false;
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    if (!this.enabled) return;
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Cache a function result
   */
  async cached(key, fn, ttl = this.cacheTTL) {
    if (!this.enabled) {
      return await fn();
    }

    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Cache content with file modification time check
   */
  async cacheContent(filePath, fn, ttl = this.cacheTTL) {
    if (!this.enabled) {
      return await fn();
    }

    try {
      const stats = await fs.stat(filePath);
      const mtime = stats.mtime.getTime();
      const key = this.generateKey(`${filePath}:${mtime}`);

      const cached = this.get(key);
      if (cached !== null) {
        return cached;
      }

      const result = await fn();
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      // If we can't stat the file, just execute the function
      return await fn();
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern) {
    if (!this.enabled) return;

    const regex = new RegExp(pattern);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    if (!this.enabled) return;

    const now = Date.now();
    const expiredKeys = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(2) : 0;

    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
      ttl: this.cacheTTL,
      entries: Array.from(this.cache.entries()).map(([key, item]) => ({
        key: key.substring(0, 16) + '...',
        created: new Date(item.created).toISOString(),
        accessed: new Date(item.accessed).toISOString(),
        hits: item.hits,
        expiresIn: Math.max(0, item.expiry - Date.now())
      }))
    };
  }

  /**
   * Preload content cache
   */
  async preloadContent(contentPath) {
    if (!this.enabled) return;

    try {
      const entries = await fs.readdir(contentPath, { withFileTypes: true });
      const preloadPromises = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const indexPath = path.join(contentPath, entry.name, 'index.md');
          
          preloadPromises.push(
            this.cacheContent(indexPath, async () => {
              try {
                const content = await fs.readFile(indexPath, 'utf-8');
                return { content, preloaded: true };
              } catch (error) {
                return null;
              }
            })
          );
        }
      }

      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.warn('Cache preload failed:', error.message);
    }
  }

  /**
   * Middleware for Express to add cache headers
   */
  middleware(options = {}) {
    const {
      maxAge = 300, // 5 minutes
      cacheControl = 'public',
      etag = true
    } = options;

    return (req, res, next) => {
      if (!this.enabled) {
        return next();
      }

      // Add cache headers for static content
      if (req.method === 'GET' && !req.path.startsWith('/admin')) {
        res.set({
          'Cache-Control': `${cacheControl}, max-age=${maxAge}`,
          'X-Cache': 'MISS'
        });

        if (etag) {
          const originalSend = res.send;
          res.send = function(body) {
            if (typeof body === 'string') {
              const hash = crypto.createHash('md5').update(body).digest('hex');
              res.set('ETag', `"${hash}"`);
              
              if (req.headers['if-none-match'] === `"${hash}"`) {
                res.status(304).end();
                return;
              }
            }
            originalSend.call(this, body);
          };
        }
      }

      next();
    };
  }

  /**
   * Destroy cache service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

module.exports = CacheService;