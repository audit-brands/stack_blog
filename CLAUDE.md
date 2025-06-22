# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Node.js Flat-File CMS** project inspired by Kirby CMS. The project is currently in the planning phase with only a design document (`stack_blog_design_plan.md`) present.

### Key Technologies (Planned)
- **Backend**: Node.js with Express.js
- **Content Storage**: Markdown files with YAML frontmatter
- **Templating**: Nunjucks, Handlebars, or EJS
- **Authentication**: bcrypt for single admin user
- **File Processing**: Sharp (images), Multer (uploads), gray-matter (Markdown parsing)

## Architecture

The CMS follows a flat-file approach where:
- Content is stored in Markdown/YAML files organized in folders
- Each folder represents a page or content item
- No database is used - all data is file-based
- Single admin user for content management
- Server-side rendering of pages

### Planned Directory Structure
```
content/          # Markdown/YAML content files
templates/        # HTML templates
public/           # Static assets (CSS, JS, uploads)
admin/            # Admin panel interface
config/           # Configuration files
routes/           # Express route definitions
controllers/      # Route handlers
services/         # Core business logic (ContentService, etc.)
plugins/          # Extension system
app.js            # Main application entry point
```

## Development Commands

Since the project hasn't been implemented yet, these commands will be available once the project is set up:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production (if applicable)
npm run build

# Lint code
npm run lint
```

## Core Components (Planned)

1. **ContentService**: Handles reading/writing content files, parsing Markdown with frontmatter
2. **AuthService**: Manages single admin user authentication
3. **FileService**: Handles file uploads and media management
4. **TemplateEngine**: Renders pages using chosen template engine
5. **Router**: Maps URLs to content files and handles dynamic routing

## Security Considerations

- Single admin user with bcrypt-hashed password
- CSRF protection for admin forms
- Input sanitization for user uploads
- File upload restrictions (type, size)
- Protected admin routes with session management

## Plugin Architecture

The design includes an extensible plugin system allowing:
- Custom content types
- Additional template helpers
- Route extensions
- Content processing hooks

## Git Commit Guidelines

When making commits to this repository:
- DO NOT include "Co-Authored-By: Claude <noreply@anthropic.com>" line in commit messages
- Keep commit messages clear and concise
- Follow conventional commit format (feat:, fix:, docs:, etc.)
- Include the 🤖 emoji and "Generated with Claude Code" link when appropriate

## TaskWarrior Integration

This project uses TaskWarrior for task management. All todos are associated with the project 'stack_blog' for easy filtering and tracking.

### TaskWarrior Commands
```bash
# View all stack_blog tasks
task project:stack_blog list

# View pending stack_blog tasks
task project:stack_blog status:pending list

# View completed stack_blog tasks
task project:stack_blog status:completed list

# Mark a task as done
task <id> done

# Add a new task to the project
task add project:stack_blog "Task description"
```

### Current Development Phase
Currently working on **Phase 1: Project Setup and Core Infrastructure**

## Getting Started

To begin implementation:
1. Initialize npm project: `npm init -y` ✓
2. Install core dependencies: `npm install express gray-matter bcrypt multer sharp` ✓
3. Create the directory structure as outlined above ✓
4. Implement core services starting with ContentService
5. Set up Express routes and middleware
6. Build the admin panel interface