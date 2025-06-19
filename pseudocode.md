# Collaborative E-Book Reader - Pseudo Code (Updated with Configurable Limits & Error Handling)

## System Architecture Overview

### Core Components:
1. **Frontend**: React-based web application with EPUB.js
2. **Backend**: Node.js/Express server
3. **Database**: Local storage (SQLite) for MVP, scalable to PostgreSQL
4. **File Storage**: Local file system for EPUB files
5. **Real-time Updates**: WebSocket connections for live collaboration
6. **EPUB Rendering**: EPUB.js library for robust EPUB parsing and display
7. **Configuration System**: Centralized limits and constraints management

## Configuration System Integration

### 1. Centralized Limits Configuration
```javascript
// Import configuration system
import { 
  getCurrentLimits, 
  LIMIT_VALIDATORS, 
  ERROR_MESSAGES,
  upgradeToPhase 
} from './config/limits.js';

// Get current limits based on environment
const limits = getCurrentLimits(process.env.NODE_ENV || 'production');
```

### 2. Environment-Specific Configuration
```javascript
// Development environment (higher limits for testing)
development: {
  FILE: { MAX_SIZE_MB: 50 },
  USER: { MAX_CONCURRENT_PER_SESSION: 10 }
}

// Production environment (MVP limits)
production: {
  FILE: { MAX_SIZE_MB: 25 },
  USER: { MAX_CONCURRENT_PER_SESSION: 5 }
}

// Testing environment (lower limits for fast tests)
testing: {
  FILE: { MAX_SIZE_MB: 10 },
  USER: { MAX_CONCURRENT_PER_SESSION: 3 }
}
```

## Data Structures

### 1. User Profile
```javascript
UserProfile {
  id: UUID
  sessionId: String (for anonymous users)
  displayName: String (e.g., "Cheerful Penguin")
  color: String (hex color)
  icon: String (icon identifier)
  createdAt: Timestamp
  lastActive: Timestamp
  isActive: Boolean
}
```

### 2. E-Book Session
```javascript
EbookSession {
  id: UUID
  uniqueLink: String (URL slug)
  title: String
  author: String
  filePath: String
  totalPages: Number
  createdAt: Timestamp
  createdBy: UserProfile.id
  tableOfContents: Array<Chapter>
  epubMetadata: Object (EPUB.js metadata)
  currentUserCount: Number
  isActive: Boolean
}
```

### 3. Chapter (Table of Contents)
```javascript
Chapter {
  id: UUID
  title: String
  href: String (EPUB.js spine reference)
  level: Number (for nested chapters)
  ebookSessionId: UUID
}
```

### 4. User Progress
```javascript
UserProgress {
  id: UUID
  userId: UserProfile.id
  ebookSessionId: UUID
  currentLocation: String (EPUB.js CFI or href)
  currentPage: Number (calculated from location)
  lastReadAt: Timestamp
  isActive: Boolean
}
```

### 5. Highlight
```javascript
Highlight {
  id: UUID
  userId: UserProfile.id
  ebookSessionId: UUID
  cfiRange: String (EPUB.js CFI range)
  selectedText: String
  color: String (inherited from user)
  createdAt: Timestamp
  chapterHref: String (EPUB.js spine reference)
}
```

### 6. Comment
```javascript
Comment {
  id: UUID
  highlightId: UUID
  userId: UserProfile.id
  content: String
  createdAt: Timestamp
  updatedAt: Timestamp
  replyDepth: Number
}
```

### 7. Reply
```javascript
Reply {
  id: UUID
  commentId: UUID
  userId: UserProfile.id
  content: String
  createdAt: Timestamp
  updatedAt: Timestamp
  replyDepth: Number
}
```

## Application Flow with Error Handling

