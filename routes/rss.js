const express = require('express');
const { rssService, performanceService } = require('../services');

const router = express.Router();

/**
 * RSS 2.0 Feed with Enhanced Analytics and Sponsorship Features
 */
router.get('/rss.xml', async (req, res) => {
  const measurement = performanceService?.startMeasurement('rss_feed_request', {
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    ip: req.ip
  });

  try {
    // Configure RSS service with site settings
    await rssService.initialize({
      url: req.protocol + '://' + req.get('host'),
      title: 'Stack Blog',
      description: 'Modern flat-file CMS with Ghost theme compatibility and enhanced RSS analytics'
    });

    // Generate RSS feed
    const rssXML = await rssService.generateRSSFeed({
      includeSponsors: true,
      includeAnalytics: true,
      maxItems: parseInt(req.query.limit) || 50,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-RSS-Version': '2.0-enhanced',
      'X-RSS-Features': 'sponsors,analytics,tracking'
    });

    if (performanceService) {
      performanceService.endMeasurement(measurement, { 
        success: true,
        xmlSize: rssXML.length,
        cacheHit: false 
      });
    }

    res.send(rssXML);

  } catch (error) {
    console.error('RSS generation error:', error);
    
    if (performanceService) {
      performanceService.endMeasurement(measurement, { 
        success: false,
        error: error.message 
      });
    }

    res.status(500).set('Content-Type', 'application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSS Feed Error</title>
    <description>Unable to generate RSS feed</description>
    <link>${req.protocol}://${req.get('host')}</link>
  </channel>
</rss>`);
  }
});

/**
 * RSS Feed with JSON output (for API consumers)
 */
router.get('/feed.json', async (req, res) => {
  try {
    await rssService.initialize({
      url: req.protocol + '://' + req.get('host'),
      title: 'Stack Blog',
      description: 'Modern flat-file CMS with Ghost theme compatibility'
    });

    // Get RSS data as JSON
    const pages = await rssService.contentService.getAllPages();
    const blogPosts = pages
      .filter(page => page.slug.startsWith('blog/') && page.metadata.date)
      .sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date))
      .slice(0, parseInt(req.query.limit) || 50);

    const feedData = {
      version: "https://jsonfeed.org/version/1.1",
      title: "Stack Blog",
      description: "Modern flat-file CMS with Ghost theme compatibility",
      home_page_url: `${req.protocol}://${req.get('host')}`,
      feed_url: `${req.protocol}://${req.get('host')}/feed.json`,
      items: blogPosts.map(page => ({
        id: `${req.protocol}://${req.get('host')}/${page.slug}`,
        url: `${req.protocol}://${req.get('host')}/${page.slug}`,
        title: page.metadata.title,
        content_html: page.content || '',
        summary: page.metadata.description || page.metadata.excerpt || '',
        date_published: new Date(page.metadata.date).toISOString(),
        author: page.metadata.author ? { name: page.metadata.author } : undefined,
        tags: Array.isArray(page.metadata.tags) ? 
          page.metadata.tags : 
          (page.metadata.tags ? page.metadata.tags.split(',').map(t => t.trim()) : [])
      }))
    };

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });

    res.json(feedData);

  } catch (error) {
    console.error('JSON feed generation error:', error);
    res.status(500).json({ 
      error: 'Unable to generate JSON feed',
      message: error.message 
    });
  }
});

/**
 * RSS Analytics API Endpoints
 */

/**
 * Track RSS impression (called by RSS readers when parsing feed)
 */
router.get('/api/rss/track/impression/:impressionId', (req, res) => {
  const { impressionId } = req.params;
  
  try {
    // Track impression
    if (!rssService.analytics.impressions.has(impressionId)) {
      rssService.analytics.impressions.set(impressionId, {
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        ip: req.ip
      });
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Length': pixel.length
    });

    res.send(pixel);

  } catch (error) {
    console.error('Impression tracking error:', error);
    res.status(500).send('Error');
  }
});

