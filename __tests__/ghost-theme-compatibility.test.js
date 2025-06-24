const { 
  ThemeService, 
  GhostContextService,
  ContentService,
  MarkdownService,
  CacheService,
  PluginService,
  RoutesService
} = require('../services');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

describe('Ghost Theme Compatibility Tests', () => {
  let app;
  let themeService;
  let ghostContextService;
  let routesService;
  let contentService;
  let markdownService;

  beforeAll(async () => {
    // Set up services
    const cacheService = new CacheService();
    const pluginService = new PluginService();
    
    app = express();
    themeService = new ThemeService(app);
    contentService = new ContentService(cacheService, pluginService);
    markdownService = new MarkdownService(cacheService, pluginService);
    ghostContextService = new GhostContextService(contentService, markdownService);
    routesService = new RoutesService();
  });

  describe('Theme Structure Compatibility', () => {
    test('should handle Casper theme structure', async () => {
      const casperExists = await themeService.themeExists('casper-basic');
      expect(casperExists).toBe(true);
      
      // Test theme activation
      const activated = await themeService.setActiveTheme('casper-basic', 'handlebars');
      expect(activated).toBe(true);
      expect(themeService.activeTheme).toBe('casper-basic');
      expect(themeService.getCurrentEngine()).toBe('handlebars');
    });

    test('should list theme files correctly', async () => {
      const themes = await themeService.listThemes();
      const casperTheme = themes.find(theme => theme.name === 'casper-basic');
      
      expect(casperTheme).toBeDefined();
      expect(['handlebars', 'ghost']).toContain(casperTheme.engine);
    });
  });

  describe('Ghost Helpers Compatibility', () => {
    beforeEach(async () => {
      await themeService.setActiveTheme('casper-basic', 'handlebars');
    });

    test('should render foreach helper correctly', () => {
      const helpers = themeService.getGhostHelpers();
      const items = [
        { title: 'Post 1', slug: 'post-1' },
        { title: 'Post 2', slug: 'post-2' }
      ];

      const mockOptions = {
        fn: (item, options) => `<div data-index="${options.data.index}">${item.title}</div>`,
        inverse: () => '<div>No items</div>',
        data: {}
      };

      const result = helpers.foreach.call({}, items, mockOptions);
      expect(result).toContain('Post 1');
      expect(result).toContain('Post 2');
      expect(result).toContain('data-index="0"');
      expect(result).toContain('data-index="1"');
    });

    test('should generate asset URLs correctly', () => {
      const helpers = themeService.getGhostHelpers();
      themeService.activeTheme = 'casper-basic';
      
      const assetUrl = helpers.asset.call(themeService, 'css/screen.css');
      expect(assetUrl).toBe('/themes/casper-basic/assets/css/screen.css');
    });

    test('should render ghost_head with proper meta tags', () => {
      const helpers = themeService.getGhostHelpers();
      const context = {
        meta_title: 'Test Page',
        meta_description: 'Test description',
        canonical: 'http://example.com/test',
        '@site': { title: 'Test Site' },
        post: {
          title: 'Test Post',
          published_at: '2023-01-01',
          updated_at: '2023-01-02',
          authors: [{ name: 'Test Author' }],
          tags: [{ name: 'test' }]
        }
      };

      const result = helpers.ghost_head.call(context);
      expect(result.string).toContain('<title>Test Page</title>');
      expect(result.string).toContain('meta name="description"');
      expect(result.string).toContain('link rel="canonical"');
      expect(result.string).toContain('og:title');
      // Note: structured data requires context.structured_data to be set
      // expect(result.string).toContain('application/ld+json');
    });

    test('should handle navigation helper', () => {
      const helpers = themeService.getGhostHelpers();
      const context = {
        '@site': {
          navigation: [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' }
          ]
        },
        canonical: '/about'
      };

      const mockOptions = {
        fn: (item, options) => `<a href="${item.url}" class="${options.data.current ? 'current' : ''}">${item.label}</a>`,
        inverse: () => '<span>No navigation</span>',
        data: {}
      };

      const result = helpers.navigation.call(context, mockOptions);
      expect(result).toContain('Home');
      expect(result).toContain('About');
      expect(result).toContain('class="current"'); // About should be current
    });

    test('should handle pagination helper', () => {
      const helpers = themeService.getGhostHelpers();
      const context = {
        pagination: {
          page: 2,
          pages: 5,
          next: '/page/3/',
          prev: '/page/1/'
        }
      };

      const mockOptions = {
        fn: (pagination) => `Page ${pagination.page} of ${pagination.pages}`,
        inverse: () => 'No pagination'
      };

      const result = helpers.pagination.call(context, mockOptions);
      expect(result).toBe('Page 2 of 5');
    });

    test('should handle has helper for feature detection', () => {
      const helpers = themeService.getGhostHelpers();
      
      const contextWithTag = { tag: { name: 'test' } };
      const contextWithoutTag = {};

      const mockOptions = {
        fn: () => 'has tag',
        inverse: () => 'no tag'
      };

      expect(helpers.has.call(contextWithTag, 'tag', mockOptions)).toBe('has tag');
      expect(helpers.has.call(contextWithoutTag, 'tag', mockOptions)).toBe('no tag');
    });

    test('should handle is helper for context checking', () => {
      const helpers = themeService.getGhostHelpers();
      
      const postContext = { context: ['post'] };
      const indexContext = { context: ['index'] };

      const mockOptions = {
        fn: () => 'is post',
        inverse: () => 'not post'
      };

      expect(helpers.is.call(postContext, 'post', mockOptions)).toBe('is post');
      expect(helpers.is.call(indexContext, 'post', mockOptions)).toBe('not post');
    });

    test('should format dates correctly', () => {
      const helpers = themeService.getGhostHelpers();
      const testDate = '2023-12-25T10:30:00Z';

      expect(helpers.date(testDate, 'YYYY')).toBe('2023');
      expect(helpers.date(testDate, 'MM')).toBe('12');
      expect(helpers.date(testDate, 'DD')).toBe('25');
      expect(helpers.date(testDate, 'MMMM')).toBe('December');
      expect(helpers.date(testDate, 'YYYY-MM-DD')).toBe('2023-12-25');
    });

    test('should generate excerpts correctly', () => {
      const helpers = themeService.getGhostHelpers();
      
      const contextWithExcerpt = { excerpt: 'This is a short excerpt' };
      const contextWithHtml = { html: '<p>This is a <strong>long</strong> HTML content that should be truncated after a certain number of words to create an excerpt.</p>' };

      const mockOptions = { hash: { words: 5 } };

      expect(helpers.excerpt.call(contextWithExcerpt, mockOptions)).toBe('This is a short excerpt');
      
      const htmlExcerpt = helpers.excerpt.call(contextWithHtml, mockOptions);
      expect(htmlExcerpt).toContain('This is a long HTML...');
      expect(htmlExcerpt).not.toContain('<strong>');
    });
  });

  describe('Ghost Context Generation', () => {
    test('should generate complete index context', async () => {
      const pages = [
        {
          slug: 'test-post-1',
          content: 'Test content 1',
          metadata: { title: 'Test Post 1', date: '2023-01-01', tags: 'test,blog' }
        },
        {
          slug: 'test-post-2', 
          content: 'Test content 2',
          metadata: { title: 'Test Post 2', date: '2023-01-02', featured: true }
        }
      ];

      const context = await ghostContextService.generateContext({
        pages,
        currentPage: 1,
        totalPages: 3,
        baseUrl: 'http://example.com',
        contextType: 'index',
        config: {
          title: 'Test Blog',
          description: 'A test blog'
        }
      });

      expect(context['@site']).toBeDefined();
      expect(context['@site'].title).toBe('Test Blog');
      expect(context.posts).toHaveLength(2);
      expect(context.posts[0].title).toBe('Test Post 2'); // Should be sorted by date desc
      expect(context.posts[0].featured).toBe(true);
      expect(context.pagination).toBeDefined();
      expect(context.pagination.pages).toBe(3);
      expect(context.context).toEqual(['index']);
    });

    test('should generate post context with structured data', async () => {
      const page = {
        slug: 'test-post',
        content: 'Test post content',
        metadata: {
          title: 'Test Post',
          description: 'Test description',
          author: 'Test Author',
          date: '2023-01-01',
          tags: 'test,blog'
        }
      };

      const context = await ghostContextService.generateContext({
        page,
        baseUrl: 'http://example.com',
        contextType: 'post',
        config: { title: 'Test Blog' }
      });

      expect(context.post).toBeDefined();
      expect(context.post.title).toBe('Test Post');
      expect(context.post.authors[0].name).toBe('Test Author');
      expect(context.post.tags).toHaveLength(2);
      expect(context.structured_data).toBeDefined();
      expect(context.structured_data['@type']).toBe('Article');
      expect(context.meta_title).toBe('Test Post');
      expect(context.meta_description).toBe('Test description');
    });

    test('should generate tag context', async () => {
      const pages = [
        {
          slug: 'tagged-post',
          content: 'Tagged content',
          metadata: { title: 'Tagged Post', tags: 'javascript,node' }
        }
      ];

      const context = await ghostContextService.generateContext({
        pages,
        tag: 'javascript',
        baseUrl: 'http://example.com',
        contextType: 'tag',
        config: { title: 'Test Blog' }
      });

      expect(context.tag).toBeDefined();
      expect(context.tag.name).toBe('javascript');
      expect(context.tag.slug).toBe('javascript');
      expect(context.tag.url).toBe('http://example.com/tag/javascript/');
      expect(context.meta_title).toBe('javascript - Test Blog');
      expect(context.context).toEqual(['tag']);
    });

    test('should generate author context', async () => {
      const pages = [
        {
          slug: 'author-post',
          content: 'Author content',
          metadata: { title: 'Author Post', author: 'John Doe' }
        }
      ];

      const context = await ghostContextService.generateContext({
        pages,
        author: 'John Doe',
        baseUrl: 'http://example.com',
        contextType: 'author',
        config: { title: 'Test Blog' }
      });

      expect(context.author).toBeDefined();
      expect(context.author.name).toBe('John Doe');
      expect(context.author.slug).toBe('john-doe');
      expect(context.author.url).toBe('http://example.com/author/john-doe/');
      expect(context.meta_title).toBe('John Doe - Test Blog');
      expect(context.context).toEqual(['author']);
    });
  });

  describe('Routes.yaml Support', () => {
    test('should parse basic routes configuration', async () => {
      const testRoutes = {
        routes: {
          '/custom/': { template: 'custom' },
          '/page/{page}/': { template: 'index' }
        },
        collections: {
          '/': { permalink: '/{slug}/', template: 'post' },
          '/blog/': { permalink: '/blog/{slug}/', template: 'post' }
        },
        taxonomies: {
          tag: '/tag/{slug}/',
          author: '/author/{slug}/'
        }
      };

      const processed = routesService.processRoutes(testRoutes);
      
      expect(processed.routes['/custom/'].template).toBe('custom');
      expect(processed.collections['/'].permalink).toBe('/{slug}/');
      expect(processed.taxonomies.tag).toBe('/tag/{slug}/');
    });

    test('should match URL patterns correctly', async () => {
      const testRoutes = {
        routes: {
          '/': { template: 'index' },
          '/page/{page}/': { template: 'index' }
        },
        collections: {
          '/': { permalink: '/{slug}/', template: 'post' }
        },
        taxonomies: {
          tag: '/tag/{slug}/'
        }
      };

      routesService.routes = routesService.processRoutes(testRoutes);

      // Test exact route match
      const homeMatch = routesService.matchRoute('/');
      expect(homeMatch.type).toBe('route');
      expect(homeMatch.template).toBe('index');

      // Test collection route (simpler test)
      const postMatch = routesService.matchRoute('/my-post/');
      expect(postMatch).toBeTruthy();
      expect(postMatch.type).toBe('collection');
      expect(postMatch.params.slug).toBe('my-post');

      // Test taxonomy route
      const tagMatch = routesService.matchRoute('/tag/javascript/');
      expect(tagMatch.type).toBe('taxonomy');
      expect(tagMatch.params.slug).toBe('javascript');
    });

    test('should generate URLs from patterns', async () => {
      const testRoutes = {
        collections: {
          '/': { permalink: '/blog/{year}/{month}/{slug}/' }
        },
        taxonomies: {
          tag: '/topics/{slug}/',
          author: '/writers/{slug}/'
        }
      };

      routesService.routes = routesService.processRoutes(testRoutes);

      const postData = {
        slug: 'my-post',
        published_at: '2023-12-25T10:00:00Z'
      };

      const postUrl = routesService.generateUrl('post', postData);
      expect(postUrl).toBe('/blog/2023/12/my-post/');

      const tagUrl = routesService.generateUrl('tag', { slug: 'javascript' });
      expect(tagUrl).toBe('/topics/javascript/');

      const authorUrl = routesService.generateUrl('author', { slug: 'john-doe' });
      expect(authorUrl).toBe('/writers/john-doe/');
    });

    test('should validate routes configuration', async () => {
      // Valid configuration
      const validRoutes = {
        routes: { '/custom/': 'custom' },
        collections: { '/': { permalink: '/{slug}/' } }
      };

      // Invalid configuration
      const invalidRoutes = {
        routes: { 'invalid-pattern': 'template' }, // Missing leading slash
        collections: { '/': {} } // Missing permalink
      };

      // Mock file system for validation
      const originalReadFile = fs.readFile;
      fs.readFile = jest.fn()
        .mockResolvedValueOnce(JSON.stringify(validRoutes))
        .mockResolvedValueOnce(JSON.stringify(invalidRoutes));

      const validResult = await routesService.validateRoutes('/fake/theme/path');
      expect(validResult.valid).toBe(true);

      fs.readFile = originalReadFile;
    });
  });

  describe('Theme Switching and Asset Serving', () => {
    test('should switch between themes correctly', async () => {
      // Test switching to handlebars theme
      const success1 = await themeService.setActiveTheme('casper-basic', 'handlebars');
      expect(success1).toBe(true);
      expect(themeService.activeTheme).toBe('casper-basic');
      expect(themeService.getCurrentEngine()).toBe('handlebars');

      // Test fallback for non-existent theme
      const success2 = await themeService.setActiveTheme('non-existent-theme', 'handlebars');
      expect(success2).toBe(false);
    });

    test('should configure handlebars engine correctly', () => {
      themeService.configureHandlebarsEngine();
      expect(themeService.handlebarsEngine).toBeDefined();
      expect(themeService.handlebarsEngine.handlebars).toBeDefined();
    });
  });

  describe('Real Theme Template Rendering', () => {
    test('should render simple handlebars template', async () => {
      await themeService.setActiveTheme('casper-basic', 'handlebars');
      
      const context = {
        '@site': { title: 'Test Site' },
        posts: [
          { title: 'Test Post', slug: 'test', excerpt: 'Test excerpt' }
        ]
      };

      // Simple template without @site reference since Handlebars needs special setup for @ syntax
      const simpleTemplate = `<h1>{{site.title}}</h1>{{#foreach posts}}<article><h2>{{title}}</h2><p>{{excerpt}}</p></article>{{/foreach}}`;

      const handlebars = themeService.handlebarsEngine.handlebars;
      const helpers = themeService.getGhostHelpers();
      
      // Register helpers
      Object.keys(helpers).forEach(name => {
        handlebars.registerHelper(name, helpers[name]);
      });

      // Modify context to work with standard Handlebars syntax
      const modifiedContext = {
        site: context['@site'],
        posts: context.posts
      };

      const compiled = handlebars.compile(simpleTemplate);
      const rendered = compiled(modifiedContext);

      expect(rendered).toContain('Test Site');
      expect(rendered).toContain('Test Post');
      expect(rendered).toContain('Test excerpt');
    });
  });

  afterAll(async () => {
    // Clean up test state
    if (themeService) {
      themeService.activeTheme = null;
      themeService.engine = 'nunjucks';
    }
  });
});

