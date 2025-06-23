# Development Guide

This guide covers setting up a development environment, contributing to Stack Blog, and understanding the codebase architecture.

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher  
- **Git**: Latest version
- **Code Editor**: VS Code, WebStorm, or similar with JavaScript support

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/audit-brands/stack_blog.git
cd stack_blog

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

### Development Environment Variables

```bash
# .env file for development
NODE_ENV=development
PORT=3000

# Security (use development values)
SESSION_SECRET=dev-session-secret-change-in-production
API_KEY=dev-api-key-change-in-production
ADMIN_PASSWORD_HASH=$2b$12$devHashGeneratedWithNpmRunSetup

# Content Configuration
CONTENT_PATH=./content
MEDIA_PATH=./content/media
CACHE_TTL=60000

# Development Settings
LOG_LEVEL=debug
ENABLE_DEBUG=true
HOT_RELOAD=true
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run debug        # Start with debugging enabled

# Testing
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Quality
npm run lint        # Run ESLint
npm run lint:fix    # Fix linting issues automatically
npm run format      # Format code with Prettier

# Build & Deploy
npm run build       # Build for production
npm start          # Start production server
npm run setup      # Generate admin password hash
```

## 🏗️ Architecture Overview

### Directory Structure

```
stack_blog/
├── app.js                    # Main application entry point
├── config/                   # Configuration files
│   └── default.js           # Default configuration
├── content/                  # Content storage
│   ├── index.md             # Homepage content
│   └── media/               # Uploaded media files
├── docs/                     # Documentation
├── middleware/               # Express middleware
│   ├── security.js          # Security middleware
│   └── validation.js        # Input validation
├── plugins/                  # Plugin directory
│   └── example-plugin/      # Example plugin
├── public/                   # Static assets
│   ├── css/                 # Stylesheets
│   ├── js/                  # Client-side JavaScript
│   └── images/              # Static images
├── routes/                   # Express route handlers
│   ├── admin.js             # Admin panel routes
│   ├── api.js               # REST API routes
│   └── frontend.js          # Frontend routes
├── services/                 # Business logic services
│   ├── AuthService.js       # Authentication
│   ├── ContentService.js    # Content management
│   ├── MediaService.js      # File uploads
│   ├── SearchService.js     # Search functionality
│   ├── CacheService.js      # Caching
│   ├── PluginService.js     # Plugin system
│   └── index.js             # Service exports
├── templates/                # Nunjucks templates
│   ├── layout.html          # Base layout
│   ├── default.html         # Default page template
│   ├── 404.html             # 404 error page
│   └── admin/               # Admin templates
└── __tests__/                # Test files
    ├── ContentService.test.js
    ├── AuthService.test.js
    └── api.test.js
```

### Core Services

#### ContentService
Manages Markdown content files and metadata.

```javascript
const { contentService } = require('./services');

// Read a page
const page = await contentService.getPage('about');

// List pages with pagination
const result = await contentService.listPages({
  page: 1,
  limit: 10,
  search: 'keyword'
});

// Save a page
await contentService.savePage('new-page', metadata, content);
```

#### AuthService
Handles authentication and session management.

```javascript
const { authService } = require('./services');

// Authenticate user
const user = await authService.authenticateUser('admin', 'password');

// Check if authenticated
const isAuth = authService.isAuthenticated(req.session);

// Middleware for protected routes
router.use(authService.requireAuth.bind(authService));
```

#### MediaService
Manages file uploads and media processing.

```javascript
const { mediaService } = require('./services');

// Get upload configuration
const upload = mediaService.getMulterConfig();

// Process uploaded image
const result = await mediaService.processImage(filePath, {
  generateThumbnail: true,
  maxWidth: 1920,
  quality: 85
});
```

#### SearchService
Provides full-text search functionality.

```javascript
const { searchService } = require('./services');

// Search content
const results = await searchService.search('query', {
  page: 1,
  limit: 10,
  sortBy: 'relevance'
});

// Get search suggestions
const suggestions = await searchService.getSuggestions('partial');
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test ContentService.test.js

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Structure

```javascript
// Example test file: __tests__/ContentService.test.js
const ContentService = require('../services/ContentService');