/**
 * Track RSS click (redirect through tracking)
 */
router.get('/api/rss/track/click/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const { url } = req.query;
  
  try {
    // Track click
    rssService.analytics.clicks.set(trackingId, {
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      ip: req.ip,
      targetUrl: url
    });

    // Redirect to target URL
    if (url && url.startsWith('http')) {
      res.redirect(302, url);
    } else {
      res.status(400).send('Invalid URL');
    }

  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).send('Error');
  }
});

/**
 * RSS Analytics Dashboard Data (protected endpoint)
 */
router.get('/api/rss/analytics', async (req, res) => {
  try {
    // In production, this should be protected with authentication
    const analytics = rssService.getAnalytics();
    
    // Get additional performance metrics
    const performanceData = performanceService?.getStats();
    
    const dashboardData = {
      overview: analytics,
      performance: performanceData?.metrics?.requests || {},
      sponsors: {
        active: Array.from(rssService.sponsors.values()).filter(s => s.active),
        totalCampaigns: rssService.sponsorCampaigns.size
      },
      recent: {
        impressions: Array.from(rssService.analytics.impressions.values())
          .slice(-10)
          .reverse(),
        clicks: Array.from(rssService.analytics.clicks.values())
          .slice(-10)
          .reverse()
      }
    };

    res.json(dashboardData);

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch analytics',
      message: error.message 
    });
  }
});

/**
 * RSS Sponsor Management API (protected endpoints)
 */

/**
 * Add new sponsor
 */
router.post('/api/rss/sponsors', async (req, res) => {
  try {
    // In production, add authentication middleware
    const sponsorConfig = req.body;
    
    // Validate sponsor configuration
    if (!sponsorConfig.id || !sponsorConfig.name) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, name' 
      });
    }

    // Add sponsor
    rssService.addSponsor({
      ...sponsorConfig,
      active: sponsorConfig.active !== false, // Default to active
      created: new Date()
    });

    res.json({ 
      success: true,
      message: `Sponsor "${sponsorConfig.name}" added successfully`,
      sponsor: sponsorConfig
    });

  } catch (error) {
    console.error('Add sponsor error:', error);
    res.status(500).json({ 
      error: 'Unable to add sponsor',
      message: error.message 
    });
  }
});

/**
 * Get all sponsors
 */
router.get('/api/rss/sponsors', (req, res) => {
  try {
    const sponsors = Array.from(rssService.sponsors.values());
    res.json({ sponsors });
  } catch (error) {
    console.error('Get sponsors error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch sponsors',
      message: error.message 
    });
  }
});

/**
 * Update sponsor
 */
router.put('/api/rss/sponsors/:sponsorId', (req, res) => {
  try {
    const { sponsorId } = req.params;
    const updates = req.body;
    
    const existingSponsor = rssService.sponsors.get(sponsorId);
    if (!existingSponsor) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    // Update sponsor
    const updatedSponsor = {
      ...existingSponsor,
      ...updates,
      updated: new Date()
    };
    
    rssService.sponsors.set(sponsorId, updatedSponsor);

    res.json({ 
      success: true,
      message: `Sponsor "${sponsorId}" updated successfully`,
      sponsor: updatedSponsor
    });

  } catch (error) {
    console.error('Update sponsor error:', error);
    res.status(500).json({ 
      error: 'Unable to update sponsor',
      message: error.message 
    });
  }
});

/**
 * Delete sponsor
 */
router.delete('/api/rss/sponsors/:sponsorId', (req, res) => {
  try {
    const { sponsorId } = req.params;
    
    if (!rssService.sponsors.has(sponsorId)) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    rssService.removeSponsor(sponsorId);

    res.json({ 
      success: true,
      message: `Sponsor "${sponsorId}" deleted successfully`
    });

  } catch (error) {
    console.error('Delete sponsor error:', error);
    res.status(500).json({ 
      error: 'Unable to delete sponsor',
      message: error.message 
    });
  }
});

module.exports = router;