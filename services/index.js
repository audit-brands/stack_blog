const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');
const AuthService = require('./AuthService');
const MediaService = require('./MediaService');
const CacheService = require('./CacheService');
const PluginService = require('./PluginService');
const SearchService = require('./SearchService');
const ThemeService = require('./ThemeService');
const GhostContextService = require('./GhostContextService');
const RoutesService = require('./RoutesService');

// Create singleton instances
const cacheService = new CacheService();
const pluginService = new PluginService();
const contentService = new ContentService(cacheService, pluginService);
const markdownService = new MarkdownService(cacheService, pluginService);
const authService = new AuthService();
const mediaService = new MediaService();
const searchService = new SearchService(contentService, markdownService, cacheService);
const ghostContextService = new GhostContextService(contentService, markdownService);
const routesService = new RoutesService();

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
  GhostContextService,
  RoutesService,
  contentService,
  markdownService,
  authService,
  mediaService,
  cacheService,
  pluginService,
  searchService,
  ghostContextService,
  routesService,
  setThemeService: (service) => { themeService = service; },
  getThemeService: () => themeService
};