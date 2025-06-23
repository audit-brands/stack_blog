# Configuration Guide

This guide covers all configuration options available in Stack Blog, from basic setup to advanced production configurations.

## 📝 Environment Variables

### Required Variables

```bash
# Basic Application Settings
NODE_ENV=production                    # Environment: development, production, test
PORT=3000                             # Port to run the application on

# Security Configuration (REQUIRED for production)
SESSION_SECRET=your-64-char-secret    # Session encryption key
ADMIN_PASSWORD_HASH=bcrypt-hash       # Admin password hash
```

### Optional Variables

```bash
# API Configuration
API_KEY=your-api-key                  # Optional API authentication key

# Content Configuration
CONTENT_PATH=./content                # Path to content directory
MEDIA_PATH=./content/media           # Path to media uploads
CACHE_TTL=300000                     # Cache TTL in milliseconds (5 minutes)

# CORS Configuration
ALLOWED_ORIGINS=https://example.com   # Comma-separated allowed origins

# Logging Configuration
LOG_LEVEL=info                       # Log level: error, warn, info, debug
LOG_FILE=./logs/app.log              # Log file path

# Search Configuration
SEARCH_ENABLED=true                  # Enable search functionality
SEARCH_INDEX_TTL=300000             # Search index TTL in milliseconds

# Performance Configuration
CLUSTER_MODE=false                   # Enable cluster mode
MAX_WORKERS=4                        # Maximum worker processes
MEMORY_LIMIT=512                     # Memory limit in MB per worker
```

### Security Variables

```bash
# Rate Limiting
RATE_LIMIT_GENERAL=1000              # General requests per window
RATE_LIMIT_AUTH=5                    # Auth attempts per window
RATE_LIMIT_API=100                   # API requests per window
RATE_LIMIT_UPLOAD=50                 # Upload requests per window
RATE_LIMIT_WINDOW=900000             # Rate limit window in ms (15 minutes)

# Security Headers
CSP_ENABLED=true                     # Enable Content Security Policy
HSTS_ENABLED=true                    # Enable HTTP Strict Transport Security
HSTS_MAX_AGE=31536000               # HSTS max age in seconds

# Session Configuration
SESSION_NAME=stackblog.sid           # Session cookie name
SESSION_MAX_AGE=86400000            # Session max age in ms (24 hours)
SESSION_SECURE=true                  # Secure flag for session cookies (HTTPS only)
SESSION_HTTP_ONLY=true              # HTTPOnly flag for session cookies

# File Upload Security
UPLOAD_MAX_SIZE=10485760            # Max upload size in bytes (10MB)
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

## 🔧 Configuration Files

### Default Configuration

```javascript
// config/default.js
module.exports = {
  // Application settings
  app: {
    name: 'Stack Blog',
    version: '1.0.0',
    description: 'A flat-file CMS built with Node.js',
    author: 'Stack Blog Team'
  },

  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // Content configuration
  content: {
    path: process.env.CONTENT_PATH || './content',
    mediaPath: process.env.MEDIA_PATH || './content/media',
    defaultTemplate: 'default',
    maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ]
  },

  // Cache configuration
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100,
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 60 * 1000 // 1 minute
  },

  // Search configuration
  search: {
    enabled: process.env.SEARCH_ENABLED !== 'false',
    indexTTL: parseInt(process.env.SEARCH_INDEX_TTL) || 5 * 60 * 1000, // 5 minutes
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS) || 50,
    snippetLength: parseInt(process.env.SEARCH_SNIPPET_LENGTH) || 150
  },

  // Security configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    apiKey: process.env.API_KEY,
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
    
    // Rate limiting
    rateLimits: {
      general: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_GENERAL) || 1000
      },
      auth: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_AUTH) || 5
      },
      api: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_API) || 100
      },
      upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: parseInt(process.env.RATE_LIMIT_UPLOAD) || 50
      }
    },

    // CORS configuration
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
      credentials: true,
      optionsSuccessStatus: 200
    },

    // Session configuration
    session: {
      name: process.env.SESSION_NAME || 'stackblog.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.SESSION_SECURE !== 'false',
        httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 hours
      }
    },

    // Security headers
    helmet: {
      contentSecurityPolicy: {
        enabled: process.env.CSP_ENABLED !== 'false',
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://kit.fontawesome.com"],
          scriptSrc: ["'self'", "https://kit.fontawesome.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          fontSrc: ["'self'", "https://kit.fontawesome.com", "data:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"]
        }
      },
      hsts: {
        enabled: process.env.HSTS_ENABLED !== 'false',
        maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
    console: process.env.NODE_ENV !== 'production',
    format: process.env.LOG_FORMAT || 'combined'
  },

  // Plugin configuration
  plugins: {
    enabled: process.env.PLUGINS_ENABLED !== 'false',
    path: process.env.PLUGINS_PATH || './plugins',
    autoload: process.env.PLUGINS_AUTOLOAD !== 'false'
  }
};
```

### Environment-Specific Configuration

#### Development Configuration

```javascript
// config/development.js
module.exports = {
  // Override default settings for development
  server: {
    port: 3000
  },

  security: {
    helmet: {
      contentSecurityPolicy: {
        enabled: false // Disable CSP for development tools
      }
    },
    session: {
      cookie: {
        secure: false // Allow HTTP in development
      }
    }
  },

  logging: {
    level: 'debug',
    console: true
  },

  cache: {
    enabled: false // Disable caching for development
  }
};
```

#### Production Configuration

```javascript
// config/production.js
module.exports = {
  server: {
    trustProxy: true // Trust reverse proxy headers
  },

  security: {
    helmet: {
      contentSecurityPolicy: {
        enabled: true
      },
      hsts: {
        enabled: true
      }
    },
    session: {
      cookie: {
        secure: true // Require HTTPS
      }
    }
  },

  logging: {
    level: 'warn',
    console: false,
    file: './logs/production.log'
  },

  cache: {
    enabled: true
  }
};
```

#### Test Configuration

```javascript
// config/test.js
module.exports = {
  content: {
    path: './test-content'
  },

  cache: {
    enabled: false
  },

  search: {
    enabled: false
  },

  logging: {
    level: 'error',
    console: false
  }
};
```

## 🔐 Security Configuration

### Password Requirements

```javascript
// Password validation rules
const passwordRules = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  allowedSymbols: '@$!%*?&',
  maxLength: 128
};
```

### Rate Limiting Configuration

```javascript
// Custom rate limiting configuration
const rateLimits = {
  // General application traffic
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5, // login attempts per window
    skipSuccessfulRequests: true,
    message: 'Too many login attempts, please try again later'
  },

  // API endpoints
  api: {
    windowMs: 15 * 60 * 1000,
    max: 100, // API calls per window
    message: 'API rate limit exceeded',
    keyGenerator: (req) => req.ip + ':' + (req.headers['authorization'] || 'anonymous')
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // uploads per hour
    message: 'Upload rate limit exceeded'
  }
};
```

### Content Security Policy

```javascript
// CSP configuration for different environments
const cspConfig = {
  development: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'", "ws:", "wss:"]
  },

  production: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://kit.fontawesome.com"],
    scriptSrc: ["'self'", "https://kit.fontawesome.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    fontSrc: ["'self'", "https://kit.fontawesome.com", "data:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"]
  }
};
```

## 📁 Content Configuration

### Content Directory Structure

```
content/
├── index.md                 # Homepage (required)
├── about/
│   └── index.md            # About page
├── blog/
│   ├── 2024/
│   │   ├── post-1.md
│   │   └── post-2.md
│   └── index.md            # Blog index
├── pages/
│   ├── privacy.md
│   └── terms.md
└── media/                  # Uploaded files
    ├── images/
    ├── documents/
    └── uploads/
