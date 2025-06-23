const express = require('express');
const session = require('express-session');
const nunjucks = require('nunjucks');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const config = require('./config/default');
const frontendRoutes = require('./routes/frontend');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const { cacheService, pluginService, setThemeService, ThemeService } = require('./services');

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

// Configure Nunjucks template engine
const templatePath = path.join(__dirname, 'templates');
const nunjucksEnv = nunjucks.configure(templatePath, {
  autoescape: true,
  express: app,
  watch: process.env.NODE_ENV !== 'production'
});

// Add custom template filters
nunjucksEnv.addFilter('markdown', (str) => {
  const { markdownService } = require('./services');
  return markdownService.render(str);
});

nunjucksEnv.addFilter('preview', (str, length = 160) => {
  const { markdownService } = require('./services');
  return markdownService.renderPreview(str, length);
});

nunjucksEnv.addFilter('date', (str, format = 'F j, Y') => {
  const date = new Date(str);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

// Set view engine
app.set('view engine', 'html');

// Initialize Theme Service
const themeService = new ThemeService(app);
setThemeService(themeService);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

// Routes with specific rate limiting
app.use('/api', apiLimiter, apiRoutes);
app.use('/admin', adminSecurityCheck, adminRoutes);
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
    
    app.listen(PORT, () => {
      console.log(`Stack Blog server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Templates: ${templatePath}`);
      console.log(`Plugins loaded: ${pluginService.getAllPlugins().length}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;