### 1. Home Page (E-Book Upload) with Validation
```pseudocode
FUNCTION displayHomePage():
  SHOW upload form with drag-and-drop area
  SHOW "Upload EPUB" button
  SHOW file size limit: limits.FILE.MAX_SIZE_MB + "MB"
  
  ON file selection:
    validation = validateFileUpload(file)
    IF validation.valid:
      CALL uploadEbook(file)
    ELSE:
      SHOW_ERROR(validation.error)
```

### 2. File Upload Validation
```pseudocode
FUNCTION validateFileUpload(file):
  limits = getCurrentLimits()
  
  // Check file size
  IF !LIMIT_VALIDATORS.validateFileSize(file.size):
    RETURN { 
      valid: false, 
      error: ERROR_MESSAGES.FILE_SIZE_EXCEEDED(limits.FILE.MAX_SIZE_MB) 
    }
  
  // Check file type
  IF !LIMIT_VALIDATORS.validateFileType(file.name):
    RETURN { 
      valid: false, 
      error: ERROR_MESSAGES.INVALID_FILE_TYPE(limits.FILE.ALLOWED_TYPES) 
    }
  
  // Check upload timeout
  IF uploadTime > limits.FILE.UPLOAD_TIMEOUT_MS:
    RETURN { 
      valid: false, 
      error: ERROR_MESSAGES.UPLOAD_TIMEOUT() 
    }
  
  RETURN { valid: true }
```

### 3. E-Book Upload Process with EPUB.js and Error Handling
```pseudocode
FUNCTION uploadEbook(epubFile):
  TRY:
    // Save file to storage first
    filePath = SAVE_FILE(epubFile)
    
    // Initialize EPUB.js book for parsing
    book = NEW_EPUBJS_BOOK(filePath)
    
    // Wait for book to be ready with timeout
    AWAIT book.ready WITH_TIMEOUT(limits.PERFORMANCE.EPUB.PARSE_TIMEOUT_MS)
    
    // Extract metadata using EPUB.js
    metadata = book.package.metadata
    title = metadata.title || "Untitled"
    author = metadata.creator || "Unknown Author"
    
    // Extract spine (reading order) using EPUB.js
    spine = book.spine.items
    totalPages = spine.length
    
    // Validate page count
    IF !LIMIT_VALIDATORS.validateEpubPageCount(totalPages):
      THROW_ERROR(ERROR_MESSAGES.EPUB_TOO_LARGE(limits.PERFORMANCE.EPUB.MAX_PAGES))
    
    // Extract table of contents using EPUB.js
    toc = EXTRACT_TOC_FROM_EPUBJS(book)
    
    // Generate unique link
    uniqueLink = GENERATE_UNIQUE_SLUG()
    
    // Save to database
    ebookSession = CREATE_EBOOK_SESSION({
      title, author, totalPages, uniqueLink, toc, filePath
    })
    
    // Redirect to reader
    REDIRECT_TO("/reader/" + uniqueLink)
    
  CATCH parsingError:
    SHOW_ERROR("Unable to parse EPUB file. Please check if the file is corrupted.")
    DELETE_FILE(filePath)
    
  CATCH timeoutError:
    SHOW_ERROR("EPUB parsing timed out. Please try a smaller file.")
    DELETE_FILE(filePath)
    
  CATCH databaseError:
    SHOW_ERROR("Database error. Please try again.")
    DELETE_FILE(filePath)
    
  CATCH generalError:
    SHOW_ERROR("An unexpected error occurred. Please try again.")
    DELETE_FILE(filePath)
```

