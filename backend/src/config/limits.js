// MVP Limits Configuration - Collaborative E-Book Reader
// All limits are defined as variables for easy scaling

export const MVP_LIMITS = {
  // File Upload Limits
  FILE: {
    MAX_SIZE_MB: 25,
    MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25MB in bytes
    ALLOWED_TYPES: ['.epub'],
    UPLOAD_TIMEOUT_MS: 60000, // 60 seconds
    VALIDATE_EPUB_STRUCTURE: true
  },

  // User Limits
  USER: {
    MAX_CONCURRENT_PER_SESSION: 5,
    SESSION_TIMEOUT_MINUTES: 30,
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes in milliseconds
    PROFILE_PERSISTENCE_HOURS: 24,
    PROFILE_PERSISTENCE_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    REQUIRE_AUTHENTICATION: false, // Anonymous users only for MVP
    MAX_SESSIONS_PER_USER: 1 // One active session per user
  },

  // Content Limits
  CONTENT: {
    HIGHLIGHTS: {
      MAX_PER_USER_PER_BOOK: 100,
      MAX_PER_PAGE: 50,
      MIN_TEXT_LENGTH: 1, // Minimum characters for a highlight
      MAX_TEXT_LENGTH: 1000 // Maximum characters for a highlight
    },
    COMMENTS: {
      MAX_PER_HIGHLIGHT: 5,
      MAX_LENGTH_CHARS: 500,
      MIN_LENGTH_CHARS: 1,
      MAX_REPLY_DEPTH: 2 // comment → reply → reply to reply
    },
    REPLIES: {
      MAX_PER_COMMENT: 10,
      MAX_LENGTH_CHARS: 300,
      MIN_LENGTH_CHARS: 1
    }
  },

  // Performance Limits
  PERFORMANCE: {
    EPUB: {
      MAX_PAGES: 1000,
      MAX_MEMORY_MB: 50,
      MAX_MEMORY_BYTES: 50 * 1024 * 1024,
      RENDER_TIMEOUT_MS: 30000, // 30 seconds to render
      PARSE_TIMEOUT_MS: 15000 // 15 seconds to parse
    },
    WEBSOCKET: {
      MAX_MESSAGES_PER_SECOND: 10,
      MAX_MESSAGE_SIZE_BYTES: 1024 * 1024, // 1MB per message
      RECONNECTION_ATTEMPTS: 5,
      RECONNECTION_DELAY_MS: 1000
    },
    DATABASE: {
      QUERY_TIMEOUT_MS: 5000, // 5 seconds
      MAX_CONCURRENT_QUERIES: 10,
      CONNECTION_TIMEOUT_MS: 10000
    },
    API: {
      RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
      RATE_LIMIT_WINDOW_MS: 60000 // 1 minute
    }
  },

  // Feature Limits
  FEATURES: {
    REAL_TIME_COLLABORATION: true,
    OFFLINE_SUPPORT: false,
    EXPORT_FEATURES: false,
    ADVANCED_NAVIGATION: false,
    SEARCH_FUNCTIONALITY: false,
    BOOKMARKING: false,
    NOTES_FEATURE: false
  },

  // UI/UX Limits
  UI: {
    MAX_HIGHLIGHTS_VISIBLE: 50, // Show only 50 highlights at once
    MAX_COMMENTS_VISIBLE: 20, // Show only 20 comments at once
    AUTO_SAVE_INTERVAL_MS: 5000, // Auto-save every 5 seconds
    DEBOUNCE_DELAY_MS: 300, // Debounce user input
    TOOLTIP_DISPLAY_TIME_MS: 3000 // How long to show tooltips
  },

  // Storage Limits
  STORAGE: {
    MAX_EPUB_FILES: 100, // Maximum EPUB files stored on server
    MAX_FILE_AGE_DAYS: 30, // Delete files older than 30 days
    MAX_DATABASE_SIZE_MB: 1000, // Maximum database size
    BACKUP_RETENTION_DAYS: 7 // Keep backups for 7 days
  }
};

// Environment-specific overrides
export const ENVIRONMENT_OVERRIDES = {
  development: {
    FILE: {
      MAX_SIZE_MB: 50, // Larger files for testing
      UPLOAD_TIMEOUT_MS: 120000 // 2 minutes for testing
    },
    USER: {
      MAX_CONCURRENT_PER_SESSION: 10 // More users for testing
    },
    PERFORMANCE: {
      DATABASE: {
        QUERY_TIMEOUT_MS: 10000 // Longer timeout for development
      }
    }
  },
  
  testing: {
    FILE: {
      MAX_SIZE_MB: 10, // Smaller files for faster tests
      UPLOAD_TIMEOUT_MS: 30000 // 30 seconds for tests
    },
    USER: {
      MAX_CONCURRENT_PER_SESSION: 3 // Fewer users for tests
    },
    CONTENT: {
      HIGHLIGHTS: {
        MAX_PER_USER_PER_BOOK: 10 // Fewer highlights for tests
      }
    }
  },
  
  production: {
    // Use default MVP_LIMITS values
  }
};

// Helper function to get current limits based on environment
export function getCurrentLimits(environment = 'production') {
  const baseLimits = { ...MVP_LIMITS };
  const overrides = ENVIRONMENT_OVERRIDES[environment] || {};
  
  // Deep merge overrides with base limits
  return deepMerge(baseLimits, overrides);
}

