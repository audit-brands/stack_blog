const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

describe('Theme Asset Serving', () => {
  let app;
  
  beforeAll(async () => {
    // Clear module cache to get fresh app instance
    delete require.cache[require.resolve('../app')];
    process.env.SESSION_SECRET = 'test-secret';
    process.env.API_KEY = 'test-api-key';
    
    app = require('../app');
    
    // Ensure test theme CSS file exists
    const themePath = path.join(__dirname, '../themes/casper-basic/assets/css');
    const cssContent = await fs.readFile(path.join(themePath, 'screen.css'), 'utf-8').catch(() => null);
    
    if (!cssContent) {
      // Create a minimal CSS file for testing if it doesn't exist
      await fs.mkdir(themePath, { recursive: true });
      await fs.writeFile(
        path.join(themePath, 'screen.css'),
        '/* Test CSS */ body { margin: 0; }'
      );
    }
  });

  describe('GET /themes/*', () => {
    test('should serve theme CSS files', async () => {
      const response = await request(app)
        .get('/themes/casper-basic/assets/css/screen.css')
        .expect(200)
        .expect('Content-Type', /text\/css/);
      
      expect(response.text).toContain('/* Basic Casper-inspired CSS');
    });

    test('should return 404 for non-existent theme assets', async () => {
      await request(app)
        .get('/themes/non-existent-theme/assets/style.css')
        .expect(404);
    });

    test('should set proper cache headers in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Need to restart app for env change to take effect
      delete require.cache[require.resolve('../app')];
      const prodApp = require('../app');
      
      const response = await request(prodApp)
        .get('/themes/casper-basic/assets/css/screen.css')
        .expect(200);
      
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age=86400');
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should serve JavaScript files with correct content type', async () => {
      // Create a test JS file
      const jsPath = path.join(__dirname, '../themes/casper-basic/assets/js');
      await fs.mkdir(jsPath, { recursive: true });
      await fs.writeFile(
        path.join(jsPath, 'main.js'),
        '// Test JavaScript\nconsole.log("Theme loaded");'
      );
      
      const response = await request(app)
        .get('/themes/casper-basic/assets/js/main.js')
        .expect(200)
        .expect('Content-Type', /application\/javascript/);
      
      expect(response.text).toContain('Theme loaded');
    });

    test('should handle nested theme directories', async () => {
      // Create nested test file
      const nestedPath = path.join(__dirname, '../themes/casper-basic/assets/vendor/lib');
      await fs.mkdir(nestedPath, { recursive: true });
      await fs.writeFile(
        path.join(nestedPath, 'vendor.css'),
        '/* Vendor CSS */'
      );
      
      const response = await request(app)
        .get('/themes/casper-basic/assets/vendor/lib/vendor.css')
        .expect(200);
      
      expect(response.text).toContain('/* Vendor CSS */');
    });

    test('should prevent directory listing', async () => {
      await request(app)
        .get('/themes/casper-basic/assets/')
        .expect(404);
      
      await request(app)
        .get('/themes/casper-basic/')
        .expect(404);
    });

    test('should handle font files with proper content types', async () => {
      const fontsPath = path.join(__dirname, '../themes/casper-basic/assets/fonts');
      await fs.mkdir(fontsPath, { recursive: true });
      
      // Create dummy font files
      const fontTests = [
        { file: 'font.woff2', contentType: /font\/woff2/ },
        { file: 'font.ttf', contentType: /font\/ttf/ },
        { file: 'font.eot', contentType: /application\/vnd\.ms-fontobject/ }
      ];
      
      for (const test of fontTests) {
        await fs.writeFile(
          path.join(fontsPath, test.file),
          'dummy font data'
        );
        
        await request(app)
          .get(`/themes/casper-basic/assets/fonts/${test.file}`)
          .expect(200)
          .expect('Content-Type', test.contentType);
      }
    });
  });

  describe('Asset Helper Integration', () => {
    test('should resolve asset paths correctly', async () => {
      const { getThemeService } = require('../services');
      const themeService = getThemeService();
      
      if (themeService) {
        const helpers = themeService.getGhostHelpers();
        themeService.activeTheme = 'casper-basic';
        
        const assetPath = helpers.asset.call(themeService, 'css/screen.css');
        expect(assetPath).toBe('/themes/casper-basic/assets/css/screen.css');
        
        // Verify the resolved path is accessible
        await request(app)
          .get(assetPath)
          .expect(200);
      }
    });
  });

  afterAll(async () => {
    // Clean up test files
    const testFiles = [
      '../themes/casper-basic/assets/js/main.js',
      '../themes/casper-basic/assets/vendor/lib/vendor.css',
      '../themes/casper-basic/assets/fonts/font.woff2',
      '../themes/casper-basic/assets/fonts/font.ttf',
      '../themes/casper-basic/assets/fonts/font.eot'
    ];
    
    for (const file of testFiles) {
      try {
        await fs.unlink(path.join(__dirname, file));
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});