#!/usr/bin/env node

/**
 * Stack Blog Setup Script
 * Interactive setup for Stack Blog CMS
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class StackBlogSetup {
  constructor() {
    this.config = {};
    this.envPath = path.join(process.cwd(), '.env');
    this.exampleEnvPath = path.join(process.cwd(), '.env.example');
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async question(prompt, defaultValue = '') {
    return new Promise((resolve) => {
      const displayPrompt = defaultValue 
        ? `${prompt} (${colors.cyan}${defaultValue}${colors.reset}): `
        : `${prompt}: `;
      
      rl.question(displayPrompt, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  async confirmAction(prompt) {
    const answer = await this.question(`${prompt} (y/N)`);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }

  async generatePasswordHash(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  validatePassword(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[@$!%*?&]/.test(password);

    const errors = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSymbols) {
      errors.push('Password must contain at least one symbol (@$!%*?&)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async promptForPassword() {
    this.log('\nAdmin Password Setup', 'bright');
    this.log('Your password must meet the following requirements:', 'yellow');
    this.log('• At least 8 characters long');
    this.log('• Contains uppercase and lowercase letters');
    this.log('• Contains at least one number');
    this.log('• Contains at least one symbol (@$!%*?&)');

    let password, confirmPassword;
    let isValid = false;

    while (!isValid) {
      // Hide password input
      process.stdout.write('\nEnter admin password: ');
      password = await this.getHiddenInput();
      
      const validation = this.validatePassword(password);
      if (!validation.isValid) {
        this.log('\nPassword does not meet requirements:', 'red');
        validation.errors.forEach(error => this.log(`• ${error}`, 'red'));
        continue;
      }

      process.stdout.write('Confirm admin password: ');
      confirmPassword = await this.getHiddenInput();

      if (password !== confirmPassword) {
        this.log('\nPasswords do not match. Please try again.', 'red');
        continue;
      }

      isValid = true;
    }

    return password;
  }

  async getHiddenInput() {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let password = '';
      
      stdin.on('data', function(key) {
        // Ctrl+C
        if (key === '\u0003') {
          process.exit();
        }
        
        // Enter
        if (key === '\r' || key === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeAllListeners('data');
          console.log('');
          resolve(password);
          return;
        }
        
        // Backspace
        if (key === '\u007f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          return;
        }
        
        // Regular character
        password += key;
        process.stdout.write('*');
      });
    });
  }

  async setupEnvironment() {
    this.log('\n=== Stack Blog Setup ===', 'bright');
    this.log('This setup will help you configure Stack Blog for first use.\n', 'cyan');

    // Check if .env already exists
    if (fs.existsSync(this.envPath)) {
      this.log('Found existing .env file.', 'yellow');
      const overwrite = await this.confirmAction('Do you want to overwrite it?');
      if (!overwrite) {
        this.log('Setup cancelled.', 'yellow');
        return false;
      }
    }

    // Basic application settings
    this.log('\n1. Basic Configuration', 'bright');
    this.config.NODE_ENV = await this.question('Environment (development/production)', 'production');
    this.config.PORT = await this.question('Port number', '3000');
    this.config.DOMAIN = await this.question('Domain name (for Docker/HTTPS)', 'localhost');

    // Security configuration
    this.log('\n2. Security Configuration', 'bright');
    this.log('Generating secure secrets...', 'cyan');
    
    this.config.SESSION_SECRET = this.generateSecureSecret(64);
    this.config.API_KEY = this.generateSecureSecret(32);
    
    this.log(`✓ Session secret: ${this.config.SESSION_SECRET.substring(0, 20)}...`, 'green');
    this.log(`✓ API key: ${this.config.API_KEY.substring(0, 20)}...`, 'green');

    // Admin password
    const password = await this.promptForPassword();
    this.config.ADMIN_PASSWORD_HASH = await this.generatePasswordHash(password);
    this.log('\n✓ Admin password hash generated', 'green');

    // Content configuration
    this.log('\n3. Content Configuration', 'bright');
    this.config.CONTENT_PATH = await this.question('Content directory path', './content');
    this.config.MEDIA_PATH = await this.question('Media upload path', './content/media');

    // CORS configuration
    this.log('\n4. CORS Configuration', 'bright');
    if (this.config.NODE_ENV === 'production') {
      this.config.ALLOWED_ORIGINS = await this.question('Allowed origins (comma-separated)', `https://${this.config.DOMAIN}`);
    } else {
      this.config.ALLOWED_ORIGINS = 'http://localhost:3000';
    }

    // Performance configuration
    this.log('\n5. Performance Configuration', 'bright');
    this.config.CACHE_ENABLED = await this.question('Enable caching? (true/false)', 'true');
    this.config.SEARCH_ENABLED = await this.question('Enable search? (true/false)', 'true');

    return true;
  }

  generateEnvFile() {
    const envContent = `# Stack Blog Environment Configuration
# Generated on ${new Date().toISOString()}

# =============================================================================
# Application Configuration
# =============================================================================
NODE_ENV=${this.config.NODE_ENV}
PORT=${this.config.PORT}
HOST=0.0.0.0
TRUST_PROXY=true

# =============================================================================
# Security Configuration
# =============================================================================
SESSION_SECRET=${this.config.SESSION_SECRET}
API_KEY=${this.config.API_KEY}
ADMIN_PASSWORD_HASH=${this.config.ADMIN_PASSWORD_HASH}

# =============================================================================
# Content Configuration
# =============================================================================
CONTENT_PATH=${this.config.CONTENT_PATH}
MEDIA_PATH=${this.config.MEDIA_PATH}

# =============================================================================
# CORS Configuration
# =============================================================================
ALLOWED_ORIGINS=${this.config.ALLOWED_ORIGINS}

# =============================================================================
# Performance Configuration
# =============================================================================
CACHE_ENABLED=${this.config.CACHE_ENABLED}
CACHE_TTL=300000
CACHE_MAX_SIZE=100

SEARCH_ENABLED=${this.config.SEARCH_ENABLED}
SEARCH_INDEX_TTL=300000
SEARCH_MAX_RESULTS=50

# =============================================================================
# Rate Limiting Configuration
# =============================================================================
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_GENERAL=1000
RATE_LIMIT_AUTH=5
RATE_LIMIT_API=100
RATE_LIMIT_UPLOAD=50

# =============================================================================
# Security Headers
# =============================================================================
CSP_ENABLED=true
HSTS_ENABLED=${this.config.NODE_ENV === 'production'}
HSTS_MAX_AGE=31536000

# =============================================================================
# Session Configuration
# =============================================================================
SESSION_NAME=stackblog.sid
SESSION_MAX_AGE=86400000
SESSION_SECURE=${this.config.NODE_ENV === 'production'}
SESSION_HTTP_ONLY=true

# =============================================================================
# File Upload Configuration
# =============================================================================
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain

# =============================================================================
# Logging Configuration
# =============================================================================
LOG_LEVEL=${this.config.NODE_ENV === 'development' ? 'debug' : 'info'}
LOG_FILE=./logs/app.log

# =============================================================================
# Plugin Configuration
# =============================================================================
PLUGINS_ENABLED=true
PLUGINS_PATH=./plugins
PLUGINS_AUTOLOAD=true

# =============================================================================
# Docker Configuration
# =============================================================================
DOMAIN=${this.config.DOMAIN}
`;

    return envContent;
  }

  async createDirectories() {
    const directories = [
      this.config.CONTENT_PATH,
      this.config.MEDIA_PATH,
      './logs',
      './plugins'
    ];

    this.log('\nCreating directories...', 'cyan');
    
    for (const dir of directories) {
      const fullPath = path.resolve(dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.log(`✓ Created: ${dir}`, 'green');
      } else {
        this.log(`✓ Exists: ${dir}`, 'yellow');
      }
    }
  }

  async createSampleContent() {
    const indexPath = path.join(this.config.CONTENT_PATH, 'index.md');
    
    if (!fs.existsSync(indexPath)) {
      const sampleContent = `---
title: "Welcome to Stack Blog"
description: "A modern flat-file CMS built with Node.js"
template: "default"
date: "${new Date().toISOString().split('T')[0]}"
featured: true
---

# Welcome to Stack Blog

Congratulations! You have successfully set up Stack Blog, a modern flat-file CMS built with Node.js.

## What's Next?

1. **Explore the Admin Panel**: Visit [/admin](/admin) to start managing your content
2. **Create Your First Post**: Use the admin panel to create new pages and blog posts  
3. **Customize Your Site**: Edit templates in the \`templates/\` directory
4. **Upload Media**: Use the media manager to upload images and files
5. **Configure Plugins**: Explore the plugin system to extend functionality

## Features

- **Flat-File Architecture**: No database required
- **Markdown Support**: Write content in Markdown with frontmatter
- **Admin Panel**: Modern, responsive admin interface
- **REST API**: Complete API for headless usage
- **Search**: Full-text search with intelligent suggestions
- **Security**: Production-ready security features
- **Plugin System**: Extensible architecture

## Getting Started

To log into the admin panel, visit [/admin](/admin) and use the password you set during setup.

For more information, check out the [documentation](docs/) or visit the [GitHub repository](https://github.com/audit-brands/stack_blog).

---

*This content was automatically generated during setup. Feel free to edit or delete it.*`;

      fs.writeFileSync(indexPath, sampleContent);
      this.log('✓ Created sample homepage content', 'green');
    }
  }

  async displaySummary() {
    this.log('\n=== Setup Complete! ===', 'bright');
    this.log('Stack Blog has been successfully configured.\n', 'green');

    this.log('Configuration Summary:', 'bright');
    this.log(`• Environment: ${this.config.NODE_ENV}`, 'cyan');
    this.log(`• Port: ${this.config.PORT}`, 'cyan');
    this.log(`• Domain: ${this.config.DOMAIN}`, 'cyan');
    this.log(`• Content Path: ${this.config.CONTENT_PATH}`, 'cyan');
    this.log(`• Caching: ${this.config.CACHE_ENABLED}`, 'cyan');
    this.log(`• Search: ${this.config.SEARCH_ENABLED}`, 'cyan');

    this.log('\nNext Steps:', 'bright');
    this.log('1. Start the application:', 'yellow');
    this.log('   npm start', 'cyan');
    this.log('2. Visit your site:', 'yellow');
    this.log(`   http://localhost:${this.config.PORT}`, 'cyan');
    this.log('3. Access the admin panel:', 'yellow');
    this.log(`   http://localhost:${this.config.PORT}/admin`, 'cyan');

    if (this.config.NODE_ENV === 'production') {
      this.log('\nProduction Deployment:', 'bright');
      this.log('• Configure SSL certificates', 'yellow');
      this.log('• Set up reverse proxy (Nginx/Apache)', 'yellow');
      this.log('• Configure firewall rules', 'yellow');
      this.log('• Set up monitoring and backups', 'yellow');
      this.log('• Review security documentation', 'yellow');
    }

    this.log('\nDocumentation:', 'bright');
    this.log('• README.md - Getting started guide', 'cyan');
    this.log('• docs/DEPLOYMENT.md - Production deployment', 'cyan');
    this.log('• docs/SECURITY.md - Security configuration', 'cyan');
    this.log('• docs/API.md - REST API documentation', 'cyan');

    this.log('\nSupport:', 'bright');
    this.log('• GitHub Issues: https://github.com/audit-brands/stack_blog/issues', 'cyan');
    this.log('• Documentation: Check the docs/ directory', 'cyan');
  }

  async run() {
    try {
      const proceed = await this.setupEnvironment();
      if (!proceed) {
        rl.close();
        return;
      }

      // Generate and write .env file
      const envContent = this.generateEnvFile();
      fs.writeFileSync(this.envPath, envContent);
      this.log('\n✓ Environment file created (.env)', 'green');

      // Create necessary directories
      await this.createDirectories();

      // Create sample content
      await this.createSampleContent();

      // Display summary
      await this.displaySummary();

    } catch (error) {
      this.log(`\nSetup failed: ${error.message}`, 'red');
      console.error(error);
    } finally {
      rl.close();
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Stack Blog Setup Script

Usage: npm run setup [options]

Options:
  --help, -h     Show this help message
  --password     Generate password hash only
  --secrets      Generate secrets only

Examples:
  npm run setup                    # Interactive setup
  npm run setup -- --password     # Generate password hash only
  npm run setup -- --secrets      # Generate secrets only
`);
  process.exit(0);
}

if (args.includes('--password')) {
  // Password generation only
  const setup = new StackBlogSetup();
  setup.promptForPassword().then(async (password) => {
    const hash = await setup.generatePasswordHash(password);
    setup.log('\nGenerated password hash:', 'green');
    setup.log(hash, 'cyan');
    setup.log('\nAdd this to your .env file as ADMIN_PASSWORD_HASH', 'yellow');
    process.exit(0);
  });
} else if (args.includes('--secrets')) {
  // Secrets generation only
  const setup = new StackBlogSetup();
  const sessionSecret = setup.generateSecureSecret(64);
  const apiKey = setup.generateSecureSecret(32);
  
  setup.log('\nGenerated secrets:', 'green');
  setup.log(`Session Secret: ${sessionSecret}`, 'cyan');
  setup.log(`API Key: ${apiKey}`, 'cyan');
  setup.log('\nAdd these to your .env file', 'yellow');
  process.exit(0);
} else {
  // Full interactive setup
  const setup = new StackBlogSetup();
  setup.run();
}