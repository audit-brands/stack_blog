const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class RSSService {
  constructor(contentService, ghostContextService, performanceService = null) {
    this.contentService = contentService;
    this.ghostContextService = ghostContextService;
    this.performanceService = performanceService;
    
    // RSS Configuration
    this.config = {
      title: 'Stack Blog',
      description: 'Modern flat-file CMS with Ghost theme compatibility',
      url: 'http://localhost:3000',
      language: 'en-us',
      managingEditor: 'editor@stackblog.com',
      webMaster: 'webmaster@stackblog.com',
      ttl: 60, // Cache TTL in minutes
      maxItems: 50,
      sponsorNamespace: 'http://stackblog.com/rss/sponsor',
      analyticsNamespace: 'http://stackblog.com/rss/analytics'
    };
    
    // Sponsor tracking
    this.sponsors = new Map();
    this.sponsorCampaigns = new Map();
    this.analytics = {
      impressions: new Map(),
      clicks: new Map(),
      conversions: new Map()
    };
  }

  /**
   * Initialize RSS service with site configuration
   */
  async initialize(siteConfig = {}) {
    this.config = {
      ...this.config,
      ...siteConfig,
      url: siteConfig.url || this.config.url,
      title: siteConfig.title || this.config.title,
      description: siteConfig.description || this.config.description
    };
  }

  /**
   * Generate RSS 2.0 feed with enhanced analytics and sponsorship features
   */
  async generateRSSFeed(options = {}) {
    const measurement = this.performanceService?.startMeasurement('rss_generation', {
      includeSponsors: options.includeSponsors || false,
      maxItems: options.maxItems || this.config.maxItems
    });

    try {
      // Get content pages (blog posts)
      const pages = await this.contentService.getAllPages();
      const blogPosts = pages
        .filter(page => page.slug.startsWith('blog/') && page.metadata.date)
        .sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date))
        .slice(0, options.maxItems || this.config.maxItems);

      // Generate RSS XML
      const rssXML = this.buildRSSXML(blogPosts, options);
      
      // Track feed generation
      this.trackFeedGeneration(blogPosts.length, options);
      
      if (this.performanceService) {
        this.performanceService.endMeasurement(measurement, { 
          success: true,
          itemCount: blogPosts.length,
          xmlSize: rssXML.length 
        });
      }

      return rssXML;
    } catch (error) {
      if (this.performanceService) {
        this.performanceService.endMeasurement(measurement, { 
          success: false, 
          error: error.message 
        });
      }
      throw error;
    }
  }

  /**
   * Build RSS 2.0 XML with sponsor and analytics namespaces
   */
  buildRSSXML(items, options = {}) {
    const { includeSponsors = true, includeAnalytics = true } = options;
    
    // XML namespaces
    const namespaces = [
      'xmlns:content="http://purl.org/rss/1.0/modules/content/"',
      'xmlns:dc="http://purl.org/dc/elements/1.1/"',
      'xmlns:atom="http://www.w3.org/2005/Atom"'
    ];
    
    if (includeSponsors) {
      namespaces.push(`xmlns:sponsor="${this.config.sponsorNamespace}"`);
    }
    
    if (includeAnalytics) {
      namespaces.push(`xmlns:analytics="${this.config.analyticsNamespace}"`);
    }

    const now = new Date().toUTCString();
    const feedId = this.generateFeedId();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" ${namespaces.join(' ')}>\n`;
    xml += `  <channel>\n`;
    
    // Channel metadata
    xml += `    <title><![CDATA[${this.config.title}]]></title>\n`;
    xml += `    <description><![CDATA[${this.config.description}]]></description>\n`;
    xml += `    <link>${this.config.url}</link>\n`;
    xml += `    <language>${this.config.language}</language>\n`;
    xml += `    <managingEditor>${this.config.managingEditor}</managingEditor>\n`;
    xml += `    <webMaster>${this.config.webMaster}</webMaster>\n`;
    xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
    xml += `    <pubDate>${now}</pubDate>\n`;
    xml += `    <ttl>${this.config.ttl}</ttl>\n`;
    xml += `    <generator>Stack Blog CMS with Enhanced Analytics</generator>\n`;
    xml += `    <atom:link href="${this.config.url}/rss.xml" rel="self" type="application/rss+xml"/>\n`;
    
    // Analytics metadata for the feed
    if (includeAnalytics) {
      xml += this.buildFeedAnalytics(feedId);
    }

    // Channel-level sponsor (if configured)
    if (includeSponsors && this.config.channelSponsor) {
      xml += this.buildChannelSponsor(this.config.channelSponsor);
    }

    // Items
    for (const item of items) {
      xml += this.buildRSSItem(item, { includeSponsors, includeAnalytics, feedId });
    }

    xml += `  </channel>\n`;
    xml += `</rss>\n`;

    return xml;
  }

  /**
   * Build individual RSS item with sponsor and analytics integration
   */
  buildRSSItem(page, options = {}) {
    const { includeSponsors, includeAnalytics, feedId } = options;
    const itemId = this.generateItemId(page.slug);
    const pubDate = new Date(page.metadata.date).toUTCString();
    const url = `${this.config.url}/${page.slug}`;
    
    // Get sponsor for this item
    const sponsor = includeSponsors ? this.getSponsorForItem(page) : null;
    
    let xml = `    <item>\n`;
    
    // Basic item metadata
    const title = sponsor && sponsor.titleIntegration ? 
      `${page.metadata.title} (Sponsored by ${sponsor.name})` : 
      page.metadata.title;
    
    xml += `      <title><![CDATA[${title}]]></title>\n`;
    xml += `      <description><![CDATA[${this.buildItemDescription(page, sponsor)}]]></description>\n`;
    xml += `      <link>${url}</link>\n`;
    xml += `      <guid isPermaLink="true">${url}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    
    // Author
    if (page.metadata.author) {
      xml += `      <dc:creator><![CDATA[${page.metadata.author}]]></dc:creator>\n`;
    }
    
    // Categories/Tags
    if (page.metadata.tags) {
      const tags = Array.isArray(page.metadata.tags) ? 
        page.metadata.tags : 
        page.metadata.tags.split(',').map(t => t.trim());
      
      for (const tag of tags) {
        xml += `      <category><![CDATA[${tag}]]></category>\n`;
      }
    }
    
    // Content
    if (page.content) {
      const processedContent = this.processContentForRSS(page.content, sponsor);
      xml += `      <content:encoded><![CDATA[${processedContent}]]></content:encoded>\n`;
    }
    
    // Sponsor information
    if (sponsor) {
      xml += this.buildItemSponsor(sponsor, itemId, page);
    }
    
    // Analytics tracking
    if (includeAnalytics) {
      xml += this.buildItemAnalytics(itemId, feedId, page, sponsor);
    }
    
    xml += `    </item>\n`;
    
    return xml;
  }

  /**
   * Build item description with sponsor integration
   */
  buildItemDescription(page, sponsor = null) {
    let description = page.metadata.description || page.metadata.excerpt || '';
    
    if (sponsor && sponsor.descriptionAd) {
      const sponsorMessage = sponsor.customMessage || 
        `This content is sponsored by ${sponsor.name}. ${sponsor.description || ''}`;
      
      if (sponsor.placement === 'pre-content') {
        description = `<p><em>${sponsorMessage}</em></p>\n\n${description}`;
      } else {
        description = `${description}\n\n<p><strong>Sponsor:</strong> ${sponsorMessage}</p>`;
      }
    }
    
    return description;
  }

  /**
   * Process content with sponsor integration
   */
  processContentForRSS(content, sponsor = null) {
    let processedContent = content;
    
    if (sponsor && sponsor.contentIntegration) {
      const sponsorContent = this.generateSponsorContent(sponsor);
      
      switch (sponsor.placement) {
        case 'pre-content':
          processedContent = `${sponsorContent}\n\n${content}`;
          break;
        case 'mid-content':
          // Insert after first paragraph
          const paragraphs = content.split('\n\n');
          if (paragraphs.length > 1) {
            paragraphs.splice(1, 0, sponsorContent);
            processedContent = paragraphs.join('\n\n');
          } else {
            processedContent = `${content}\n\n${sponsorContent}`;
          }
          break;
        case 'post-content':
        default:
          processedContent = `${content}\n\n${sponsorContent}`;
          break;
      }
    }
    
    return processedContent;
  }

  /**
   * Generate sponsor content block
   */
  generateSponsorContent(sponsor) {
    const trackingUrl = this.generateTrackingUrl(sponsor);
    
    return `<div class="sponsor-content">
      <h4>Sponsored Content</h4>
      <p><strong>${sponsor.name}</strong></p>
      <p>${sponsor.description || sponsor.customMessage}</p>
      ${sponsor.url ? `<p><a href="${trackingUrl}" target="_blank" rel="sponsored">Learn More</a></p>` : ''}
    </div>`;
  }

  /**
   * Build sponsor XML elements for RSS item
   */
  buildItemSponsor(sponsor, itemId, page) {
    const trackingUrl = this.generateTrackingUrl(sponsor, itemId, page);
    
    let xml = `      <sponsor:campaign id="${sponsor.id}" type="${sponsor.type || 'content'}">\n`;
    xml += `        <sponsor:name><![CDATA[${sponsor.name}]]></sponsor:name>\n`;
    xml += `        <sponsor:message><![CDATA[${sponsor.customMessage || sponsor.description}]]></sponsor:message>\n`;
    
    if (sponsor.url) {
      xml += `        <sponsor:url>${trackingUrl}</sponsor:url>\n`;
    }
    
    xml += `        <sponsor:placement>${sponsor.placement || 'post-content'}</sponsor:placement>\n`;
    
    if (sponsor.duration) {
      xml += `        <sponsor:duration>${sponsor.duration}</sponsor:duration>\n`;
    }
    
    if (sponsor.pricing) {
      xml += `        <sponsor:pricing-model>${sponsor.pricing.model}</sponsor:pricing-model>\n`;
      if (sponsor.pricing.cpm) {
        xml += `        <sponsor:cpm>${sponsor.pricing.cpm}</sponsor:cpm>\n`;
      }
    }
    
    xml += `      </sponsor:campaign>\n`;
    
    return xml;
  }

  /**
   * Build analytics XML elements for RSS item
   */
  buildItemAnalytics(itemId, feedId, page, sponsor = null) {
    const impressionId = this.generateImpressionId(itemId, feedId);
    
    let xml = `      <analytics:tracking>\n`;
    xml += `        <analytics:impression-id>${impressionId}</analytics:impression-id>\n`;
    xml += `        <analytics:feed-id>${feedId}</analytics:feed-id>\n`;
    xml += `        <analytics:item-id>${itemId}</analytics:item-id>\n`;
    xml += `        <analytics:tracking-pixel>${this.config.url}/api/rss/track/impression/${impressionId}</analytics:tracking-pixel>\n`;
    
    if (sponsor) {
      xml += `        <analytics:sponsor-tracking>\n`;
      xml += `          <analytics:campaign-id>${sponsor.id}</analytics:campaign-id>\n`;
      xml += `          <analytics:sponsor-id>${sponsor.sponsorId}</analytics:sponsor-id>\n`;
      xml += `        </analytics:sponsor-tracking>\n`;
    }
    
    // Page metadata for analytics
    xml += `        <analytics:metadata>\n`;
    xml += `          <analytics:publish-date>${page.metadata.date}</analytics:publish-date>\n`;
    if (page.metadata.tags) {
      xml += `          <analytics:tags><![CDATA[${Array.isArray(page.metadata.tags) ? page.metadata.tags.join(',') : page.metadata.tags}]]></analytics:tags>\n`;
    }
    if (page.metadata.author) {
      xml += `          <analytics:author><![CDATA[${page.metadata.author}]]></analytics:author>\n`;
    }
    xml += `        </analytics:metadata>\n`;
    
    xml += `      </analytics:tracking>\n`;
    
    return xml;
  }

  /**
   * Build feed-level analytics
   */
  buildFeedAnalytics(feedId) {
    let xml = `    <analytics:feed-tracking>\n`;
    xml += `      <analytics:feed-id>${feedId}</analytics:feed-id>\n`;
    xml += `      <analytics:generation-time>${new Date().toISOString()}</analytics:generation-time>\n`;
    xml += `      <analytics:version>1.0</analytics:version>\n`;
    xml += `    </analytics:feed-tracking>\n`;
    
    return xml;
  }

  /**
   * Build channel-level sponsor
   */
  buildChannelSponsor(sponsor) {
    let xml = `    <sponsor:channel-sponsor>\n`;
    xml += `      <sponsor:name><![CDATA[${sponsor.name}]]></sponsor:name>\n`;
    xml += `      <sponsor:message><![CDATA[${sponsor.message}]]></sponsor:message>\n`;
    if (sponsor.url) {
      xml += `      <sponsor:url>${sponsor.url}</sponsor:url>\n`;
    }
    xml += `    </sponsor:channel-sponsor>\n`;
    
    return xml;
  }

  /**
   * Generate tracking URL with UTM parameters and analytics
   */
  generateTrackingUrl(sponsor, itemId = null, page = null) {
    if (!sponsor.url) return '';
    
    const trackingId = this.generateTrackingId(sponsor.id, itemId);
    const baseUrl = sponsor.url;
    const params = new URLSearchParams();
    
    // UTM parameters
    params.set('utm_source', 'stackblog_rss');
    params.set('utm_medium', 'rss');
    params.set('utm_campaign', sponsor.id);
    
    if (itemId) {
      params.set('utm_content', itemId);
    }
    
    // Custom tracking
    params.set('sb_track', trackingId);
    params.set('sb_sponsor', sponsor.sponsorId || sponsor.id);
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Get sponsor configuration for a specific item
   */
  getSponsorForItem(page) {
    // Check for page-specific sponsor
    if (page.metadata.sponsor) {
      return this.sponsors.get(page.metadata.sponsor);
    }
    
    // Check for tag-based sponsors
    if (page.metadata.tags) {
      const tags = Array.isArray(page.metadata.tags) ? 
        page.metadata.tags : 
        page.metadata.tags.split(',').map(t => t.trim());
      
      for (const tag of tags) {
        const tagSponsor = this.getActiveSponsorByTag(tag);
        if (tagSponsor) return tagSponsor;
      }
    }
    
    // Default sponsor
    return this.getDefaultSponsor();
  }

  /**
   * Track feed generation for analytics
   */
  trackFeedGeneration(itemCount, options) {
    const trackingData = {
      timestamp: new Date(),
      itemCount,
      includeSponsors: options.includeSponsors || false,
      includeAnalytics: options.includeAnalytics || false,
      userAgent: options.userAgent || null,
      ip: options.ip || null
    };
    
    // Store for analytics (in production, this would go to a proper analytics service)
    if (!this.analytics.feedGenerations) {
      this.analytics.feedGenerations = [];
    }
    
    this.analytics.feedGenerations.push(trackingData);
    
    // Keep only last 1000 generations
    if (this.analytics.feedGenerations.length > 1000) {
      this.analytics.feedGenerations = this.analytics.feedGenerations.slice(-1000);
    }
  }

  /**
   * Utility functions for ID generation
   */
  generateFeedId() {
    return crypto.randomBytes(8).toString('hex');
  }

  generateItemId(slug) {
    return crypto.createHash('md5').update(slug).digest('hex').substring(0, 12);
  }

  generateImpressionId(itemId, feedId) {
    return crypto.createHash('md5').update(`${itemId}-${feedId}-${Date.now()}`).digest('hex');
  }

  generateTrackingId(sponsorId, itemId) {
    return crypto.createHash('md5').update(`${sponsorId}-${itemId}-${Date.now()}`).digest('hex').substring(0, 16);
  }

  /**
   * Sponsor management methods
   */
  addSponsor(sponsorConfig) {
    this.sponsors.set(sponsorConfig.id, sponsorConfig);
  }

  removeSponsor(sponsorId) {
    this.sponsors.delete(sponsorId);
  }

  getActiveSponsorByTag(tag) {
    for (const [id, sponsor] of this.sponsors) {
      if (sponsor.tags && sponsor.tags.includes(tag) && sponsor.active) {
        return sponsor;
      }
    }
    return null;
  }

  getDefaultSponsor() {
    for (const [id, sponsor] of this.sponsors) {
      if (sponsor.isDefault && sponsor.active) {
        return sponsor;
      }
    }
    return null;
  }

  /**
   * Analytics methods
   */
  getAnalytics(options = {}) {
    return {
      feedGenerations: this.analytics.feedGenerations?.length || 0,
      totalImpressions: this.analytics.impressions.size,
      totalClicks: this.analytics.clicks.size,
      totalConversions: this.analytics.conversions.size,
      activeSponsors: Array.from(this.sponsors.values()).filter(s => s.active).length,
      lastGenerated: this.analytics.feedGenerations?.[this.analytics.feedGenerations.length - 1]?.timestamp
    };
  }
}

module.exports = RSSService;