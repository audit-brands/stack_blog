const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');

// Create singleton instances
const contentService = new ContentService();
const markdownService = new MarkdownService();
const authService = new AuthService();

module.exports = {
  ContentService,
  MarkdownService,
  AuthService,
  contentService,
  markdownService,
  authService
};