// Deep merge utility function
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Validation functions for limits
export const LIMIT_VALIDATORS = {
  // File validation
  validateFileSize: (fileSizeBytes) => {
    const limits = getCurrentLimits();
    return fileSizeBytes <= limits.FILE.MAX_SIZE_BYTES;
  },

  validateFileType: (fileName) => {
    const limits = getCurrentLimits();
    return limits.FILE.ALLOWED_TYPES.some(type => fileName.endsWith(type));
  },

  // User validation
  validateUserCount: (currentUserCount) => {
    const limits = getCurrentLimits();
    return currentUserCount < limits.USER.MAX_CONCURRENT_PER_SESSION;
  },

  validateSessionTimeout: (lastActivityTime) => {
    const limits = getCurrentLimits();
    const now = Date.now();
    return (now - lastActivityTime) < limits.USER.SESSION_TIMEOUT_MS;
  },

  // Content validation
  validateHighlightCount: (userHighlightCount) => {
    const limits = getCurrentLimits();
    return userHighlightCount < limits.CONTENT.HIGHLIGHTS.MAX_PER_USER_PER_BOOK;
  },

  validateCommentCount: (highlightCommentCount) => {
    const limits = getCurrentLimits();
    return highlightCommentCount < limits.CONTENT.COMMENTS.MAX_PER_HIGHLIGHT;
  },

  validateCommentLength: (commentLength) => {
    const limits = getCurrentLimits();
    return commentLength >= limits.CONTENT.COMMENTS.MIN_LENGTH_CHARS && 
           commentLength <= limits.CONTENT.COMMENTS.MAX_LENGTH_CHARS;
  },

  // Performance validation
  validateEpubPageCount: (pageCount) => {
    const limits = getCurrentLimits();
    return pageCount <= limits.PERFORMANCE.EPUB.MAX_PAGES;
  },

  validateMessageRate: (messagesPerSecond) => {
    const limits = getCurrentLimits();
    return messagesPerSecond <= limits.PERFORMANCE.WEBSOCKET.MAX_MESSAGES_PER_SECOND;
  }
};

// Error message templates
export const ERROR_MESSAGES = {
  FILE_SIZE_EXCEEDED: (maxSize) => 
    `File too large. Maximum size is ${maxSize}MB. Please choose a smaller EPUB file.`,
  
  INVALID_FILE_TYPE: (allowedTypes) => 
    `Invalid file type. Please upload one of: ${allowedTypes.join(', ')}`,
  
  UPLOAD_TIMEOUT: () => 
    'Upload timed out. Please try again with a smaller file or better connection.',
  
  USER_LIMIT_REACHED: (maxUsers) => 
    `This reading session has reached the maximum of ${maxUsers} users. Please try again later when someone leaves.`,
  
  SESSION_TIMEOUT: () => 
    'Your session has expired due to inactivity. Please refresh the page to continue reading.',
  
  HIGHLIGHT_LIMIT_REACHED: (maxHighlights) => 
    `You've reached the maximum of ${maxHighlights} highlights. Please delete some highlights before adding new ones.`,
  
  COMMENT_LIMIT_REACHED: (maxComments) => 
    `Maximum ${maxComments} comments per highlight reached.`,
  
  COMMENT_TOO_LONG: (maxLength) => 
    `Comment too long. Maximum ${maxLength} characters allowed.`,
  
  COMMENT_TOO_SHORT: (minLength) => 
    `Comment too short. Minimum ${minLength} characters required.`,
  
  REPLY_DEPTH_EXCEEDED: (maxDepth) => 
    `Maximum reply depth of ${maxDepth} levels reached.`,
  
  EPUB_TOO_LARGE: (maxPages) => 
    `EPUB has too many pages (${maxPages} maximum). Please choose a smaller book.`,
  
  RATE_LIMIT_EXCEEDED: () => 
    'Too many requests. Please slow down and try again.',
  
  DATABASE_TIMEOUT: () => 
    'Database operation timed out. Please try again.',
  
  WEBSOCKET_ERROR: () => 
    'Connection error. Please refresh the page to reconnect.'
};

// Scaling configuration for future phases
export const SCALING_PHASES = {
  PHASE_1: { // MVP (current)
    FILE: { MAX_SIZE_MB: 25 },
    USER: { MAX_CONCURRENT_PER_SESSION: 5 },
    CONTENT: { HIGHLIGHTS: { MAX_PER_USER_PER_BOOK: 100 } }
  },
  
  PHASE_2: { // Early scaling
    FILE: { MAX_SIZE_MB: 50 },
    USER: { MAX_CONCURRENT_PER_SESSION: 10 },
    CONTENT: { HIGHLIGHTS: { MAX_PER_USER_PER_BOOK: 200 } },
    PERFORMANCE: { EPUB: { MAX_PAGES: 2000 } }
  },
  
  PHASE_3: { // Full scaling
    FILE: { MAX_SIZE_MB: 100 },
    USER: { MAX_CONCURRENT_PER_SESSION: 25 },
    CONTENT: { HIGHLIGHTS: { MAX_PER_USER_PER_BOOK: 500 } },
    PERFORMANCE: { EPUB: { MAX_PAGES: 5000 } },
    FEATURES: { 
      OFFLINE_SUPPORT: true,
      EXPORT_FEATURES: true,
      ADVANCED_NAVIGATION: true
    }
  }
};

// Function to upgrade to a new scaling phase
export function upgradeToPhase(phaseName) {
  const phase = SCALING_PHASES[phaseName];
  if (!phase) {
    throw new Error(`Unknown scaling phase: ${phaseName}`);
  }
  
  // Deep merge the phase configuration with current limits
  const newLimits = deepMerge(MVP_LIMITS, phase);
  
  // Here you would typically update the configuration in your database
  // or configuration management system
  console.log(`Upgraded to ${phaseName} with new limits:`, newLimits);
  
  return newLimits;
}

// Export default configuration
export default MVP_LIMITS; 