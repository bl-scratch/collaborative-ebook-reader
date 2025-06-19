// Example usage of configurable limits throughout the application

import { 
  getCurrentLimits, 
  LIMIT_VALIDATORS, 
  ERROR_MESSAGES,
  upgradeToPhase 
} from './limits.js';

// Example 1: File Upload Validation
export function validateFileUpload(file) {
  const limits = getCurrentLimits();
  
  // Check file size
  if (!LIMIT_VALIDATORS.validateFileSize(file.size)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.FILE_SIZE_EXCEEDED(limits.FILE.MAX_SIZE_MB)
    };
  }
  
  // Check file type
  if (!LIMIT_VALIDATORS.validateFileType(file.name)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.INVALID_FILE_TYPE(limits.FILE.ALLOWED_TYPES)
    };
  }
  
  return { valid: true };
}

// Example 2: User Session Management
export function checkUserSession(sessionId, currentUserCount) {
  const limits = getCurrentLimits();
  
  // Check if session is full
  if (!LIMIT_VALIDATORS.validateUserCount(currentUserCount)) {
    return {
      allowed: false,
      error: ERROR_MESSAGES.USER_LIMIT_REACHED(limits.USER.MAX_CONCURRENT_PER_SESSION)
    };
  }
  
  return { allowed: true };
}

// Example 3: Content Creation Validation
export function validateHighlightCreation(userId, userHighlightCount) {
  const limits = getCurrentLimits();
  
  if (!LIMIT_VALIDATORS.validateHighlightCount(userHighlightCount)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.HIGHLIGHT_LIMIT_REACHED(limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK)
    };
  }
  
  return { valid: true };
}

export function validateCommentCreation(highlightId, commentText, commentCount) {
  const limits = getCurrentLimits();
  
  // Check comment count
  if (!LIMIT_VALIDATORS.validateCommentCount(commentCount)) {
    return {
      valid: false,
      error: ERROR_MESSAGES.COMMENT_LIMIT_REACHED(limits.CONTENT.COMMENTS.MAX_PER_HIGHLIGHT)
    };
  }
  
  // Check comment length
  if (!LIMIT_VALIDATORS.validateCommentLength(commentText.length)) {
    if (commentText.length > limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS) {
      return {
        valid: false,
        error: ERROR_MESSAGES.COMMENT_TOO_LONG(limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS)
      };
    } else {
      return {
        valid: false,
        error: ERROR_MESSAGES.COMMENT_TOO_SHORT(limits.CONTENT.COMMENTS.MIN_LENGTH_CHARS)
      };
    }
  }
  
  return { valid: true };
}

// Example 4: Performance Monitoring
export function monitorPerformance(epubPageCount, messageRate) {
  const limits = getCurrentLimits();
  
  const warnings = [];
  
  // Check EPUB size
  if (!LIMIT_VALIDATORS.validateEpubPageCount(epubPageCount)) {
    warnings.push(ERROR_MESSAGES.EPUB_TOO_LARGE(limits.PERFORMANCE.EPUB.MAX_PAGES));
  }
  
  // Check message rate
  if (!LIMIT_VALIDATORS.validateMessageRate(messageRate)) {
    warnings.push(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED());
  }
  
  return warnings;
}

// Example 5: WebSocket Connection Management
export function setupWebSocketLimits(socket) {
  const limits = getCurrentLimits();
  
  // Set up rate limiting
  let messageCount = 0;
  let lastReset = Date.now();
  
  socket.on('message', (data) => {
    const now = Date.now();
    
    // Reset counter every second
    if (now - lastReset >= 1000) {
      messageCount = 0;
      lastReset = now;
    }
    
    messageCount++;
    
    if (messageCount > limits.PERFORMANCE.WEBSOCKET.MAX_MESSAGES_PER_SECOND) {
      socket.emit('error', ERROR_MESSAGES.RATE_LIMIT_EXCEEDED());
      return;
    }
    
    // Process message normally
    processMessage(data);
  });
  
  // Set up reconnection
  let reconnectAttempts = 0;
  
  socket.on('disconnect', () => {
    if (reconnectAttempts < limits.PERFORMANCE.WEBSOCKET.RECONNECTION_ATTEMPTS) {
      setTimeout(() => {
        socket.connect();
        reconnectAttempts++;
      }, limits.PERFORMANCE.WEBSOCKET.RECONNECTION_DELAY_MS);
    } else {
      socket.emit('error', ERROR_MESSAGES.WEBSOCKET_ERROR());
    }
  });
}

