# Nunjucks to Handlebars Migration Plan

## Overview
Complete migration from Nunjucks to Handlebars template engine to achieve full Ghost compatibility and resolve critical production issues.

## Current State
- **Nunjucks**: Used for admin panel and default theme (BROKEN IN PRODUCTION)
- **Handlebars**: Used for Ghost theme compatibility (WORKING)
- **Problem**: Dual template engines causing complexity and failures

## Target State
- **Handlebars Only**: Single template engine for entire application
- **Ghost Compatible**: Full compatibility with Ghost themes and admin themes
- **Simplified**: Reduced complexity and maintenance burden

---

## Phase 1: Foundation & Admin Templates (Priority: CRITICAL)

### Objectives
- Set up Handlebars for admin panel
- Create base admin layouts and partials
- Implement core admin helpers

### Tasks
1. **Configure Handlebars for Admin Routes**
   - Set up Handlebars instance for admin templates
   - Configure admin template directories
   - Set up admin-specific helpers

2. **Create Admin Base Templates**
   - Convert admin/layout.html to layout.hbs
   - Create admin partials (navigation, sidebar, etc.)
   - Implement Bulma CSS integration

3. **Convert Critical Admin Pages**
   - Login page (already working with plain HTML)
   - Dashboard (currently hardcoded)
   - Error pages

4. **Implement Admin Helpers**
   - `{{#isActive}}` for navigation
   - `{{adminAsset}}` for admin resources
   - `{{csrfToken}}` for forms

---

## Phase 2: Content Management Templates

### Objectives
- Convert all content management templates
- Maintain feature parity with current system

### Tasks
1. **Page Management Templates**
   - pages.hbs (list all pages)
   - page-edit.hbs (create/edit pages)
   - page-delete confirmation

2. **Media Management Templates**
   - media.hbs (media library)
   - media-upload.hbs
   - media-edit.hbs

3. **Form Helpers**
   - `{{input}}` helper for form fields
   - `{{textarea}}` with markdown preview
   - `{{select}}` for dropdowns

---

## Phase 3: Advanced Features & Theme Management

### Objectives
- Complete remaining admin functionality
- Implement theme management UI

### Tasks
1. **Theme Management**
   - themes.hbs (list installed themes)
   - theme-upload.hbs
   - theme-settings.hbs

2. **RSS & Analytics Templates**
   - rss-analytics.hbs
   - sponsor-management.hbs
   - analytics-dashboard.hbs

3. **System Templates**
   - cache.hbs (cache management)
   - plugins.hbs (plugin management)
   - search.hbs (search management)

---

## Phase 4: Remove Nunjucks & Cleanup

### Objectives
- Completely remove Nunjucks
- Clean up codebase
- Optimize performance

### Tasks
1. **Remove Nunjucks Dependencies**
   - Uninstall nunjucks package
   - Remove Nunjucks configuration from app.js
   - Delete old .html templates

2. **Update Documentation**
   - Update README for Handlebars only
   - Document template structure
   - Create theme development guide

3. **Testing & Optimization**
   - Test all admin functionality
   - Performance benchmarks
   - Production deployment

---

## Technical Implementation Details

### Handlebars Configuration
```javascript
// Admin Handlebars instance
const adminHbs = handlebars.create({
  defaultLayout: 'admin',
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'views/admin/layouts'),
  partialsDir: path.join(__dirname, 'views/admin/partials'),
  helpers: {
    // Admin-specific helpers
  }
});
```

### Directory Structure
```
views/
├── admin/
│   ├── layouts/
│   │   └── admin.hbs
│   ├── partials/
│   │   ├── navigation.hbs
│   │   ├── sidebar.hbs
│   │   └── footer.hbs
│   └── pages/
│       ├── dashboard.hbs
│       ├── login.hbs
│       └── ...
└── themes/
    └── [ghost themes]
```

### Helper Examples
```javascript
// Navigation active state
Handlebars.registerHelper('isActive', function(current, path) {
  return current && current.includes(path) ? 'is-active' : '';
});

// CSRF token
Handlebars.registerHelper('csrf', function() {
  return new Handlebars.SafeString(
    `<input type="hidden" name="_csrf" value="${this.csrfToken}">`
  );
});
```

---

## Success Metrics
- [ ] Zero Nunjucks dependencies in package.json
- [ ] All admin routes using Handlebars
- [ ] No template rendering errors in production
- [ ] Successful production deployment on cpeio.online
- [ ] Documentation updated
- [ ] Issue #27 closed

---

## Risk Mitigation
1. **Gradual Migration**: Phase by phase to maintain functionality
2. **Parallel Testing**: Test each converted template before removing old one
3. **Fallback Plan**: Keep Nunjucks templates until Handlebars version verified
4. **Production Testing**: Deploy to staging first if available

---

## Timeline Estimate
- Phase 1: 2-3 hours (Critical - Do immediately)
- Phase 2: 2-3 hours 
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours
- Total: ~10 hours of development