### 4. E-Book Reader Page with User Limit Validation
```pseudocode
FUNCTION displayReaderPage(uniqueLink):
  TRY:
    // Load ebook session
    ebookSession = LOAD_EBOOK_SESSION(uniqueLink)
    IF NOT ebookSession:
      SHOW_404_ERROR("Reading session not found.")
      RETURN
    
    // Check user limit before allowing access
    currentUserCount = GET_ACTIVE_USER_COUNT(uniqueLink)
    IF !LIMIT_VALIDATORS.validateUserCount(currentUserCount):
      SHOW_ERROR(ERROR_MESSAGES.USER_LIMIT_REACHED(limits.USER.MAX_CONCURRENT_PER_SESSION))
      RETURN
    
    // Create or load user profile
    userProfile = GET_OR_CREATE_USER_PROFILE()
    
    // Initialize EPUB.js book
    book = NEW_EPUBJS_BOOK(ebookSession.filePath)
    
    // Wait for book to be ready with timeout
    AWAIT book.ready WITH_TIMEOUT(limits.PERFORMANCE.EPUB.RENDER_TIMEOUT_MS)
    
    // Load user progress
    userProgress = LOAD_USER_PROGRESS(userProfile.id, ebookSession.id)
    
    // Load collaborative data with limits
    allHighlights = LOAD_HIGHLIGHTS_WITH_LIMIT(ebookSession.id, limits.UI.MAX_HIGHLIGHTS_VISIBLE)
    allComments = LOAD_COMMENTS_WITH_LIMIT(ebookSession.id, limits.UI.MAX_COMMENTS_VISIBLE)
    allUserProgress = LOAD_ALL_USER_PROGRESS(ebookSession.id)
    
    // Initialize EPUB.js renderer
    renderer = NEW_EPUBJS_RENDERER(book, "#epub-container")
    
    // Set up EPUB.js event listeners with error handling
    SETUP_EPUBJS_EVENTS_WITH_ERROR_HANDLING(renderer, book)
    
    // Render page
    RENDER_READER_UI({
      ebookSession,
      userProfile,
      userProgress,
      allHighlights,
      allComments,
      allUserProgress,
      book,
      renderer
    })
    
    // Initialize WebSocket connection with limits
    INITIALIZE_WEBSOCKET_WITH_LIMITS(uniqueLink)
    
  CATCH sessionNotFoundError:
    SHOW_ERROR("Reading session not found or has expired.")
    
  CATCH userLimitError:
    SHOW_ERROR(ERROR_MESSAGES.USER_LIMIT_REACHED(limits.USER.MAX_CONCURRENT_PER_SESSION))
    
  CATCH epubRenderingError:
    SHOW_ERROR("Unable to render EPUB. Please try refreshing the page.")
    
  CATCH websocketError:
    SHOW_WARNING("Real-time features unavailable. You can still read the book.")
    CONTINUE_WITHOUT_REALTIME()
```

### 5. EPUB.js Integration Setup with Error Handling
```pseudocode
FUNCTION setupEpubJsEventsWithErrorHandling(renderer, book):
  // Listen for location changes
  renderer.on("relocated", (location) => {
    TRY:
      UPDATE_USER_PROGRESS(location.start.cfi)
      BROADCAST_PROGRESS_UPDATE(location.start.cfi)
    CATCH error:
      LOG_ERROR("Progress update failed:", error)
  })
  
  // Listen for text selections
  renderer.on("selected", (cfiRange, contents) => {
    TRY:
      HANDLE_TEXT_SELECTION_WITH_LIMITS(cfiRange, contents)
    CATCH error:
      SHOW_ERROR("Unable to create highlight. Please try again.")
  })
  
  // Listen for rendering complete
  renderer.on("rendered", (section) => {
    TRY:
      APPLY_EXISTING_HIGHLIGHTS(section)
      UPDATE_PAGE_NUMBER(section)
    CATCH error:
      LOG_ERROR("Rendering post-processing failed:", error)
  })
  
  // Listen for errors
  renderer.on("error", (error) => {
    HANDLE_RENDERING_ERROR(error)
  })
```

