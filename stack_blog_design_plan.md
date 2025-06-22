Implementation Plan for a Node.js Flat-File CMS (Kirby-Inspired)
Introduction and Goals
Flat-file content management systems (CMS) store content in plain text files (e.g. Markdown or YAML) instead of using a database
buttercms.com. This project aims to design a flat-file CMS in Node.js, inspired by Kirby’s clean design and architecture principles. Kirby is a PHP-based flat-file CMS where folders represent pages and content is stored in text files
getkirby.com. We will mimic this approach in Node.js with a focus on simplicity, performance, and extensibility. The key goals include:
Flat-File Content Storage: All site content (pages, posts, etc.) will be stored as Markdown/YAML files on disk, not in a database.
Single Site Focus: The CMS will manage one website (no multisite functionality needed).
Admin Panel: Provide an elegant admin interface for a single content editor (one admin user) to create and edit content.
Node.js Server: Use a Node server (e.g. Express) to serve pages, handle editing requests, and manage assets.
Kirby-like Design: Follow Kirby’s principles – simple file-based content structure, flexible templating, and an intuitive editing experience.
Scalability & Clean Code: Use clear project structure and coding best practices to ensure maintainability and allow future growth or plugins.
By eliminating the database, the site should respond quickly since reading flat files is faster than making database queries
buttercms.com. We’ll also ensure security best practices (e.g. protection against common web attacks), and leverage Node’s ecosystem for additional features (like image processing and plugin support).
Directory Structure and Content Organization
The CMS will organize content in a hierarchical folder structure, similar to Kirby’s “folders as pages” concept
getkirby.com. An example directory layout might be:
plaintext
Copy
project-root/
├── content/               # All content files (each page as a folder)
│   ├── home/              
│   │   └── index.md       # Home page content (Markdown with YAML front matter)
│   ├── about/
│   │   ├── index.md       # "About" page content
│   │   └── team.jpg       # Example of an image associated with the page
│   └── blog/
│       ├── 2025-01-01-new-year/   # Blog post folder (date-title as folder name)
│       │   ├── index.md           # Blog post content 
│       │   └── hero.png           # Image used in the blog post
│       └── 2025-01-10-second-post/
│           └── index.md
├── templates/            # Template files for rendering pages (e.g. Handlebars/EJS/Nunjucks templates)
│   ├── default.html      # Default page template
│   └── blog-post.html    # Template for blog post pages
├── public/               # Public assets (served as static files)
│   ├── css/              
│   ├── js/
│   └── uploads/          # (Optional) uploaded media files, if not stored in content folders
├── admin/                # Admin panel front-end (if using a separate front-end build or static files)
│   └── dist/             # Compiled admin app (if using SPA) or templates (if server-rendered)
├── config/               # Configuration files (e.g. for admin user credentials, settings)
└── app.js                # Main Express app setup
Content File Format: Each page’s content will be written in Markdown for rich text, with YAML front-matter for metadata (title, date, etc.). This allows easy parsing of page attributes and content. For example, an index.md file might look like:
markdown
Copy
---
title: "About Our Company"
template: "default"
date: 2025-06-01
---
Welcome to **Our Company**! This is the about page content written in Markdown.
In this example:
The section between --- is YAML front matter containing structured data (title, template name, date, etc.).
Below the front matter is the main content in Markdown, which will be converted to HTML when rendering the page.
This format is human-readable and flexible. It’s also compatible with many Node libraries (like gray-matter or front-matter) that can parse the file into an object (separating metadata and content). We choose Markdown for content because it’s easy for editors to write and can be converted to HTML for display. YAML is used for front matter because it’s a simple way to define page fields (Kirby similarly separates fields in text files using a --- delimiter
sitepoint.com
sitepoint.com
). Page Folders: Each page resides in its own folder under content/. The folder name can serve as the page’s URL slug (e.g. about/ folder corresponds to /about URL). For ordering or structured sections, we can prefix folders with numbers (like 1_home, 2_about) similar to Kirby’s approach
sitepoint.com
 – though this is optional unless manual ordering is needed. Subpages are represented by nested folders (e.g. the blog folder’s subfolders are individual blog posts). Assets like images related to a page can be stored in the same folder as the page content (as shown with team.jpg in the about folder). This co-locates content with its media for easier management (Kirby likewise allows images within page folders
getkirby.com
). Alternatively, for simplicity, a global uploads/ directory (under public/) can store all media files. In this plan, we lean toward storing images within page folders to mimic Kirby’s organization, but we will ensure the Node server can serve those images (more on that in the File Upload section). Site Metadata: We can have a special file for site-wide data (like site title, author, etc.), e.g. content/site.yaml or content/site.md. Kirby uses a site.txt for global fields
getkirby.com. In our case, a site.yaml might contain global settings or an index.md in content/home could serve as the homepage. This is configurable via the server logic (e.g. treat content/home/index.md as the homepage).
Server-Side Architecture (Node.js & Express)
We will use Node.js with Express.js as the web server framework. Express is a minimal, flexible framework that allows us to easily define routes, serve static files, and integrate middleware
github.com. The server-side architecture will be organized for clarity and scalability:
Express Application Setup: The main app.js (or server.js) will initialize an Express app. We will use Express’ routing to separate concerns:
Frontend Routes: Routes that serve the website pages (for end-users).
Admin Routes (API): Routes under an /admin prefix (or separate sub-app) to serve the admin panel and handle content management actions (create, edit, delete content files, upload files).
MVC Structure: We will follow a loose MVC (Model-View-Controller) pattern:
Model: In a flat-file CMS, the "model" can be the content files themselves. We will create a Content Service module to act as the model layer – responsible for reading and writing Markdown files. For example, a ContentService could have methods like getPage(slug), savePage(slug, data), listPages(), etc. Internally it uses Node’s fs module to manage files and directories.
View: Templating is used to render HTML. We’ll use a server-side templating engine such as Nunjucks, Handlebars, or EJS to define HTML templates for pages. This allows dynamic rendering of content into a consistent layout. (Kirby uses PHP templates; here we’ll use an equivalent in Node).
Controller: Express route handlers act as controllers, invoking the content service and choosing the correct template. For example, a route handler for GET /about will call ContentService.getPage('about'), then render the about page using a template.
Routing Logic for Content Pages: We can implement a dynamic route that catches all page URLs. For example:
js
Copy
app.get('*', (req, res, next) => {
    // Map URL path to content file path
    const slug = req.path === '/' ? 'home' : req.path.substring(1); 
    const contentPath = path.join(CONTENT_DIR, slug, 'index.md');
    fs.readFile(contentPath, 'utf-8', (err, fileData) => {
        if (err) return next(); // if file not found, trigger 404 handler
        const { data: meta, content: markdown } = parseFrontMatter(fileData);
        const htmlBody = markdownToHtml(markdown);
        const templateName = meta.template || 'default';
        res.render(templateName, { ...meta, content: htmlBody });
    });
});
In the above pseudo-code:
We map the request URL to a file in content/. e.g. /about → content/about/index.md.
Use a helper (like gray-matter) to parse the Markdown file into meta (YAML front matter as an object) and markdown (the raw Markdown content).
Convert Markdown to HTML (using a library like marked or markdown-it).
Determine which template to use (e.g. from a template field in meta, defaulting to a generic template).
Render the page by passing the parsed content and meta to the chosen template (Express’s res.render will use the configured view engine).
This design makes it easy to add new pages: just add a new folder and Markdown file in content/, and the routing logic will automatically serve it. It also mimics Kirby’s approach where adding files/folders immediately adds pages, no further configuration needed
getkirby.com.
Templating Engine: We will choose a templating engine that supports layouts and includes, for flexibility in building the frontend. Nunjucks (inspired by Jinja/Twig) is a good choice because it’s powerful and can be easily integrated with Express. It allows template inheritance (layouts) and partials, which is useful for common page sections like headers, footers, or menus. Alternatively, Handlebars or EJS could be used; the choice can be left to implementation preference. The templating engine will receive data (page content, metadata, and possibly global site info) and produce final HTML. Example: The default.html template could define a layout and print content:
html
Copy
<!-- templates/default.html -->
<html>
  <head>
    <title>{{ title }} - My Site</title>
  </head>
  <body>
    {% include "partials/navbar.html" %}
    <main>
      <h1>{{ title }}</h1>
      {{ content | safe }}   {# 'content' contains the HTML of the page's body #}
    </main>
  </body>
</html>
Static File Serving: Express will serve static assets (CSS, client-side JS, images) from the public/ directory:
js
Copy
app.use(express.static(path.join(__dirname, 'public')));
This allows the site to deliver media (images, uploads, etc.) and compiled CSS/JS. If we store images in the content folders, we have two options:
Static Serving from Content: We could also serve the content/ directory as static but with restrictions (to serve only media files, not the Markdown). We must ensure .md or .yaml files are not directly accessible via HTTP for security. For example, use a custom static file middleware that only serves images or specific file types from content/.
Copy media to Public: Alternatively, when an image is uploaded or when building the site, copy images from content/... into public/uploads (possibly preserving a parallel folder structure). This keeps content purely for source files and public for served assets.
In this plan, a straightforward approach is to allow static serving of certain file types from content/ (e.g., serve *.jpg, *.png, *.pdf etc.) while blocking .md and other content files. This can be done with a custom middleware or by placing media in a separate folder under public/. We will document whichever approach is chosen in the implementation.
Configuration and Constants: Use a config file or environment variables for things like content directory path, site settings, admin credentials, etc. For example, a config/default.json (if using node-config) or .env file for sensitive info. This centralizes configurations and makes the app flexible for different environments (dev vs prod).
Logging & Error Handling: Implement basic logging (using a library like morgan for HTTP requests and perhaps Winston for application logs). Also include error handling middleware in Express to catch and display 404s or server errors gracefully (and not expose stack traces in production). This ensures the server is robust and debuggable.
Content Rendering: Static vs. Dynamic Approach
One design decision is whether to statically generate pages or dynamically render them on each request. We will consider both approaches:
Dynamic Rendering (On-the-fly): The Node server will read the markdown files and render HTML for each request (as illustrated in the routing logic above). This is similar to Kirby’s operation – on each page load, Kirby (PHP) reads the content files and generates the page. Dynamic rendering is straightforward to implement and ensures that whenever an admin edits content, the next page load will reflect those changes immediately. Modern servers with SSDs can handle many file reads quickly, and Node can cache content in memory if needed to boost performance. We can implement caching strategies such as:
In-memory caching: Keep a cache of parsed pages (e.g., in a simple object or using a caching library). Invalidation can be done by clearing the cache when a content file is updated via the admin.
Static cache files: On first request or on content save, generate the HTML and save it to a file in a cache directory. Next requests can be served directly from this pre-rendered HTML (almost like a static file). This hybrid approach gives static-like speed while still allowing dynamic updates.
With dynamic rendering, the initial page load might be slightly slower than static (due to file I/O and markdown parsing), but since no database is involved, it's still quite fast. Removing database calls reduces resource usage and latency
buttercms.com. For a moderate amount of content and traffic, dynamic on-the-fly rendering with caching will be sufficient on a dedicated server.
Static Site Generation (Pre-build): Alternatively, the CMS could generate static HTML pages whenever content is changed (or on demand). In this model, the Markdown files are transformed into HTML files ahead of time, and the server would simply serve those HTML files (or one could even deploy them to a static hosting). This approach yields very fast page loads and minimal server processing per request. It’s essentially how static site generators (like Jekyll, Hugo) work, but here we’d integrate it with the admin: after an admin saves content, the system would regenerate the affected page’s HTML (and possibly rebuild navigation or index pages if needed). Pros: High performance (just serving static files), and can leverage CDNs easily. Also, it reduces runtime errors because pages are pre-built (if something is wrong, it can be caught during generation). Cons: Increased complexity – need to implement a generation step and ensure it runs reliably after edits. Also, for immediate content updates, the system must complete the build before changes go live. On large sites, rebuilding can be slow (though we can optimize by only rebuilding changed content).
Given the requirement of "dedicated server with no major hosting constraints", our plan leans toward dynamic rendering with caching. This provides flexibility (no need to manage a build pipeline for each edit) and is simpler to implement initially. We will ensure to implement caching strategies to handle high traffic (e.g., memory cache, or using HTTP caching headers for client/proxy caching if content doesn’t change often). However, we will design the system such that static generation could be added later or as an optional mode. For example, the content service could have a method generateAll() that iterates through all content files and outputs static HTML files. This could be used to produce a static version of the site if needed (for deployment to static hosting or backup). Conclusion on Rendering: Use dynamic rendering for real-time updates and simpler workflow, with careful caching to achieve performance. Keep the door open for static generation features if needed in the future. This hybrid approach ensures we retain the speed benefits of flat-file systems (no DB queries, faster responses
buttercms.com
) while maintaining ease of content management.
Admin Panel Design and Integration
One of the core features is an admin panel for editing content through a browser, protected by a login. The admin interface will be a separate portion of the application, accessible via a route (e.g. visiting http://yoursite.com/admin).
Admin Panel Stack
We have two possible approaches for building the admin UI:
Server-Side Rendered Admin (Multi-Page App): We can use server-side templates (like Express with EJS or Pug) to render admin pages (login form, content editor form, etc.). This is simpler to implement: each admin action (edit/save) is a form submission or an AJAX call to the Express app. We can use minimal JavaScript to enhance the experience (for example, a Markdown editor widget or image uploader preview) while doing most things with standard HTML forms and page reloads.
Single-Page Application (SPA) Admin: For a more modern experience, build the admin as a small frontend application (using a framework like Vue.js or React). This SPA would communicate with the backend via a JSON API. Kirby’s panel itself is built with Vue.js components
getkirby.com, reflecting this modern approach. We can mirror this by using Vue (or React) for our admin:
The admin frontend could be built separately (with a bundler, etc.) and the compiled assets placed in admin/dist/.
The Node server serves the admin HTML/JS/CSS from the admin/ directory (much like serving a static app).
All content operations (fetching page data, saving edits, uploading files) happen through API endpoints (e.g. RESTful routes like GET /admin/api/pages/about, POST /admin/api/savePage etc.) that the SPA calls with XHR/Fetch.
This decouples the admin UI from the backend rendering – providing a smoother experience (no full page reloads, possibly rich text editors, etc.), at the cost of more initial development work.
Choice: For this plan, we prioritize clean design and ease of implementation, so we can start with a server-rendered multi-page admin interface enhanced with JavaScript where needed. This gets the job done with less complexity. However, we will structure the admin routes in a way that could later be replaced or augmented by an SPA if desired. (For example, we might already implement JSON routes for content, which both a server-rendered form and a future SPA could use.)
Admin Panel Features
Regardless of implementation style, the admin panel will include:
Login Screen: A simple login form where the admin enters username and password. Only the single authorized user can pass (see Authentication section for details on verifying credentials). Once logged in (session established), the admin can access editing interfaces.
Dashboard or Page List: The main admin page can show a list of existing content pages (perhaps as a navigable tree reflecting the content folders). This gives the admin an overview and links to edit each page. For example, it could list top-level pages (Home, About, Blog, etc.) and allow expanding the Blog to see posts. Alternatively, a simple list of all pages or a search function to find content by title.
Page Editing Form: When editing a page, the admin should see a form with fields for the content. Because our content format is Markdown + front matter, there are two types of fields:
Structured fields (from YAML front matter): e.g. title, date, template, any custom fields defined. We can generate form inputs for these. For instance, a text input for "Title", a date picker for "date", dropdown for "template" if applicable, etc. The system can either infer these fields by reading the existing front matter keys, or we can have optional blueprint definitions (similar to Kirby’s blueprints) to configure which fields to show. To start simple, we might handle standard fields (title, etc.) generically. A future extension is to allow blueprint configuration for custom fields per template.
Main content (Markdown body): a large textarea for the Markdown content. Ideally, integrate a Markdown editor component to help the admin format text. This could be a simple solution like SimpleMDE or a more advanced WYSIWYG that supports Markdown (or just use a rich text editor and then convert to Markdown, but that adds complexity). Using a Markdown-focused editor gives a good writing experience with formatting buttons, previews, etc., while storing content as Markdown.
The editing page might show a live preview of the Markdown rendered to HTML (update as they type), or at least a preview button. This can be done by using the same markdown library in the browser or via an AJAX call to an endpoint that renders markdown to HTML.
New Page Creation: The admin panel should allow creating a new page. This could be done via a “New Page” form where the admin enters a title (and perhaps chooses a parent page for nesting). The system will then:
Slugify the title to create a folder name (e.g. "My New Page" -> my-new-page folder under content/ or under a chosen parent).
Create that folder and an index.md within it with initial content (perhaps front matter with title pre-filled).
Possibly also create a default template if needed or ensure the template field is set.
Then redirect the admin to the edit form for that new page to add content.
Deleting/Renaming Pages: Basic content management might include deleting a page or changing its title/slug. Deletion involves removing the folder from content (with care – maybe only allow if no subpages, or delete all subpages too if confirmed). Renaming a page’s slug (folder) might be tricky if links are based on it, but we could allow it by renaming the folder. This is a somewhat advanced operation; it could be omitted initially, or done carefully by the admin outside the CMS if needed.
Media Management: On each page’s edit screen, provide an interface to upload images or other files to that page’s folder. This can be as simple as an “Upload Image” button that opens a file picker. When an image is uploaded:
The server receives it (via a POST to an upload endpoint), saves the file into the corresponding content folder (or public/uploads with an association).
The admin UI can then insert a link or markdown snippet for the image into the content. For instance, if an image team.jpg is uploaded to content/about/, the editor might automatically insert ![](team.jpg) or the full path ![](/about/team.jpg) in the Markdown.
Alternatively, we list uploaded files for that page and allow the admin to copy a URL or insert into content by clicking.
A possible enhancement is an asset library view (to manage all uploads in one place), but for simplicity, tying uploads to pages is cleaner and echoes Kirby’s practice of page-specific files.
User Settings: Since we only have one admin user, we might not need a complex user management UI. But we could include a simple “Change Password” form for the admin to update their password (which would update the stored credential in the config file or wherever it’s stored, see Authentication section).
Admin UI Design: We aim for a clean, minimal interface, similar in spirit to Kirby’s panel (which is praised for simplicity and clarity
getkirby.com
getkirby.com
). This means:
A sidebar or header for navigation (e.g., site name and a logout button, maybe a link back to the live site).
Simple lists or cards for pages, clearly indicating page hierarchy.
Clear forms for editing, labeling fields clearly (maybe using the front matter keys as labels or having a friendly name mapping).
Use of an existing CSS framework or component library for quicker development: for example, using Tailwind CSS for utility styling or a lightweight component kit. This ensures the admin looks modern without building all styles from scratch.
If using Vue/React, one could use ready-made UI libraries (Vuetify, Ant Design, etc.), but that might be heavy for a small project. Simpler is fine.
Integration with File System (Content CRUD Operations)
The admin panel actions must translate to file system changes, as content is stored in files. We will implement this through the backend (Express) API:
Reading Content: When the admin opens an edit page, the server will read the corresponding Markdown file, parse the front matter and content (e.g., using gray-matter library). It will then render an edit form (or send JSON) with those fields. For instance:
js
Copy
// Pseudo-code for getting page data
function getPageData(slug) {
  const file = fs.readFileSync(`content/${slug}/index.md`, 'utf8');
  const { data: attributes, content: bodyMd } = grayMatter(file);
  return { attributes, bodyMd };
}
The attributes (YAML) and the body (Markdown) are then provided to the admin UI. If using server-rendered HTML, we interpolate them into form fields. If using an API, we send them as JSON.
Saving Content: When the admin submits changes (e.g. presses "Save"), the new data needs to be written back to the flat file:
The server receives the updated content (e.g. via req.body if form-encoded or JSON).
It will merge the data into a Markdown file format again. We can use a library like gray-matter’s stringify function to produce a Markdown file from an object and a content string. For example:
js
Copy
const newContent = req.body.content;      // Markdown text from form
const newMeta = {
  title: req.body.title,
  date: req.body.date,
  // ...other fields
};
const newFileText = grayMatter.stringify(newContent, newMeta);
fs.writeFileSync(`content/${slug}/index.md`, newFileText, 'utf8');
This will overwrite the Markdown file with updated front matter and content. By preserving the text format, we keep the files human-readable and version-controllable.
After saving, we can invalidate the cache for that page (if caching is used for dynamic rendering) or regenerate static files if we were doing static site generation.
Then respond to the admin (either redirect back to the form with a success message, or send a JSON success response).
Creating New Content: As mentioned, creating a new page involves making a new folder and file. This operation will likely be triggered by a form (where admin gives a title and chooses parent). The backend will:
Create a slug (possibly using a slug library or simple regex to turn the title into a URL-safe string).
Determine the directory: if a parent is selected, use content/parentSlug/new-slug, otherwise content/new-slug.
Ensure the slug doesn’t conflict with existing one (if so, maybe append a number or return an error).
fs.mkdirSync to create the folder.
Create an index.md file. For initial content, we might include front matter with the title, and a placeholder in the body (or leave body empty). For example:
yaml
Copy
---
title: "New Page Title"
date: 2025-06-22
template: default
---
*Start writing content...*
The date can be auto-filled, template defaulted, etc.
After creation, either redirect the admin to edit that new page or return the new page data.
Deleting Content: For deletion, the server will delete the folder and all its contents using fs.rm/fs.rmdir (with recursion if needed). This action should likely require a confirmation (to avoid accidental deletion). If using an SPA, a modal “Are you sure?” can be shown; if server-rendered, maybe a two-step process (click “Delete” -> navigates to a confirm page or requires a form submission to confirm). We’ll implement it carefully to avoid deleting unintended files. Possibly move to a trash folder instead of immediate deletion, for safety (optional feature).
Throughout these operations, we must handle errors gracefully (e.g., disk write errors, permission issues, etc.) and provide feedback to the user in the admin UI.
Example Code Snippet: Saving a Page
Below is a simplified example of how a save operation might look in Express (assuming body-parser middleware is used for JSON or form data):
js
Copy
const fm = require('gray-matter');

app.post('/admin/save', ensureAuth, (req, res) => {
  const slug = req.body.slug;
  const contentMd = req.body.content;            // The markdown body from the form
  const metaFields = req.body.meta || {};        // An object of all front matter fields from form

  try {
    const filePath = path.join('content', slug, 'index.md');
    // Merge existing metadata with new, or use new directly
    // Ensure required fields like title are present:
    if (!metaFields.title) {
      throw new Error("Title is required");
    }
    const newText = fm.stringify(contentMd, metaFields);
    fs.writeFileSync(filePath, newText, 'utf8');
    // Invalidate cache or regenerate static if needed:
    cache.invalidate(slug);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to save content:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
This snippet uses ensureAuth middleware to ensure only an authenticated admin can call it (details in Authentication section). It then writes the file and updates the cache. In a real scenario, we might send the user back to the editor UI with a flash message like "Saved successfully" if not using an SPA.
Authentication and Security for Admin Access
The CMS will restrict the admin panel to a single authorized user. We need a login system to authenticate this user and protect all admin routes. Since we do not have a database, user credentials will be stored in configuration. Here’s the plan for authentication:
Credential Storage: We can store the admin username and password hash in a config file or environment variables. For example, in config.js:
js
Copy
module.exports = {
  adminUser: "admin",
  adminHash: "$2b$12$XyZ..."   // bcrypt hash of the password
};
Storing a hashed password is important for security (never store plaintext). We will use a strong hashing algorithm like bcrypt. The actual password can be set by the developer during setup (e.g., generate a hash for a chosen password and put it in config). Alternatively, we provide a one-time setup route to set the password initially.
Login Process:
The admin visits /admin/login (which shows a login form asking for username and password).
They submit credentials to /admin/login (POST). The server then compares:
Find the stored hash by username (we only have one user, but still check user matches).
Use bcrypt to compare the submitted password with the stored hash.
If it matches, create an authenticated session.
Session Management: We will use an Express session middleware (express-session) or JWT (JSON Web Token) for maintaining login state. For simplicity, using sessions with cookies is fine since it's a single server. Configuration:
Use a secure session cookie (set httpOnly to prevent JS access, and secure if using HTTPS in production).
The session store can be in-memory (default) or a file, but memory is fine for one user, or consider a file store for persistence across restarts.
After login, store something like req.session.user = adminUsername to mark the user as logged in.
Implement a middleware ensureAuth that checks req.session.user (or JWT) on protected routes. If not present, redirect to login or return 401 for XHR.
Logout: Provide a route /admin/logout that destroys the session (req.session.destroy()) and redirects to the login page.
Password Security: By using a hashed password and only one login attempt interface, risk is low. We should also:
Rate-limit login attempts to prevent brute force (e.g., limit to 5 attempts per minute using a middleware like express-rate-limit).
Encourage use of a strong password (since it's single user, the responsibility is on the site owner to choose a secure one).
Optionally, implement 2FA if high security is needed (e.g., Time-based OTP via an app), but this might be overkill. Kirby itself supports multi-user and could support 2FA, but for our single-user scenario, a strong password over HTTPS is typically sufficient.
Authorization: Only the admin user can access the content management routes. All Express routes under /admin (and API endpoints) will use the ensureAuth check. This ensures that even if someone discovers the admin URL, they cannot access content editing without logging in.
Protecting Content Files: As mentioned earlier, we must ensure raw content files (Markdown/YAML) are not publicly accessible. We will configure static serving carefully:
If we serve images from content/, we will explicitly filter by extension and disallow serving .md or .yaml files via HTTP. This prevents leaks of unpublished content or exposure of raw source.
Alternatively, keep the entire content folder inaccessible from the web (not served statically at all) and route all media access through controlled routes (not necessary if using the static filtering approach, but an option).
Security Benefits of Flat-File Architecture: By not using SQL or a database, we eliminate the risk of SQL injection entirely
getkirby.com. The attack surface is smaller – mainly the admin panel itself (which we will secure as above) and the file system. We should still handle file path inputs carefully to prevent path traversal (e.g., never directly use user input as file path without sanitization). Using a whitelisted content directory and constructing paths via safe functions (as shown in code snippet using path.join with a known base directory) helps mitigate that.
Use HTTPS: Ensure the final deployment uses HTTPS so that the admin login (credentials) and session cookie are not interceptable. This might be handled at the server config or a proxy (out of scope for coding, but a deployment consideration).
Helmet and Other Middleware: We will use helmet middleware to set secure HTTP headers, and possibly csurf for CSRF protection on forms (especially if the admin panel has forms, to prevent cross-site request forgery). These add layers of security hardening.
In summary, authentication will be straightforward: one user, one password, session-based auth, and robust middleware to protect the admin interface.
File Upload and Image Management Strategy
Handling media (images, PDFs, etc.) is important for a CMS. Our plan for file uploads and management is as follows:
Uploading Interface: In the admin panel, when editing a page, there will be an option to upload files (commonly images). This could be a dedicated section in the edit form for “Media” or an “Upload Image” button within a WYSIWYG editor.
Backend Upload Handling: We will use a Node middleware like Multer to handle file uploads (parsing multipart/form-data). For example:
js
Copy
const multer = require('multer');
const upload = multer({ dest: 'tmp/' }); // or directly to target with a DiskStorage config

app.post('/admin/upload', ensureAuth, upload.single('file'), (req, res) => {
  const file = req.file; // file info from Multer
  const pageSlug = req.body.page; // which page this upload is for
  const filename = file.originalname;
  const targetPath = path.join('content', pageSlug, filename);
  fs.rename(file.path, targetPath, (err) => {
    if (err) return res.status(500).send("Upload failed");
    // Optionally, generate a smaller version or thumbnails
    res.json({ success: true, filename: filename });
  });
});
This would take an uploaded file and move it to the page’s content folder. We keep the original filename or could sanitize/slugify it to ensure it’s web-safe (no spaces, etc.). We might also want to ensure no name collision with existing files (if a file exists, either overwrite or store with a unique suffix).
Serving Uploaded Files: If images are stored in content/<page>/, we have to ensure they are accessible. As discussed, either:
Use Express static middleware with a filter to serve images from content/ directly. E.g.:
js
Copy
app.use('/content', express.static(path.join(__dirname, 'content'), {
  index: false,
  setHeaders: (res, filePath) => {
    // Only allow certain files to be served
    if (!filePath.match(/\.(png|jpg|jpeg|gif|pdf)$/)) {
      res.statusCode = 403;
    }
  }
}));
And in content, when referencing images, use the /content/... path (which essentially exposes that folder). For example, in the about page’s markdown one might reference ![](/content/about/team.jpg).
However, this approach means the URL structure exposes “content” in path, which might not be ideal. We could alias it by mounting the static folder on another URL, like:
js
Copy
app.use('/media', express.static(path.join(__dirname, 'content'), ...));
Then /media/about/team.jpg serves the image. This keeps things cleaner for the frontend URLs.
Or copy images to public/uploads: After saving upload, also copy it to public/uploads/<pageSlug>/filename. The Markdown content can then reference /uploads/<pageSlug>/filename. This decouples the source content folder from the served path. It’s slightly more work (duplicating file or moving it entirely to public). Alternatively, set Multer’s destination directly to public/uploads/<pageSlug>. This way, the file is immediately in a web-accessible directory. The content can then refer to it. But storing in content can keep content self-contained. Either approach works; the choice can depend on ease of backup and clarity.
For our plan, we will store uploads in the page folder for organizational clarity (like Kirby does), and configure an Express static route at /media to serve those files as described.
Image Processing: To improve performance and optimize images, we can incorporate an image processing library Sharp. For example, when an image is uploaded, we might:
Create multiple sizes (thumbnail, medium, large) and save them alongside the original (e.g. image.jpg, image@medium.jpg, image@thumb.jpg). Then the content editor or templates could use appropriate sizes for responsive loading.
Or use on-the-fly resizing: Kirby’s toolkit resizes images when requested (e.g. <?= $image->resize(800) ?> in templates)
getkirby.com
getkirby.com. We could emulate this by building a simple image service route that takes a file and size and uses Sharp to serve a resized version. However, that might be over-engineering for now. A simpler route: after upload, if the image is above a certain size (dimensions or file size), we can automatically generate a downsized version for web use, or prompt the admin to choose.
Initially, we may skip heavy processing and simply ensure the images are stored as-is. The admin should be advised to upload reasonably sized images. As an optional enhancement, integrating Sharp for automatic resizing/cropping (or offering such options in the admin) can be part of the extensibility plan.
File Types and Validation: We will restrict allowed file types to those needed (images: jpg, png, gif; documents: pdf, etc.) to prevent any harmful file uploads (no .js or .exe, etc.). Multer can filter by MIME type. Also, scanning filenames for path traversal is important (Multer handles this by not allowing ../ in names, but we remain cautious).
Referencing Media in Content: How do editors insert images into pages? If using Markdown, they can use the syntax ![](url) or if we have a WYSIWYG it might insert an <img>. We can make it easier by providing the correct URL or relative path. For example, if images are served under /media, and an image team.jpg is uploaded for about page, then the URL would be /media/about/team.jpg. The admin UI can automatically inject that Markdown snippet at the cursor position. If we use an SPA, we might have a button "Insert Image" that does this. For a simpler approach with server-rendered, we might just show the uploaded file name and instruct the editor to use the markdown syntax. But better to automate it to reduce user error.
File Management: Possibly allow deleting an uploaded file from a page (e.g. if an image is outdated). The admin panel can list files in the page folder with a delete icon next to each. Clicking it will remove the file (and perhaps any resized versions). Also, if a page is deleted, its folder and thus its files are removed, which handles cleanup inherently.
Media in Templates: The templates can also access images if needed for, say, hero banners. We might incorporate logic in the templating to automatically find an image in a page folder if the content references it. But since content editors can put the images directly in content Markdown, often that’s sufficient (e.g., in a blog post the images appear where the editor placed them in markdown). For something like a page’s cover image that is separate from the body content, one could put a field in YAML front matter (e.g. cover: "hero.jpg") and then in the template use that to render an <img> banner. The admin UI should allow setting that field (maybe by picking from uploaded files or uploading directly to that field).
In summary, the file upload strategy is to integrate Multer for handling uploads, store media files in the filesystem (co-located with content for ease of management), serve them via a static route, and use front-end conveniences to help the editor insert media into their content. This keeps everything within our flat-file paradigm – even images are files on disk, no external storage needed.
Extensibility and Plugin Architecture (Optional)
To ensure the CMS can grow and adapt, we should design with extensibility in mind. Kirby provides a plugin API allowing developers to extend almost any part of the system
getkirby.com. We can incorporate a simpler plugin mechanism in our Node CMS:
Plugin Structure: Have a directory like plugins/ where custom modules can be placed. The CMS, on startup, will load any files in plugins/ (require them). A plugin could be just a Node module that registers hooks or new routes.
Hooks System: Define hooks/events for key actions in the system (similar to Kirby’s hooks for saving pages, file upload, etc.
getkirby.com
). For example:
beforeSave(page, data)
afterSave(page, data)
afterUpload(page, file)
beforePageDelete(page)
afterPageDelete(page)
The core content service would emit these events (we can use Node’s EventEmitter or a simple pub/sub pattern). Plugins can register listeners for these events to perform custom actions. For instance, a plugin might listen for afterSave and then regenerate a search index, or commit changes to a git repository, etc.
Custom Routes/Controllers: Allow plugins to add new Express routes or middleware. For example, a plugin might provide a contact form endpoint, or an API endpoint for a custom need. We can expose the Express app instance to plugins (or provide a method for plugins to register new routes). Careful namespacing or mounting under /plugins/<pluginname> might be wise to avoid route conflicts.
Template Extensibility: Provide a way to extend the templating system. If using Nunjucks or Handlebars, we can allow plugins to register new helper functions, filters, or global variables. For example, a plugin could add a filter like {{ content | myCustomFilter }} to do something special in templates. Many templating engines allow this (e.g., Nunjucks has an environment you can add filters to).
Admin Panel Extensions: If we eventually have a more complex admin (especially as an SPA), we could allow plugins to add admin UI components or pages. This is more advanced – likely out of scope for initial implementation. But we can keep the concept in mind: e.g., if someone wanted to add a gallery manager or a custom dashboard widget, a plugin might provide additional front-end code. Kirby’s Panel allows custom fields and sections via Vue components
getkirby.com
; in our case, we’d need a way to include plugin-provided scripts or HTML in the admin. This might not be done initially, but we can design the admin such that it’s not monolithic (maybe it reads some config of fields so new field types can be introduced).
Configuration and Dependency Injection: The core of our CMS (content reading, writing, routing) should be written in a modular way such that it’s easy to replace or extend parts. For instance, if we want to swap out the markdown renderer, it should be one place to change (maybe have a configurable render function). Or if we want to use a different auth method, our auth middleware is pluggable. Using dependency injection or at least clearly separated modules (like a MarkdownService, AuthService etc.) can help with this.
Example Plugin Use Cases:
A search plugin could generate a JSON index of content for a search feature.
An SEO plugin might automatically generate sitemap.xml or allow editing meta tags per page via front matter fields.
A backup plugin could commit changes to a Git repository whenever content changes (given flat-file nature, integrating with Git is a possibility to version content).
A comments plugin might integrate a third-party comments system or add a content folder for comments per page.
By offering hooks around page save and file save, these can be implemented without modifying core logic.
Version Control Integration: Not exactly a plugin, but worth noting – since content is just files, one could use Git to track changes. We could integrate this by either instructing the user to manually use Git, or automate commits via a plugin. For instance, after each save, a plugin could commit the changes. This provides version history and rollback capability, which is a nice extensional feature (some flat-file CMS encourage using Git for versioning
buttercms.com
). This is an optional idea demonstrating the flexibility of flat-file systems.
In designing the core, we will make sure to keep code clean and modular, making it easier to maintain and extend. For example, avoid hard-coding too many things in one place; instead use configuration files for settings, use middleware for add-ons (so plugins can insert middleware). Document the internal APIs so that other developers (or future us) can write plugins.
Clean Code Practices, Scalability, and Maintainability
Finally, to ensure the system is robust, we highlight some best practices and architectural decisions:
Project Organization: Clearly separate different concerns:
routes/ directory to hold route definitions (e.g. routes/frontend.js, routes/admin.js).
controllers/ for handler logic if it grows large.
services/ or lib/ for core logic like ContentService, AuthService.
views/ or templates/ for template files.
This structure avoids one giant file and makes the code easier to navigate and test.
Use of Modern JavaScript (or TypeScript): We will use modern JS features (ES6+). Optionally, using TypeScript could improve maintainability by catching type errors and providing better documentation via interfaces (e.g., define a Page type for content objects). If the team is comfortable with TS, it’s a good choice for a long-term project. Otherwise, well-documented JavaScript with JSDoc comments can suffice.
Coding Standards: Follow consistent coding style (perhaps using ESLint and Prettier to enforce formatting and catch issues). This reduces bugs and makes contributions easier.
Performance Considerations: For scalability:
Implement caching as described to handle high load. File reads are fast, but if the site grows to hundreds or thousands of pages, caching frequently accessed pages in memory will help. Also, Node’s single-threaded nature means heavy computations (like very large markdown files parsing) could block the event loop, so caching those results or offloading work to worker threads (if ever needed) is a strategy.
Use pagination or lazy loading in the admin list if the number of pages or files is huge, to avoid UI slowdown.
Monitor memory usage if caching many pages; perhaps implement an LRU cache (least-recently-used eviction) for content if memory is a concern.
Because there’s no database, the main resource usage will be CPU (for parsing, template rendering) and disk I/O. On an SSD, reading a small text file is extremely quick, but if content becomes very large, consider indexing or search improvements (like building a search index rather than scanning files on each search query).
Scalability Limits: A flat-file CMS is great up to a point – if content gets extremely large (tens of thousands of pages or heavy traffic), a single Node process might struggle without more sophisticated caching or clustering. We can scale vertically (the dedicated server can be beefy) or run multiple Node instances behind a load balancer if needed. Because there’s no central DB, we have to ensure all instances see file changes – this might require storing content on a network drive or having a mechanism to sync (beyond our scope, but a consideration). That said, for the typical use case (small to medium sites, or enterprise docs on one server), it will scale well. Removing the database overhead already improves performance and resource usage
buttercms.com
.
Extensibility: As covered, the design allows adding features without modifying core code, via plugins and clear APIs. This means the project can evolve (e.g., adding a multi-user system in future, or a headless API mode) without a complete rewrite. Kirby, for instance, allows headless usage via a REST API
getkirby.com
; we could also add an API endpoint to get content as JSON for decoupled frontends, by leveraging the same content service.
Testing: Encourage writing tests for critical parts like the ContentService (ensuring that parsing and writing files works as expected, no data loss in round trip), and for the auth logic. We can use a framework like Mocha or Jest to write unit tests. Also test the security of file operations (ensuring no directory traversal, etc.). This ensures reliability.
Documentation: Document how to create content (so end developers or power users can manually add files if they want), how to extend the system, and how to deploy it. Perhaps include a README or even generate docs for any config options or plugin hooks.
Clean Code Examples: Use clear naming for functions and variables (e.g., getPage, savePage as used earlier). Avoid magic numbers/strings – use constants or config (like a constant for content directory path, instead of sprinkling "content/" literal everywhere).
Graceful Degradation: If the admin panel fails or is not used, the site should still serve content from files (meaning the site is not tightly coupled to the admin UI). One could even edit the markdown files directly and the site would update. This is a nice property inherited from flat-file design – content is portable and editable outside the CMS interface too. It also means if the admin UI has a bug or is down, the website remains unaffected (since the site rendering is separate). This separation of concerns is good for reliability.
Backup and Migrations: Since content is in files, backing up is as simple as copying the content/ folder
buttercms.com
. We should encourage routine backups of the content folder (or use the Git plugin idea). If in future the site needs to migrate to another system, flat files are easier to migrate from than databases – you can write scripts to transform markdown to another format, etc. We will note these benefits in documentation to reassure users of the flexibility of the system.
In conclusion, following these practices will ensure the Node.js flat-file CMS remains cleanly architected, secure, and extensible. It will provide a similar developer and editor experience to Kirby: just files and folders for content (so simple)
getkirby.com
, an elegant UI for editing, and the power to extend when custom needs arise. With no database, we avoid a whole class of issues and achieve speed and security benefits by default
getkirby.com
. This plan sets the stage for building a modern flat-file CMS on Node that can be a joy for developers (easy to understand code) and for content editors (easy to manage content).
Conclusion
This implementation plan outlined the design of a Kirby-inspired flat-file CMS using Node.js. We covered the content organization (storing pages as Markdown/YAML files in structured folders), the server architecture using Express (to dynamically serve content with templates), and the creation of a secure admin panel for editing content. We discussed rendering strategies (dynamic vs static) and decided on dynamic rendering with caching, given a dedicated server environment, to balance simplicity and performance. Key aspects like authentication for the single admin user and file upload/image management were detailed, ensuring the system is functional for real-world content editing (with images, etc.). Finally, we addressed extensibility via a plugin system and general clean-code practices to keep the project maintainable and scalable. By following this plan, we will build a CMS that captures the spirit of Kirby – simple file-based content (“Just files and folders” storage
getkirby.com
), flexible templating, and a user-friendly admin interface – all on a modern Node.js stack. The result will be a lightweight yet powerful CMS that avoids the bloat of databases, responds quickly to requests (fewer resources needed thanks to flat-file architecture
buttercms.com
), and can be extended or customized as needed to fit future requirements. This Node.js flat-file CMS will be well-suited for small to medium websites where simplicity, speed, and control over content files are a priority, bringing Kirby’s proven principles into the JavaScript world.