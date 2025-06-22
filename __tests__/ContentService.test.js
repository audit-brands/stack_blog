const fs = require('fs').promises;
const path = require('path');

// Mock config before importing ContentService
const mockTestContentPath = path.join(__dirname, 'test-content');
jest.mock('../config/default', () => ({
  paths: {
    content: mockTestContentPath
  },
  content: {
    defaultTemplate: 'default'
  }
}));

const ContentService = require('../services/ContentService');

describe('ContentService', () => {
  let contentService;
  const testContentPath = mockTestContentPath;

  beforeAll(async () => {
    // Create test content directory
    await fs.mkdir(testContentPath, { recursive: true });
    contentService = new ContentService();
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testContentPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean test directory before each test
    try {
      const entries = await fs.readdir(testContentPath);
      for (const entry of entries) {
        await fs.rm(path.join(testContentPath, entry), { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('createSlug', () => {
    test('should create valid slug from title', () => {
      expect(contentService.createSlug('Hello World')).toBe('hello-world');
      expect(contentService.createSlug('Test Page with Special Chars!')).toBe('test-page-with-special-chars');
      expect(contentService.createSlug('Multiple   Spaces')).toBe('multiple-spaces');
      expect(contentService.createSlug('-Leading and trailing-')).toBe('leading-and-trailing');
    });
  });

  describe('savePage', () => {
    test('should save a new page successfully', async () => {
      const slug = 'test-page';
      const metadata = { title: 'Test Page' };
      const content = 'This is test content.';

      const result = await contentService.savePage(slug, metadata, content);

      expect(result).toBeTruthy();
      expect(result.slug).toBe(slug);
      expect(result.metadata.title).toBe('Test Page');
      expect(result.content.trim()).toBe(content);
      expect(result.exists).toBe(true);
    });

    test('should throw error if title is missing', async () => {
      const slug = 'test-page';
      const metadata = {}; // No title
      const content = 'This is test content.';

      await expect(contentService.savePage(slug, metadata, content))
        .rejects.toThrow('Page title is required');
    });

    test('should add default metadata fields', async () => {
      const slug = 'test-page';
      const metadata = { title: 'Test Page' };
      const content = 'This is test content.';

      const result = await contentService.savePage(slug, metadata, content);

      expect(result.metadata.date).toBeDefined();
      expect(result.metadata.template).toBe('default');
    });
  });

  describe('getPage', () => {
    test('should return null for non-existent page', async () => {
      const result = await contentService.getPage('non-existent');
      expect(result).toBeNull();
    });

    test('should retrieve existing page', async () => {
      // First create a page
      const slug = 'test-page';
      const metadata = { title: 'Test Page' };
      const content = 'This is test content.';
      
      await contentService.savePage(slug, metadata, content);

      // Then retrieve it
      const result = await contentService.getPage(slug);

      expect(result).toBeTruthy();
      expect(result.slug).toBe(slug);
      expect(result.metadata.title).toBe('Test Page');
      expect(result.content.trim()).toBe(content);
    });
  });

  describe('listPages', () => {
    test('should return empty array when no pages exist', async () => {
      const result = await contentService.listPages();
      expect(result).toEqual([]);
    });

    test('should list all existing pages', async () => {
      // Create test pages
      await contentService.savePage('page1', { title: 'Page 1' }, 'Content 1');
      await contentService.savePage('page2', { title: 'Page 2' }, 'Content 2');

      const result = await contentService.listPages();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.slug)).toContain('page1');
      expect(result.map(p => p.slug)).toContain('page2');
    });
  });

  describe('deletePage', () => {
    test('should return false for non-existent page', async () => {
      const result = await contentService.deletePage('non-existent');
      expect(result).toBe(false);
    });

    test('should delete existing page', async () => {
      // Create a page
      const slug = 'test-page';
      await contentService.savePage(slug, { title: 'Test Page' }, 'Content');

      // Delete it
      const result = await contentService.deletePage(slug);
      expect(result).toBe(true);

      // Verify it's gone
      const page = await contentService.getPage(slug);
      expect(page).toBeNull();
    });
  });

  describe('slugExists', () => {
    test('should return false for non-existent slug', async () => {
      const result = await contentService.slugExists('non-existent');
      expect(result).toBe(false);
    });

    test('should return true for existing slug', async () => {
      const slug = 'test-page';
      await contentService.savePage(slug, { title: 'Test Page' }, 'Content');

      const result = await contentService.slugExists(slug);
      expect(result).toBe(true);
    });
  });
});