const SearchService = require('../services/SearchService');

// Mock services
const mockContentService = {
  listPages: jest.fn(),
  contentPath: '/test/content'
};

const mockMarkdownService = {
  render: jest.fn(),
  extractMetadata: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  generateKey: jest.fn()
};

describe('SearchService', () => {
  let searchService;

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService(mockContentService, mockMarkdownService, mockCacheService);
  });

  describe('constructor', () => {
    test('should initialize with disabled state in test environment', () => {
      expect(searchService.enabled).toBe(false);
    });

    test('should initialize search index', () => {
      expect(searchService.searchIndex).toBeInstanceOf(Map);
      expect(searchService.searchIndex.size).toBe(0);
    });
  });

  describe('extractPlainText', () => {
    test('should remove markdown syntax', () => {
      const markdown = '# Hello **World**\n\nThis is `code` and [link](url).';
      const result = searchService.extractPlainText(markdown);
      
      expect(result).toBe('Hello World This is and link.');
    });

    test('should handle empty content', () => {
      expect(searchService.extractPlainText('')).toBe('');
      expect(searchService.extractPlainText(null)).toBe('');
    });

    test('should remove code blocks', () => {
      const markdown = 'Text\n```javascript\nconst code = "test";\n```\nMore text';
      const result = searchService.extractPlainText(markdown);
      
      expect(result).toBe('Text More text');
    });
  });

  describe('normalizeText', () => {
    test('should normalize text for searching', () => {
      const text = 'Hello, World! This is a TEST.';
      const result = searchService.normalizeText(text);
      
      expect(result).toBe('hello world this is a test');
    });

    test('should handle special characters', () => {
      const text = 'Test@#$%^&*()text';
      const result = searchService.normalizeText(text);
      
      expect(result).toBe('test text');
    });
  });

  describe('needsIndexing', () => {
    test('should return false when disabled', () => {
      expect(searchService.needsIndexing()).toBe(false);
    });

    test('should return true when not indexed', () => {
      searchService.enabled = true;
      expect(searchService.needsIndexing()).toBe(true);
    });

    test('should return true when index is expired', () => {
      searchService.enabled = true;
      searchService.lastIndexed = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      expect(searchService.needsIndexing()).toBe(true);
    });
  });

  describe('calculateRelevanceScore', () => {
    test('should calculate relevance score correctly', () => {
      const doc = {
        title: 'Test Title',
        description: 'Test description',
        content: 'This is test content with multiple test words',
        searchText: 'test title test description this is test content with multiple test words'
      };
      const queryTerms = ['test'];
      const originalQuery = 'test';
      
      const score = searchService.calculateRelevanceScore(doc, queryTerms, originalQuery);
      
      expect(score).toBeGreaterThan(0);
    });

    test('should give higher score for exact phrase matches', () => {
      const doc = {
        title: 'Test Document',
        description: 'A test document',
        content: 'This is a test document',
        searchText: 'test document a test document this is a test document'
      };
      const queryTerms = ['test', 'document'];
      const originalQuery = 'test document';
      
      const score = searchService.calculateRelevanceScore(doc, queryTerms, originalQuery);
      
      expect(score).toBeGreaterThan(10); // Should include exact phrase bonus
    });
  });

  describe('generateSnippet', () => {
    test('should generate snippet with highlighted terms', () => {
      const content = 'This is a long piece of content that contains test words for testing purposes.';
      const queryTerms = ['test'];
      
      const snippet = searchService.generateSnippet(content, queryTerms, 50);
      
      expect(snippet).toContain('<mark>test</mark>');
      expect(snippet.length).toBeLessThanOrEqual(100); // Accounting for markup
    });

    test('should handle content shorter than max length', () => {
      const content = 'Short content';
      const queryTerms = ['content'];
      
      const snippet = searchService.generateSnippet(content, queryTerms, 50);
      
      expect(snippet).toBe('Short <mark>content</mark>');
    });

    test('should return truncated content when no query terms', () => {
      const content = 'This is a long piece of content that should be truncated.';
      const queryTerms = [];
      
      const snippet = searchService.generateSnippet(content, queryTerms, 20);
      
      expect(snippet).toBe('This is a long piece...');
    });
  });

  describe('search', () => {
    test('should use fallback search when disabled', async () => {
      mockContentService.listPages.mockResolvedValue({
        pages: [{
          slug: 'test',
          metadata: { title: 'Test Page' },
          content: 'Test content',
          lastModified: new Date()
        }]
      });

      const result = await searchService.search('test');
      
      expect(result.fallback).toBe(true);
      expect(mockContentService.listPages).toHaveBeenCalled();
    });

    test('should return empty results for empty query when enabled', async () => {
      searchService.enabled = true;
      const result = await searchService.search('');
      
      expect(result.results).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    test('should handle search errors gracefully', async () => {
      mockContentService.listPages.mockRejectedValue(new Error('Test error'));
      
      const result = await searchService.search('test');
      
      expect(result.error).toBe('Test error');
      expect(result.results).toEqual([]);
    });
  });

  describe('getSuggestions', () => {
    test('should return empty array when disabled', async () => {
      const suggestions = await searchService.getSuggestions('test');
      
      expect(suggestions).toEqual([]);
    });

    test('should return empty array for short query', async () => {
      const suggestions = await searchService.getSuggestions('t');
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('clearIndex', () => {
    test('should clear search index', () => {
      searchService.searchIndex.set('test', {});
      searchService.lastIndexed = Date.now();
      
      searchService.clearIndex();
      
      expect(searchService.searchIndex.size).toBe(0);
      expect(searchService.lastIndexed).toBeNull();
    });
  });

  describe('getStats', () => {
    test('should return search statistics', () => {
      const stats = searchService.getStats();
      
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('indexSize');
      expect(stats).toHaveProperty('lastIndexed');
      expect(stats).toHaveProperty('indexAge');
      expect(stats).toHaveProperty('ttl');
      expect(stats).toHaveProperty('needsReindex');
      expect(stats.enabled).toBe(false);
    });
  });

  describe('sortResults', () => {
    test('should sort by relevance by default', () => {
      const results = [
        { title: 'A', score: 1 },
        { title: 'B', score: 3 },
        { title: 'C', score: 2 }
      ];
      
      searchService.sortResults(results, 'relevance');
      
      expect(results[0].score).toBe(3);
      expect(results[1].score).toBe(2);
      expect(results[2].score).toBe(1);
    });

    test('should sort by title alphabetically', () => {
      const results = [
        { title: 'Zebra', score: 1 },
        { title: 'Apple', score: 3 },
        { title: 'Banana', score: 2 }
      ];
      
      searchService.sortResults(results, 'title');
      
      expect(results[0].title).toBe('Apple');
      expect(results[1].title).toBe('Banana');
      expect(results[2].title).toBe('Zebra');
    });

    test('should sort by date newest first', () => {
      const results = [
        { title: 'A', date: '2023-01-01' },
        { title: 'B', date: '2023-12-31' },
        { title: 'C', date: '2023-06-15' }
      ];
      
      searchService.sortResults(results, 'date');
      
      expect(results[0].date).toBe('2023-12-31');
      expect(results[1].date).toBe('2023-06-15');
      expect(results[2].date).toBe('2023-01-01');
    });
  });
});