# Security Guide

Stack Blog implements comprehensive security measures to protect against common web vulnerabilities and attacks. This document outlines the security features and best practices.

## 🛡️ Implemented Security Features

### Rate Limiting

**General Rate Limiting**
- 1,000 requests per 15 minutes per IP
- Excludes static assets (CSS, JS, images, media)
- Returns 429 status with retry-after header

**Authentication Rate Limiting**
- 5 login attempts per 15 minutes per IP
- Protects against brute force attacks
- Skips successful requests

**API Rate Limiting**
- 100 API requests per 15 minutes per IP
- Separate limits for API endpoints
- Configurable per endpoint

**Upload Rate Limiting**
- 50 file uploads per hour per IP
- Prevents abuse of file upload functionality
- Additional security checks for file types

### Security Headers

**Helmet.js Integration**
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer Policy

**Content Security Policy**
```javascript
{
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://kit.fontawesome.com"],
  scriptSrc: ["'self'", "https://kit.fontawesome.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  fontSrc: ["'self'", "https://kit.fontawesome.com", "data:"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"]
}
```

### Input Validation & Sanitization

**Express Validator Integration**
- Server-side validation for all inputs
- Type checking and format validation
- Length limits and pattern matching
- HTML escaping for XSS prevention

**Input Sanitization**
- Null byte removal
- HTML entity encoding
- Query parameter sanitization
- Request body sanitization

**Validation Rules**
- Username: alphanumeric, dots, dashes, underscores (1-50 chars)
- Password: min 8 chars, uppercase, lowercase, number, special char
- Slugs: alphanumeric, dashes, underscores, forward slashes
- File names: alphanumeric, dots, dashes, underscores

### File Upload Security

**File Type Restrictions**
```javascript
const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
```

**Security Checks**
- File size limits (10MB max)
- MIME type validation
- Filename sanitization
- Suspicious file extension blocking
- Directory traversal prevention

**Blocked Extensions**
- .php, .asp, .jsp (server-side scripts)
- .exe, .bat, .sh, .cmd (executables)
- .js, .html, .htm (client-side scripts)
- .vbs, .scr (potentially malicious)

### Authentication Security

**Password Requirements**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

**Session Security**
- HTTPOnly cookies
- Secure flag in production
- Session expiration (24 hours)
- CSRF protection on all forms

**bcrypt Password Hashing**
- 12 salt rounds
- Industry-standard hashing
- Secure password comparison

### CSRF Protection

**csurf Middleware**
- CSRF tokens for all forms
- Double-submit cookie pattern
- Automatic token validation
- Custom error handling

### Security Monitoring

**Request Logging**
- Suspicious pattern detection
- Failed login attempt logging
- IP address tracking
- User agent analysis

**Suspicious Patterns Detected**
- Directory traversal attempts (`../`)
- XSS injection (`<script>`)
- SQL injection (`union select`)
- Template injection (`${}`)
- Prototype pollution (`__proto__`)
- Common attack vectors

### API Security

**Authentication**
- Optional Bearer token authentication
- API key validation
- Configurable via environment variable

**Input Validation**
- JSON schema validation
- Content-Type checking
- Parameter sanitization
- Rate limiting

### CORS Configuration

**Cross-Origin Resource Sharing**
- Configurable allowed origins
- Credentials support
- Preflight request handling
- Environment-based configuration

## 🔧 Configuration

### Environment Variables

```bash
# Security Configuration
API_KEY=your-secure-api-key-here
SESSION_SECRET=your-session-secret-here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Admin Authentication
ADMIN_PASSWORD_HASH=your-bcrypt-hash-here

# Production Settings
NODE_ENV=production
```

### Security Headers Configuration

The application automatically configures security headers based on environment:

**Development**
- More permissive CSP for development tools
- Console logging enabled
- Detailed error messages

**Production**
- Strict CSP policies
- Minimal error information
- Enhanced security logging

## 🚨 Security Best Practices

### Deployment Security

1. **Use HTTPS in Production**
   ```bash
   # Enable HSTS
   NODE_ENV=production
   ```

2. **Secure Environment Variables**
   - Use strong, random session secrets
   - Generate secure API keys
   - Store secrets securely (not in code)

3. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Apply patches promptly

4. **Reverse Proxy Configuration**
   ```nginx
   # Nginx example
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```

5. **Firewall Configuration**
   - Restrict admin panel access by IP
   - Block suspicious traffic patterns
   - Monitor for DDoS attacks

### Content Security

1. **Input Validation**
   - Validate all user inputs
   - Use parameterized queries
   - Escape output properly

2. **File Security**
   - Scan uploaded files
   - Store uploads outside web root
   - Implement virus scanning

3. **Access Control**
   - Use strong passwords
   - Implement two-factor authentication
   - Regular access reviews

### Monitoring & Logging

1. **Security Events**
   - Failed login attempts
   - Suspicious requests
   - File upload attempts
   - Rate limit violations

2. **Log Analysis**
   - Regular log review
   - Automated alerting
   - Incident response procedures

3. **Performance Monitoring**
   - Monitor for unusual traffic
   - Track response times
   - Identify potential attacks

## ⚠️ Security Considerations

### Known Limitations

1. **File Upload**
   - No virus scanning by default
   - Relies on MIME type checking
   - Consider external scanning service

2. **Rate Limiting**
   - IP-based (can be bypassed with proxies)
   - In-memory storage (resets on restart)
   - Consider Redis for persistence

3. **Session Management**
   - Memory-based sessions
   - Not suitable for multi-server deployments
   - Consider session store for scaling

### Recommended Enhancements

1. **Additional Security Layers**
   - Web Application Firewall (WAF)
   - DDoS protection service
   - Content Delivery Network (CDN)

2. **Monitoring Tools**
   - Security Information and Event Management (SIEM)
   - Log aggregation service
   - Uptime monitoring

3. **Backup Security**
   - Encrypted backups
   - Secure backup storage
   - Regular restore testing

## 🔍 Security Audit Checklist

- [ ] Strong password policies enforced
- [ ] CSRF protection on all forms
- [ ] Input validation on all endpoints
- [ ] File upload restrictions implemented
- [ ] Rate limiting configured
- [ ] Security headers properly set
- [ ] HTTPS enabled in production
- [ ] Session security configured
- [ ] Error handling doesn't leak information
- [ ] Dependencies regularly updated
- [ ] Security monitoring in place
- [ ] Backup and recovery procedures tested

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email security details to the maintainers
3. Include steps to reproduce
4. Allow time for investigation and patching
5. Follow responsible disclosure practices

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limit](https://express-rate-limit.mintlify.app/)