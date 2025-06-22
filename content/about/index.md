---
title: "About Stack Blog"
template: "default"
date: 2025-06-22
description: "Learn about Stack Blog, a modern flat-file CMS built with Node.js"
---

# About Stack Blog

Stack Blog is a modern, flat-file content management system inspired by Kirby CMS and built with Node.js. It provides a simple, file-based approach to content management where pages are stored as Markdown files with YAML frontmatter.

## Key Features

- **Flat-File Storage**: No database required - content is stored in simple Markdown files
- **YAML Frontmatter**: Structured metadata for pages using YAML format
- **Dynamic Routing**: Automatic URL mapping to content files
- **Nunjucks Templates**: Powerful templating engine with layouts and includes
- **Markdown Processing**: Advanced markdown rendering with custom extensions
- **Media Management**: Built-in support for images and file uploads
- **Security-First**: Built with security best practices from the ground up

## Architecture

The system follows a clean, modular architecture:

- **ContentService**: Handles reading and writing of content files
- **MarkdownService**: Processes markdown content and extracts metadata
- **Template Engine**: Renders pages using Nunjucks templates
- **Dynamic Router**: Maps URLs to content automatically

## Technology Stack

- **Backend**: Node.js with Express.js
- **Templates**: Nunjucks templating engine
- **Content**: Markdown files with YAML frontmatter
- **Parsing**: gray-matter for frontmatter, markdown-it for rendering
- **Security**: Helmet.js for HTTP security headers

This approach provides the simplicity of static site generators with the flexibility of dynamic content management.