### 6. Text Selection with Limits Validation
```pseudocode
FUNCTION handleTextSelectionWithLimits(cfiRange, contents):
  limits = getCurrentLimits()
  
  // Get selected text from EPUB.js
  selectedText = contents.text()
  
  // Validate text length
  IF selectedText.length < limits.CONTENT.HIGHLIGHTS.MIN_TEXT_LENGTH:
    SHOW_ERROR("Selection too short. Please select more text.")
    RETURN
  
  IF selectedText.length > limits.CONTENT.HIGHLIGHTS.MAX_TEXT_LENGTH:
    SHOW_ERROR("Selection too long. Please select less text.")
    RETURN
  
  // Check user highlight count
  userHighlightCount = GET_USER_HIGHLIGHT_COUNT(userProfile.id, ebookSession.id)
  IF !LIMIT_VALIDATORS.validateHighlightCount(userHighlightCount):
    SHOW_ERROR(ERROR_MESSAGES.HIGHLIGHT_LIMIT_REACHED(limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK))
    RETURN
  
  // Create highlight
  highlight = CREATE_HIGHLIGHT({
    userId: userProfile.id,
    ebookSessionId: ebookSession.id,
    cfiRange: cfiRange,
    selectedText: selectedText,
    color: userProfile.color,
    chapterHref: contents.section.href
  })
  
  // Save to database
  SAVE_HIGHLIGHT(highlight)
  
  // Apply highlight to EPUB.js renderer
  renderer.annotations.add("highlight", cfiRange, {}, (e) => {
    IF e:
      LOG_ERROR("Highlight application failed:", e)
  })
  
  // Broadcast to other users
  BROADCAST_HIGHLIGHT_CREATED(highlight)
  
  // Show comment input
  SHOW_COMMENT_INPUT(highlight.id)
```

### 7. Comment System with Limits
```pseudocode
FUNCTION addCommentWithLimits(highlightId, content):
  limits = getCurrentLimits()
  
  // Validate comment length
  IF !LIMIT_VALIDATORS.validateCommentLength(content.length):
    IF content.length > limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS:
      SHOW_ERROR(ERROR_MESSAGES.COMMENT_TOO_LONG(limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS))
    ELSE:
      SHOW_ERROR(ERROR_MESSAGES.COMMENT_TOO_SHORT(limits.CONTENT.COMMENTS.MIN_LENGTH_CHARS))
    RETURN
  
  // Check comment count for this highlight
  commentCount = GET_COMMENT_COUNT(highlightId)
  IF !LIMIT_VALIDATORS.validateCommentCount(commentCount):
    SHOW_ERROR(ERROR_MESSAGES.COMMENT_LIMIT_REACHED(limits.CONTENT.COMMENTS.MAX_PER_HIGHLIGHT))
    RETURN
  
  // Create comment
  comment = CREATE_COMMENT({
    highlightId: highlightId,
    userId: userProfile.id,
    content: content,
    replyDepth: 0
  })
  
  // Save to database
  SAVE_COMMENT(comment)
  
  // Broadcast to other users
  BROADCAST_COMMENT_ADDED(comment)
  
  // Update UI
  UPDATE_COMMENTS_PANEL()
```

### 8. Reply System with Depth Limits
```pseudocode
FUNCTION addReplyWithLimits(commentId, content):
  limits = getCurrentLimits()
  
  // Get parent comment
  parentComment = GET_COMMENT(commentId)
  
  // Check reply depth
  IF parentComment.replyDepth >= limits.CONTENT.COMMENTS.MAX_REPLY_DEPTH:
    SHOW_ERROR(ERROR_MESSAGES.REPLY_DEPTH_EXCEEDED(limits.CONTENT.COMMENTS.MAX_REPLY_DEPTH))
    RETURN
  
  // Validate reply length
  IF content.length > limits.CONTENT.REPLIES.MAX_LENGTH_CHARS:
    SHOW_ERROR(ERROR_MESSAGES.COMMENT_TOO_LONG(limits.CONTENT.REPLIES.MAX_LENGTH_CHARS))
    RETURN
  
  // Check reply count
  replyCount = GET_REPLY_COUNT(commentId)
  IF replyCount >= limits.CONTENT.REPLIES.MAX_PER_COMMENT:
    SHOW_ERROR("Maximum replies per comment reached.")
    RETURN
  
  // Create reply
  reply = CREATE_REPLY({
    commentId: commentId,
    userId: userProfile.id,
    content: content,
    replyDepth: parentComment.replyDepth + 1
  })
  
  // Save to database
  SAVE_REPLY(reply)
  
  // Broadcast to other users
  BROADCAST_REPLY_ADDED(reply)
```

