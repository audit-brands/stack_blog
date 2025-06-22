const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const nunjucks = require('nunjucks');
const path = require('path');
require('dotenv').config();

const config = require('./config/default');
const frontendRoutes = require('./routes/frontend');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

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

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Serve media files from content directories with filtering
app.use('/media', express.static(path.join(__dirname, 'content'), {
  index: false,
  setHeaders: (res, filePath) => {
    // Only allow certain file types to be served
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.svg'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      res.status(403);
      return false;
    }
  }
}));

// Routes
app.use('/admin', adminRoutes);
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

// Start server
app.listen(PORT, () => {
  console.log(`Stack Blog server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Templates: ${templatePath}`);
});

module.exports = app;