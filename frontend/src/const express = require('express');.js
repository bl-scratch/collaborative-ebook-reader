const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// Import configuration
const config = require('./config/config');

// Import routes
const uploadRoutes = require('./routes/upload');
const sessionRoutes = require('./routes/session');

// Import services
const DatabaseService = require('./services/database');
const CollaborationService = require('./services/collaboration');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Initialize services
const dbService = new DatabaseService();
const collaborationService = new CollaborationService(io, dbService);

// Middleware
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: config.MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_FILE_SIZE }));

// Session middleware
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.NODE_ENV === 'production',
    maxAge: config.SESSION_TIMEOUT
  }
}));

// File upload middleware
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/epub+zip' || file.originalname.endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Only EPUB files are allowed'), false);
    }
  }
});

// Routes
app.use('/api/upload', uploadRoutes(upload, dbService));
app.use('/api/session', sessionRoutes(dbService));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: `File size must be less than ${config.MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user joining a book session
  socket.on('join-book', async (data) => {
    try {
      const { bookId, userId, username } = data;
      
      if (!bookId || !userId || !username) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }
      
      // Check if book exists
      const book = await dbService.getBook(bookId);
      if (!book) {
        socket.emit('error', { message: 'Book not found' });
        return;
      }
      
      // Check user limits
      const activeUsers = await collaborationService.getActiveUsers(bookId);
      if (activeUsers.length >= config.MAX_CONCURRENT_USERS) {
        socket.emit('error', { message: 'Maximum users reached for this book' });
        return;
      }
      
      // Join room and add user
      socket.join(bookId);
      await collaborationService.addUser(bookId, userId, username, socket.id);
      
      // Notify other users
      socket.to(bookId).emit('user-joined', { userId, username });
      
      // Send current users list
      const users = await collaborationService.getActiveUsers(bookId);
      socket.emit('users-list', users);
      
      // Send existing highlights and comments
      const highlights = await dbService.getHighlights(bookId);
      const comments = await dbService.getComments(bookId);
      socket.emit('existing-data', { highlights, comments });
      
    } catch (error) {
      console.error('Error joining book:', error);
      socket.emit('error', { message: 'Failed to join book session' });
    }
  });
  
  // Handle highlights
  socket.on('add-highlight', async (data) => {
    try {
      const { bookId, userId, cfiRange, text, color } = data;
      
      if (!bookId || !userId || !cfiRange) {
        socket.emit('error', { message: 'Missing required fields for highlight' });
        return;
      }
      
      // Check highlight limits
      const userHighlights = await dbService.getUserHighlights(bookId, userId);
      if (userHighlights.length >= config.MAX_HIGHLIGHTS_PER_USER) {
        socket.emit('error', { message: 'Maximum highlights reached' });
        return;
      }
      
      const highlight = await dbService.addHighlight(bookId, userId, cfiRange, text, color);
      socket.to(bookId).emit('highlight-added', highlight);
      socket.emit('highlight-confirmed', highlight);
      
    } catch (error) {
      console.error('Error adding highlight:', error);
      socket.emit('error', { message: 'Failed to add highlight' });
    }
  });
  
  // Handle comments
  socket.on('add-comment', async (data) => {
    try {
      const { bookId, userId, cfiRange, text, highlightId } = data;
      
      if (!bookId || !userId || !text) {
        socket.emit('error', { message: 'Missing required fields for comment' });
        return;
      }
      
      // Check comment limits
      const userComments = await dbService.getUserComments(bookId, userId);
      if (userComments.length >= config.MAX_COMMENTS_PER_USER) {
        socket.emit('error', { message: 'Maximum comments reached' });
        return;
      }
      
      const comment = await dbService.addComment(bookId, userId, cfiRange, text, highlightId);
      socket.to(bookId).emit('comment-added', comment);
      socket.emit('comment-confirmed', comment);
      
    } catch (error) {
      console.error('Error adding comment:', error);
      socket.emit('error', { message: 'Failed to add comment' });
    }
  });
  
  // Handle comment replies
  socket.on('add-reply', async (data) => {
    try {
      const { bookId, userId, parentCommentId, text } = data;
      
      if (!bookId || !userId || !parentCommentId || !text) {
        socket.emit('error', { message: 'Missing required fields for reply' });
        return;
      }
      
      // Check reply limits
      const userReplies = await dbService.getUserReplies(bookId, userId);
      if (userReplies.length >= config.MAX_REPLIES_PER_USER) {
        socket.emit('error', { message: 'Maximum replies reached' });
        return;
      }
      
      const reply = await dbService.addReply(bookId, userId, parentCommentId, text);
      socket.to(bookId).emit('reply-added', reply);
      socket.emit('reply-confirmed', reply);
      
    } catch (error) {
      console.error('Error adding reply:', error);
      socket.emit('error', { message: 'Failed to add reply' });
    }
  });
  
  // Handle user reading position
  socket.on('update-position', async (data) => {
    try {
      const { bookId, userId, cfi } = data;
      
      if (!bookId || !userId || !cfi) {
        return;
      }
      
      await collaborationService.updateUserPosition(bookId, userId, cfi);
      socket.to(bookId).emit('position-updated', { userId, cfi });
      
    } catch (error) {
      console.error('Error updating position:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    try {
      const userData = await collaborationService.removeUser(socket.id);
      if (userData) {
        socket.to(userData.bookId).emit('user-left', { userId: userData.userId });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Initialize database
dbService.init().then(() => {
  console.log('Database initialized successfully');
  
  // Start server
  server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Frontend URL: ${config.FRONTEND_URL}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };