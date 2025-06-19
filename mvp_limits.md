# MVP Limits & Constraints - Collaborative E-Book Reader

## Proposed MVP Limits

### 1. File Upload Limits
- **File size**: Maximum 25MB per EPUB file
- **File type**: EPUB 2.0 and 3.0 only (no PDF, MOBI, etc.)
- **File validation**: Must contain valid EPUB structure (container.xml, content.opf, etc.)
- **Upload timeout**: 60 seconds maximum upload time

### 2. User Limits
- **Concurrent users per session**: Maximum 5 users per unique link
- **User session timeout**: 30 minutes of inactivity
- **Anonymous users only**: No user registration/login required
- **User profile persistence**: 24 hours (profiles deleted after 24 hours of inactivity)

### 3. Content Limits
- **Highlights per user**: Maximum 100 highlights per user per book
- **Comments per highlight**: Maximum 5 comments per highlight
- **Comment length**: Maximum 500 characters per comment
- **Reply depth**: Maximum 2 levels of replies (comment → reply → reply to reply)

### 4. Performance Limits
- **EPUB page limit**: Maximum 1000 pages per book
- **Memory usage**: Maximum 50MB per EPUB in browser memory
- **WebSocket message rate**: Maximum 10 messages per second per user
- **Database query timeout**: 5 seconds maximum

### 5. Feature Limits
- **Real-time collaboration**: Basic highlighting and comments only
- **Offline support**: None (requires active connection)
- **Export features**: None (read-only collaboration)
- **Advanced navigation**: Basic TOC and page navigation only

## Error Messages for Limit Exceeded

### File Upload Limits
```javascript
// File size exceeded
SHOW_ERROR("File too large. Maximum size is 25MB. Please choose a smaller EPUB file.")

// Invalid file type
SHOW_ERROR("Invalid file type. Please upload an EPUB file (.epub extension).")

// Upload timeout
SHOW_ERROR("Upload timed out. Please try again with a smaller file or better connection.")
```

### User Limits
```javascript
// Too many concurrent users
SHOW_ERROR("This reading session has reached the maximum of 5 users. Please try again later when someone leaves.")

// Session timeout
SHOW_WARNING("Your session has expired due to inactivity. Please refresh the page to continue reading.")
```

### Content Limits
```javascript
// Too many highlights
SHOW_WARNING("You've reached the maximum of 100 highlights. Please delete some highlights before adding new ones.")

// Comment too long
SHOW_ERROR("Comment too long. Maximum 500 characters allowed.")

// Too many comments
SHOW_WARNING("Maximum 5 comments per highlight reached.")
```

## Implementation Strategy

### 1. Frontend Validation
```javascript
// File upload validation
FUNCTION validateFileUpload(file):
  IF file.size > 25 * 1024 * 1024: // 25MB
    RETURN { valid: false, error: "file_too_large" }
  
  IF !file.name.endsWith('.epub'):
    RETURN { valid: false, error: "invalid_file_type" }
  
  RETURN { valid: true }

// User limit checking
FUNCTION checkUserLimit(sessionId):
  currentUsers = GET_ACTIVE_USERS(sessionId)
  IF currentUsers.length >= 5:
    RETURN { allowed: false, error: "user_limit_reached" }
  
  RETURN { allowed: true }
```

### 2. Backend Enforcement
```javascript
// Server-side limits enforcement
FUNCTION enforceMVPLimits():
  // File size check
  IF uploadedFile.size > 25MB:
    REJECT_UPLOAD("File too large")
  
  // User count check
  IF getActiveUserCount(sessionId) >= 5:
    REJECT_NEW_USER("Session full")
  
  // Content limits
  IF getUserHighlightCount(userId, sessionId) >= 100:
    REJECT_HIGHLIGHT("Highlight limit reached")
  
  IF getCommentCount(highlightId) >= 5:
    REJECT_COMMENT("Comment limit reached")
```

### 3. Real-time Limit Monitoring
```javascript
// WebSocket limit monitoring
FUNCTION monitorLimits():
  // Track active users
  activeUsers = TRACK_ACTIVE_USERS(sessionId)
  
  // Notify when approaching limits
  IF activeUsers.length >= 4:
    BROADCAST_WARNING("Session nearly full")
  
  // Enforce user limits
  IF activeUsers.length >= 5:
    REJECT_NEW_CONNECTIONS()
```

## Benefits of These Limits

### 1. Performance Benefits
- **Faster loading**: Smaller files load quicker
- **Lower memory usage**: Prevents browser crashes
- **Reduced server load**: Fewer concurrent users to manage
- **Simpler database**: Smaller datasets to query

### 2. User Experience Benefits
- **Predictable behavior**: Users know what to expect
- **Faster collaboration**: Fewer users means less noise
- **Stable performance**: Consistent experience across sessions
- **Clear feedback**: Users understand limits and constraints

### 3. Development Benefits
- **Easier testing**: Smaller scope to test thoroughly
- **Faster iteration**: Less complexity to debug
- **Proven concepts**: Validate core features before scaling
- **Manageable scope**: Focus on core functionality

## Future Scaling Considerations

### When to Increase Limits
- **File size**: When storage and bandwidth improve
- **User count**: When WebSocket infrastructure is robust
- **Content limits**: When database performance is optimized
- **Feature limits**: When core features are stable

### Scaling Strategy
```javascript
// Gradual limit increases
FUNCTION planScaling():
  PHASE_1: // MVP (current limits)
    fileSize: 25MB
    users: 5
    highlights: 100
  
  PHASE_2: // Early scaling
    fileSize: 50MB
    users: 10
    highlights: 200
  
  PHASE_3: // Full scaling
    fileSize: 100MB
    users: 25
    highlights: 500
```

## Monitoring and Analytics

### Limit Usage Tracking
```javascript
// Track how often limits are hit
FUNCTION trackLimitUsage():
  TRACK_METRIC("file_size_exceeded")
  TRACK_METRIC("user_limit_reached")
  TRACK_METRIC("highlight_limit_reached")
  TRACK_METRIC("comment_limit_reached")
  
  // Use this data to inform scaling decisions
  ANALYZE_LIMIT_USAGE_PATTERNS()
```

### User Feedback Collection
```javascript
// Collect feedback when limits are hit
FUNCTION collectLimitFeedback():
  SHOW_FEEDBACK_FORM("How would you like us to improve these limits?")
  
  // Common feedback options
  OPTIONS = [
    "Increase file size limit",
    "Allow more concurrent users",
    "Allow more highlights",
    "Allow longer comments"
  ]
```

These MVP limits provide a solid foundation for testing the core collaborative features while keeping the system manageable and performant. They can be gradually increased based on user feedback and technical improvements. 