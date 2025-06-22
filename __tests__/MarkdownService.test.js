const MarkdownService = require('../services/MarkdownService');

describe('MarkdownService', () => {
  let markdownService;

  beforeAll(() => {
    markdownService = new MarkdownService();
  });

  describe('render', () => {
    test('should render basic markdown to HTML', () => {
      const markdown = '# Hello World\n\nThis is **bold** text.';
      const result = markdownService.render(markdown);
      
      expect(result).toContain('<h1');
      expect(result).toContain('Hello World');
      expect(result).toContain('<strong>bold</strong>');
    });

    test('should handle empty content', () => {
      expect(markdownService.render('')).toBe('');
      expect(markdownService.render(null)).toBe('');
      expect(markdownService.render(undefined)).toBe('');
    });

    test('should add id attributes to headings', () => {
      const markdown = '# Hello World\n## Sub Heading';
      const result = markdownService.render(markdown);
      
      expect(result).toContain('id="hello-world"');
      expect(result).toContain('id="sub-heading"');
    });
  });

  describe('createSlug', () => {
    test('should create valid slugs from text', () => {
      expect(markdownService.createSlug('Hello World')).toBe('hello-world');
      expect(markdownService.createSlug('Test with Special Characters!')).toBe('test-with-special-characters');
      expect(markdownService.createSlug('Multiple   Spaces')).toBe('multiple-spaces');
      expect(markdownService.createSlug('CamelCase Text')).toBe('camelcase-text');
    });
  });

  describe('extractMetadata', () => {
    test('should extract headings from markdown', () => {
      const markdown = `
# Main Title
## Subtitle
### Sub-subtitle
Some content here.
      `;
      
      const metadata = markdownService.extractMetadata(markdown);
      
      expect(metadata.headings).toHaveLength(3);
      expect(metadata.headings[0]).toEqual({
        level: 1,
        text: 'Main Title',
        slug: 'main-title'
      });
      expect(metadata.headings[1]).toEqual({
        level: 2,
        text: 'Subtitle',
        slug: 'subtitle'
      });
    });

    test('should calculate word count and reading time', () => {
      const markdown = `
# Title

This is a test paragraph with multiple words. 
It should be counted properly for reading time estimation.

Another paragraph with more content to test the word counting functionality.
      `;
      
      const metadata = markdownService.extractMetadata(markdown);
      
      expect(metadata.wordCount).toBeGreaterThan(15);
      expect(metadata.readingTime).toBeGreaterThan(0);
    });

    test('should ignore code blocks in word count', () => {
      const markdown = `
# Title

Some text here.

\`\`\`javascript
const code = "this should not be counted";
console.log("lots of words in code");
\`\`\`

More text after code.
      `;
      
      const metadata = markdownService.extractMetadata(markdown);
      
      // Word count should not include code block content
      expect(metadata.wordCount).toBeLessThan(15);
    });
  });

  describe('renderPreview', () => {
    test('should create plain text preview', () => {
      const markdown = `
# Title

This is **bold** text with *italic* and [link](http://example.com).

Another paragraph.
      `;
      
      const preview = markdownService.renderPreview(markdown, 50);
      
      expect(preview).not.toContain('#');
      expect(preview).not.toContain('**');
      expect(preview).not.toContain('[');
      expect(preview.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    test('should handle short content without truncation', () => {
      const markdown = 'Short content.';
      const preview = markdownService.renderPreview(markdown, 50);
      
      expect(preview).toBe('Short content.');
      expect(preview).not.toContain('...');
    });

    test('should handle empty content', () => {
      expect(markdownService.renderPreview('')).toBe('');
      expect(markdownService.renderPreview(null)).toBe('');
    });
  });

  describe('parse', () => {
    test('should parse markdown into tokens', () => {
      const markdown = '# Hello\n\nParagraph text.';
      const tokens = markdownService.parse(markdown);
      
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should handle empty content', () => {
      expect(markdownService.parse('')).toEqual([]);
      expect(markdownService.parse(null)).toEqual([]);
    });
  });
});