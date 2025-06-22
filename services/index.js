const ContentService = require('./ContentService');
const MarkdownService = require('./MarkdownService');

// Create singleton instances
const contentService = new ContentService();
const markdownService = new MarkdownService();

module.exports = {
  ContentService,
  MarkdownService,
  contentService,
  markdownService
};