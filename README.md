# Stack Blog

A modern, secure flat-file CMS built with Node.js that manages content using Markdown files. Features a powerful admin panel, REST API, search functionality, and comprehensive security measures suitable for production deployment.

## 🚀 Features

### Core Features
- **Flat-File Architecture**: No database required - content stored as Markdown files
- **Dynamic Routing**: Automatic URL mapping from file structure
- **Markdown Support**: Full GitHub Flavored Markdown with frontmatter metadata
- **Template System**: Flexible Nunjucks templates with inheritance
- **Admin Panel**: Modern, responsive admin interface with Bulma CSS
- **File Management**: Upload and manage media files with image processing

### Advanced Features
- **Full-Text Search**: Intelligent search with relevance scoring and suggestions
- **REST API**: Complete headless CMS API for external integrations
- **Plugin System**: Extensible architecture with hooks and filters
- **Caching**: Smart content caching for improved performance
- **Security**: Production-ready security with rate limiting and validation

### Security Features
- **Multi-Tier Rate Limiting**: DDoS protection with configurable limits
- **Security Headers**: Comprehensive headers via Helmet.js (CSP, HSTS, etc.)
- **Input Validation**: Server-side validation and sanitization
- **CSRF Protection**: Form security with token validation
- **File Upload Security**: MIME type restrictions and size limits
- **Authentication**: Secure bcrypt password hashing with sessions

## 📋 Requirements

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Operating System**: Linux, macOS, or Windows

## 🛠️ Installation

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/audit-brands/stack_blog.git
   cd stack_blog
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate admin password hash**
   ```bash
   npm run setup
   # Follow prompts to create admin password
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access your site**
   - Frontend: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

### Environment Configuration

Create a `.env` file in the root directory:

```bash
# Application Settings
NODE_ENV=development
PORT=3000

# Security Configuration
SESSION_SECRET=your-secure-session-secret-here
API_KEY=your-secure-api-key-here
ADMIN_PASSWORD_HASH=your-bcrypt-password-hash-here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Content Configuration
CONTENT_PATH=./content
MEDIA_PATH=./media
CACHE_TTL=300000
```

## 📖 Documentation

### Complete Documentation
- **[API Documentation](docs/API.md)** - REST API reference and examples
- **[Security Guide](docs/SECURITY.md)** - Security features and best practices
- **[Security Audit](docs/SECURITY_AUDIT.md)** - Comprehensive security assessment
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Development Guide](docs/DEVELOPMENT.md)** - Contributing and development setup

### Quick References
- **[Configuration](docs/CONFIGURATION.md)** - Environment variables and settings
- **[Plugin Development](docs/PLUGINS.md)** - Creating custom plugins
- **[Template System](docs/TEMPLATES.md)** - Template development guide
- **[Content Management](docs/CONTENT.md)** - Content creation and organization

## 🏗️ Architecture

### Core Components

```
stack_blog/
├── app.js                 # Main application entry point
├── config/                # Configuration files
├── content/               # Markdown content files
├── docs/                  # Documentation
├── middleware/            # Express middleware
├── plugins/               # Plugin directory
├── public/                # Static assets (CSS, JS, images)
├── routes/                # Express route handlers
├── services/              # Business logic services
├── templates/             # Nunjucks templates
└── __tests__/             # Test files
```

### Service Architecture

- **ContentService**: Manages Markdown file operations
- **AuthService**: Handles authentication and sessions
- **MediaService**: File upload and image processing
- **SearchService**: Full-text search and indexing
- **CacheService**: Content caching and performance
- **PluginService**: Plugin management and hooks

## 🔧 Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test ContentService.test.js
```

### Development Commands
```bash
# Start development server with hot reload
npm run dev

# Run linting
npm run lint

# Run security audit
npm audit

# Generate password hash for admin
npm run setup
```

### Creating Content

Content is stored as Markdown files in the `content/` directory:

```markdown
---
title: "Your Page Title"
description: "Page description for SEO"
template: "default"
date: "2024-01-01"
---

# Your Content Here

Write your content in **Markdown** format.
```

### Directory Structure
```
content/
├── index.md              # Homepage
├── about/
│   └── index.md          # About page
├── blog/
│   ├── post-1.md         # Blog post
│   └── post-2.md         # Another blog post
└── media/                # Uploaded media files
```

## 🌐 API Usage

### Authentication
```bash
# Set API key in headers for protected endpoints
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/pages
```

### Basic Operations
```bash
# Get all pages
GET /api/pages

# Get specific page
GET /api/pages/:slug

# Create new page
POST /api/pages
{
  "title": "New Page",
  "content": "# Content here",
  "description": "Page description"
}

# Search content
GET /api/search?q=keyword
```

See [API Documentation](docs/API.md) for complete reference.

## 🔐 Security

Stack Blog implements comprehensive security measures:

### Production Security Checklist
- [ ] Configure strong session secrets
- [ ] Set up HTTPS with valid SSL certificates
- [ ] Configure rate limiting for your traffic patterns
- [ ] Set up proper CORS origins
- [ ] Enable security headers
- [ ] Configure firewall rules
- [ ] Set up log monitoring
- [ ] Regular dependency updates

### Security Features
- **Rate Limiting**: Multi-tier protection against abuse
- **Input Validation**: All user inputs validated and sanitized
- **Security Headers**: CSP, HSTS, XSS protection, and more
- **File Upload Security**: MIME type restrictions and scanning
- **CSRF Protection**: Form submissions protected with tokens
- **Session Security**: HTTPOnly cookies with secure flags

See [Security Guide](docs/SECURITY.md) for detailed information.

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker
docker build -t stack-blog .
docker run -p 3000:3000 --env-file .env stack-blog
```

### Traditional Deployment
```bash
# Install dependencies
npm ci --production

# Set environment to production
export NODE_ENV=production

# Start with PM2
npm install -g pm2
pm2 start ecosystem.config.js
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

See [Deployment Guide](docs/DEPLOYMENT.md) for complete instructions.

## 🔌 Plugin Development

Create custom plugins to extend Stack Blog:

```javascript
// plugins/my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  
  hooks: {
    'content:before-render': (content) => {
      // Modify content before rendering
      return content;
    }
  }
};
```

See [Plugin Development Guide](docs/PLUGINS.md) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Write tests for new features
- Follow existing code style
- Update documentation
- Ensure security best practices

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: Report bugs on GitHub Issues
- **Security**: See [Security Guide](docs/SECURITY.md) for security reporting

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/) and [Node.js](https://nodejs.org/)
- Templates powered by [Nunjucks](https://mozilla.github.io/nunjucks/)
- Styling with [Bulma CSS](https://bulma.io/)
- Security provided by [Helmet.js](https://helmetjs.github.io/)
- Markdown processing by [markdown-it](https://github.com/markdown-it/markdown-it)

---

**Stack Blog** - A modern, secure flat-file CMS for the Node.js ecosystem.