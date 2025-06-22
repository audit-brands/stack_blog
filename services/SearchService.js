class SearchService {
  constructor(contentService, markdownService, cacheService = null) {
    this.contentService = contentService;
    this.markdownService = markdownService;
    this.cache = cacheService;
    this.searchIndex = new Map();
    this.lastIndexed = null;
    this.indexTTL = 5 * 60 * 1000; // 5 minutes
    this.enabled = process.env.NODE_ENV !== 'test'; // Disable in tests
  }

  /**
   * Build search index from all content
   */
  async buildIndex() {
    if (!this.enabled) return;

    try {
      const result = await this.contentService.listPages({ limit: 1000 });
      const pages = result.pages;
      
      this.searchIndex.clear();
      
      for (const page of pages) {
        await this.indexPage(page);
      }
      
      this.lastIndexed = Date.now();
      console.log(`Search index built: ${this.searchIndex.size} pages indexed`);
    } catch (error) {
      console.error('Error building search index:', error);
    }
  }

  /**
   * Index a single page
   */
  async indexPage(page) {
    try {
      // Extract searchable text from markdown content
      const plainText = this.extractPlainText(page.content);
      
      // Create search document
      const searchDoc = {
        slug: page.slug,
        title: page.metadata.title || page.slug,
        description: page.metadata.description || '',
        content: plainText,
        date: page.metadata.date,
        template: page.metadata.template,
        searchText: this.normalizeText([
          page.metadata.title || '',
          page.metadata.description || '',
          plainText
        ].join(' ')),
        lastModified: page.lastModified || new Date(),
        metadata: page.metadata
      };
      
      this.searchIndex.set(page.slug, searchDoc);
    } catch (error) {
      console.error(`Error indexing page ${page.slug}:`, error);
    }
  }

  /**
   * Extract plain text from markdown content
   */
  extractPlainText(markdown) {
    if (!markdown) return '';
    
    return markdown
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]*`/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove markdown syntax
      .replace(/[#*_~`]/g, '')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize text for searching
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if index needs refreshing
   */
  needsIndexing() {
    if (!this.enabled) return false;
    if (!this.lastIndexed) return true;
    return Date.now() - this.lastIndexed > this.indexTTL;
  }

  /**
   * Search content with various options
   */
  async search(query, options = {}) {
    if (!this.enabled) {
      // Fallback to simple content search when disabled
      return await this.fallbackSearch(query, options);
    }

    const {
      page = 1,
      limit = 10,
      sortBy = 'relevance', // relevance, date, title
      filters = {}
    } = options;

    // Refresh index if needed
    if (this.needsIndexing()) {
      await this.buildIndex();
    }

    if (!query || query.trim().length === 0) {
      return {
        results: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          total: 0,
          limit,
          hasNext: false,
          hasPrev: false
        },
        query: '',
        searchTime: 0
      };
    }

    const startTime = Date.now();
    const normalizedQuery = this.normalizeText(query);
    const queryTerms = normalizedQuery.split(' ').filter(term => term.length > 0);

    // Search through index
    const searchResults = [];
    
    for (const [slug, doc] of this.searchIndex) {
      const score = this.calculateRelevanceScore(doc, queryTerms, query);
      
      if (score > 0) {
        // Apply filters
        if (filters.template && doc.template !== filters.template) continue;
        if (filters.dateFrom && new Date(doc.date) < new Date(filters.dateFrom)) continue;
        if (filters.dateTo && new Date(doc.date) > new Date(filters.dateTo)) continue;
        
        const snippet = this.generateSnippet(doc.content, queryTerms);
        
        searchResults.push({
          slug: doc.slug,
          title: doc.title,
          description: doc.description,
          snippet,
          score,
          date: doc.date,
          lastModified: doc.lastModified,
          template: doc.template,
          metadata: doc.metadata,
          url: `/${doc.slug}`
        });
      }
    }

    // Sort results
    this.sortResults(searchResults, sortBy);

    // Paginate
    const total = searchResults.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedResults = searchResults.slice(offset, offset + limit);

    const searchTime = Date.now() - startTime;

    return {
      results: paginatedResults,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      },
      query,
      searchTime,
      indexSize: this.searchIndex.size,
      lastIndexed: this.lastIndexed
    };
  }

  /**
   * Calculate relevance score for a document
   */
  calculateRelevanceScore(doc, queryTerms, originalQuery) {
    let score = 0;
    const titleWeight = 3;
    const descriptionWeight = 2;
    const contentWeight = 1;

    for (const term of queryTerms) {
      // Exact phrase matching gets higher score
      if (doc.searchText.includes(originalQuery.toLowerCase())) {
        score += 10;
      }
      
      // Title matches
      if (doc.title.toLowerCase().includes(term)) {
        score += titleWeight;
      }
      
      // Description matches
      if (doc.description.toLowerCase().includes(term)) {
        score += descriptionWeight;
      }
      
      // Content matches
      const contentMatches = (doc.content.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      score += contentMatches * contentWeight;
    }

    return score;
  }

  /**
   * Generate content snippet around search terms
   */
  generateSnippet(content, queryTerms, maxLength = 200) {
    if (!content || queryTerms.length === 0) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    const contentLower = content.toLowerCase();
    let bestStart = 0;
    let bestScore = 0;

    // Find the best position that contains the most query terms
    for (let i = 0; i < content.length - maxLength; i++) {
      const snippet = contentLower.substring(i, i + maxLength);
      let score = 0;
      
      for (const term of queryTerms) {
        score += (snippet.match(new RegExp(term, 'g')) || []).length;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }

    let snippet = content.substring(bestStart, bestStart + maxLength);
    
    // Add ellipsis if needed
    if (bestStart > 0) snippet = '...' + snippet;
    if (bestStart + maxLength < content.length) snippet += '...';

    // Highlight search terms (basic HTML)
    for (const term of queryTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    }

    return snippet;
  }

  /**
   * Sort search results
   */
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'date':
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'title':
        results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'relevance':
      default:
        results.sort((a, b) => b.score - a.score);
        break;
    }
  }

  /**
   * Fallback search when indexing is disabled
   */
  async fallbackSearch(query, options = {}) {
    const { page = 1, limit = 10 } = options;
    
    try {
      const result = await this.contentService.listPages({ 
        page, 
        limit: 1000, 
        search: query 
      });
      
      return {
        results: result.pages.slice(0, limit).map(p => ({
          slug: p.slug,
          title: p.metadata.title || p.slug,
          description: p.metadata.description || '',
          snippet: this.extractPlainText(p.content).substring(0, 200) + '...',
          score: 1,
          date: p.metadata.date,
          lastModified: p.lastModified,
          template: p.metadata.template,
          metadata: p.metadata,
          url: `/${p.slug}`
        })),
        pagination: {
          currentPage: page,
          totalPages: 1,
          total: result.pages.length,
          limit,
          hasNext: false,
          hasPrev: false
        },
        query,
        searchTime: 0,
        fallback: true
      };
    } catch (error) {
      console.error('Fallback search error:', error);
      return {
        results: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          total: 0,
          limit,
          hasNext: false,
          hasPrev: false
        },
        query,
        searchTime: 0,
        error: error.message
      };
    }
  }

  /**
   * Get search suggestions based on indexed content
   */
  async getSuggestions(query, limit = 5) {
    if (!this.enabled || !query || query.length < 2) {
      return [];
    }

    if (this.needsIndexing()) {
      await this.buildIndex();
    }

    const suggestions = new Set();
    const queryLower = query.toLowerCase();

    for (const [slug, doc] of this.searchIndex) {
      // Suggest page titles that start with the query
      if (doc.title.toLowerCase().startsWith(queryLower)) {
        suggestions.add(doc.title);
      }
      
      // Suggest words from content that start with the query
      const words = doc.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.startsWith(queryLower) && word.length > query.length) {
          suggestions.add(word);
        }
      }
      
      if (suggestions.size >= limit * 2) break; // Collect more than needed
    }

    return Array.from(suggestions)
      .slice(0, limit)
      .sort((a, b) => a.length - b.length); // Prefer shorter suggestions
  }

  /**
   * Clear search index
   */
  clearIndex() {
    this.searchIndex.clear();
    this.lastIndexed = null;
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      indexSize: this.searchIndex.size,
      lastIndexed: this.lastIndexed,
      indexAge: this.lastIndexed ? Date.now() - this.lastIndexed : null,
      ttl: this.indexTTL,
      needsReindex: this.needsIndexing()
    };
  }
}

module.exports = SearchService;