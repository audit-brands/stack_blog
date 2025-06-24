// Fixed login route with session save
router.post('/login', authLimiter, authService.redirectIfAuthenticated.bind(authService), csrfProtection, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/admin/login?error=missing_credentials');
    }

    const user = await authService.authenticateUser(username, password);
    
    if (user) {
      // Login successful
      authService.loginUser(req.session, user);
      
      // Force session save before redirect
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/admin/login?error=server_error');
        }
        
        // Redirect to originally requested URL or admin dashboard
        const redirectUrl = req.session.redirectUrl || '/admin';
        delete req.session.redirectUrl;
        
        res.redirect(redirectUrl);
      });
    } else {
      // Login failed
      res.redirect('/admin/login?error=invalid_credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/admin/login?error=server_error');
  }
});