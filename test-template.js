const nunjucks = require('nunjucks');
const path = require('path');

// Configure Nunjucks like in the app
const templatePath = path.join(__dirname, 'templates');
const nunjucksEnv = nunjucks.configure(templatePath, {
  autoescape: true,
  watch: false
});

// Add the same filters as in app.js
nunjucksEnv.addFilter('date', (str, format = 'F j, Y') => {
  const date = new Date(str);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

nunjucksEnv.addFilter('startsWith', (str, prefix) => {
  return str && typeof str === 'string' && str.startsWith(prefix);
});

// Test data like what frontend.js would use
const templateData = {
  page: {
    metadata: {
      title: 'Welcome to Stack Blog'
    },
    content: '<h1>Welcome to Stack Blog</h1><p>This is a test.</p>'
  },
  site: {
    title: 'Stack Blog',
    description: 'A flat-file CMS built with Node.js'
  },
  currentPath: '/'
};

console.log('Testing template rendering...');

try {
  const result = nunjucksEnv.render('default.html', templateData);
  console.log('SUCCESS: Template rendered');
  console.log('Output length:', result.length);
} catch (error) {
  console.error('ERROR rendering template:', error.message);
  console.error('Stack:', error.stack);
}