### 9. WebSocket Connection with Rate Limiting
```pseudocode
FUNCTION initializeWebSocketWithLimits(uniqueLink):
  limits = getCurrentLimits()
  
  websocket = CONNECT_TO_WEBSOCKET("/ws/" + uniqueLink)
  
  // Set up rate limiting
  messageCount = 0
  lastReset = Date.now()
  
  websocket.onMessage = FUNCTION(message):
    now = Date.now()
    
    // Reset counter every second
    IF now - lastReset >= 1000:
      messageCount = 0
      lastReset = now
    
    messageCount++
    
    IF messageCount > limits.PERFORMANCE.WEBSOCKET.MAX_MESSAGES_PER_SECOND:
      websocket.emit('error', ERROR_MESSAGES.RATE_LIMIT_EXCEEDED())
      RETURN
    
    // Process message
    data = PARSE_JSON(message)
    PROCESS_WEBSOCKET_MESSAGE(data)
  
  // Set up reconnection
  reconnectAttempts = 0
  
  websocket.onDisconnect = FUNCTION():
    IF reconnectAttempts < limits.PERFORMANCE.WEBSOCKET.RECONNECTION_ATTEMPTS:
      setTimeout(() => {
        websocket.connect()
        reconnectAttempts++
      }, limits.PERFORMANCE.WEBSOCKET.RECONNECTION_DELAY_MS)
    ELSE:
      SHOW_ERROR(ERROR_MESSAGES.WEBSOCKET_ERROR())
```

### 10. Session Management with Timeouts
```pseudocode
FUNCTION setupSessionManagement():
  limits = getCurrentLimits()
  
  // Set up session timeout checking
  setInterval(() => {
    now = Date.now()
    inactiveUsers = GET_INACTIVE_USERS(now - limits.USER.SESSION_TIMEOUT_MS)
    
    inactiveUsers.forEach(user => {
      user.socket.emit('timeout', ERROR_MESSAGES.SESSION_TIMEOUT())
      user.socket.disconnect()
      REMOVE_USER_FROM_SESSION(user.id)
    })
  }, 60000) // Check every minute
  
  // Set up profile cleanup
  setInterval(() => {
    now = Date.now()
    expiredProfiles = GET_EXPIRED_PROFILES(now - limits.USER.PROFILE_PERSISTENCE_MS)
    
    expiredProfiles.forEach(profile => {
      DELETE_USER_PROFILE(profile.id)
    })
  }, 3600000) // Check every hour
```

### 11. Database Operations with Timeouts
```pseudocode
FUNCTION executeDatabaseQuery(query, params):
  limits = getCurrentLimits()
  
  TRY:
    result = EXECUTE_QUERY_WITH_TIMEOUT(query, params, limits.PERFORMANCE.DATABASE.QUERY_TIMEOUT_MS)
    RETURN result
    
  CATCH timeoutError:
    SHOW_ERROR(ERROR_MESSAGES.DATABASE_TIMEOUT())
    LOG_ERROR("Database query timeout:", query)
    
  CATCH databaseLockedError:
    RETRY_WITH_BACKOFF(query, params)
    
  CATCH diskFullError:
    SHOW_ERROR("Storage full. Please contact administrator.")
    LOG_ERROR("Disk space exhausted")
    
  CATCH corruptionError:
    SHOW_ERROR("Database error. Please refresh the page.")
    LOG_ERROR("Database corruption detected")
```