// Example 6: Database Query Management
export function setupDatabaseLimits() {
  const limits = getCurrentLimits();
  
  return {
    queryTimeout: limits.PERFORMANCE.DATABASE.QUERY_TIMEOUT_MS,
    maxConcurrent: limits.PERFORMANCE.DATABASE.MAX_CONCURRENT_QUERIES,
    connectionTimeout: limits.PERFORMANCE.DATABASE.CONNECTION_TIMEOUT_MS
  };
}

// Example 7: UI Configuration
export function getUIConfig() {
  const limits = getCurrentLimits();
  
  return {
    maxHighlightsVisible: limits.UI.MAX_HIGHLIGHTS_VISIBLE,
    maxCommentsVisible: limits.UI.MAX_COMMENTS_VISIBLE,
    autoSaveInterval: limits.UI.AUTO_SAVE_INTERVAL_MS,
    debounceDelay: limits.UI.DEBOUNCE_DELAY_MS,
    tooltipDisplayTime: limits.UI.TOOLTIP_DISPLAY_TIME_MS
  };
}

// Example 8: Feature Flags
export function getFeatureFlags() {
  const limits = getCurrentLimits();
  
  return {
    realTimeCollaboration: limits.FEATURES.REAL_TIME_COLLABORATION,
    offlineSupport: limits.FEATURES.OFFLINE_SUPPORT,
    exportFeatures: limits.FEATURES.EXPORT_FEATURES,
    advancedNavigation: limits.FEATURES.ADVANCED_NAVIGATION,
    searchFunctionality: limits.FEATURES.SEARCH_FUNCTIONALITY,
    bookmarking: limits.FEATURES.BOOKMARKING,
    notesFeature: limits.FEATURES.NOTES_FEATURE
  };
}

// Example 9: Scaling Management
export function handleScalingUpgrade() {
  // Example: Upgrade from MVP to Phase 2
  try {
    const newLimits = upgradeToPhase('PHASE_2');
    console.log('Successfully upgraded to Phase 2');
    console.log('New file size limit:', newLimits.FILE.MAX_SIZE_MB, 'MB');
    console.log('New user limit:', newLimits.USER.MAX_CONCURRENT_PER_SESSION);
    return newLimits;
  } catch (error) {
    console.error('Failed to upgrade:', error.message);
    return null;
  }
}

// Example 10: Environment-specific Configuration
export function getEnvironmentConfig() {
  const environment = process.env.NODE_ENV || 'production';
  const limits = getCurrentLimits(environment);
  
  console.log(`Running in ${environment} mode with limits:`, {
    fileSize: limits.FILE.MAX_SIZE_MB + 'MB',
    users: limits.USER.MAX_CONCURRENT_PER_SESSION,
    highlights: limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK
  });
  
  return limits;
}

// Example 11: Storage Management
export function setupStorageLimits() {
  const limits = getCurrentLimits();
  
  return {
    maxFiles: limits.STORAGE.MAX_EPUB_FILES,
    maxFileAge: limits.STORAGE.MAX_FILE_AGE_DAYS,
    maxDatabaseSize: limits.STORAGE.MAX_DATABASE_SIZE_MB,
    backupRetention: limits.STORAGE.BACKUP_RETENTION_DAYS
  };
}

// Example 12: Session Timeout Management
export function setupSessionTimeout() {
  const limits = getCurrentLimits();
  
  // Set up session timeout
  setInterval(() => {
    const now = Date.now();
    const inactiveUsers = getInactiveUsers(now - limits.USER.SESSION_TIMEOUT_MS);
    
    inactiveUsers.forEach(user => {
      user.socket.emit('timeout', ERROR_MESSAGES.SESSION_TIMEOUT());
      user.socket.disconnect();
    });
  }, 60000); // Check every minute
  
  // Set up profile cleanup
  setInterval(() => {
    const now = Date.now();
    const expiredProfiles = getExpiredProfiles(now - limits.USER.PROFILE_PERSISTENCE_MS);
    
    expiredProfiles.forEach(profile => {
      deleteUserProfile(profile.id);
    });
  }, 3600000); // Check every hour
}

// Helper functions (these would be implemented in your actual application)
function processMessage(data) {
  // Process WebSocket message
}

function getInactiveUsers(since) {
  // Get users inactive since timestamp
  return [];
}

function getExpiredProfiles(since) {
  // Get profiles expired since timestamp
  return [];
}

function deleteUserProfile(profileId) {
  // Delete user profile
}

function getInactiveUsers(since) {
  // Get users inactive since timestamp
  return [];
}

function getExpiredProfiles(since) {
  // Get profiles expired since timestamp
  return [];
}

function deleteUserProfile(profileId) {
  // Delete user profile
} 