describe('ContentService', () => {
  let contentService;

  beforeEach(() => {
    contentService = new ContentService('./test-content');
  });

  describe('getPage', () => {
    test('should return page when it exists', async () => {
      const page = await contentService.getPage('test-page');
      expect(page).toBeDefined();
      expect(page.metadata.title).toBe('Test Page');
    });

    test('should return null when page does not exist', async () => {
      const page = await contentService.getPage('nonexistent');
      expect(page).toBeNull();
    });
  });
});
```

### Writing Tests

1. **Test Files**: Place in `__tests__/` directory
2. **Naming**: Use `.test.js` suffix
3. **Structure**: Group related tests with `describe`
4. **Mocking**: Mock external dependencies
5. **Coverage**: Aim for >80% code coverage

### Test Utilities

```javascript
// Test helper functions
const testUtils = {
  // Create test content
  createTestPage: (slug, metadata = {}, content = '') => {
    return {
      slug,
      metadata: { title: 'Test', ...metadata },
      content,
      lastModified: new Date()
    };
  },

  // Mock request/response
  mockReq: (options = {}) => ({
    body: {},
    params: {},
    query: {},
    session: {},
    ...options
  }),

  mockRes: () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.render = jest.fn(() => res);
    res.redirect = jest.fn(() => res);
    return res;
  }
};
```

## 🔌 Plugin Development

### Plugin Structure

```javascript
// plugins/my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Description of what this plugin does',
  author: 'Your Name',
  
  // Plugin configuration
  config: {
    enabled: true,
    setting1: 'default-value'
  },

  // Hook implementations
  hooks: {
    'content:before-render': (content, metadata) => {
      // Modify content before rendering
      return content.replace(/\[note\]/g, '<div class="note">');
    },
    
    'content:after-save': async (page) => {
      // Perform actions after page is saved
      console.log(`Page saved: ${page.slug}`);
    }
  },

  // Plugin initialization
  init: (app, services) => {
    // Setup plugin routes, middleware, etc.
    app.get('/plugin/my-plugin', (req, res) => {
      res.json({ message: 'Hello from my plugin!' });
    });
  }
};
```

### Available Hooks

```javascript
// Content hooks
'content:before-render'   // Modify content before Markdown rendering
'content:after-render'    // Modify HTML after rendering
'content:before-save'     // Validate/modify content before saving
'content:after-save'      // Perform actions after saving
'content:before-delete'   // Confirm deletion or cleanup
'content:after-delete'    // Cleanup after deletion

// Request hooks
'request:before-route'    // Modify request before routing
'request:after-route'     // Log or analyze after routing

// Admin hooks
'admin:before-login'      // Additional login validation
'admin:after-login'       // Post-login actions
'admin:dashboard'         // Add dashboard widgets

// Search hooks
'search:before-index'     // Modify content before indexing
'search:after-search'     // Modify search results
```

### Plugin Testing

```javascript
// __tests__/plugins/my-plugin.test.js
const plugin = require('../../plugins/my-plugin');

describe('My Plugin', () => {
  test('should have required metadata', () => {
    expect(plugin.name).toBe('my-plugin');
    expect(plugin.version).toBeDefined();
  });

  test('should modify content correctly', () => {
    const content = 'This is a [note] for testing';
    const result = plugin.hooks['content:before-render'](content);
    expect(result).toContain('<div class="note">');
  });
});
```

## 🎨 Frontend Development

### Template System

Stack Blog uses Nunjucks for templating:

```html
<!-- templates/layout.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ page.metadata.title }} - {{ site.title }}</title>
    <link rel="stylesheet" href="/css/main.css">
</head>
<body>
    <header>
        <nav>
            <a href="/">{{ site.title }}</a>
        </nav>
    </header>
    
    <main>
        {% block content %}{% endblock %}
    </main>
    
    <footer>
        <p>&copy; {{ moment().year() }} {{ site.title }}</p>
    </footer>
</body>
</html>
```

### CSS Development

```css
/* public/css/main.css */
:root {
  --primary-color: #3273dc;
  --secondary-color: #363636;
  --text-color: #4a4a4a;
  --background: #ffffff;
}

/* Use CSS custom properties */
.header {
  background-color: var(--primary-color);
  color: white;
}

/* Responsive design */
@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }
}
```

### JavaScript Development

```javascript
// public/js/main.js
class StackBlog {
  constructor() {
    this.init();
  }

  init() {
    this.setupSearch();
    this.setupNavigation();
  }

