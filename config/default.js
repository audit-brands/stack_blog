const path = require('path');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  paths: {
    content: path.join(__dirname, '../content'),
    templates: path.join(__dirname, '../templates'),
    public: path.join(__dirname, '../public'),
    uploads: path.join(__dirname, '../public/uploads')
  },
  
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || ''
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  content: {
    markdownExtensions: ['.md', '.markdown'],
    defaultTemplate: 'default',
    homeSlug: 'home'
  },
  
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ]
  }
};