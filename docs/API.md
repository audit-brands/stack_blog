# Stack Blog REST API

Stack Blog includes a comprehensive REST API that allows you to use it as a headless CMS. The API provides endpoints for content management, search, and media handling.

## Base URL

All API endpoints are prefixed with `/api`:

```
http://localhost:3000/api
```

## Authentication

Protected endpoints (create, update, delete operations) require authentication when an API key is configured. Set the `API_KEY` environment variable to enable API authentication.

### Usage

Include the API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

If no API key is configured, all endpoints are publicly accessible.

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "error": "Error Type",
  "message": "Error description"
}
```

## Content Endpoints

### List Pages

Get a paginated list of all pages.

```
GET /api/pages
```

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10, max: 100) - Items per page
- `search` (string) - Search term to filter pages
- `template` (string) - Filter by template type
- `sort` (string, default: 'date') - Sort by: date, title, slug
- `order` (string, default: 'desc') - Sort order: asc, desc

**Example Response:**
```json
{
  "success": true,
  "data": {
    "pages": [
      {
        "slug": "welcome",
        "title": "Welcome to Stack Blog",
        "description": "Getting started guide",
        "content": "# Welcome...",
        "html": "<h1>Welcome...</h1>",
        "metadata": {
          "title": "Welcome to Stack Blog",
          "description": "Getting started guide",
          "template": "default",
          "date": "2023-12-01",
          "wordCount": 150,
          "readingTime": 1
        },
        "lastModified": "2023-12-01T10:00:00.000Z",
        "url": "/welcome"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "total": 42,
      "limit": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Get Page

Get a specific page by slug.

```
GET /api/pages/:slug
```

**Query Parameters:**
- `html` (boolean, default: true) - Include rendered HTML

**Example Response:**
```json
{
  "success": true,
  "data": {
    "slug": "welcome",
    "title": "Welcome to Stack Blog",
    "description": "Getting started guide",
    "content": "# Welcome...",
    "html": "<h1>Welcome...</h1>",
    "metadata": { ... },
    "lastModified": "2023-12-01T10:00:00.000Z",
    "url": "/welcome"
  }
}
```

### Create Page

Create a new page. **Requires authentication if API key is configured.**

```
POST /api/pages
```

**Request Body:**
```json
{
  "title": "Page Title",
  "content": "# Page content in Markdown",
  "description": "Optional description",
  "template": "default",
  "date": "2023-12-01",
  "slug": "optional-custom-slug"
}
```

**Response:** Returns the created page data with 201 status.

### Update Page

Update an existing page. **Requires authentication if API key is configured.**

```
PUT /api/pages/:slug
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "# Updated content",
  "description": "Updated description",
  "template": "blog",
  "date": "2023-12-01",
  "newSlug": "optional-new-slug"
}
```

**Response:** Returns the updated page data.

### Delete Page

Delete a page. **Requires authentication if API key is configured.**

```
DELETE /api/pages/:slug
```

**Response:**
```json
{
  "success": true,
  "message": "Page deleted successfully"
}
```

## Search Endpoints

### Search Content

Search through all content with full-text search.

```
GET /api/search
```

**Query Parameters:**
- `q` (string) - Search query
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 10, max: 50) - Results per page
- `sort` (string, default: 'relevance') - Sort by: relevance, date, title
- `template` (string) - Filter by template
- `from` (date) - Filter by date from
- `to` (date) - Filter by date to

**Example Response:**
```json
{
  "success": true,
  "data": {
    "query": "welcome",
    "results": [
      {
        "slug": "welcome",
        "title": "Welcome to Stack Blog",
        "description": "Getting started guide",
        "snippet": "...getting started with <mark>welcome</mark> content...",
        "score": 8.5,
        "date": "2023-12-01",
        "lastModified": "2023-12-01T10:00:00.000Z",
        "template": "default",
        "url": "/welcome"
      }
    ],
    "pagination": { ... },
    "searchTime": 12,
    "indexSize": 42
  }
}
```

### Search Suggestions

Get search suggestions for autocomplete.

```
GET /api/search/suggestions
```

**Query Parameters:**
- `q` (string) - Partial search query
- `limit` (integer, default: 5) - Number of suggestions

**Example Response:**
```json
{
  "success": true,
  "data": ["welcome", "website", "web development"]
}
```

## Media Endpoints

### List Media Files

Get a paginated list of media files.

```
GET /api/media
```

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20, max: 100) - Items per page
- `search` (string) - Search in filenames
- `type` (string) - Filter by type: image, document, all

**Example Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "filename": "hero-image.jpg",
        "originalName": "hero image.jpg",
        "size": 245760,
        "mimetype": "image/jpeg",
        "url": "/media/hero-image.jpg",
        "lastModified": "2023-12-01T10:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### Get File Info

Get information about a specific media file.

```
GET /api/media/:filename
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "filename": "hero-image.jpg",
    "originalName": "hero image.jpg",
    "size": 245760,
    "mimetype": "image/jpeg",
    "url": "/media/hero-image.jpg",
    "lastModified": "2023-12-01T10:00:00.000Z",
    "dimensions": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

### Upload Files

Upload media files. **Requires authentication if API key is configured.**

```
POST /api/media/upload
```

**Request:** Multipart form data with `files` field (supports multiple files, max 10).

**Example Response:**
```json
{
  "success": true,
  "message": "2 file(s) uploaded successfully",
  "data": {
    "files": [
      {
        "filename": "image-123456.jpg",
        "originalName": "my-image.jpg",
        "size": 245760,
        "mimetype": "image/jpeg",
        "url": "/media/image-123456.jpg",
        "processed": {
          "original": "image-123456.jpg",
          "thumbnail": "thumb-image-123456.jpg"
        }
      }
    ]
  }
}
```

### Delete File

Delete a media file. **Requires authentication if API key is configured.**

```
DELETE /api/media/:filename
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## System Endpoints

### API Status

Get API status and system information.

```
GET /api/status
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "version": "1.0.0",
    "timestamp": "2023-12-01T10:00:00.000Z",
    "search": {
      "enabled": true,
      "indexSize": 42,
      "lastIndexed": 1701428400000
    },
    "endpoints": {
      "pages": "/api/pages",
      "search": "/api/search",
      "media": "/api/media",
      "status": "/api/status"
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or missing required fields |
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists (e.g., slug conflict) |
| 500 | Internal Server Error - Server-side error |

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

The API doesn't include CORS headers by default. Configure CORS middleware if you need cross-origin access.

## Examples

### JavaScript/Node.js

```javascript
const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'your-api-key';

// Get all pages
const pages = await fetch(`${API_BASE}/pages`)
  .then(res => res.json());

// Create a page
const newPage = await fetch(`${API_BASE}/pages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    title: 'My New Page',
    content: '# Hello World\n\nThis is my new page!'
  })
}).then(res => res.json());

// Search content
const searchResults = await fetch(`${API_BASE}/search?q=hello`)
  .then(res => res.json());
```

### Python

```python
import requests

API_BASE = 'http://localhost:3000/api'
API_KEY = 'your-api-key'

# Get all pages
response = requests.get(f'{API_BASE}/pages')
pages = response.json()

# Create a page
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}
data = {
    'title': 'My New Page',
    'content': '# Hello World\n\nThis is my new page!'
}
response = requests.post(f'{API_BASE}/pages', json=data, headers=headers)
new_page = response.json()
```

### cURL

```bash
# Get all pages
curl http://localhost:3000/api/pages

# Create a page
curl -X POST http://localhost:3000/api/pages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"title":"My New Page","content":"# Hello World"}'

# Search
curl "http://localhost:3000/api/search?q=hello&limit=5"
```