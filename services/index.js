const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');
const MediaService = require('./MediaService');

// Create singleton instances
const contentService = new ContentService();
const markdownService = new MarkdownService();
const authService = new AuthService();
const mediaService = new MediaService();

module.exports = {
  ContentService,
  MarkdownService,
  AuthService,
  MediaService,
  contentService,
  markdownService,
  authService,
  mediaService
};