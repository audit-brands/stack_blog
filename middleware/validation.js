const { body, query, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors.array()
    });
  }
  next();
};

/**
 * Login validation
 */
const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Username must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username can only contain letters, numbers, dots, dashes, and underscores'),
  
  body('password')
    .isLength({ min: 1, max: 200 })
    .withMessage('Password is required and must be less than 200 characters'),
  
  handleValidationErrors
];

/**
 * Page creation/update validation
 */
const validatePage = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  
  body('content')
    .isLength({ min: 1, max: 100000 })
    .withMessage('Content must be between 1 and 100,000 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .escape(),
  
  body('template')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Template name can only contain letters, numbers, dashes, and underscores')
    .isLength({ max: 50 })
    .withMessage('Template name must be less than 50 characters'),
  
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),
  
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_/-]+$/)
    .withMessage('Slug can only contain letters, numbers, dashes, underscores, and forward slashes')
    .isLength({ max: 200 })
    .withMessage('Slug must be less than 200 characters'),
  
  handleValidationErrors
];

/**
 * Search validation
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be less than 200 characters')
    .escape(),
  
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer less than 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['relevance', 'date', 'title'])
    .withMessage('Sort must be one of: relevance, date, title'),
  
  query('template')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Template filter can only contain letters, numbers, dashes, and underscores'),
  
  handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer less than 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

/**
 * Slug parameter validation
 */
const validateSlug = [
  param('slug')
    .trim()
    .matches(/^[a-zA-Z0-9_/-]+$/)
    .withMessage('Slug can only contain letters, numbers, dashes, underscores, and forward slashes')
    .isLength({ min: 1, max: 200 })
    .withMessage('Slug must be between 1 and 200 characters'),
  
  handleValidationErrors
];

/**
 * Filename parameter validation
 */
const validateFilename = [
  param('filename')
    .trim()
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Filename can only contain letters, numbers, dots, dashes, and underscores')
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must be between 1 and 255 characters'),
  
  handleValidationErrors
];

/**
 * Plugin creation validation
 */
const validatePlugin = [
  body('name')
    .trim()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Plugin name can only contain letters, numbers, dashes, and underscores')
    .isLength({ min: 1, max: 50 })
    .withMessage('Plugin name must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .escape(),
  
  body('author')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Author must be less than 100 characters')
    .escape(),
  
  handleValidationErrors
];

/**
 * API key validation
 */
const validateApiRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;
  
  // Skip validation if no API key is configured
  if (!apiKey) {
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required'
    });
  }
  
  const token = authHeader.substring(7);
  
  // Validate token format (should be alphanumeric and reasonable length)
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(token)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token format'
    });
  }
  
  if (token !== apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }
  
  next();
};

/**
 * Content-Type validation for API endpoints
 */
const validateContentType = (expectedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next(); // Skip for GET and DELETE requests
    }
    
    const contentType = req.get('Content-Type');
    if (!contentType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content-Type header is required'
      });
    }
    
    const isValid = expectedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isValid) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Expected Content-Type: ${expectedTypes.join(' or ')}`
      });
    }
    
    next();
  };
};

/**
 * File upload validation
 */
const validateFileUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No files uploaded'
    });
  }
  
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  
  for (const file of req.files) {
    // Check file size
    if (file.size > maxFileSize) {
      return res.status(413).json({
        error: 'File Too Large',
        message: `File ${file.originalname} exceeds maximum size of 10MB`
      });
    }
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid File Type',
        message: `File type ${file.mimetype} is not allowed`
      });
    }
    
    // Check filename
    if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
      return res.status(400).json({
        error: 'Invalid Filename',
        message: 'Filename contains invalid characters'
      });
    }
  }
  
  next();
};

/**
 * Password validation for setup
 */
const validatePassword = [
  body('password')
    .isLength({ min: 8, max: 200 })
    .withMessage('Password must be between 8 and 200 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validatePage,
  validateSearch,
  validatePagination,
  validateSlug,
  validateFilename,
  validatePlugin,
  validateApiRequest,
  validateContentType,
  validateFileUpload,
  validatePassword,
  handleValidationErrors
};