  setupSearch() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(this.handleSearch, 300));
    }
  }

  async handleSearch(event) {
    const query = event.target.value;
    if (query.length < 2) return;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      this.displaySearchResults(data.data.results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StackBlog();
});
```

## 🔍 Debugging

### Development Debugging

```bash
# Start with debugging enabled
npm run debug

# Or with Node.js inspector
node --inspect app.js

# Debug specific test
node --inspect-brk node_modules/.bin/jest ContentService.test.js
```

### Logging

```javascript
// Add debug logging
const debug = require('debug')('stack-blog:service');

class MyService {
  async doSomething() {
    debug('Starting operation...');
    
    try {
      const result = await someAsyncOperation();
      debug('Operation completed successfully');
      return result;
    } catch (error) {
      debug('Operation failed:', error.message);
      throw error;
    }
  }
}
```

### Performance Profiling

```javascript
// Add timing to critical operations
console.time('content-render');
const html = await markdownService.render(content);
console.timeEnd('content-render');

// Memory usage monitoring
const used = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(used.rss / 1024 / 1024) + 'MB',
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB'
});
```

## 🚀 Contributing

### Contribution Workflow

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/yourusername/stack_blog.git
   cd stack_blog
   git remote add upstream https://github.com/audit-brands/stack_blog.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Write code following the style guide
   - Add tests for new functionality
   - Update documentation if needed

4. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "Add amazing feature"
   git push origin feature/amazing-feature
   ```

6. **Create a Pull Request**
   - Describe your changes
   - Link to relevant issues
   - Include screenshots if UI changes

### Code Style Guidelines

#### JavaScript Style

```javascript
// Use const/let, not var
const config = require('./config');
let counter = 0;

// Use arrow functions for callbacks
const items = array.map(item => item.name);

// Use async/await, not callbacks
async function getData() {
  try {
    const result = await fetchData();
    return result;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}

// Destructuring
const { name, version } = require('./package.json');

// Template literals
const message = `Hello ${name}, you are using version ${version}`;
```

#### File Organization

```javascript
// Order of imports
const fs = require('fs');              // Node.js built-ins
const express = require('express');    // Third-party modules
const config = require('./config');   // Local modules

// Order of exports
class MyService {
  // Constructor first
  constructor() {}
  
  // Public methods
  async publicMethod() {}
  
  // Private methods (underscore prefix)
  _privateMethod() {}
}

module.exports = MyService;
```

### Documentation Standards

- Use JSDoc for function documentation
- Update README.md for significant changes
- Add examples for new features
- Keep documentation current with code changes

```javascript
/**
 * Renders Markdown content to HTML
 * @param {string} content - The Markdown content to render
 * @param {Object} options - Rendering options
 * @param {boolean} options.sanitize - Whether to sanitize HTML
 * @returns {Promise<string>} The rendered HTML
 * @throws {Error} When content is invalid
 */
async function render(content, options = {}) {
  // Implementation
}
```

### Security Guidelines

1. **Input Validation**: Always validate user inputs
2. **SQL Injection**: Use parameterized queries (if using databases)
3. **XSS Prevention**: Escape user content in templates
4. **Authentication**: Never store passwords in plain text
5. **Authorization**: Check permissions for protected operations
6. **File Uploads**: Validate file types and sizes
7. **Environment Variables**: Never commit secrets to code

### Performance Guidelines

1. **Caching**: Implement appropriate caching strategies
2. **Database Queries**: Optimize queries and use indexes
3. **Memory**: Avoid memory leaks, clean up resources
4. **Async Operations**: Use async/await properly
5. **Bundle Size**: Keep dependencies minimal

## 🔧 Development Tools

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-markdown",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag"
  ]
}
```

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  rules: {
    'no-unused-vars': 'error',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

## 📚 Learning Resources

### Node.js & Express
- [Express.js Guide](https://expressjs.com/en/guide/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Frontend Technologies
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [Bulma CSS Framework](https://bulma.io/documentation/)
- [Markdown-it Documentation](https://github.com/markdown-it/markdown-it)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

### Testing
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest for API Testing](https://github.com/visionmedia/supertest)

## 🆘 Getting Help

1. **Documentation**: Check the `docs/` directory first
2. **Issues**: Search existing GitHub issues
3. **Discussions**: Use GitHub Discussions for questions
4. **Code Review**: Request reviews for complex changes

Remember: Good code is not just working code, but code that is readable, maintainable, and secure.