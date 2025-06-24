# Ghost Theme Compatibility Guide

Stack Blog CMS provides comprehensive Ghost theme compatibility, allowing you to use thousands of existing Ghost themes without modification. This guide covers everything you need to know about using Ghost themes with Stack Blog.

## Overview

Stack Blog implements a dual-engine architecture that supports both Nunjucks (default) and Handlebars (Ghost themes) template engines. When you activate a Ghost theme, Stack Blog automatically:

- Switches to Handlebars rendering engine
- Maps Stack Blog content to Ghost-compatible context
- Provides all essential Ghost helpers
- Serves theme assets with proper caching
- Validates theme compatibility

## Quick Start

### 1. Installing a Ghost Theme

**Method 1: Upload via Admin Panel**
1. Go to `/admin/themes` in your Stack Blog admin panel
2. Click "Upload Theme"
3. Select a Ghost theme ZIP file
4. Stack Blog will automatically validate and install the theme

**Method 2: Manual Installation**
1. Download a Ghost theme (ZIP file)
2. Extract to `themes/your-theme-name/` directory
3. Ensure the theme contains `index.hbs` and `post.hbs`
4. Activate via admin panel

### 2. Activating a Theme

1. Navigate to Admin → Theme Management
2. Find your desired theme in the list
3. Click "Activate" next to the theme name
4. Stack Blog will switch to Handlebars engine automatically

## Compatibility Levels

Stack Blog rates theme compatibility on five levels:

- **🟢 Excellent** (90-100%): Perfect compatibility, all features work
- **🔵 Good** (75-89%): Minor warnings, fully functional
- **🟡 Fair** (60-74%): Some limitations, mostly works
- **🟠 Poor** (40-59%): Significant issues, basic functionality only
- **🔴 Incompatible** (<40%): Major problems, not recommended

## Supported Ghost Features

### ✅ Fully Supported

#### Template Engine
- **Handlebars Templates**: Complete `.hbs` template support
- **Layouts and Partials**: Full Ghost layout system
- **Template Inheritance**: Ghost's template fallback system
- **Asset Serving**: CSS, JS, fonts with proper caching
- **Routes.yaml**: Basic custom routing support

#### Ghost Helpers
All major Ghost helpers are implemented:

```handlebars
{{#foreach posts}}           <!-- Enhanced iteration with data context -->
{{asset "css/style.css"}}    <!-- Theme asset URL generation -->
{{ghost_head}}               <!-- Complete meta tags, SEO, JSON-LD -->
{{ghost_foot}}               <!-- Code injection support -->
{{navigation}}               <!-- Site navigation rendering -->
{{pagination}}               <!-- Pagination controls -->
{{#has "tag"}}              <!-- Feature detection -->
{{#is "post"}}              <!-- Context checking -->
{{date format="YYYY-MM-DD"}} <!-- Date formatting -->
{{excerpt words="50"}}       <!-- Content excerpts -->
```

#### Context Variables
Complete Ghost context mapping:

```handlebars
{{@site.title}}              <!-- Site information -->
{{@site.description}}
{{@site.url}}
{{@site.navigation}}

{{#foreach posts}}           <!-- Post listings -->
  {{title}}
  {{excerpt}}
  {{url}}
  {{published_at}}
  {{#foreach authors}}{{name}}{{/foreach}}
  {{#foreach tags}}{{name}}{{/foreach}}
{{/foreach}}

{{post.title}}               <!-- Individual posts -->
{{post.html}}
{{post.feature_image}}
{{post.reading_time}}

{{pagination.page}}          <!-- Pagination -->
{{pagination.pages}}
{{pagination.next}}
{{pagination.prev}}

{{tag.name}}                 <!-- Tag pages -->
{{tag.description}}
{{author.name}}              <!-- Author pages -->
```

