const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const ThemeService = require('../services/ThemeService');

describe('ThemeService', () => {
  let app;
  let themeService;
  const testThemesPath = path.join(__dirname, '../test-themes');

  beforeAll(async () => {
    app = express();
    themeService = new ThemeService(app);
    
    // Override themes path for testing
    themeService.themesPath = testThemesPath;
    
    // Create test themes directory
    await fs.mkdir(testThemesPath, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test themes directory
    try {
      await fs.rm(testThemesPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      expect(themeService.activeTheme).toBeNull();
      expect(themeService.engine).toBe('nunjucks');
      expect(themeService.handlebarsEngine).toBeNull();
    });

    test('should initialize themes directory', async () => {
      await themeService.initializeThemesDirectory();
      
      const defaultThemePath = path.join(testThemesPath, 'default');
      const stats = await fs.stat(defaultThemePath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Theme Management', () => {
    test('should detect non-existent theme', async () => {
      const exists = await themeService.themeExists('non-existent');
      expect(exists).toBe(false);
    });

    test('should detect existing theme', async () => {
      const testThemePath = path.join(testThemesPath, 'test-theme');
      await fs.mkdir(testThemePath, { recursive: true });
      
      const exists = await themeService.themeExists('test-theme');
      expect(exists).toBe(true);
    });

    test('should list available themes', async () => {
      // Create a few test themes
      await fs.mkdir(path.join(testThemesPath, 'theme1'), { recursive: true });
      await fs.mkdir(path.join(testThemesPath, 'theme2'), { recursive: true });
      
      // Create an index.hbs file to identify as handlebars theme
      await fs.writeFile(path.join(testThemesPath, 'theme1', 'index.hbs'), '<h1>Test Theme</h1>');
      
      const themes = await themeService.listThemes();
      expect(themes.length).toBeGreaterThan(0);
      
      const theme1 = themes.find(t => t.name === 'theme1');
      expect(theme1).toBeDefined();
      expect(theme1.engine).toBe('handlebars');
    });
  });

  describe('Ghost Helpers', () => {
    test('should provide basic Ghost helpers', () => {
      const helpers = themeService.getGhostHelpers();
      
      expect(helpers.foreach).toBeDefined();
      expect(helpers.asset).toBeDefined();
      expect(helpers.if).toBeDefined();
      expect(helpers.unless).toBeDefined();
      expect(helpers.ghost_head).toBeDefined();
      expect(helpers.ghost_foot).toBeDefined();
      expect(typeof helpers.foreach).toBe('function');
    });

    test('should handle foreach helper with array', () => {
      const helpers = themeService.getGhostHelpers();
      const context = ['item1', 'item2', 'item3'];
      
      const mockOptions = {
        fn: (item, options) => `<li>${item}</li>`,
        inverse: () => '<li>No items</li>',
        data: {}
      };
      
      const result = helpers.foreach.call({}, context, mockOptions);
      expect(result).toBe('<li>item1</li><li>item2</li><li>item3</li>');
    });

    test('should handle empty array in foreach helper', () => {
      const helpers = themeService.getGhostHelpers();
      const context = [];
      
      const mockOptions = {
        fn: (item) => `<li>${item}</li>`,
        inverse: () => '<li>No items</li>',
        data: {}
      };
      
      const result = helpers.foreach.call({}, context, mockOptions);
      expect(result).toBe('<li>No items</li>');
    });
  });

  describe('Engine Configuration', () => {
    test('should configure Handlebars engine', () => {
      const engine = themeService.configureHandlebarsEngine();
      expect(engine).toBeDefined();
      expect(themeService.handlebarsEngine).toBeDefined();
    });

    test('should return current engine', () => {
      expect(themeService.getCurrentEngine()).toBe('nunjucks');
    });
  });
});