const request = require('supertest');
const express = require('express');
const apiRoutes = require('../routes/api');

// Mock services
jest.mock('../services', () => ({
  contentService: {
    listPages: jest.fn(),
    getPage: jest.fn(),
    savePage: jest.fn(),
    deletePage: jest.fn(),
    slugExists: jest.fn(),
    createSlug: jest.fn()
  },
  markdownService: {
    render: jest.fn(),
    extractMetadata: jest.fn()
  },
  searchService: {
    search: jest.fn(),
    getSuggestions: jest.fn(),
    getStats: jest.fn()
  },
  mediaService: {
    listFiles: jest.fn(),
    getFileInfo: jest.fn(),
    deleteFile: jest.fn(),
    getMulterConfig: jest.fn(),
    processImage: jest.fn(),
    imageFormats: ['image/jpeg', 'image/png']
  }
}));

const { contentService, markdownService, searchService, mediaService } = require('../services');

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/status', () => {
    test('should return system status', async () => {
      searchService.getStats.mockReturnValue({
        enabled: true,
        indexSize: 10,
        lastIndexed: Date.now()
      });

      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'operational');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('endpoints');
    });
  });

  describe('GET /api/pages', () => {
    test('should return paginated list of pages', async () => {
      const mockPages = [{
        slug: 'test-page',
        metadata: { title: 'Test Page', description: 'Test description' },
        content: '# Test Content',
        lastModified: new Date()
      }];

      const mockPagination = {
        currentPage: 1,
        totalPages: 1,
        total: 1,
        limit: 10
      };

      contentService.listPages.mockResolvedValue({
        pages: mockPages,
        pagination: mockPagination
      });

      markdownService.render.mockResolvedValue('<h1>Test Content</h1>');
      markdownService.extractMetadata.mockReturnValue({
        wordCount: 2,
        readingTime: 1
      });

      const response = await request(app)
        .get('/api/pages')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pages).toHaveLength(1);
      expect(response.body.data.pages[0]).toHaveProperty('slug', 'test-page');
      expect(response.body.data.pages[0]).toHaveProperty('html', '<h1>Test Content</h1>');
      expect(response.body.data.pagination).toEqual(mockPagination);
    });

    test('should handle pagination parameters', async () => {
      contentService.listPages.mockResolvedValue({
        pages: [],
        pagination: { currentPage: 2, totalPages: 5, total: 50, limit: 10 }
      });

      await request(app)
        .get('/api/pages?page=2&limit=10')
        .expect(200);

      expect(contentService.listPages).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: '',
        template: undefined,
        sortBy: 'date',
        sortOrder: 'desc'
      });
    });
  });

  describe('GET /api/pages/:slug', () => {
    test('should return specific page', async () => {
      const mockPage = {
        slug: 'test-page',
        metadata: { title: 'Test Page', description: 'Test description' },
        content: '# Test Content',
        lastModified: new Date()
      };

      contentService.getPage.mockResolvedValue(mockPage);
      markdownService.render.mockResolvedValue('<h1>Test Content</h1>');
      markdownService.extractMetadata.mockReturnValue({
        wordCount: 2,
        readingTime: 1
      });

      const response = await request(app)
        .get('/api/pages/test-page')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('test-page');
      expect(response.body.data.html).toBe('<h1>Test Content</h1>');
    });

    test('should return 404 for non-existent page', async () => {
      contentService.getPage.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/pages/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });

    test('should skip HTML rendering when html=false', async () => {
      const mockPage = {
        slug: 'test-page',
        metadata: { title: 'Test Page' },
        content: '# Test Content',
        lastModified: new Date()
      };

      contentService.getPage.mockResolvedValue(mockPage);
      markdownService.extractMetadata.mockReturnValue({});

      const response = await request(app)
        .get('/api/pages/test-page?html=false')
        .expect(200);

      expect(response.body.data.html).toBeNull();
      expect(markdownService.render).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/pages', () => {
    test('should create new page without API key when not configured', async () => {
      const newPage = {
        title: 'New Page',
        content: '# New Content',
        description: 'New description'
      };

      const savedPage = {
        slug: 'new-page',
        metadata: { title: 'New Page', description: 'New description', template: 'default' },
        content: '# New Content',
        lastModified: new Date()
      };

      contentService.createSlug.mockReturnValue('new-page');
      contentService.slugExists.mockResolvedValue(false);
      contentService.savePage.mockResolvedValue(savedPage);
      markdownService.render.mockResolvedValue('<h1>New Content</h1>');
      markdownService.extractMetadata.mockReturnValue({});

      const response = await request(app)
        .post('/api/pages')
        .send(newPage)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('new-page');
    });

    test('should require title and content', async () => {
      const response = await request(app)
        .post('/api/pages')
        .send({ title: 'Test' })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });

    test('should handle slug conflicts', async () => {
      contentService.createSlug.mockReturnValue('existing-page');
      contentService.slugExists.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/pages')
        .send({ title: 'Existing Page', content: 'Content' })
        .expect(409);

      expect(response.body.error).toBe('Conflict');
    });
  });

  describe('PUT /api/pages/:slug', () => {
    test('should update existing page without API key when not configured', async () => {
      const existingPage = {
        slug: 'test-page',
        metadata: { title: 'Old Title', date: '2023-01-01' },
        content: 'Old content'
      };

      const updatedPage = {
        slug: 'test-page',
        metadata: { title: 'New Title', date: '2023-01-01', template: 'default' },
        content: 'New content',
        lastModified: new Date()
      };

      contentService.getPage.mockResolvedValue(existingPage);
      contentService.savePage.mockResolvedValue(updatedPage);
      markdownService.render.mockResolvedValue('<p>New content</p>');
      markdownService.extractMetadata.mockReturnValue({});

      const response = await request(app)
        .put('/api/pages/test-page')
        .send({ title: 'New Title', content: 'New content' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Title');
    });

    test('should return 404 for non-existent page', async () => {
      contentService.getPage.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/pages/non-existent')
        .send({ title: 'Title', content: 'Content' })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('DELETE /api/pages/:slug', () => {
    test('should delete existing page without API key when not configured', async () => {
      const existingPage = {
        slug: 'test-page',
        metadata: { title: 'Test Page' }
      };

      contentService.getPage.mockResolvedValue(existingPage);
      contentService.deletePage.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/pages/test-page')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    test('should return 404 for non-existent page', async () => {
      contentService.getPage.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/pages/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/search', () => {
    test('should perform search and return results', async () => {
      const mockSearchResults = {
        results: [
          {
            slug: 'test-page',
            title: 'Test Page',
            snippet: 'Test snippet...',
            score: 5
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          total: 1
        },
        searchTime: 25,
        indexSize: 10
      };

      searchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query).toBe('test');
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.searchTime).toBe(25);
    });

    test('should handle search with filters', async () => {
      searchService.search.mockResolvedValue({
        results: [],
        pagination: { currentPage: 1, totalPages: 0, total: 0 },
        searchTime: 0,
        indexSize: 0
      });

      await request(app)
        .get('/api/search?q=test&template=blog&from=2023-01-01')
        .expect(200);

      expect(searchService.search).toHaveBeenCalledWith('test', {
        page: 1,
        limit: 10,
        sortBy: 'relevance',
        filters: {
          template: 'blog',
          dateFrom: '2023-01-01',
          dateTo: undefined
        }
      });
    });
  });

  describe('GET /api/search/suggestions', () => {
    test('should return search suggestions', async () => {
      searchService.getSuggestions.mockResolvedValue(['test', 'testing', 'tests']);

      const response = await request(app)
        .get('/api/search/suggestions?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(['test', 'testing', 'tests']);
    });

    test('should return empty array for empty query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/media', () => {
    test('should return media files list', async () => {
      const mockFiles = [
        {
          filename: 'image.jpg',
          size: 1024,
          mimetype: 'image/jpeg',
          lastModified: new Date()
        }
      ];

      mediaService.listFiles.mockResolvedValue({
        files: mockFiles,
        pagination: { currentPage: 1, totalPages: 1, total: 1 }
      });

      const response = await request(app)
        .get('/api/media')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(1);
    });
  });

  describe('GET /api/media/:filename', () => {
    test('should return file info', async () => {
      const mockFileInfo = {
        filename: 'image.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        url: '/media/image.jpg'
      };

      mediaService.getFileInfo.mockResolvedValue(mockFileInfo);

      const response = await request(app)
        .get('/api/media/image.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFileInfo);
    });

    test('should return 404 for non-existent file', async () => {
      mediaService.getFileInfo.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/media/non-existent.jpg')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('API Authentication', () => {
    beforeEach(() => {
      // Mock API key for auth tests
      process.env.API_KEY = 'test-api-key';
    });

    afterEach(() => {
      delete process.env.API_KEY;
    });

    test('should require Bearer token for protected endpoints when API key is configured', async () => {
      const response = await request(app)
        .post('/api/pages')
        .send({ title: 'Test', content: 'Content' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('should accept valid Bearer token', async () => {
      contentService.createSlug.mockReturnValue('test-page');
      contentService.slugExists.mockResolvedValue(false);
      contentService.savePage.mockResolvedValue({
        slug: 'test-page',
        metadata: { title: 'Test' },
        content: 'Content',
        lastModified: new Date()
      });
      markdownService.render.mockResolvedValue('<p>Content</p>');
      markdownService.extractMetadata.mockReturnValue({});

      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', 'Bearer test-api-key')
        .send({ title: 'Test', content: 'Content' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid Bearer token', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', 'Bearer invalid-key')
        .send({ title: 'Test', content: 'Content' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });
});