### 12. Performance Monitoring
```pseudocode
FUNCTION monitorPerformance():
  limits = getCurrentLimits()
  
  // Monitor memory usage
  memoryUsage = GET_MEMORY_USAGE()
  IF memoryUsage > limits.PERFORMANCE.EPUB.MAX_MEMORY_BYTES:
    SHOW_WARNING("High memory usage detected. Consider refreshing the page.")
  
  // Monitor message rate
  messageRate = GET_MESSAGE_RATE()
  IF messageRate > limits.PERFORMANCE.WEBSOCKET.MAX_MESSAGES_PER_SECOND:
    THROTTLE_MESSAGES()
  
  // Monitor database size
  databaseSize = GET_DATABASE_SIZE()
  IF databaseSize > limits.STORAGE.MAX_DATABASE_SIZE_MB * 1024 * 1024:
    CLEANUP_OLD_DATA()
```

## Error Recovery Strategies

### 1. Graceful Degradation
```pseudocode
FUNCTION implementGracefulDegradation():
  // If real-time features fail
  IF websocket_failed:
    SWITCH_TO_POLLING_MODE()
    SHOW_WARNING("Real-time features unavailable. Updates will be delayed.")
  
  // If highlighting fails
  IF highlighting_failed:
    DISABLE_HIGHLIGHTING_FEATURE()
    SHOW_WARNING("Highlighting temporarily disabled.")
  
  // If progress tracking fails
  IF progress_tracking_failed:
    USE_LOCAL_STORAGE_ONLY()
    SHOW_WARNING("Progress saved locally only.")
  
  // If EPUB rendering fails
  IF epub_rendering_failed:
    SHOW_TEXT_ONLY_VERSION()
    SHOW_WARNING("Advanced formatting unavailable.")
```

### 2. Data Recovery Mechanisms
```pseudocode
FUNCTION implementDataRecovery():
  // Regular backups
  SCHEDULE_REGULAR_BACKUPS(limits.STORAGE.BACKUP_RETENTION_DAYS)
  
  // Incremental saves
  IMPLEMENT_INCREMENTAL_SAVES(limits.UI.AUTO_SAVE_INTERVAL_MS)
  
  // Conflict resolution
  IMPLEMENT_CONFLICT_RESOLUTION()
  
  // Data validation
  IMPLEMENT_DATA_VALIDATION()
```

## Scaling Management

### 1. Phase Upgrade Function
```pseudocode
FUNCTION upgradeToScalingPhase(phaseName):
  TRY:
    newLimits = upgradeToPhase(phaseName)
    
    // Update all active sessions with new limits
    activeSessions = GET_ALL_ACTIVE_SESSIONS()
    activeSessions.forEach(session => {
      UPDATE_SESSION_LIMITS(session.id, newLimits)
    })
    
    // Notify all users of limit changes
    BROADCAST_LIMIT_UPDATE(newLimits)
    
    LOG_INFO("Successfully upgraded to", phaseName)
    RETURN newLimits
    
  CATCH error:
    LOG_ERROR("Failed to upgrade to", phaseName, ":", error)
    ROLLBACK_TO_PREVIOUS_PHASE()
```

### 2. Limit Usage Analytics
```pseudocode
FUNCTION trackLimitUsage():
  // Track how often limits are hit
  TRACK_METRIC("file_size_exceeded")
  TRACK_METRIC("user_limit_reached")
  TRACK_METRIC("highlight_limit_reached")
  TRACK_METRIC("comment_limit_reached")
  
  // Analyze usage patterns
  usagePatterns = ANALYZE_LIMIT_USAGE_PATTERNS()
  
  // Suggest scaling if needed
  IF usagePatterns.file_size_exceeded > 0.1: // 10% of uploads
    SUGGEST_SCALING("FILE_SIZE")
  
  IF usagePatterns.user_limit_reached > 0.05: // 5% of sessions
    SUGGEST_SCALING("USER_COUNT")
```

