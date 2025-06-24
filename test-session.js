const express = require('express');
const session = require('express-session');
const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Session configuration
app.use(session({
  secret: '470ed03717ccb7181984143e82fc0a74aad7f089fd547d979a3df44c2f45bacc8a29657f3df256d6c31d702f5aa4d012a7b1ec2866c27c2899071ec1bc4c3f5c',
  resave: false,
  saveUninitialized: false,
  name: 'stackblog.sid',
  cookie: {
    secure: false, // Explicitly false for reverse proxy
    httpOnly: true,
    maxAge: 86400000,
    sameSite: 'lax'
  }
}));

// Test routes
app.get('/test-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    secure: req.secure,
    protocol: req.protocol
  });
});

app.get('/test-login', (req, res) => {
  req.session.user = { username: 'admin', test: true };
  res.json({ message: 'Session set', sessionID: req.sessionID });
});

app.get('/test-check', (req, res) => {
  res.json({
    hasUser: !!req.session.user,
    user: req.session.user,
    sessionID: req.sessionID
  });
});

app.listen(3001, () => {
  console.log('Test server on port 3001');
});