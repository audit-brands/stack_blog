const express = require('express');
const session = require('express-session');
const handlebars = require('handlebars');
const exphbs = require('express-handlebars');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const config = require('./config/default');
const frontendRoutes = require('./routes/frontend');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const rssRoutes = require('./routes/rss');
const { cacheService, pluginService, setThemeService, ThemeService, templateCacheService } = require('./services');

// Security middleware
const {
  generalLimiter,
  authLimiter,
  apiLimiter,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  securityLogger,
  adminSecurityCheck
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Security logging and monitoring
app.use(securityLogger);

// Input sanitization
app.use(sanitizeInput);

// General rate limiting
app.use(generalLimiter);


// Configure Handlebars as primary template engine
const hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  viewsDir: path.join(__dirname, 'views'),
  helpers: {
    // Frontend helpers (migrated from Nunjucks)
    markdown: function(str) {
      const { markdownService } = require('./services');
      return new handlebars.SafeString(markdownService.render(str));
    },
    preview: function(str, length = 160) {
      const { markdownService } = require('./services');
      return markdownService.renderPreview(str, length);
    },
    date: function(str, format = 'F j, Y') {
      const date = new Date(str);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    },
    startsWith: function(str, prefix) {
      return str && typeof str === 'string' && str.startsWith(prefix);
    },
    // Admin-specific helpers
    isActive: function(current, path) {
      return current && current.includes(path) ? 'is-active' : '';
    },
    csrf: function() {
      return new handlebars.SafeString(`<input type="hidden" name="_csrf" value="${this.csrfToken}">`);
    },
    json: function(context) {
      return new handlebars.SafeString(JSON.stringify(context));
    },
    eq: function(a, b) {
      return a === b;
    },
    gt: function(a, b) {
      return a > b;
    },
    lt: function(a, b) {
      return a < b;
    },
    gte: function(a, b) {
      return a >= b;
    },
    lte: function(a, b) {
      return a <= b;
    },
    and: function(a, b) {
      return a && b;
    },
    or: function(a, b) {
      return a || b;
    },
    not: function(a) {
      return !a;
    },
    join: function(array, separator) {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    },
    formatDate: function(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    },
    formatDateTime: function(date) {
      if (!date) return '';
      return new Date(date).toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    truncate: function(str, length) {
      if (!str) return '';
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    },
    capitalize: function(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },
    formatFileSize: function(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    selected: function(value, selectedValue) {
      return value === selectedValue ? 'selected' : '';
    },
    checked: function(value, checkedValue) {
      return value === checkedValue ? 'checked' : '';
    },
    times: function(n, block) {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += block.fn(i);
      }
      return result;
    },
    range: function(start, end) {
      const result = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    },
    ifEquals: function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    },
    unless: function(conditional, options) {
      return !conditional ? options.fn(this) : options.inverse(this);
    },
    pluralize: function(count, singular, plural) {
      return count === 1 ? singular : (plural || singular + 's');
    },
    block: function(name) {
      const blocks = this._blocks || (this._blocks = {});
      const block = blocks[name] || (blocks[name] = []);
      block.push(arguments[arguments.length - 1].fn(this));
      return null;
    },
    contentFor: function(name, options) {
      const blocks = this._blocks || (this._blocks = {});
      const block = blocks[name] || (blocks[name] = []);
      block.push(options.fn(this));
    },
    outputBlock: function(name) {
      const blocks = this._blocks;
      const content = blocks && blocks[name] ? blocks[name].join('\n') : null;
      return new handlebars.SafeString(content || '');
    }
  }
});

// Set up Handlebars as primary view engine
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Theme Service with template caching
const themeService = new ThemeService(app, templateCacheService);
setThemeService(themeService);

// Session configuration - adjusted for reverse proxy
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  name: process.env.SESSION_NAME || 'stackblog.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_SECURE !== 'false',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : false
  }
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache middleware for frontend pages
app.use(cacheService.middleware({
  maxAge: 300, // 5 minutes
  cacheControl: 'public'
}));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Serve theme assets with proper caching
app.use('/themes', express.static(path.join(__dirname, 'themes'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true,
  index: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // Set proper content types
    if (ext === '.css') {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    } else if (ext === '.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    } else if (ext === '.woff' || ext === '.woff2') {
      res.setHeader('Content-Type', 'font/woff2');
    } else if (ext === '.ttf') {
      res.setHeader('Content-Type', 'font/ttf');
    } else if (ext === '.eot') {
      res.setHeader('Content-Type', 'application/vnd.ms-fontobject');
    }
    
    // Add cache headers for production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// Serve media files from content directories with filtering
app.use('/media', express.static(path.join(__dirname, 'content'), {
  index: false,
  setHeaders: (res, filePath) => {
    // Only allow certain file types to be served
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.svg', '.txt', '.doc', '.docx'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      res.status(403);
      return false;
    }
    
    // Set proper content type for images
    if (['.jpg', '.jpeg'].includes(ext)) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.gif') {
      res.setHeader('Content-Type', 'image/gif');
    } else if (ext === '.webp') {
      res.setHeader('Content-Type', 'image/webp');
    } else if (ext === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// Health check endpoints for load balancer
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes with specific rate limiting
app.use('/api', apiLimiter, apiRoutes);
app.use('/admin', adminSecurityCheck, adminRoutes);

// RSS routes (before frontend to catch /rss.xml)
app.use('/', rssRoutes);

app.use('/', frontendRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('404', {
    page: {
      metadata: {
        title: 'Page Not Found'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'A flat-file CMS built with Node.js'
    },
    currentPath: req.path
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Application error:', error);
  
  res.status(500).render('error', {
    page: {
      metadata: {
        title: 'Server Error'
      }
    },
    site: {
      title: 'Stack Blog',
      description: 'A flat-file CMS built with Node.js'
    },
    error: process.env.NODE_ENV === 'development' ? error : null,
    currentPath: req.path
  });
});

// Initialize plugins and start server
async function startServer() {
  try {
    await pluginService.init();
    
    const server = app.listen(PORT, () => {
      console.log(`Stack Blog server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Templates: ${path.join(__dirname, 'views')}`);
      console.log(`Plugins loaded: ${pluginService.getAllPlugins().length}`);
    });
    
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;