#### SEO and Meta Tags
- **Open Graph**: Complete Facebook sharing support
- **Twitter Cards**: Twitter sharing optimization
- **JSON-LD**: Structured data for search engines
- **Canonical URLs**: Proper URL canonicalization
- **Meta Descriptions**: Auto-generated and custom

### 🟡 Partially Supported

#### Routes.yaml
- **Basic routing**: Custom URL patterns
- **Collections**: Simple permalink patterns
- **Taxonomies**: Tag and author URL customization
- **Redirects**: Limited support

#### Advanced Features
- **Ghost Apps**: Not supported (Ghost-specific)
- **Ghost API**: Not applicable (Stack Blog uses flat files)
- **Webhooks**: Not supported
- **Ghost CLI**: Not applicable

### ❌ Not Supported

- **Ghost Database**: Stack Blog uses flat files
- **Ghost Admin API**: Different admin system
- **Ghost Members**: Not implemented
- **Ghost Subscriptions**: Not applicable
- **Ghost Labs Features**: Ghost-specific features

## Theme Structure Requirements

For optimal compatibility, Ghost themes should include:

### Required Files
```
theme-name/
├── index.hbs           # Homepage template (required)
├── post.hbs           # Post template (required)
├── package.json       # Theme metadata (recommended)
└── assets/           # Theme assets (recommended)
    ├── css/
    ├── js/
    └── fonts/
```

### Recommended Files
```
theme-name/
├── default.hbs        # Main layout
├── page.hbs          # Static pages
├── tag.hbs           # Tag archives
├── author.hbs        # Author archives
├── error.hbs         # 404 page
├── partials/         # Reusable components
│   ├── header.hbs
│   ├── footer.hbs
│   └── navigation.hbs
└── routes.yaml       # Custom routing (optional)
```

## Content Mapping

Stack Blog automatically maps its flat-file content structure to Ghost's expected format:

### Pages → Posts
```yaml
# Stack Blog (Markdown + YAML)
---
title: "My Blog Post"
description: "Post description"
author: "John Doe"
date: "2023-12-25"
tags: "javascript, nodejs"
featured: true
---
# Post Content
```

```javascript
// Ghost Context (Generated)
{
  title: "My Blog Post",
  excerpt: "Post description",
  authors: [{ name: "John Doe" }],
  published_at: "2023-12-25",
  tags: [
    { name: "javascript", slug: "javascript" },
    { name: "nodejs", slug: "nodejs" }
  ],
  featured: true,
  html: "<h1>Post Content</h1>",
  reading_time: 2
}
```

## Popular Theme Compatibility

### ✅ Excellent Compatibility
- **Casper** (Ghost default): Perfect compatibility
- **Liebling**: Full support for all features
- **Editorial**: Complete functionality
- **Alto**: Works perfectly
- **London**: Full compatibility

### 🔵 Good Compatibility
- **Massively**: Minor styling adjustments needed
- **Nurui**: Some advanced features limited
- **Dawn**: Works with minimal issues

### 🟡 Fair Compatibility
- **Themes with complex Ghost API usage**: Limited functionality
- **Themes requiring Ghost Apps**: Core features work

## Troubleshooting

### Theme Not Rendering Correctly

1. **Check theme validation**:
   ```bash
   # Use admin panel validation
   Admin → Themes → [Theme] → Validate
   ```

2. **Verify required files**:
   - Ensure `index.hbs` exists
   - Check `post.hbs` is present
   - Validate `package.json` format

3. **Review console errors**:
   - Check browser console for JavaScript errors
   - Review server logs for template errors

### Missing Styles or Scripts

1. **Asset path issues**:
   ```handlebars
   <!-- Correct -->
   {{asset "css/style.css"}}
   
   <!-- Incorrect -->
   <link rel="stylesheet" href="/css/style.css">
   ```

2. **Cache issues**:
   ```bash
   # Clear template cache
   Admin → Cache → Clear Template Cache
   ```

### Context Variables Missing

