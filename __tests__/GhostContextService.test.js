const GhostContextService = require('../services/GhostContextService');

// Mock services
const mockContentService = {};
const mockMarkdownService = {
  render: jest.fn(async (content) => `<p>${content}</p>`),
  renderPreview: jest.fn((content, length) => content.substring(0, length))
};

describe('GhostContextService', () => {
  let ghostContextService;

  beforeEach(() => {
    ghostContextService = new GhostContextService(mockContentService, mockMarkdownService);
    jest.clearAllMocks();
  });

  describe('Page to Post Conversion', () => {
    const mockPage = {
      slug: 'test-post',
      content: 'This is test content for the blog post.',
      metadata: {
        title: 'Test Post',
        description: 'This is a test post description',
        author: 'John Doe',
        date: '2025-06-23',
        tags: ['test', 'blog'],
        featured: true
      },
      lastModified: new Date('2025-06-23T10:00:00Z')
    };

    test('should convert Stack Blog page to Ghost post format', async () => {
      const post = await ghostContextService.pageToPost(mockPage, 'https://example.com');

      expect(post).toMatchObject({
        title: 'Test Post',
        slug: 'test-post',
        url: 'https://example.com/test-post',
        excerpt: 'This is a test post description',
        status: 'published',
        featured: true
      });

      expect(post.authors).toHaveLength(1);
      expect(post.authors[0].name).toBe('John Doe');
      expect(post.tags).toHaveLength(2);
      expect(post.tags[0].name).toBe('test');
      expect(post.tags[1].name).toBe('blog');
    });

    test('should handle missing metadata gracefully', async () => {
      const minimalPage = {
        slug: 'minimal-post',
        content: 'Minimal content'
      };

      const post = await ghostContextService.pageToPost(minimalPage);

      expect(post.title).toBe('Untitled');
      expect(post.authors[0].name).toBe('Admin');
      expect(post.tags).toHaveLength(0);
      expect(post.featured).toBe(false);
    });

    test('should generate excerpt from content if description missing', async () => {
      const pageWithoutDescription = {
        slug: 'no-desc',
        content: 'This is a long piece of content that should be used as an excerpt when no description is provided.',
        metadata: {
          title: 'No Description Post'
        }
      };

      const post = await ghostContextService.pageToPost(pageWithoutDescription);

      expect(mockMarkdownService.renderPreview).toHaveBeenCalledWith(
        pageWithoutDescription.content, 
        160
      );
      expect(post.excerpt).toBe(pageWithoutDescription.content.substring(0, 160));
    });
  });

  describe('Multiple Pages to Posts', () => {
    test('should convert array of pages to posts', async () => {
      const pages = [
        {
          slug: 'post-1',
          content: 'Content 1',
          metadata: { title: 'Post 1' }
        },
        {
          slug: 'post-2', 
          content: 'Content 2',
          metadata: { title: 'Post 2' }
        }
      ];

      const posts = await ghostContextService.pagesToPosts(pages);

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe('Post 1');
      expect(posts[1].title).toBe('Post 2');
    });

    test('should handle empty pages array', async () => {
      const posts = await ghostContextService.pagesToPosts([]);
      expect(posts).toHaveLength(0);
    });
  });

  describe('Pagination Generation', () => {
    test('should generate pagination for multiple pages', () => {
      const pagination = ghostContextService.generatePagination(
        2, 5, 'https://example.com', '/blog'
      );

      expect(pagination).toMatchObject({
        page: 2,
        pages: 5,
        next: 'https://example.com/blog/page/3/',
        prev: 'https://example.com/blog/'
      });
    });

    test('should handle first page pagination', () => {
      const pagination = ghostContextService.generatePagination(
        1, 3, 'https://example.com', '/blog'
      );

      expect(pagination.prev).toBeNull();
      expect(pagination.next).toBe('https://example.com/blog/page/2/');
    });

    test('should handle last page pagination', () => {
      const pagination = ghostContextService.generatePagination(
        3, 3, 'https://example.com', '/blog'
      );

      expect(pagination.next).toBeNull();
      expect(pagination.prev).toBe('https://example.com/blog/page/2/');
    });

    test('should return null for single page', () => {
      const pagination = ghostContextService.generatePagination(1, 1);
      expect(pagination).toBeNull();
    });
  });

  describe('Site Context Generation', () => {
    test('should generate basic site context', () => {
      const siteContext = ghostContextService.generateSiteContext();

      expect(siteContext['@site']).toMatchObject({
        title: 'Stack Blog',
        description: 'A flat-file CMS built with Node.js',
        url: 'http://localhost:3000',
        lang: 'en',
        timezone: 'UTC'
      });

      expect(siteContext['@site'].navigation).toHaveLength(3);
    });

    test('should use provided config for site context', () => {
      const config = {
        title: 'My Custom Blog',
        description: 'A custom blog description',
        url: 'https://myblog.com',
        facebook: 'myblog',
        twitter: '@myblog'
      };

      const siteContext = ghostContextService.generateSiteContext(config);

      expect(siteContext['@site']).toMatchObject({
        title: 'My Custom Blog',
        description: 'A custom blog description',
        url: 'https://myblog.com',
        facebook: 'myblog',
        twitter: '@myblog'
      });
    });
  });

  describe('Complete Context Generation', () => {
    test('should generate complete context for index page', async () => {
      const pages = [
        { slug: 'post-1', content: 'Content 1', metadata: { title: 'Post 1' } }
      ];

      const context = await ghostContextService.generateContext({
        pages,
        currentPage: 1,
        totalPages: 2,
        baseUrl: 'https://example.com',
        contextType: 'index'
      });

      expect(context['@site']).toBeDefined();
      expect(context.posts).toHaveLength(1);
      expect(context.pagination).toBeDefined();
      expect(context.context).toEqual(['index']);
    });

    test('should generate complete context for single post', async () => {
      const page = {
        slug: 'my-post',
        content: 'Post content',
        metadata: { title: 'My Post' }
      };

      const context = await ghostContextService.generateContext({
        page,
        baseUrl: 'https://example.com',
        contextType: 'post'
      });

      expect(context.post).toBeDefined();
      expect(context.post.title).toBe('My Post');
      expect(context.page).toBeDefined();
      expect(context.canonical).toBe('https://example.com/my-post');
      expect(context.context).toEqual(['post']);
    });
  });

  describe('Utility Functions', () => {
    test('should parse tags from string', () => {
      const tags = ghostContextService.parseTags('tag1, tag2, tag3', 'https://example.com');

      expect(tags).toHaveLength(3);
      expect(tags[0]).toMatchObject({
        name: 'tag1',
        slug: 'tag1',
        url: 'https://example.com/tag/tag1/'
      });
    });

    test('should parse tags from array', () => {
      const tags = ghostContextService.parseTags(['javascript', 'web-dev'], 'https://example.com');

      expect(tags).toHaveLength(2);
      expect(tags[1]).toMatchObject({
        name: 'web-dev',
        slug: 'web-dev',
        url: 'https://example.com/tag/web-dev/'
      });
    });

    test('should calculate reading time', () => {
      const shortContent = 'This is a short piece of content.';
      const longContent = 'This is a much longer piece of content. '.repeat(50);

      expect(ghostContextService.calculateReadingTime(shortContent)).toBe(1);
      expect(ghostContextService.calculateReadingTime(longContent)).toBeGreaterThan(1);
    });

    test('should generate consistent IDs from slugs', () => {
      const id1 = ghostContextService.generateId('test-post');
      const id2 = ghostContextService.generateId('test-post');
      const id3 = ghostContextService.generateId('different-post');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(typeof id1).toBe('number');
    });

    test('should slugify text correctly', () => {
      expect(ghostContextService.slugify('Hello World!')).toBe('hello-world');
      expect(ghostContextService.slugify('Test & Development')).toBe('test-development');
      expect(ghostContextService.slugify('   Multiple   Spaces   ')).toBe('multiple-spaces');
    });

    test('should parse dates correctly', () => {
      const validDate = ghostContextService.parseDate('2025-06-23');
      const invalidDate = ghostContextService.parseDate('invalid-date');

      expect(validDate).toBeInstanceOf(Date);
      expect(invalidDate).toBeNull();
    });
  });
});