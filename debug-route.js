// Add this to routes/admin.js temporarily
router.get('/debug-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    hasUser: !!(req.session && req.session.user),
    user: req.session ? req.session.user : null,
    cookies: req.headers.cookie
  });
});

router.get('/debug-login', csrfProtection, async (req, res) => {
  const password = 'StackBlog2025!';
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const bcrypt = require('bcrypt');
  
  res.json({
    passwordMatches: await bcrypt.compare(password, hash),
    hashFromEnv: hash,
    envLoaded: !!process.env.ADMIN_PASSWORD_HASH
  });
});