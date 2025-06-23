const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');
const MediaService = require('./MediaService');
const CacheService = require('./CacheService');
const PluginService = require('./PluginService');
const SearchService = require('./SearchService');
const ThemeService = require('./ThemeService');

// Create singleton instances
const cacheService = new CacheService();
const pluginService = new PluginService();
const contentService = new ContentService(cacheService, pluginService);
const markdownService = new MarkdownService(cacheService, pluginService);
const authService = new AuthService();
const mediaService = new MediaService();
const searchService = new SearchService(contentService, markdownService, cacheService);

// Note: ThemeService will be initialized in app.js with app reference
let themeService = null;

module.exports = {
  ContentService,
  MarkdownService,
  AuthService,
  MediaService,
  CacheService,
  PluginService,
  SearchService,
  ThemeService,
  contentService,
  markdownService,
  authService,
  mediaService,
  cacheService,
  pluginService,
  searchService,
  setThemeService: (service) => { themeService = service; },
  getThemeService: () => themeService
};