1. **Check context mapping**:
   ```handlebars
   <!-- Debug context -->
   <pre>{{json this}}</pre>
   ```

2. **Verify helper usage**:
   ```handlebars
   <!-- Use Ghost helpers -->
   {{#foreach posts}}{{title}}{{/foreach}}
   
   <!-- Not plain Handlebars -->
   {{#each posts}}{{title}}{{/each}}
   ```

## Performance Optimization

### Template Caching
Stack Blog automatically caches compiled templates in production:

```javascript
// Automatic in production
templateCacheService.enabled = process.env.NODE_ENV === 'production'
```

### Asset Optimization
- **CSS/JS Minification**: Use build tools in your theme
- **Image Optimization**: Compress images before upload
- **Font Loading**: Use font-display: swap for better performance

### Cache Management
```bash
# Admin panel cache controls
Admin → Cache Management
- Clear Template Cache: Clears compiled templates
- Clear Content Cache: Clears processed content
- Preload Cache: Warms up cache for better performance
```

## Theme Development

### Creating Ghost-Compatible Themes

1. **Start with Ghost theme structure**:
   ```bash
   mkdir my-theme
   cd my-theme
   npm init
   ```

2. **Create package.json**:
   ```json
   {
     "name": "my-theme",
     "version": "1.0.0",
     "engines": {
       "ghost": ">=4.0.0"
     }
   }
   ```

3. **Build essential templates**:
   ```handlebars
   <!-- index.hbs -->
   {{#foreach posts}}
     <article>
       <h2><a href="{{url}}">{{title}}</a></h2>
       <p>{{excerpt}}</p>
     </article>
   {{/foreach}}
   ```

### Testing Themes

1. **Use validation tools**:
   - Stack Blog built-in validation
   - GScan compatibility checker
   - Manual testing across contexts

2. **Test all contexts**:
   - Homepage (index)
   - Individual posts
   - Tag pages
   - Author pages
   - Error pages

## Migration from Ghost

### Content Migration
1. **Export Ghost content** to JSON
2. **Convert to Markdown** using migration scripts
3. **Preserve metadata** in YAML frontmatter
4. **Update image references** to Stack Blog paths

### Theme Migration
1. **Test existing themes** with Stack Blog validation
2. **Fix compatibility issues** if needed
3. **Adjust asset references** if required
4. **Update any Ghost-specific features**

## Best Practices

### Theme Selection
- ✅ Choose themes with high compatibility ratings
- ✅ Test thoroughly before production use
- ✅ Keep themes updated
- ✅ Backup themes before modifications

### Performance
- ✅ Enable caching in production
- ✅ Optimize images and assets
- ✅ Minimize external dependencies
- ✅ Use CDN for static assets

### Security
- ✅ Only install themes from trusted sources
- ✅ Review theme code before installation
- ✅ Keep Stack Blog updated
- ✅ Monitor for security updates

## Support and Resources

### Getting Help
- **Documentation**: This guide and Stack Blog docs
- **GitHub Issues**: Report bugs and compatibility issues
- **Community**: Stack Blog community forums
- **Validation Tools**: Built-in theme validation

### Useful Links
- [Ghost Theme Documentation](https://ghost.org/docs/themes/)
- [Handlebars Documentation](https://handlebarsjs.com/)
- [Ghost Theme Marketplace](https://ghost.org/marketplace/)
- [GScan Theme Validator](https://github.com/TryGhost/GScan)

## Changelog

### Version 2.0 (Phase 2)
- ✅ Complete Ghost context implementation
- ✅ Enhanced ghost_head/ghost_foot helpers
- ✅ Navigation and pagination helpers
- ✅ Admin theme management UI

### Version 3.0 (Phase 3)
- ✅ GScan theme validation integration
- ✅ Template and helper caching
- ✅ Theme upload/download/delete features
- ✅ Performance optimizations

---

**Stack Blog Ghost Theme Compatibility**: Bringing the power of Ghost themes to flat-file simplicity.