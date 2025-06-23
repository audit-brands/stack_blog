module.exports = {
  apps: [{
    name: 'stack-blog',
    script: './app.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment configuration
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3001
    },
    
    // Logging configuration
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Memory and performance
    max_memory_restart: '512M',
    node_args: '--max-old-space-size=512',
    
    // Graceful shutdown and restart
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Auto restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // File watching (disabled in production)
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'content/media',
      '.git',
      '__tests__'
    ],
    
    // Source map support
    source_map_support: true,
    
    // Merge logs from all instances
    merge_logs: true,
    
    // Instance variables
    instance_var: 'INSTANCE_ID',
    
    // Health check endpoint
    health_check_path: '/api/status',
    health_check_grace_period: 3000,
    
    // Cron restart (optional - restart daily at 4 AM)
    cron_restart: '0 4 * * *',
    
    // Advanced PM2 features
    pmx: true,
    automation: false,
    
    // Environment-specific overrides
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      CACHE_ENABLED: 'false'
    }
  }],

  // Deployment configuration
  deploy: {
    production: {
      user: 'stackblog',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/audit-brands/stack_blog.git',
      path: '/home/stackblog/stack_blog',
      
      // Pre-deployment hooks
      'pre-deploy-local': 'echo "Starting deployment..."',
      'pre-deploy': 'git reset --hard && git clean -fd',
      
      // Post-deployment hooks
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production',
      'post-setup': 'ls -la',
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'stackblog',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'https://github.com/audit-brands/stack_blog.git',
      path: '/home/stackblog/stack_blog_staging',
      'post-deploy': 'npm ci && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};