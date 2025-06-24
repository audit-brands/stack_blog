const gscan = require('gscan');
const path = require('path');
const fs = require('fs').promises;

class ThemeValidationService {
  constructor() {
    this.validationCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Validate a Ghost theme using GScan
   */
  async validateTheme(themePath, themeName = null) {
    const cacheKey = `${themePath}-${await this.getThemeHash(themePath)}`;
    
    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
    }

    try {
      // Ensure theme path exists
      const stats = await fs.stat(themePath);
      if (!stats.isDirectory()) {
        throw new Error('Theme path is not a directory');
      }

      // Run GScan validation
      const result = await gscan.checkZip({
        path: themePath,
        name: themeName || path.basename(themePath)
      });

      // Process and enhance the result
      const processedResult = this.processGScanResult(result, themeName);
      
      // Cache the result
      this.validationCache.set(cacheKey, {
        result: processedResult,
        timestamp: Date.now()
      });

      return processedResult;
    } catch (error) {
      console.error('Theme validation error:', error);
      return {
        valid: false,
        errors: [{
          level: 'error',
          code: 'validation_failed',
          message: `Theme validation failed: ${error.message}`,
          rule: 'theme-validation'
        }],
        warnings: [],
        recommendations: [],
        summary: {
          valid: false,
          errorCount: 1,
          warningCount: 0,
          compatibility: 'unknown'
        }
      };
    }
  }

