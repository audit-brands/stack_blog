class PerformanceService {
  constructor() {
    this.metrics = {
      requests: new Map(),
      templateRenders: new Map(),
      cacheOperations: new Map(),
      themeOperations: new Map()
    };
    
    this.benchmarks = {
      templateRendering: [],
      contextGeneration: [],
      themeValidation: [],
      cacheOperations: []
    };
    
    this.enabled = process.env.NODE_ENV === 'development' || process.env.PERFORMANCE_MONITORING === 'true';
    this.maxMetricsSize = 1000; // Maximum number of metrics to store
  }

  /**
   * Start a performance measurement
   */
  startMeasurement(operation, context = {}) {
    if (!this.enabled) return null;

    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const measurement = {
      id,
      operation,
      context,
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage(),
      timestamp: new Date()
    };

    return measurement;
  }

  /**
   * End a performance measurement
   */
  endMeasurement(measurement, result = null) {
    if (!this.enabled || !measurement) return null;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const completed = {
      ...measurement,
      endTime,
      endMemory,
      duration: Number(endTime - measurement.startTime) / 1e6, // Convert to milliseconds
      memoryDelta: {
        rss: endMemory.rss - measurement.startMemory.rss,
        heapUsed: endMemory.heapUsed - measurement.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - measurement.startMemory.heapTotal,
        external: endMemory.external - measurement.startMemory.external
      },
      result: result ? this.sanitizeResult(result) : null
    };

    this.recordMetric(completed);
    return completed;
  }

  /**
   * Measure an async operation
   */
  async measureAsync(operation, fn, context = {}) {
    const measurement = this.startMeasurement(operation, context);
    try {
      const result = await fn();
      this.endMeasurement(measurement, { success: true, resultSize: this.getResultSize(result) });
      return result;
    } catch (error) {
      this.endMeasurement(measurement, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync(operation, fn, context = {}) {
    const measurement = this.startMeasurement(operation, context);
    try {
      const result = fn();
      this.endMeasurement(measurement, { success: true, resultSize: this.getResultSize(result) });
      return result;
    } catch (error) {
      this.endMeasurement(measurement, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(measurement) {
    if (!this.enabled) return;

    const { operation } = measurement;
    
    // Store in appropriate metric collection
    if (operation.includes('template')) {
      this.addToCollection(this.metrics.templateRenders, measurement);
    } else if (operation.includes('cache')) {
      this.addToCollection(this.metrics.cacheOperations, measurement);
    } else if (operation.includes('theme')) {
      this.addToCollection(this.metrics.themeOperations, measurement);
    } else {
      this.addToCollection(this.metrics.requests, measurement);
    }

    // Add to benchmarks for analysis
    this.addToBenchmark(operation, measurement);
  }

  /**
   * Benchmark theme rendering performance
   */
  async benchmarkThemeRendering(themeName, sampleSize = 10) {
    if (!this.enabled) return null;

    const { getThemeService, ghostContextService } = require('./index');
    const themeService = getThemeService();
    
    if (!themeService) {
      throw new Error('Theme service not available');
    }

    const results = [];
    const sampleContent = this.generateSampleContent(sampleSize);

    for (let i = 0; i < sampleSize; i++) {
      const measurement = this.startMeasurement('benchmark_theme_rendering', {
        theme: themeName,
        iteration: i + 1,
        contentSize: sampleContent[i].content.length
      });

      try {
        // Generate Ghost context
        const contextStart = process.hrtime.bigint();
        const context = await ghostContextService.generateContext({
          page: sampleContent[i],
          pages: sampleContent,
          baseUrl: 'http://localhost:3000',
          contextType: 'post',
          config: { title: 'Benchmark Blog' }
        });
        const contextTime = Number(process.hrtime.bigint() - contextStart) / 1e6;

        // Render template
        const renderStart = process.hrtime.bigint();
        const rendered = await themeService.renderTemplate('post', context, 'handlebars');
        const renderTime = Number(process.hrtime.bigint() - renderStart) / 1e6;

        const completed = this.endMeasurement(measurement, {
          success: true,
          contextTime,
          renderTime,
          outputSize: rendered.length
        });

        results.push(completed);
      } catch (error) {
        this.endMeasurement(measurement, { success: false, error: error.message });
      }
    }

    return this.analyzeBenchmarkResults(results, 'theme_rendering');
  }

  /**
   * Benchmark template caching performance
   */
  async benchmarkTemplateCache(operations = 100) {
    if (!this.enabled) return null;

    const { templateCacheService } = require('./index');
    const results = [];

    // Test cache misses (cold cache)
    templateCacheService.clearAll();
    for (let i = 0; i < operations; i++) {
      const measurement = await this.measureAsync(
        'benchmark_cache_miss',
        () => templateCacheService.getTemplate(`/fake/path/template${i % 10}.hbs`).catch(() => null),
        { iteration: i + 1, type: 'miss' }
      );
      results.push(measurement);
    }

    // Test cache hits (warm cache)
    for (let i = 0; i < operations; i++) {
      const measurement = await this.measureAsync(
        'benchmark_cache_hit',
        () => templateCacheService.getCachedHelper('test', [i], () => `result${i}`),
        { iteration: i + 1, type: 'hit' }
      );
      results.push(measurement);
    }

    return this.analyzeBenchmarkResults(results, 'template_cache');
  }

  /**
   * Get performance statistics
   */
  getStats() {
    if (!this.enabled) {
      return { enabled: false, message: 'Performance monitoring is disabled' };
    }

    const stats = {
      enabled: true,
      timestamp: new Date(),
      metrics: {
        requests: this.getCollectionStats(this.metrics.requests),
        templateRenders: this.getCollectionStats(this.metrics.templateRenders),
        cacheOperations: this.getCollectionStats(this.metrics.cacheOperations),
        themeOperations: this.getCollectionStats(this.metrics.themeOperations)
      },
      benchmarks: {
        templateRendering: this.getBenchmarkSummary('templateRendering'),
        contextGeneration: this.getBenchmarkSummary('contextGeneration'),
        themeValidation: this.getBenchmarkSummary('themeValidation'),
        cacheOperations: this.getBenchmarkSummary('cacheOperations')
      },
      systemInfo: this.getSystemInfo()
    };

    return stats;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const stats = this.getStats();
    
    if (!stats.enabled) {
      return stats;
    }

    const report = {
      ...stats,
      recommendations: this.generateRecommendations(stats),
      alerts: this.generateAlerts(stats)
    };

    return report;
  }

  /**
   * Clear all performance data
   */
  clearStats() {
    this.metrics = {
      requests: new Map(),
      templateRenders: new Map(),
      cacheOperations: new Map(),
      themeOperations: new Map()
    };
    
    this.benchmarks = {
      templateRendering: [],
      contextGeneration: [],
      themeValidation: [],
      cacheOperations: []
    };
  }

  // Private methods

  addToCollection(collection, measurement) {
    collection.set(measurement.id, measurement);
    
    // Maintain size limit
    if (collection.size > this.maxMetricsSize) {
      const oldestKey = collection.keys().next().value;
      collection.delete(oldestKey);
    }
  }

  addToBenchmark(operation, measurement) {
    const category = this.categorizeBenchmark(operation);
    if (category && this.benchmarks[category]) {
      this.benchmarks[category].push(measurement);
      
      // Maintain size limit
      if (this.benchmarks[category].length > this.maxMetricsSize) {
        this.benchmarks[category].shift();
      }
    }
  }

  categorizeBenchmark(operation) {
    if (operation.includes('template') || operation.includes('render')) {
      return 'templateRendering';
    } else if (operation.includes('context')) {
      return 'contextGeneration';
    } else if (operation.includes('validation')) {
      return 'themeValidation';
    } else if (operation.includes('cache')) {
      return 'cacheOperations';
    }
    return null;
  }

  getCollectionStats(collection) {
    if (collection.size === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 };
    }

    const durations = Array.from(collection.values()).map(m => m.duration);
    return {
      count: collection.size,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0)
    };
  }

  getBenchmarkSummary(category) {
    const benchmarks = this.benchmarks[category];
    if (!benchmarks || benchmarks.length === 0) {
      return { count: 0 };
    }

    const durations = benchmarks.map(b => b.duration);
    const memoryUsage = benchmarks.map(b => b.memoryDelta.heapUsed);
    
    return {
      count: benchmarks.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      avgMemoryDelta: memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length,
      lastUpdated: new Date(Math.max(...benchmarks.map(b => b.timestamp)))
    };
  }

  analyzeBenchmarkResults(results, type) {
    const durations = results.map(r => r.duration);
    const successRate = results.filter(r => r.result?.success).length / results.length;
    
    return {
      type,
      totalOperations: results.length,
      successRate,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      timestamp: new Date()
    };
  }

  generateSampleContent(size) {
    const samples = [];
    for (let i = 0; i < size; i++) {
      samples.push({
        slug: `sample-post-${i}`,
        content: 'Sample content '.repeat(100 + (i * 10)),
        metadata: {
          title: `Sample Post ${i}`,
          description: `Description for sample post ${i}`,
          author: 'Benchmark User',
          date: new Date(Date.now() - (i * 86400000)).toISOString(),
          tags: ['sample', 'benchmark', `tag${i % 5}`]
        }
      });
    }
    return samples;
  }

  generateRecommendations(stats) {
    const recommendations = [];
    
    // Template rendering performance
    if (stats.metrics.templateRenders.avgDuration > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Template rendering is slower than optimal. Consider enabling template caching.',
        action: 'Enable production caching or optimize templates'
      });
    }

    // Cache hit rate
    if (stats.metrics.cacheOperations.count > 0) {
      // This would need cache hit rate calculation
      recommendations.push({
        type: 'caching',
        priority: 'low',
        message: 'Monitor cache hit rates for optimal performance.',
        action: 'Review cache configuration and TTL settings'
      });
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'High memory usage detected. Consider optimizing or scaling.',
        action: 'Review memory usage patterns and optimize code'
      });
    }

    return recommendations;
  }

  generateAlerts(stats) {
    const alerts = [];
    
    // High average response time
    if (stats.metrics.requests.avgDuration > 1000) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `Average request time is ${stats.metrics.requests.avgDuration.toFixed(2)}ms`,
        threshold: 1000,
        current: stats.metrics.requests.avgDuration
      });
    }

    // Very high response time
    if (stats.metrics.requests.maxDuration > 5000) {
      alerts.push({
        type: 'performance',
        severity: 'critical',
        message: `Maximum request time exceeded 5 seconds: ${stats.metrics.requests.maxDuration.toFixed(2)}ms`,
        threshold: 5000,
        current: stats.metrics.requests.maxDuration
      });
    }

    return alerts;
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (index % 1 === 0) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index % 1);
    }
  }

  sanitizeResult(result) {
    if (typeof result === 'string' && result.length > 1000) {
      return { type: 'string', length: result.length, preview: result.substring(0, 100) + '...' };
    }
    if (typeof result === 'object' && result !== null) {
      return { type: 'object', keys: Object.keys(result) };
    }
    return result;
  }

  getResultSize(result) {
    if (typeof result === 'string') {
      return result.length;
    }
    if (typeof result === 'object' && result !== null) {
      return JSON.stringify(result).length;
    }
    return 0;
  }

  getSystemInfo() {
    const memUsage = process.memoryUsage();
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      uptime: Math.round(process.uptime())
    };
  }
}

module.exports = PerformanceService;