```

### Frontmatter Configuration

```yaml
---
# Required fields
title: "Page Title"
date: "2024-01-01"

# Optional fields
description: "SEO description"
template: "default"
author: "Author Name"
tags: ["tag1", "tag2"]
featured: true
published: true
slug: "custom-slug"

# Custom metadata
customField: "Custom value"
seoKeywords: "keyword1, keyword2"
ogImage: "/media/images/social-share.jpg"
---
```

### Template Configuration

```javascript
// Template mapping
const templates = {
  'default': 'default.html',
  'blog': 'blog.html',
  'page': 'page.html',
  'portfolio': 'portfolio.html',
  'contact': 'contact.html'
};

// Template variables available
const templateVars = {
  page: {
    metadata: {}, // Frontmatter data
    content: '',  // Markdown content
    html: '',     // Rendered HTML
    url: '',      // Page URL
    slug: ''      // Page slug
  },
  site: {
    title: '',
    description: '',
    url: '',
    author: ''
  },
  config: {}, // Application config
  moment: {}, // Moment.js for date formatting
  _: {}       // Lodash utilities
};
```

## 🔍 Search Configuration

### Search Settings

```javascript
const searchConfig = {
  enabled: true,
  indexTTL: 5 * 60 * 1000, // 5 minutes
  
  // Fields to index
  indexFields: [
    'title',        // Page title
    'content',      // Markdown content
    'description',  // Meta description
    'tags',         // Tags array
    'author'        // Author name
  ],

  // Search result scoring
  scoring: {
    titleMatch: 3.0,      // Title matches worth 3x
    exactMatch: 2.0,      // Exact phrase matches worth 2x
    contentMatch: 1.0,    // Content matches worth 1x
    tagMatch: 2.5,        // Tag matches worth 2.5x
    freshnessBoost: 0.1   // Recent content boost
  },

  // Result formatting
  results: {
    maxResults: 50,
    snippetLength: 150,
    highlightTag: 'mark'
  }
};
```

### Search Index Configuration

```javascript
const indexConfig = {
  // Stop words to exclude
  stopWords: [
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
    'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
    'that', 'the', 'to', 'was', 'will', 'with'
  ],

  // Minimum word length to index
  minWordLength: 2,

  // Maximum word length to index
  maxWordLength: 50,

  // Word processing
  stemming: true,
  lowercase: true,
  removeAccents: true
};
```

## 🔧 Plugin Configuration

### Plugin Settings

```javascript
// Plugin configuration
const pluginConfig = {
  enabled: true,
  autoload: true,
  path: './plugins',
  
  // Plugin-specific settings
  plugins: {
    'example-plugin': {
      enabled: true,
      setting1: 'value1',
      setting2: 'value2'
    },
    
    'analytics-plugin': {
      enabled: process.env.NODE_ENV === 'production',
      trackingId: process.env.ANALYTICS_TRACKING_ID,
      anonymizeIp: true
    },
    
    'backup-plugin': {
      enabled: true,
      interval: '0 2 * * *', // Daily at 2 AM
      retention: 30, // Keep 30 backups
      destination: process.env.BACKUP_DESTINATION
    }
  }
};
```

### Plugin Development Configuration

```javascript
// Plugin manifest example
const pluginManifest = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Plugin description',
  author: 'Plugin Author',
  license: 'MIT',
  
  // Plugin dependencies
  dependencies: {
    'stack-blog': '^1.0.0'
  },
  
  // Required permissions
  permissions: [
    'content:read',
    'content:write',
    'admin:access'
  ],
  
  // Configuration schema
  configSchema: {
    enabled: { type: 'boolean', default: true },
    apiKey: { type: 'string', required: true },
    maxItems: { type: 'number', default: 10, min: 1, max: 100 }
  }
};
```

## 📊 Performance Configuration

### Caching Configuration

```javascript
const cacheConfig = {
  // Content caching
  content: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Max cached items
    checkPeriod: 60 * 1000 // Cleanup interval
  },

  // Search index caching
  search: {
    enabled: true,
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 1 // Only cache latest index
  },

  // Static file caching (handled by reverse proxy)
  static: {
    maxAge: 365 * 24 * 60 * 60, // 1 year for static assets
    etag: true,
    lastModified: true
  }
};
```

### Cluster Configuration

```javascript
// PM2 cluster configuration
module.exports = {
  apps: [{
    name: 'stack-blog',
    script: './app.js',
    instances: process.env.CLUSTER_INSTANCES || 'max',
    exec_mode: 'cluster',
    
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Performance settings
    max_memory_restart: process.env.MEMORY_LIMIT + 'M' || '512M',
    node_args: '--max-old-space-size=' + (process.env.MEMORY_LIMIT || 512),
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## 🌐 CORS Configuration

```javascript
const corsConfig = {
  // Basic CORS configuration
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};
```

## 📝 Example Configuration Files

### Complete .env Example

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true

# Security Configuration
SESSION_SECRET=your-super-secure-session-secret-that-is-at-least-64-characters-long
API_KEY=your-secure-api-key-change-this-in-production
ADMIN_PASSWORD_HASH=$2b$12$your.bcrypt.password.hash.goes.here

# Content Configuration
CONTENT_PATH=./content
MEDIA_PATH=./content/media
CACHE_TTL=300000
CACHE_ENABLED=true

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_GENERAL=1000
RATE_LIMIT_AUTH=5
RATE_LIMIT_API=100
RATE_LIMIT_UPLOAD=50
RATE_LIMIT_WINDOW=900000

# Search Configuration
SEARCH_ENABLED=true
SEARCH_INDEX_TTL=300000
SEARCH_MAX_RESULTS=50

# Security Headers
CSP_ENABLED=true
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000

# Session Configuration
SESSION_NAME=stackblog.sid
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_HTTP_ONLY=true

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Plugin Configuration
PLUGINS_ENABLED=true
PLUGINS_PATH=./plugins
PLUGINS_AUTOLOAD=true
```

### Docker Environment File

```bash
# docker.env
NODE_ENV=production
PORT=3000

# Use Docker secrets or bind mounts for sensitive data
SESSION_SECRET_FILE=/run/secrets/session_secret
API_KEY_FILE=/run/secrets/api_key
ADMIN_PASSWORD_HASH_FILE=/run/secrets/admin_password_hash

# Volume paths
CONTENT_PATH=/app/content
MEDIA_PATH=/app/content/media
LOG_FILE=/app/logs/app.log

# Performance
CACHE_ENABLED=true
CACHE_TTL=900000
```

This configuration guide provides comprehensive coverage of all Stack Blog configuration options. Adjust settings based on your specific requirements and environment constraints.