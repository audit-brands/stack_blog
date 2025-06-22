const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');
const MediaService = require('./MediaService');
const CacheService = require('./CacheService');

// Create singleton instances
const cacheService = new CacheService();
const contentService = new ContentService(cacheService);
const markdownService = new MarkdownService(cacheService);
const authService = new AuthService();
const mediaService = new MediaService();

module.exports = {
  ContentService,
  MarkdownService,
  AuthService,
  MediaService,
  CacheService,
  contentService,
  markdownService,
  authService,
  mediaService,
  cacheService
};