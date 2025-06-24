const { 
  ThemeService, 
  GhostContextService,
  ContentService,
  MarkdownService,
  CacheService,
  PluginService
} = require('../services');
const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

describe('Casper Theme Demo', () => {
  test('demonstrates Ghost theme rendering capability', async () => {
    // Create services
    const cacheService = new CacheService();
    const pluginService = new PluginService();
    const markdownService = new MarkdownService(cacheService, pluginService);
    const contentService = new ContentService(cacheService, pluginService);
    const ghostContextService = new GhostContextService(contentService, markdownService);
    
    // Create Express app
    const app = express();
    const themeService = new ThemeService(app);
    
    // Set up theme
    await themeService.setActiveTheme('casper-basic', 'handlebars');
    
    // Create sample content
    const samplePage = {
      slug: 'demo-post',
      content: 'This is **demo content** for Ghost theme testing.',
      metadata: {
        title: 'Demo Post',
        description: 'A demo post showing Ghost theme compatibility',
        author: 'Demo Author',
        date: '2025-06-23',
        tags: ['demo', 'ghost'],
        featured: true
      }
    };
    
    // Generate Ghost context
    const context = await ghostContextService.generateContext({
      page: samplePage,
      pages: [samplePage],
      baseUrl: 'http://localhost:3000',
      contextType: 'index',
      config: {
        title: 'Demo Blog',
        description: 'Demonstrating Ghost theme support'
      }
    });
    
    // Verify context structure
    expect(context['@site']).toBeDefined();
    expect(context['@site'].title).toBe('Demo Blog');
    expect(context.posts).toHaveLength(1);
    expect(context.posts[0].title).toBe('Demo Post');
    expect(context.posts[0].featured).toBe(true);
    expect(context.posts[0].authors[0].name).toBe('Demo Author');
    expect(context.posts[0].tags).toHaveLength(2);
    
    // Test Handlebars rendering with Ghost helpers
    const handlebars = themeService.handlebarsEngine.handlebars;
    const helpers = themeService.getGhostHelpers();
    
    // Register helpers
    Object.keys(helpers).forEach(name => {
      handlebars.registerHelper(name, helpers[name]);
    });
    
    // Simple template test
    const template = handlebars.compile(`
      {{#foreach posts}}
        <article class="{{#if featured}}featured{{/if}}">
          <h2>{{title}}</h2>
          <p>By {{#foreach authors}}{{name}}{{/foreach}}</p>
          <div>{{{html}}}</div>
          {{#foreach tags}}
            <span class="tag">{{name}}</span>
          {{/foreach}}
        </article>
      {{/foreach}}
    `);
    
    const rendered = template(context);
    
    // Verify rendering
    expect(rendered).toContain('Demo Post');
    expect(rendered).toContain('Demo Author');
    expect(rendered).toContain('class="featured"');
    expect(rendered).toContain('<span class="tag">demo</span>');
    expect(rendered).toContain('<span class="tag">ghost</span>');
    expect(rendered).toContain('<p>This is <strong>demo content</strong>');
    
    // Test asset helper
    themeService.activeTheme = 'casper-basic';
    const assetPath = helpers.asset.call(themeService, 'css/screen.css');
    expect(assetPath).toBe('/themes/casper-basic/assets/css/screen.css');
    
    // Test ghost_head helper with proper context
    const pageContext = { 
      page: { metadata: context.posts[0] }, 
      canonical: 'http://localhost:3000/demo-post' 
    };
    const headContent = helpers.ghost_head.call(pageContext);
    expect(headContent.string).toContain('canonical');
    expect(headContent.string).toContain('http://localhost:3000/demo-post');
    
    console.log('\n✅ Ghost Theme Compatibility Demonstrated:');
    console.log('  - Handlebars templates rendering');
    console.log('  - Ghost helpers working (foreach, if, asset, ghost_head)');
    console.log('  - Stack Blog content mapped to Ghost format');
    console.log('  - Casper theme structure ready for use');
    console.log('\n🎉 Phase 1 Complete: Ghost themes can now be used with Stack Blog!');
  });
});