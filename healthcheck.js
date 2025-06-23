const http = require('http');

/**
 * Health check script for Stack Blog
 * Used by Docker and monitoring systems to verify application health
 */

const config = {
  host: process.env.HEALTH_CHECK_HOST || 'localhost',
  port: process.env.PORT || 3000,
  path: process.env.HEALTH_CHECK_PATH || '/api/status',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
};

function performHealthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: config.path,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'StackBlog-HealthCheck/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.success && response.data.status === 'operational') {
              resolve({
                status: 'healthy',
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                data: response.data
              });
            } else {
              reject(new Error(`Service not operational: ${JSON.stringify(response)}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Health check timeout after ${config.timeout}ms`));
    });

    const startTime = Date.now();
    req.end();
  });
}

// Advanced health checks
async function performAdvancedChecks() {
  const checks = {
    api: false,
    disk: false,
    memory: false
  };

  // Check API endpoint
  try {
    await performHealthCheck();
    checks.api = true;
  } catch (error) {
    console.error('API health check failed:', error.message);
  }

  // Check disk space
  try {
    const fs = require('fs');
    const stats = fs.statSync('./');
    // Basic disk check - ensure we can read filesystem
    checks.disk = stats.isDirectory();
  } catch (error) {
    console.error('Disk health check failed:', error.message);
  }

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB default limit
    const heapUsedPercent = (memUsage.heapUsed / maxMemory) * 100;
    
    checks.memory = heapUsedPercent < 90; // Fail if using >90% of allocated memory
    
    if (process.env.HEALTH_CHECK_VERBOSE === 'true') {
      console.log('Memory usage:', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
        heapUsedPercent: Math.round(heapUsedPercent) + '%'
      });
    }
  } catch (error) {
    console.error('Memory health check failed:', error.message);
  }

  return checks;
}

// Main execution
async function main() {
  const verbose = process.env.HEALTH_CHECK_VERBOSE === 'true';
  const advanced = process.env.HEALTH_CHECK_ADVANCED === 'true';

  try {
    if (advanced) {
      if (verbose) console.log('Performing advanced health checks...');
      
      const checks = await performAdvancedChecks();
      const allPassed = Object.values(checks).every(check => check === true);
      
      if (verbose) {
        console.log('Health check results:', checks);
      }
      
      if (allPassed) {
        if (verbose) console.log('All health checks passed');
        process.exit(0);
      } else {
        console.error('Some health checks failed:', checks);
        process.exit(1);
      }
    } else {
      if (verbose) console.log('Performing basic health check...');
      
      const result = await performHealthCheck();
      
      if (verbose) {
        console.log('Health check passed:', {
          status: result.status,
          responseTime: result.responseTime + 'ms',
          version: result.data.version,
          uptime: process.uptime() + 's'
        });
      }
      
      process.exit(0);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
    
    if (verbose) {
      console.error('Health check configuration:', config);
      console.error('Process uptime:', process.uptime() + 's');
      console.error('Node version:', process.version);
    }
    
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => {
  console.log('Health check interrupted by SIGTERM');
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('Health check interrupted by SIGINT');
  process.exit(1);
});

// Run the health check
main();