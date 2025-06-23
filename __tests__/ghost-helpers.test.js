const express = require('express');
const ThemeService = require('../services/ThemeService');

describe('Ghost Helpers Integration', () => {
  let app;
  let themeService;

  beforeAll(() => {
    app = express();
    themeService = new ThemeService(app);
    themeService.activeTheme = 'casper-basic';
  });

  describe('Helper Integration', () => {
    test('foreach helper should work with blog posts', () => {
      const helpers = themeService.getGhostHelpers();
      const posts = [
        { title: 'First Post', slug: 'first-post' },
        { title: 'Second Post', slug: 'second-post' }
      ];

      const mockOptions = {
        fn: (post, options) => {
          const isFirst = options.data.first;
          const isLast = options.data.last;
          return `<article class="${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}">
            <h2>${post.title}</h2>
            <p>Index: ${options.data.index}</p>
          </article>`;
        },
        inverse: () => '<p>No posts available</p>',
        data: {}
      };

      const result = helpers.foreach.call({}, posts, mockOptions);
      expect(result).toContain('First Post');
      expect(result).toContain('Second Post');
      expect(result).toContain('class="first ');
      expect(result).toContain('class=" last"');
      expect(result).toContain('Index: 0');
      expect(result).toContain('Index: 1');
    });

    test('asset helper should generate correct paths', () => {
      const helpers = themeService.getGhostHelpers();
      
      const cssPath = helpers.asset.call(themeService, 'css/screen.css');
      expect(cssPath).toBe('/themes/casper-basic/assets/css/screen.css');
      
      const jsPath = helpers.asset.call(themeService, 'js/main.js');
      expect(jsPath).toBe('/themes/casper-basic/assets/js/main.js');
    });

    test('if helper should handle conditional rendering', () => {
      const helpers = themeService.getGhostHelpers();
      
      const mockOptions = {
        fn: function() { return 'Condition is true'; },
        inverse: function() { return 'Condition is false'; }
      };

      const resultTrue = helpers.if.call({}, true, mockOptions);
      expect(resultTrue).toBe('Condition is true');

      const resultFalse = helpers.if.call({}, false, mockOptions);
      expect(resultFalse).toBe('Condition is false');

      const resultUndefined = helpers.if.call({}, undefined, mockOptions);
      expect(resultUndefined).toBe('Condition is false');
    });

    test('unless helper should handle inverse conditional rendering', () => {
      const helpers = themeService.getGhostHelpers();
      
      const mockOptions = {
        fn: function() { return 'Condition is false'; },
        inverse: function() { return 'Condition is true'; }
      };

      const resultTrue = helpers.unless.call({}, true, mockOptions);
      expect(resultTrue).toBe('Condition is true');

      const resultFalse = helpers.unless.call({}, false, mockOptions);
      expect(resultFalse).toBe('Condition is false');
    });

    test('ghost_head helper should generate meta tags', () => {
      const helpers = themeService.getGhostHelpers();
      
      const context = {
        page: {
          metadata: {
            title: 'Test Page',
            description: 'This is a test page description'
          }
        },
        canonical: 'https://example.com/test-page'
      };

      const result = helpers.ghost_head.call(context);
      expect(result.string).toContain('og:title');
      expect(result.string).toContain('Test Page');
      expect(result.string).toContain('og:description');
      expect(result.string).toContain('This is a test page description');
      expect(result.string).toContain('canonical');
      expect(result.string).toContain('https://example.com/test-page');
    });

    test('ghost_foot helper should return safe string', () => {
      const helpers = themeService.getGhostHelpers();
      
      const result = helpers.ghost_foot.call({});
      expect(result.string).toBeDefined();
      expect(typeof result.string).toBe('string');
    });
  });

  describe('Helper Edge Cases', () => {
    test('foreach should handle non-array input', () => {
      const helpers = themeService.getGhostHelpers();
      
      const mockOptions = {
        fn: () => 'Should not appear',
        inverse: () => 'No items found',
        data: {}
      };

      const resultNull = helpers.foreach.call({}, null, mockOptions);
      expect(resultNull).toBe('No items found');

      const resultUndefined = helpers.foreach.call({}, undefined, mockOptions);
      expect(resultUndefined).toBe('No items found');

      const resultString = helpers.foreach.call({}, 'not an array', mockOptions);
      expect(resultString).toBe('No items found');
    });

    test('asset helper should handle missing options', () => {
      const helpers = themeService.getGhostHelpers();
      
      const result = helpers.asset.call(themeService, 'css/screen.css', null);
      expect(result).toBe('/themes/casper-basic/assets/css/screen.css');
    });
  });
});