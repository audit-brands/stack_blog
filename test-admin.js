// Add this to routes/admin.js temporarily

// Test route that bypasses templates
router.get('/test', (req, res) => {
  res.send(`
    <h1>Admin Test Page</h1>
    <p>Session ID: ${req.sessionID}</p>
    <p>Has User: ${!!(req.session && req.session.user)}</p>
    <p>User: ${JSON.stringify(req.session ? req.session.user : null)}</p>
    <p>Authenticated: ${authService.isAuthenticated(req.session)}</p>
    <a href="/admin/test-dashboard">Test Dashboard</a>
  `);
});

// Simple dashboard without any template engine
router.get('/test-dashboard', authService.requireAuth.bind(authService), (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Dashboard</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
    </head>
    <body>
      <div class="container">
        <h1 class="title">Test Dashboard</h1>
        <p>Welcome ${req.session.user.username}!</p>
        <a href="/admin/logout" class="button">Logout</a>
      </div>
    </body>
    </html>
  `);
});