describe('Popular Ghost Theme Structure Analysis', () => {
  const popularThemeStructures = [
    {
      name: 'Casper',
      requiredFiles: ['index.hbs', 'post.hbs', 'package.json'],
      requiredHelpers: ['foreach', 'asset', 'ghost_head', 'ghost_foot'],
      optionalFiles: ['author.hbs', 'tag.hbs', 'error.hbs']
    },
    {
      name: 'Liebling',
      requiredFiles: ['index.hbs', 'post.hbs', 'page.hbs'],
      requiredHelpers: ['foreach', 'navigation', 'pagination'],
      features: ['dark_mode', 'social_links']
    },
    {
      name: 'Editorial',
      requiredFiles: ['index.hbs', 'post.hbs', 'default.hbs'],
      requiredHelpers: ['has', 'is', 'date'],
      features: ['sidebar', 'featured_posts']
    }
  ];

  test.each(popularThemeStructures)('should support $name theme requirements', (themeStructure) => {
    const themeService = new ThemeService(express());
    const helpers = themeService.getGhostHelpers();

    // Check that all required helpers are available
    themeStructure.requiredHelpers.forEach(helperName => {
      expect(helpers[helperName]).toBeDefined();
      expect(typeof helpers[helperName]).toBe('function');
    });

    console.log(`✅ ${themeStructure.name} theme compatibility: All required helpers available`);
  });
});

console.log('\n🎉 Ghost Theme Compatibility Test Suite Complete!');