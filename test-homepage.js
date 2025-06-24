const { contentService, markdownService } = require('./services');

async function testHomepage() {
  try {
    console.log('Testing homepage content loading...');
    
    // Test getting the home page
    const page = await contentService.getPage('home');
    console.log('Page found:', !!page);
    
    if (page) {
      console.log('Title:', page.metadata.title);
      console.log('Template:', page.metadata.template);
      console.log('Content length:', page.content.length);
      
      // Test markdown rendering
      const htmlContent = await markdownService.render(page.content);
      console.log('HTML rendered:', !!htmlContent);
      console.log('HTML length:', htmlContent.length);
    } else {
      console.log('ERROR: Page not found');
    }
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testHomepage();