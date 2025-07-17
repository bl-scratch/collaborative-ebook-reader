import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';

// Import configuration
import { getCurrentLimits } from './config/limits.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Get current limits based on environment
const limits = getCurrentLimits(process.env.NODE_ENV || 'development');

// Database setup
const dbPath = path.join(__dirname, '../database/ebooks.db');
const db = new sqlite3.Database(dbPath);

// Ensure database directory exists
fs.ensureDirSync(path.dirname(dbPath));

// Initialize database tables
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop existing tables and recreate with new schema
      db.run(`DROP TABLE IF EXISTS books`);
      db.run(`DROP TABLE IF EXISTS highlights`);
      db.run(`DROP TABLE IF EXISTS comments`);
      db.run(`DROP TABLE IF EXISTS sessions`);
      db.run(`DROP TABLE IF EXISTS users`);
      db.run(`DROP TABLE IF EXISTS user_progress`);
      db.run(`DROP TABLE IF EXISTS book_profiles`);
      
      // Books table with slug column
      db.run(`
        CREATE TABLE books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT,
          filename TEXT NOT NULL,
          filepath TEXT NOT NULL,
          file_size INTEGER,
          session_id TEXT NOT NULL,
          slug TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.log('Error creating books table:', err);
          return reject(err);
        }
        console.log('✅ Created books table with slug');
      });
      
      // Highlights table - support both Socket.io and HTTP API
      db.run(`
        CREATE TABLE highlights (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          chapter INTEGER,
          text TEXT,
          text_content TEXT,
          cfi TEXT,
          position INTEGER,
          color TEXT DEFAULT '#ffeb3b',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books (id)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating highlights table:', err);
          return reject(err);
        }
        console.log('✅ Created highlights table');
      });
      
      // Comments table - support both Socket.io and HTTP API
      db.run(`
        CREATE TABLE comments (
          id TEXT PRIMARY KEY,
          book_id TEXT,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          chapter INTEGER,
          text TEXT,
          comment TEXT,
          content TEXT,
          position INTEGER,
          highlight_id TEXT,
          parent_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books (id),
          FOREIGN KEY (highlight_id) REFERENCES highlights (id)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating comments table:', err);
          return reject(err);
        }
        console.log('✅ Created comments table');
      });
      
      // Sessions table with user tracking
      db.run(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          user_count INTEGER DEFAULT 0,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books (id)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating sessions table:', err);
          return reject(err);
        }
        console.log('✅ Created sessions table');
      });
      
      // Book-specific profiles table
      db.run(`
        CREATE TABLE book_profiles (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          username TEXT NOT NULL,
          color TEXT DEFAULT '#4ECDC4',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books (id),
          UNIQUE(book_id, username)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating book_profiles table:', err);
          return reject(err);
        }
        console.log('✅ Created book_profiles table');
      });
      
      // Users table with session tracking (kept for socket.io compatibility)
      db.run(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          username TEXT NOT NULL,
          color TEXT DEFAULT '#ffeb3b',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions (id)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating users table:', err);
          return reject(err);
        }
        console.log('✅ Created users table');
      });
      
      // User progress table
      db.run(`
        CREATE TABLE user_progress (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          progress REAL DEFAULT 0,
          chapter INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_id) REFERENCES books (id)
        )
      `, (err) => {
        if (err) {
          console.log('Error creating user_progress table:', err);
          return reject(err);
        }
        console.log('✅ Created user_progress table');
      });
      
      resolve();
    });
  });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}.epub`;  // Just UUID + .epub extension
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: limits.FILE.MAX_SIZE_BYTES,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (limits.FILE.ALLOWED_TYPES.some(type => file.originalname.endsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only EPUB files are allowed.'), false);
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"], // Add both Vite ports
  credentials: true
}));

// Rate limiting - exclude progress endpoints
const limiter = rateLimit({
  windowMs: limits.PERFORMANCE.API.RATE_LIMIT_WINDOW_MS,
  max: limits.PERFORMANCE.API.RATE_LIMIT_REQUESTS_PER_MINUTE,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for progress endpoints
    return req.path.includes('/progress');
  }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    limits: {
      fileSize: limits.FILE.MAX_SIZE_MB,
      maxUsers: limits.USER.MAX_CONCURRENT_PER_SESSION,
      maxHighlights: limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK
    }
  });
});

// Generate random user profile
function generateUserProfile() {
  const adjectives = ['Cheerful', 'Curious', 'Witty', 'Brave', 'Clever', 'Friendly', 'Gentle', 'Happy', 'Kind', 'Lively'];
  const animals = ['Penguin', 'Dolphin', 'Elephant', 'Giraffe', 'Kangaroo', 'Lion', 'Owl', 'Panda', 'Tiger', 'Zebra'];
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return {
    username: `${adjective} ${animal}`,
    color: color
  };
}

// Add this function after generateUserProfile() (around line 258)
function generateSlug() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// API Routes

// Upload EPUB file
app.post('/api/upload', upload.single('epub'), async (req, res) => {
  console.log('=== UPLOAD REQUEST RECEIVED ===');
  console.log('Request file:', req.file);
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('✅ File received:', req.file.originalname);
    console.log('✅ File saved as:', req.file.filename);
    console.log('✅ File saved to:', req.file.path);

    const bookId = uuidv4();
    const sessionId = uuidv4();
    
    // Extract real title from EPUB metadata
    let title = req.file.originalname.replace('.epub', ''); // Fallback to filename
    let author = 'Unknown Author'; // Default author
    
    console.log('🔍 About to attempt metadata extraction...');
    console.log(' Function exists:', typeof extractEpubMetadata);
    
    try {
      console.log('🚀 Calling extractEpubMetadata...');
      // Use Calibre to extract metadata
      const metadata = await extractEpubMetadata(req.file.path);
      console.log('📋 Metadata extraction succeeded:', metadata);
      
      if (metadata.title) {
        console.log('📖 Found title:', metadata.title);
        title = metadata.title;
      } else {
        console.log('⚠️  No title found in metadata, using filename');
      }
      
      if (metadata.author) {
        console.log('✍️  Found author:', metadata.author);
        author = metadata.author;
      } else {
        console.log('⚠️  No author found in metadata, using default');
      }
      
      console.log('✅ Final metadata - Title:', title, 'Author:', author);
    } catch (metadataError) {
      console.log('❌ Metadata extraction failed with error:', metadataError);
      console.log('❌ Error message:', metadataError.message);
      console.log('❌ Error stack:', metadataError.stack);
      console.log('⚠️  Using fallback title and author');
    }
    
    // Generate unique slug
    const slug = generateSlug();
    console.log('🔗 Generated slug:', slug);
    
    console.log('✅ Creating book with ID:', bookId);
    
    // Insert book into database with slug
    db.run(
      'INSERT INTO books (id, title, filename, filepath, file_size, author, session_id, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [bookId, title, req.file.filename, req.file.path, req.file.size, author, sessionId, slug],
      function(err) {
        if (err) {
          console.log('❌ Database error:', err);
          return res.status(500).json({ error: 'Failed to save book information' });
        }
        
        console.log('✅ Book saved to database');
        
        // Create session
        db.run(
          'INSERT INTO sessions (id, book_id) VALUES (?, ?)',
          [sessionId, bookId],
          function(err) {
            if (err) {
              console.log('❌ Session creation error:', err);
              return res.status(500).json({ error: 'Failed to create session' });
            }
            
            console.log('✅ Session created:', sessionId);
            
            const response = {
              bookId: bookId,
              sessionId: sessionId,
              title: title,
              author: author,
              filename: req.file.filename,
              slug: slug
            };
            
            console.log('📤 Sending response:', response);
            res.json(response);
          }
        );
      }
    );
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get book information
app.get('/api/book/:bookId', (req, res) => {
  const { bookId } = req.params;
  
  db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(book);
  });
});

// Get session information
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.get(`
    SELECT s.*, b.title, b.filename 
    FROM sessions s 
    JOIN books b ON s.book_id = b.id 
    WHERE s.id = ?
  `, [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  });
});

// Get highlights for a book
app.get('/api/book/:bookId/highlights', (req, res) => {
  const { bookId } = req.params;
  
  db.all(`
    SELECT h.*, u.username, u.color as user_color
    FROM highlights h
    JOIN users u ON h.user_id = u.id
    WHERE h.book_id = ?
    ORDER BY h.created_date DESC
  `, [bookId], (err, highlights) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(highlights);
  });
});

// Get comments for a highlight - WITH JOIN (requires proper user_id)
app.get('/api/highlight/:highlightId/comments', (req, res) => {
  const { highlightId } = req.params;
  
  db.all(`
    SELECT c.id, c.book_id, c.user_id, c.username, c.chapter, c.text, c.comment, 
           c.content, c.position, c.highlight_id, c.parent_id, c.created_at,
           u.color as user_color
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.highlight_id = ?
    ORDER BY c.created_at ASC
  `, [highlightId], (err, comments) => {
    if (err) {
      console.log('❌ Database error getting comments:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('✅ Retrieved comments for highlight:', highlightId, 'comments:', comments);
    res.json(comments || []);
  });
});

// Test Calibre installation
app.get('/api/test-calibre', async (req, res) => {
  try {
    console.log('Testing Calibre installation...');
    
    const calibrePath = '/Applications/calibre.app/Contents/MacOS/ebook-convert';
    
    // Test if Calibre exists
    if (!fs.existsSync(calibrePath)) {
      return res.json({ 
        success: false, 
        error: 'Calibre not found at expected path',
        path: calibrePath
      });
    }
    
    // Test Calibre version
    const versionProcess = spawn(calibrePath, ['--version']);
    
    versionProcess.stdout.on('data', (data) => {
      const version = data.toString().trim();
      console.log('Calibre version:', version);
      res.json({ 
        success: true, 
        version: version,
        path: calibrePath
      });
    });
    
    versionProcess.stderr.on('data', (data) => {
      res.json({ 
        success: false, 
        error: 'Failed to get Calibre version',
        stderr: data.toString()
      });
    });
    
    versionProcess.on('error', (error) => {
      res.json({ 
        success: false, 
        error: 'Failed to spawn Calibre process',
        details: error.message
      });
    });
    
  } catch (error) {
    res.json({ 
      success: false, 
      error: 'Test failed',
      details: error.message
    });
  }
});

// Add this test endpoint to check if metadata extraction works
app.get('/api/test-metadata/:bookId', async (req, res) => {
  const { bookId } = req.params;
  
  try {
    // Get book info from database
    db.get('SELECT * FROM books WHERE id = ?', [bookId], async (err, book) => {
      if (err || !book) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      console.log('🧪 Testing metadata extraction for:', book.filepath);
      
      try {
        const metadata = await extractEpubMetadata(book.filepath);
        res.json({ success: true, metadata: metadata });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  let currentUser = null;
  let currentSession = null;
  
  // Join session
  socket.on('join-session', async (data) => {
    const { sessionId } = data;
    
    try {
      // Check if session exists and get user count
      db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
        if (err || !session) {
          socket.emit('error', 'Session not found');
          return;
        }
        
        // Check user limit
        if (session.user_count >= limits.USER.MAX_CONCURRENT_PER_SESSION) {
          socket.emit('error', 'Session is full');
          return;
        }
        
        // Generate user profile
        const profile = generateUserProfile();
        const userId = uuidv4();
        
        // Create user
        db.run(
          'INSERT INTO users (id, session_id, username, color) VALUES (?, ?, ?, ?)',
          [userId, sessionId, profile.username, profile.color],
          function(err) {
            if (err) {
              socket.emit('error', 'Failed to create user');
              return;
            }
            
            // Update session user count
            db.run(
              'UPDATE sessions SET user_count = user_count + 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
              [sessionId]
            );
            
            currentUser = { id: userId, ...profile };
            currentSession = sessionId;
            
            socket.join(sessionId);
            socket.emit('user-joined', currentUser);
            socket.to(sessionId).emit('user-joined-session', currentUser);
            
            // Send current users in session
            db.all('SELECT * FROM users WHERE session_id = ?', [sessionId], (err, users) => {
              if (!err) {
                socket.emit('session-users', users);
              }
            });
          }
        );
      });
    } catch (error) {
      socket.emit('error', 'Failed to join session');
    }
  });
  
  // Handle highlights
  socket.on('create-highlight', (data) => {
    if (!currentUser || !currentSession) {
      socket.emit('error', 'Not connected to session');
      return;
    }
    
    const { bookId, cfi, textContent, color } = data;
    const highlightId = uuidv4();
    
    // Check highlight limits
    db.get(
      'SELECT COUNT(*) as count FROM highlights WHERE user_id = ? AND book_id = ?',
      [currentUser.id, bookId],
      (err, result) => {
        if (err || result.count >= limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK) {
          socket.emit('error', 'Highlight limit reached');
          return;
        }
        
        // Create highlight
        db.run(
          'INSERT INTO highlights (id, book_id, user_id, cfi, text_content, color) VALUES (?, ?, ?, ?, ?, ?)',
          [highlightId, bookId, currentUser.id, cfi, textContent, color || currentUser.color],
          function(err) {
            if (err) {
              socket.emit('error', 'Failed to create highlight');
              return;
            }
            
            const highlight = {
              id: highlightId,
              bookId,
              userId: currentUser.id,
              cfi,
              textContent,
              color: color || currentUser.color,
              username: currentUser.username,
              userColor: currentUser.color,
              createdDate: new Date().toISOString()
            };
            
            socket.emit('highlight-created', highlight);
            socket.to(currentSession).emit('highlight-added', highlight);
          }
        );
      }
    );
  });
  
  // Handle comments
  socket.on('create-comment', (data) => {
    if (!currentUser || !currentSession) {
      socket.emit('error', 'Not connected to session');
      return;
    }
    
    const { highlightId, content, parentId } = data;
    const commentId = uuidv4();
    
    // Validate comment length
    if (content.length < limits.CONTENT.COMMENTS.MIN_LENGTH_CHARS || 
        content.length > limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS) {
      socket.emit('error', 'Comment length invalid');
      return;
    }
    
    // Check comment limits
    db.get(
      'SELECT COUNT(*) as count FROM comments WHERE highlight_id = ?',
      [highlightId],
      (err, result) => {
        if (err || result.count >= limits.CONTENT.COMMENTS.MAX_PER_HIGHLIGHT) {
          socket.emit('error', 'Comment limit reached');
          return;
        }
        
        // Create comment
        db.run(
          'INSERT INTO comments (id, highlight_id, user_id, content, parent_id) VALUES (?, ?, ?, ?, ?)',
          [commentId, highlightId, currentUser.id, content, parentId || null],
          function(err) {
            if (err) {
              socket.emit('error', 'Failed to create comment');
              return;
            }
            
            const comment = {
              id: commentId,
              highlightId,
              userId: currentUser.id,
              content,
              parentId: parentId || null,
              username: currentUser.username,
              userColor: currentUser.color,
              createdDate: new Date().toISOString()
            };
            
            socket.emit('comment-created', comment);
            socket.to(currentSession).emit('comment-added', comment);
          }
        );
      }
    );
  });
  
  // Handle reading progress
  socket.on('update-progress', (data) => {
    if (!currentUser || !currentSession) {
      return;
    }
    
    const { cfi, percentage } = data;
    socket.to(currentSession).emit('user-progress-updated', {
      userId: currentUser.id,
      username: currentUser.username,
      color: currentUser.color,
      cfi,
      percentage
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (currentUser && currentSession) {
      // Remove user from session
      db.run(
        'DELETE FROM users WHERE id = ?',
        [currentUser.id],
        function(err) {
          if (!err) {
            // Update session user count
            db.run(
              'UPDATE sessions SET user_count = user_count - 1 WHERE id = ?',
              [currentSession]
            );
            
            socket.to(currentSession).emit('user-left', currentUser);
          }
        }
      );
    }
  });
});

// Update the convert endpoint to use hybrid cleanup
app.post('/api/convert-epub/:bookId', async (req, res) => {
  const { bookId } = req.params;
  
  try {
    console.log('Converting EPUB for book ID:', bookId);
    
    // Get book info from database
    db.get('SELECT * FROM books WHERE id = ?', [bookId], async (err, book) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      console.log('Found book:', book.filename);
      console.log('Book filepath:', book.filepath);
      
      // Check if file exists
      if (!fs.existsSync(book.filepath)) {
        console.error('File does not exist:', book.filepath);
        return res.status(404).json({ error: 'Book file not found' });
      }
      
      try {
        // Convert EPUB to HTML using Calibre
        const result = await convertEpubToHtml(book.filepath);
        
        // Send response first
        res.json({
          success: true,
          html: result.content.html,
          chapters: result.content.chapters,
          metadata: result.content.metadata,
          bookId: bookId
        });
        
        // Clean up after response is sent
        result.cleanup();
        
      } catch (conversionError) {
        console.error('Conversion error:', conversionError);
        res.status(500).json({ error: `Failed to convert EPUB: ${conversionError.message}` });
      }
    });
  } catch (error) {
    console.error('Convert endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Temporary version with NO file deletion for debugging
async function convertEpubToHtml(filePath) {
  return new Promise((resolve, reject) => {
    console.log('\n=== CALIBRE CONVERSION DEBUG ===');
    console.log('Input file path:', filePath);
    console.log('File exists:', fs.existsSync(filePath));
    
    const calibrePath = '/Applications/calibre.app/Contents/MacOS/ebook-convert';
    console.log('Calibre path:', calibrePath);
    
    // Create output filename
    const inputDir = path.dirname(filePath);
    const inputName = path.basename(filePath, '.epub');
    const tempOutputPath = path.join(inputDir, `${inputName}_output.txt`);
    
    console.log('Output path:', tempOutputPath);
    
    const conversionArgs = [
      filePath,           // Input file
      tempOutputPath      // Output file
    ];
    
    console.log('Full conversion command:', calibrePath, conversionArgs.join(' '));
    
    const calibreProcess = spawn(calibrePath, conversionArgs);
    
    let errorOutput = '';
    
    calibreProcess.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      console.log('Calibre stderr:', output);
    });
    
    calibreProcess.on('close', (code) => {
      console.log('\n=== CONVERSION RESULT ===');
      console.log('Exit code:', code);
      console.log('Expected output file:', tempOutputPath);
      console.log('Output file exists:', fs.existsSync(tempOutputPath));
      
      if (code === 0) {
        if (fs.existsSync(tempOutputPath)) {
          try {
            const textContent = fs.readFileSync(tempOutputPath, 'utf8');
            console.log('✅ Text extraction successful, length:', textContent.length);
            console.log('Text preview:', textContent.substring(0, 200) + '...');
            
            // TEMPORARILY DISABLED: No file deletion
            // fs.unlinkSync(tempOutputPath);
            console.log('⚠️  TEMPORARY: File NOT deleted for debugging');
            
            const htmlContent = convertTextToHtml(textContent);
            const parsedContent = parseCalibreHtml(htmlContent);
            
            // Return content with no-op cleanup function
            resolve({
              content: parsedContent,
              cleanup: () => {
                console.log('⚠️  TEMPORARY: Cleanup disabled for debugging');
                // No cleanup for now
              }
            });
          } catch (err) {
            console.error('❌ Failed to read text file:', err);
            reject(new Error(`Failed to read converted text: ${err.message}`));
          }
        } else {
          console.error('❌ Output file not found after successful conversion');
          console.error('Expected:', tempOutputPath);
          reject(new Error('Calibre did not create output file'));
        }
      } else {
        console.error('❌ Calibre conversion failed');
        console.error('Exit code:', code);
        console.error('Error output:', errorOutput);
        
        reject(new Error(`Calibre conversion failed with code ${code}: ${errorOutput}`));
      }
    });
    
    calibreProcess.on('error', (error) => {
      console.error('❌ Calibre process spawn error:', error);
      reject(new Error(`Failed to spawn Calibre process: ${error.message}`));
    });
    
    setTimeout(() => {
      calibreProcess.kill();
      reject(new Error('Calibre conversion timed out after 30 seconds'));
    }, 30000);
  });
}

// Add this function to convert plain text to HTML
function convertTextToHtml(textContent) {
  // Split into paragraphs and add basic HTML formatting
  const paragraphs = textContent.split('\n\n').filter(p => p.trim().length > 0);
  
  let html = '<div class="book-content">';
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    
    // Check if this looks like a chapter heading
    if (paragraph.length < 100 && 
        (paragraph.toUpperCase().includes('CHAPTER') || 
         paragraph.match(/^[IVX]+\./) || 
         paragraph.match(/^\d+\./))) {
      html += `<h2 class="chapter-title">${paragraph}</h2>`;
    } else {
      html += `<p class="paragraph">${paragraph}</p>`;
    }
  }
  
  html += '</div>';
  return html;
}

// Update the parseCalibreHtml function for the new format
function parseCalibreHtml(htmlContent) {
  // Split by chapter headings
  const chapterMatches = htmlContent.match(/<h2[^>]*>.*?<\/h2>/g) || [];
  const chapters = [];
  
  if (chapterMatches.length > 0) {
    // Split content by chapter headings
    const parts = htmlContent.split(/<h2[^>]*>.*?<\/h2>/);
    
    for (let i = 1; i < parts.length; i++) {
      const chapterTitle = chapterMatches[i - 1].replace(/<[^>]*>/g, '').trim();
      const chapterContent = parts[i].trim();
      
      if (chapterContent) {
        chapters.push({
          title: chapterTitle || `Chapter ${i}`,
          content: `<h2>${chapterTitle}</h2>${chapterContent}`
        });
      }
    }
  }
  
  // If no chapters found, treat entire content as one chapter
  if (chapters.length === 0) {
    chapters.push({
      title: 'Book Content',
      content: htmlContent
    });
  }
  
  return {
    html: htmlContent,
    chapters: chapters,
    metadata: {
      title: 'Converted Book',
      chapters: chapters.length
    }
  };
}

// Update the extractEpubMetadata function with detailed logging
async function extractEpubMetadata(filePath) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Starting metadata extraction...');
    console.log('📁 File path:', filePath);
    console.log('📁 File exists:', fs.existsSync(filePath));
    
    const calibrePath = '/Applications/calibre.app/Contents/MacOS/ebook-meta';
    console.log('🔧 Calibre path:', calibrePath);
    console.log('🔧 Calibre exists:', fs.existsSync(calibrePath));
    
    // Use shell execution like terminal
    const shellCommand = `${calibrePath} "${filePath}"`;
    console.log('💻 Shell command:', shellCommand);
    
    const calibreProcess = spawn('sh', ['-c', shellCommand], {
      cwd: path.dirname(filePath),
      env: { ...process.env, PATH: process.env.PATH }
    });
    
    let output = '';
    let errorOutput = '';
    
    calibreProcess.stdout.setEncoding('utf8');
    calibreProcess.stderr.setEncoding('utf8');
    
    calibreProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('📤 Metadata stdout chunk:', chunk);
    });
    
    calibreProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.log('⚠️  Metadata stderr chunk:', chunk);
    });
    
    calibreProcess.on('close', (code) => {
      console.log('🏁 Metadata extraction finished');
      console.log('📊 Exit code:', code);
      console.log('📄 Full metadata output:', output);
      console.log('⚠️  Full metadata error:', errorOutput);
      
      if (code === 0) {
        const metadata = parseCalibreMetadata(output);
        console.log('✅ Parsed metadata:', metadata);
        resolve(metadata);
      } else {
        console.log('❌ Metadata extraction failed');
        reject(new Error(`Failed to extract metadata (code ${code}): ${errorOutput}`));
      }
    });
    
    calibreProcess.on('error', (error) => {
      console.log('❌ Metadata process spawn error:', error);
      reject(new Error(`Failed to spawn metadata process: ${error.message}`));
    });
  });
}

// Update the parseCalibreMetadata function to handle the actual output format
function parseCalibreMetadata(output) {
  console.log('🔍 Parsing metadata output...');
  console.log('📄 Raw output to parse (JSON):', JSON.stringify(output));
  console.log('📄 Raw output to parse (length):', output.length);
  
  if (!output || output.trim().length === 0) {
    console.log('⚠️  Output is empty or whitespace only');
    return {};
  }
  
  const lines = output.split('\n');
  const metadata = {};
  
  console.log(' Processing', lines.length, 'lines...');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    console.log(` Line ${i + 1} (raw): "${JSON.stringify(line)}"`);
    console.log(` Line ${i + 1} (trimmed): "${trimmedLine}"`);
    
    // Handle the actual format: "Title               : Wuthering Heights"
    if (trimmedLine.startsWith('Title')) {
      // Extract everything after the colon and spaces
      const titleMatch = trimmedLine.match(/Title\s*:\s*(.+)/);
      if (titleMatch) {
        metadata.title = titleMatch[1].trim();
        console.log('📖 Found title:', metadata.title);
      }
    } else if (trimmedLine.startsWith('Author(s)')) {
      // Extract everything after the colon and spaces
      const authorMatch = trimmedLine.match(/Author\(s\)\s*:\s*(.+)/);
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
        console.log('✍️  Found author:', metadata.author);
      }
    } else if (trimmedLine.startsWith('Author')) {
      // Extract everything after the colon and spaces
      const authorMatch = trimmedLine.match(/Author\s*:\s*(.+)/);
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
        console.log('✍️  Found author:', metadata.author);
      }
    }
  }
  
  console.log('✅ Final parsed metadata:', metadata);
  return metadata;
}

// Update the highlights POST endpoint
app.post('/api/books/:bookId/highlights', (req, res) => {
  const { bookId } = req.params;
  const { text, chapter, position, color, profile_id, username } = req.body;
  
  if (!text || !chapter || !profile_id || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const highlightId = uuidv4();
  
  db.run(
    'INSERT INTO highlights (id, book_id, user_id, username, text, chapter, position, color, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [highlightId, bookId, profile_id, username, text, chapter, position, color || '#ffeb3b'],
    function(err) {
      if (err) {
        console.log('❌ Database error creating highlight:', err);
        return res.status(500).json({ error: 'Failed to create highlight' });
      }
      
      const newHighlight = {
        id: highlightId,
        book_id: bookId,
        user_id: profile_id,
        username: username,
        text: text,
        chapter: chapter,
        position: position,
        color: color || '#ffeb3b',
        created_date: new Date().toISOString()
      };
      
      console.log('✅ Created highlight:', newHighlight);
      res.json(newHighlight);
    }
  );
});

app.get('/api/books/:bookId/highlights', (req, res) => {
  const { bookId } = req.params;
  const { chapter } = req.query;
  
  let query = 'SELECT * FROM highlights WHERE book_id = ?';
  let params = [bookId];
  
  if (chapter) {
    query += ' AND chapter = ?';
    params.push(chapter);
  }
  
  query += ' ORDER BY created_date DESC';
  
  db.all(query, params, (err, highlights) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to load highlights' });
    }
    
    res.json(highlights);
  });
});

// Add these missing endpoints after the highlights endpoints
app.get('/api/books/:bookId/comments', (req, res) => {
  const { bookId } = req.params;
  const { chapter, highlight_id } = req.query;
  
  let query = 'SELECT * FROM comments WHERE book_id = ?';
  let params = [bookId];
  
  if (chapter) {
    query += ' AND chapter = ?';
    params.push(parseInt(chapter));
  }
  
  if (highlight_id) {
    query += ' AND highlight_id = ?';
    params.push(highlight_id);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, comments) => {
    if (err) {
      console.log('❌ Database error loading comments:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('✅ Loaded comments:', comments);
    res.json(comments || []);
  });
});

// Update the comments POST endpoint
app.post('/api/books/:bookId/comments', (req, res) => {
  const { bookId } = req.params;
  const { text, selectedText, chapter, position, highlightId, profile_id, username } = req.body;
  
  if (!text || !selectedText || !chapter || !profile_id || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const commentId = uuidv4();
  
  db.run(
    'INSERT INTO comments (id, book_id, user_id, username, text, comment, chapter, position, highlight_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [commentId, bookId, profile_id, username, selectedText, text, chapter, position, highlightId || null],
    function(err) {
      if (err) {
        console.log('❌ Database error creating comment:', err);
        return res.status(500).json({ error: 'Failed to create comment' });
      }
      
      const newComment = {
        id: commentId,
        book_id: bookId,
        user_id: profile_id,
        username: username,
        text: selectedText,
        comment: text,
        chapter: chapter,
        position: position,
        highlight_id: highlightId,
        created_at: new Date().toISOString()
      };
      
      console.log('✅ Created comment:', newComment);
      res.json(newComment);
    }
  );
});

// Add these user management endpoints after the existing API routes

// Create a new user
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  const userId = uuidv4();
  const userColor = '#' + Math.floor(Math.random()*16777215).toString(16); // Random color
  
  db.run(
    'INSERT INTO users (id, username, color) VALUES (?, ?, ?)',
    [userId, username, userColor],
    function(err) {
      if (err) {
        console.log('❌ Database error creating user:', err);
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      const newUser = {
        id: userId,
        username: username,
        color: userColor,
        created_at: new Date().toISOString()
      };
      
      console.log('✅ Created user:', newUser);
      res.json(newUser);
    }
  );
});

// Get user by ID
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.log('❌ Database error getting user:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      console.log('❌ Database error getting users:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(users || []);
  });
});

// Profile management endpoints
app.get('/api/books/:bookId/profiles', (req, res) => {
  const { bookId } = req.params;
  
  db.all(
    'SELECT id, username, color, created_at, last_used FROM book_profiles WHERE book_id = ? ORDER BY last_used DESC',
    [bookId],
    (err, profiles) => {
      if (err) {
        console.log('❌ Database error getting profiles:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log('✅ Retrieved profiles for book:', bookId, 'count:', profiles.length);
      res.json({ profiles: profiles || [] });
    }
  );
});

app.post('/api/books/:bookId/profiles', (req, res) => {
  const { bookId } = req.params;
  const { username } = req.body;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  if (username.length > 50) {
    return res.status(400).json({ error: 'Username too long (max 50 characters)' });
  }
  
  const profileId = uuidv4();
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  db.run(
    'INSERT INTO book_profiles (id, book_id, username, color) VALUES (?, ?, ?, ?)',
    [profileId, bookId, username.trim(), randomColor],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Username already exists for this book' });
        }
        console.log('❌ Database error creating profile:', err);
        return res.status(500).json({ error: 'Failed to create profile' });
      }
      
      const newProfile = {
        id: profileId,
        book_id: bookId,
        username: username.trim(),
        color: randomColor,
        created_at: new Date().toISOString()
      };
      
      console.log('✅ Created profile:', newProfile);
      res.json(newProfile);
    }
  );
});

app.put('/api/books/:bookId/profiles/:profileId/use', (req, res) => {
  const { bookId, profileId } = req.params;
  
  db.run(
    'UPDATE book_profiles SET last_used = CURRENT_TIMESTAMP WHERE id = ? AND book_id = ?',
    [profileId, bookId],
    function(err) {
      if (err) {
        console.log('❌ Database error updating profile usage:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      console.log('✅ Updated profile last_used:', profileId);
      res.json({ success: true });
    }
  );
});

// Add progress tracking endpoints (updated to use profile_id)
app.post('/api/books/:bookId/progress', (req, res) => {
  const { bookId } = req.params;
  const { profile_id, username, progress, chapter } = req.body;
  
  if (!profile_id || !username || progress === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const progressId = `${bookId}_${profile_id}`;
  
  // First try to insert (for new user), if exists then update
  db.run(
    `INSERT OR IGNORE INTO user_progress (id, book_id, user_id, username, progress, chapter, created_at, last_updated) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [progressId, bookId, profile_id, username, progress, chapter || 1],
    function(err) {
      if (err) {
        console.log('❌ Database error inserting progress:', err);
        return res.status(500).json({ error: 'Failed to update progress' });
      }
      
      // Then update the progress (preserving created_at)
      db.run(
        `UPDATE user_progress SET progress = ?, chapter = ?, username = ?, last_updated = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [progress, chapter || 1, username, progressId],
        function(updateErr) {
          if (updateErr) {
            console.log('❌ Database error updating progress:', updateErr);
            return res.status(500).json({ error: 'Failed to update progress' });
          }
          
          console.log('✅ Updated progress for profile:', username, 'progress:', progress);
          res.json({ success: true });
        }
      );
    }
  );
});

app.get('/api/books/:bookId/progress', (req, res) => {
  const { bookId } = req.params;
  
  db.all(
    `SELECT user_id, username, progress, chapter, last_updated 
     FROM user_progress 
     WHERE book_id = ? AND last_updated > datetime('now', '-5 minutes')
     ORDER BY last_updated DESC`,
    [bookId],
    (err, users) => {
      if (err) {
        console.log('❌ Database error getting progress:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log('✅ Retrieved progress for book:', bookId, 'users:', users);
      res.json({ users: users || [] });
    }
  );
});

// Get specific user's progress
app.get('/api/books/:bookId/progress/:userId', (req, res) => {
  const { bookId, userId } = req.params;
  
  db.get(
    `SELECT user_id, username, progress, chapter, last_updated 
     FROM user_progress 
     WHERE book_id = ? AND user_id = ?`,
    [bookId, userId],
    (err, user) => {
      if (err) {
        console.log('❌ Database error getting user progress:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User progress not found' });
      }
      
      res.json(user);
    }
  );
});

// Reading stats endpoints for scorecard
app.get('/api/progress/:bookId/:profileId', (req, res) => {
  const { bookId, profileId } = req.params;
  
  db.get(
    `SELECT user_id, username, progress, chapter, last_updated,
            (SELECT MIN(created_at) FROM user_progress WHERE book_id = ? AND user_id = ?) as first_session
     FROM user_progress 
     WHERE book_id = ? AND user_id = ?
     ORDER BY last_updated DESC
     LIMIT 1`,
    [bookId, profileId, bookId, profileId],
    (err, progress) => {
      if (err) {
        console.log('❌ Database error getting progress stats:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(progress || { first_session: null, progress: 0 });
    }
  );
});

app.get('/api/highlights/:bookId', (req, res) => {
  const { bookId } = req.params;
  const { profile_id } = req.query;
  
  let query = 'SELECT * FROM highlights WHERE book_id = ?';
  let params = [bookId];
  
  if (profile_id) {
    query += ' AND user_id = ?';
    params.push(profile_id);
  }
  
  query += ' ORDER BY created_date DESC';
  
  db.all(query, params, (err, highlights) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to load highlights' });
    }
    
    res.json(highlights || []);
  });
});

app.get('/api/comments/:bookId', (req, res) => {
  const { bookId } = req.params;
  const { profile_id } = req.query;
  
  let query = 'SELECT * FROM comments WHERE book_id = ?';
  let params = [bookId];
  
  if (profile_id) {
    query += ' AND user_id = ?';
    params.push(profile_id);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, comments) => {
    if (err) {
      console.log('❌ Database error loading comments:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(comments || []);
  });
});

// Add this endpoint after the existing book endpoints (around line 410)
app.get('/api/book/slug/:slug', (req, res) => {
  const { slug } = req.params;
  
  db.get('SELECT * FROM books WHERE slug = ?', [slug], (err, book) => {
    if (err) {
      console.log('❌ Database error getting book by slug:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!book) {
      console.log('❌ Book not found for slug:', slug);
      return res.status(404).json({ error: 'Book not found' });
    }
    
    console.log('✅ Found book for slug:', slug, 'book:', book);
    res.json(book);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`File size limit: ${limits.FILE.MAX_SIZE_MB}MB`);
      console.log(`Max users per session: ${limits.USER.MAX_CONCURRENT_PER_SESSION}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;