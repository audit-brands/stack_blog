const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');
const MediaService = require('./MediaService');
const CacheService = require('./CacheService');
const PluginService = require('./PluginService');
const SearchService = require('./SearchService');

// Create singleton instances
const cacheService = new CacheService();
const pluginService = new PluginService();
const contentService = new ContentService(cacheService, pluginService);
const markdownService = new MarkdownService(cacheService, pluginService);
const authService = new AuthService();
const mediaService = new MediaService();
const searchService = new SearchService(contentService, markdownService, cacheService);

module.exports = {
  ContentService,
  MarkdownService,
  AuthService,
  MediaService,
  CacheService,
  PluginService,
  SearchService,
  contentService,
  markdownService,
  authService,
  mediaService,
  cacheService,
  pluginService,
  searchService
};