const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

/**
 * General rate limiting for all requests
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static assets
    return req.url.startsWith('/css/') || 
           req.url.startsWith('/js/') || 
           req.url.startsWith('/images/') ||
           req.url.startsWith('/media/');
  }
});

/**
 * Strict rate limiting for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * API rate limiting
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 API requests per windowMs
  message: {
    error: 'API Rate Limit Exceeded',
    message: 'Too many API requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Upload rate limiting
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 uploads per hour
  message: {
    error: 'Upload Rate Limit Exceeded',
    message: 'Too many file uploads from this IP, please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Security headers configuration
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Allow inline styles for dynamic styling
        "https://kit.fontawesome.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrc: [
        "'self'",
        "https://kit.fontawesome.com",
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:",
        "blob:"
      ],
      fontSrc: [
        "'self'",
        "https://kit.fontawesome.com",
        "https://fonts.gstatic.com",
        "data:"
      ],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for FontAwesome compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In production, you should configure allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove null bytes that could be used for injection
  const sanitizeString = (str) => {
    if (typeof str === 'string') {
      return str.replace(/\0/g, '');
    }
    return str;
  };

  // Sanitize request body
  if (req.body) {
    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }

  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }

  next();
};

/**
 * Request logging middleware for security monitoring
 */
const securityLogger = (req, res, next) => {
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript protocol
    /data:.*base64/i,  // Data URI with base64
    /\$\{.*\}/,  // Template injection
    /__proto__/,  // Prototype pollution
    /\.php$/,  // PHP file requests (shouldn't exist)
    /wp-admin/,  // WordPress admin attempts
    /phpmyadmin/i,  // phpMyAdmin attempts
  ];

  const url = req.url;
  const method = req.method;
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    console.warn(`[SECURITY] Suspicious request detected:`, {
      ip,
      method,
      url,
      userAgent,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  }

  // Log failed authentication attempts
  res.on('finish', () => {
    if (req.path === '/admin/login' && res.statusCode === 302 && req.query.error) {
      console.warn(`[SECURITY] Failed login attempt:`, {
        ip,
        userAgent,
        error: req.query.error,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

/**
 * Admin route protection
 */
const adminSecurityCheck = (req, res, next) => {
  // Additional security checks for admin routes
  if (req.path.startsWith('/admin')) {
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
    for (const header of suspiciousHeaders) {
      if (req.get(header) && req.get(header) !== req.get('host')) {
        console.warn(`[SECURITY] Suspicious header detected in admin request:`, {
          ip: req.ip,
          header,
          value: req.get(header),
          path: req.path
        });
      }
    }
  }
  
  next();
};

/**
 * File upload security checks
 */
const uploadSecurityCheck = (req, res, next) => {
  if (req.files) {
    for (const file of req.files) {
      // Check file size (additional check beyond multer limits)
      if (file.size > 10 * 1024 * 1024) { // 10MB
        return res.status(413).json({
          error: 'File Too Large',
          message: 'File size exceeds maximum allowed size of 10MB'
        });
      }
      
      // Check for suspicious file names
      const suspiciousNames = [
        /\.php$/i,
        /\.asp$/i,
        /\.jsp$/i,
        /\.exe$/i,
        /\.bat$/i,
        /\.sh$/i,
        /\.cmd$/i,
        /\.com$/i,
        /\.scr$/i,
        /\.vbs$/i,
        /\.js$/i,
        /\.html$/i,
        /\.htm$/i
      ];
      
      if (suspiciousNames.some(pattern => pattern.test(file.originalname))) {
        console.warn(`[SECURITY] Suspicious file upload attempt:`, {
          ip: req.ip,
          filename: file.originalname,
          mimetype: file.mimetype
        });
        
        return res.status(400).json({
          error: 'Invalid File Type',
          message: 'File type not allowed for security reasons'
        });
      }
    }
  }
  
  next();
};

/**
 * Content Security Policy for admin pages
 */
const adminCSP = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'", 
      "'unsafe-inline'",
      "https://kit.fontawesome.com"
    ],
    scriptSrc: [
      "'self'",
      "https://kit.fontawesome.com"
    ],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: [
      "'self'",
      "https://kit.fontawesome.com",
      "data:"
    ],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"]
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  securityLogger,
  adminSecurityCheck,
  uploadSecurityCheck,
  adminCSP
};