## Database Schema (Updated with Limits)

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Ebook sessions table
CREATE TABLE ebook_sessions (
  id TEXT PRIMARY KEY,
  unique_link TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  file_path TEXT NOT NULL,
  total_pages INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  epub_metadata TEXT, -- JSON string of EPUB.js metadata
  current_user_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Chapters table (updated for EPUB.js)
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  href TEXT NOT NULL, -- EPUB.js spine reference
  level INTEGER DEFAULT 1,
  ebook_session_id TEXT NOT NULL,
  FOREIGN KEY (ebook_session_id) REFERENCES ebook_sessions(id)
);

-- User progress table (updated for EPUB.js)
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ebook_session_id TEXT NOT NULL,
  current_location TEXT, -- EPUB.js CFI
  current_page INTEGER DEFAULT 1,
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ebook_session_id) REFERENCES ebook_sessions(id)
);

-- Highlights table (updated for EPUB.js)
CREATE TABLE highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ebook_session_id TEXT NOT NULL,
  cfi_range TEXT NOT NULL, -- EPUB.js CFI range
  selected_text TEXT NOT NULL,
  color TEXT NOT NULL,
  chapter_href TEXT NOT NULL, -- EPUB.js spine reference
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ebook_session_id) REFERENCES ebook_sessions(id)
);

-- Comments table
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  highlight_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reply_depth INTEGER DEFAULT 0,
  FOREIGN KEY (highlight_id) REFERENCES highlights(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Replies table
CREATE TABLE replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reply_depth INTEGER DEFAULT 1,
  FOREIGN KEY (comment_id) REFERENCES comments(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Configuration table for limits
CREATE TABLE configuration (
  id TEXT PRIMARY KEY,
  phase_name TEXT NOT NULL,
  limits_json TEXT NOT NULL, -- JSON string of current limits
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## File Structure (Updated with Configuration)

```
collaborative-ebook-reader/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomePage.jsx
│   │   │   ├── EbookReader.jsx
│   │   │   ├── EpubRenderer.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── TableOfContents.jsx
│   │   │   ├── HighlightingSystem.jsx
│   │   │   ├── CommentsPanel.jsx
│   │   │   ├── NavigationControls.jsx
│   │   │   ├── UserProfile.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   ├── hooks/
│   │   │   ├── useEpubJs.js
│   │   │   ├── useWebSocket.js
│   │   │   ├── useEbookSession.js
│   │   │   ├── useUserProfile.js
│   │   │   └── useLimits.js
│   │   ├── utils/
│   │   │   ├── epubJsHelpers.js
│   │   │   ├── cfiUtils.js
│   │   │   ├── colorGenerator.js
│   │   │   ├── nameGenerator.js
│   │   │   └── errorHandler.js
│   │   ├── config/
│   │   │   ├── limits.js
│   │   │   └── usage-example.js
│   │   └── App.jsx
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── upload.js
│   │   │   ├── reader.js
│   │   │   └── api.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── EbookSession.js
│   │   │   ├── Highlight.js
│   │   │   └── Comment.js
│   │   ├── services/
│   │   │   ├── epubService.js
│   │   │   ├── websocketService.js
│   │   │   ├── databaseService.js
│   │   │   └── limitsService.js
│   │   ├── config/
│   │   │   └── limits.js
│   │   └── server.js
│   ├── uploads/
│   ├── database/
│   └── package.json
└── README.md
```

## Dependencies (Updated for Configuration)

### Frontend Dependencies:
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "epubjs": "^0.3.93",
    "rangy": "^1.3.0",
    "socket.io-client": "^4.7.0",
    "uuid": "^9.0.0"
  }
}
```

### Backend Dependencies:
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "sqlite3": "^5.1.0",
    "multer": "^1.4.5",
    "socket.io": "^4.7.0",
    "uuid": "^9.0.0",
    "cors": "^2.8.5"
  }
}
```

This updated pseudo code now includes comprehensive error handling, configurable limits for all phases, and centralized configuration management. The system is designed to gracefully handle failures and scale smoothly from MVP to full production deployment. 