  /**
   * Process GScan result into a more usable format
   */
  processGScanResult(gscanResult, themeName) {
    const errors = [];
    const warnings = [];
    const recommendations = [];

    // Process results by type
    if (gscanResult.results) {
      if (gscanResult.results.error) {
        gscanResult.results.error.forEach(error => {
          errors.push({
            level: 'error',
            code: error.code || 'unknown_error',
            message: error.message || 'Unknown error',
            rule: error.rule || 'unknown',
            details: error.details || null,
            file: error.file || null,
            line: error.line || null
          });
        });
      }

      if (gscanResult.results.warning) {
        gscanResult.results.warning.forEach(warning => {
          warnings.push({
            level: 'warning',
            code: warning.code || 'unknown_warning',
            message: warning.message || 'Unknown warning',
            rule: warning.rule || 'unknown',
            details: warning.details || null,
            file: warning.file || null,
            line: warning.line || null
          });
        });
      }

      if (gscanResult.results.recommendation) {
        gscanResult.results.recommendation.forEach(rec => {
          recommendations.push({
            level: 'recommendation',
            code: rec.code || 'unknown_recommendation',
            message: rec.message || 'Unknown recommendation',
            rule: rec.rule || 'unknown',
            details: rec.details || null
          });
        });
      }
    }

    // Determine overall validity and compatibility
    const valid = errors.length === 0;
    const compatibility = this.determineCompatibility(gscanResult, errors, warnings);

    return {
      valid,
      errors,
      warnings,
      recommendations,
      summary: {
        valid,
        errorCount: errors.length,
        warningCount: warnings.length,
        recommendationCount: recommendations.length,
        compatibility,
        ghostVersion: gscanResult.version || 'unknown',
        themeName: themeName || 'unknown'
      },
      gscanVersion: gscan.version || 'unknown',
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Determine theme compatibility level
   */
  determineCompatibility(gscanResult, errors, warnings) {
    if (errors.length === 0) {
      if (warnings.length === 0) {
        return 'excellent';
      } else if (warnings.length <= 3) {
        return 'good';
      } else {
        return 'fair';
      }
    } else if (errors.length <= 2) {
      return 'poor';
    } else {
      return 'incompatible';
    }
  }

  /**
   * Get theme compatibility report for Stack Blog
   */
  async getStackBlogCompatibility(themePath, themeName = null) {
    const validation = await this.validateTheme(themePath, themeName);
    
    // Stack Blog specific compatibility checks
    const stackBlogChecks = await this.performStackBlogChecks(themePath);
    
    return {
      ...validation,
      stackBlogCompatibility: {
        ...stackBlogChecks,
        overall: this.calculateStackBlogCompatibility(validation, stackBlogChecks)
      }
    };
  }

  /**
   * Perform Stack Blog specific compatibility checks
   */
  async performStackBlogChecks(themePath) {
    const checks = {
      hasPackageJson: false,
      hasIndexTemplate: false,
      hasPostTemplate: false,
      usesGhostHelpers: false,
      hasAssets: false,
      hasPartials: false,
      filesSupported: [],
      filesUnsupported: []
    };

    try {
      // Check for package.json
      try {
        await fs.access(path.join(themePath, 'package.json'));
        checks.hasPackageJson = true;
      } catch (error) {
        // Not required for Stack Blog
      }

      // Check for required templates
      try {
        await fs.access(path.join(themePath, 'index.hbs'));
        checks.hasIndexTemplate = true;
        checks.filesSupported.push('index.hbs');
      } catch (error) {
        checks.filesUnsupported.push('index.hbs');
      }

      try {
        await fs.access(path.join(themePath, 'post.hbs'));
        checks.hasPostTemplate = true;
        checks.filesSupported.push('post.hbs');
      } catch (error) {
        checks.filesUnsupported.push('post.hbs');
      }

      // Check for assets directory
      try {
        const assetsPath = path.join(themePath, 'assets');
        const assetsStats = await fs.stat(assetsPath);
        if (assetsStats.isDirectory()) {
          checks.hasAssets = true;
          checks.filesSupported.push('assets/');
        }
      } catch (error) {
        checks.filesUnsupported.push('assets/');
      }

      // Check for partials directory
      try {
        const partialsPath = path.join(themePath, 'partials');
        const partialsStats = await fs.stat(partialsPath);
        if (partialsStats.isDirectory()) {
          checks.hasPartials = true;
          checks.filesSupported.push('partials/');
        }
      } catch (error) {
        // Not required
      }

      // Check for Ghost helpers usage
      checks.usesGhostHelpers = await this.checkForGhostHelpers(themePath);

    } catch (error) {
      console.error('Error performing Stack Blog checks:', error);
    }

    return checks;
  }

  /**
   * Check if theme uses Ghost helpers
   */
  async checkForGhostHelpers(themePath) {
    const ghostHelpers = [
      'foreach', 'asset', 'ghost_head', 'ghost_foot', 
      'navigation', 'pagination', 'has', 'is', 'date'
    ];

    try {
      const files = await this.getAllTemplateFiles(themePath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Check for Ghost helpers in the template
        for (const helper of ghostHelpers) {
          const helperRegex = new RegExp(`{{#?${helper}[\\s}]`, 'i');
          if (helperRegex.test(content)) {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking for Ghost helpers:', error);
    }

    return false;
  }

  /**
   * Get all template files in a theme
   */
  async getAllTemplateFiles(themePath, files = []) {
    try {
      const entries = await fs.readdir(themePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(themePath, entry.name);
        
        if (entry.isDirectory() && !['node_modules', '.git', 'assets'].includes(entry.name)) {
          await this.getAllTemplateFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.hbs')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Error reading template files:', error);
    }

    return files;
  }

  /**
   * Calculate overall Stack Blog compatibility
   */
  calculateStackBlogCompatibility(validation, stackBlogChecks) {
    let score = 100;
    
    // Deduct points for GScan issues
    score -= validation.summary.errorCount * 15;
    score -= validation.summary.warningCount * 5;
    
    // Deduct points for missing Stack Blog requirements
    if (!stackBlogChecks.hasIndexTemplate) score -= 20;
    if (!stackBlogChecks.hasPostTemplate) score -= 15;
    if (!stackBlogChecks.hasAssets) score -= 10;
    if (!stackBlogChecks.usesGhostHelpers) score -= 10;
    
    // Ensure minimum score
    score = Math.max(0, score);
    
    // Convert to compatibility level
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'incompatible';
  }

  /**
   * Get a simple hash of theme files for caching
   */
  async getThemeHash(themePath) {
    try {
      const stats = await fs.stat(themePath);
      return stats.mtime.getTime().toString();
    } catch (error) {
      return Date.now().toString();
    }
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.validationCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }

  /**
   * Validate multiple themes in batch
   */
  async validateThemes(themePaths) {
    const results = {};
    
    // Validate themes in parallel with limited concurrency
    const concurrency = 3;
    const chunks = [];
    for (let i = 0; i < themePaths.length; i += concurrency) {
      chunks.push(themePaths.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (themePath) => {
        const themeName = path.basename(themePath);
        try {
          const result = await this.getStackBlogCompatibility(themePath, themeName);
          return { themeName, result };
        } catch (error) {
          return { 
            themeName, 
            result: { 
              valid: false, 
              error: error.message 
            } 
          };
        }
      });

      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(({ themeName, result }) => {
        results[themeName] = result;
      });
    }

    return results;
  }
}

module.exports = ThemeValidationService;