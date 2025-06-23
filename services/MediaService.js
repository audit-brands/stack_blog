const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config/default');

class MediaService {
  constructor() {
    this.uploadsPath = path.join(config.paths.content, 'uploads');
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.imageFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  }

  /**
   * Initialize upload directory
   */
  async init() {
    try {
      await fs.mkdir(this.uploadsPath, { recursive: true });
    } catch (error) {
      console.error('Error creating uploads directory:', error);
      throw error;
    }
  }

  /**
   * Get multer configuration for file uploads
   */
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadsPath);
      },
      filename: (req, file, cb) => {
        // Generate unique filename while preserving extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // Max 10 files per upload
      },
      fileFilter: (req, file, cb) => {
        if (this.allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      }
    });
  }

  /**
   * Process uploaded images (resize, optimize)
   */
  async processImage(filePath, options = {}) {
    try {
      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 85,
        generateThumbnail = true,
        thumbnailSize = 300
      } = options;

      const ext = path.extname(filePath).toLowerCase();
      const baseName = path.basename(filePath, ext);
      const dir = path.dirname(filePath);

      // Skip SVG files
      if (ext === '.svg') {
        return {
          original: path.basename(filePath),
          thumbnail: null
        };
      }

      let sharpInstance = sharp(filePath);
      const metadata = await sharpInstance.metadata();

      // Resize if image is too large
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Optimize and save
      let outputPath = filePath;
      if (ext === '.jpg' || ext === '.jpeg') {
        await sharpInstance.jpeg({ quality }).toFile(filePath + '.tmp');
      } else if (ext === '.png') {
        await sharpInstance.png({ quality }).toFile(filePath + '.tmp');
      } else if (ext === '.webp') {
        await sharpInstance.webp({ quality }).toFile(filePath + '.tmp');
      } else {
        // For other formats, just copy
        await sharpInstance.toFile(filePath + '.tmp');
      }

      // Replace original with optimized version
      await fs.rename(filePath + '.tmp', filePath);

      let thumbnailName = null;

      // Generate thumbnail
      if (generateThumbnail) {
        thumbnailName = `${baseName}-thumb${ext}`;
        const thumbnailPath = path.join(dir, thumbnailName);
        
        await sharp(filePath)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);
      }

      return {
        original: path.basename(filePath),
        thumbnail: thumbnailName,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: (await fs.stat(filePath)).size
        }
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  /**
   * Get list of uploaded files
   */
  async listFiles(options = {}) {
    try {
      const { page = 1, limit = 20, search = '', type = 'all' } = options;
      
      await this.init(); // Ensure directory exists

      const files = await fs.readdir(this.uploadsPath);
      const fileDetails = [];

      for (const filename of files) {
        const filePath = path.join(this.uploadsPath, filename);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && !filename.startsWith('.')) {
            const ext = path.extname(filename).toLowerCase();
            const mimeType = this.getMimeTypeFromExtension(ext);
            const isImage = this.imageFormats.includes(mimeType);
            
            // Skip thumbnail files in listing
            if (filename.includes('-thumb.')) {
              continue;
            }

            fileDetails.push({
              filename,
              originalName: filename,
              path: `/media/uploads/${filename}`,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              extension: ext,
              mimeType,
              isImage,
              type: isImage ? 'image' : this.getFileType(mimeType)
            });
          }
        } catch (statError) {
          console.warn(`Error getting stats for ${filename}:`, statError);
        }
      }

      // Filter by search term
      let filteredFiles = fileDetails;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredFiles = fileDetails.filter(file => 
          file.filename.toLowerCase().includes(searchLower) ||
          file.type.toLowerCase().includes(searchLower)
        );
      }

      // Filter by type
      if (type !== 'all') {
        filteredFiles = filteredFiles.filter(file => file.type === type);
      }

      // Sort by modified date (newest first)
      filteredFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

      // Paginate
      const total = filteredFiles.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedFiles = filteredFiles.slice(offset, offset + limit);

      return {
        files: paginatedFiles,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        }
      };
    } catch (error) {
      console.error('Error listing files:', error);
      return {
        files: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          total: 0,
          limit,
          hasNext: false,
          hasPrev: false,
          nextPage: null,
          prevPage: null
        }
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filename) {
    try {
      const filePath = path.join(this.uploadsPath, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return false; // File doesn't exist
      }

      // Delete main file
      await fs.unlink(filePath);

      // Delete thumbnail if it exists
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const thumbnailName = `${baseName}-thumb.jpg`;
      const thumbnailPath = path.join(this.uploadsPath, thumbnailName);
      
      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // Thumbnail doesn't exist, that's ok
      }

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filename) {
    try {
      const filePath = path.join(this.uploadsPath, filename);
      const stats = await fs.stat(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(ext);
      const isImage = this.imageFormats.includes(mimeType);

      return {
        filename,
        path: `/media/uploads/${filename}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: ext,
        mimeType,
        isImage,
        type: isImage ? 'image' : this.getFileType(mimeType),
        exists: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get file type from mime type
   */
  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType.includes('word')) return 'document';
    return 'file';
  }

  /**
   * Get mime type from file extension
   */
  getMimeTypeFromExtension(ext) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = MediaService;