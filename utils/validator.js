/**
 * TaskSense - Data Validation Layer
 * Validasi skema data untuk task, folder, dan settings
 */

// Regex patterns
const PATTERNS = {
  ID: /^(task|folder)_[a-z0-9_]+$/,
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,
  URL: /^https?:\/\/.+/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
};

// Valid enum values
const ENUMS = {
  PRIORITY: ['low', 'medium', 'high'],
  STATUS: ['active', 'completed'],
  THEME: ['light', 'dark'],
  SORT_BY: ['createdAt', 'priority', 'title'],
  SORT_ORDER: ['asc', 'desc']
};

// Default values
const DEFAULTS = {
  TASK: {
    priority: 'medium',
    status: 'active',
    note: '',
    url: null,
    pageTitle: '',
    favicon: null,
    domain: '',
    domainTag: 'Link',
    folderId: null,
    reminder: null,
    completedAt: null,
    order: 0
  },
  FOLDER: {
    color: '#4A90D9',
    icon: '📁',
    order: 0
  },
  SETTINGS: {
    theme: 'light',
    defaultFolderId: null,
    defaultPriority: 'medium',
    browserStartupReminder: {
      enabled: true,
      showPendingCount: true
    },
    notifications: {
      enabled: true,
      sound: false
    },
    display: {
      showFavicon: true,
      showDomainTag: true,
      taskSortBy: 'createdAt',
      taskSortOrder: 'desc'
    }
  },
  META: {
    version: '1.0.0',
    installedAt: null,
    lastBackupAt: null,
    totalTasksCreated: 0,
    totalTasksCompleted: 0
  }
};

/**
 * Helper: Check if string is non-empty after trimming
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Helper: Check if value is valid ISO 8601 date string
 */
function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  return PATTERNS.ISO_DATE.test(value);
}

/**
 * Sanitize favicon URL - prevent XSS
 */
function sanitizeFaviconUrl(favicon) {
  if (!favicon) return null;
  if (typeof favicon !== 'string') return null;
  
  try {
    const url = new URL(favicon);
    // Only allow http/https protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return favicon;
  } catch {
    return null;
  }
}

/**
 * Sanitize and validate URL
 */
function sanitizeUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  
  try {
    const parsedUrl = new URL(url);
    // Only allow http/https protocol
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  if (!url) return '';
  
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return '';
  }
}

/**
 * Generate unique ID
 */
function generateId(prefix) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validate task object
 * @param {object} task - Task object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTask(task) {
  const errors = [];

  if (!task || typeof task !== 'object') {
    return { valid: false, errors: ['Task must be an object'] };
  }

  // ID validation
  if (!task.id || !PATTERNS.ID.test(task.id) || !task.id.startsWith('task_')) {
    errors.push('Invalid task ID format. Expected: task_timestamp_random');
  }

  // Title validation
  if (!isNonEmptyString(task.title)) {
    errors.push('Title is required and must be a non-empty string');
  } else if (task.title.length > 120) {
    errors.push('Title must be 120 characters or less');
  }

  // Note validation
  if (task.note !== undefined && task.note !== null) {
    if (typeof task.note !== 'string') {
      errors.push('Note must be a string');
    } else if (task.note.length > 500) {
      errors.push('Note must be 500 characters or less');
    }
  }

  // Priority validation
  if (!ENUMS.PRIORITY.includes(task.priority)) {
    errors.push(`Priority must be one of: ${ENUMS.PRIORITY.join(', ')}`);
  }

  // Status validation
  if (!ENUMS.STATUS.includes(task.status)) {
    errors.push(`Status must be one of: ${ENUMS.STATUS.join(', ')}`);
  }

  // URL validation (optional)
  if (task.url !== undefined && task.url !== null) {
    const sanitizedUrl = sanitizeUrl(task.url);
    if (!sanitizedUrl) {
      errors.push('URL must be a valid http/https URL or null');
    }
  }

  // CreatedAt validation
  if (!isValidISODate(task.createdAt)) {
    errors.push('CreatedAt must be a valid ISO 8601 date string');
  }

  // CompletedAt validation (optional)
  if (task.completedAt !== undefined && task.completedAt !== null) {
    if (!isValidISODate(task.completedAt)) {
      errors.push('CompletedAt must be a valid ISO 8601 date string or null');
    }
  }

  // Order validation
  if (typeof task.order !== 'number' || task.order < 0 || !Number.isInteger(task.order)) {
    errors.push('Order must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate folder object
 * @param {object} folder - Folder object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFolder(folder) {
  const errors = [];

  if (!folder || typeof folder !== 'object') {
    return { valid: false, errors: ['Folder must be an object'] };
  }

  // ID validation
  if (!folder.id || !PATTERNS.ID.test(folder.id) || !folder.id.startsWith('folder_')) {
    errors.push('Invalid folder ID format. Expected: folder_timestamp_random');
  }

  // Name validation
  if (!isNonEmptyString(folder.name)) {
    errors.push('Name is required and must be a non-empty string');
  } else if (folder.name.length > 50) {
    errors.push('Name must be 50 characters or less');
  }

  // Color validation
  if (!PATTERNS.HEX_COLOR.test(folder.color)) {
    errors.push('Color must be a valid hex color (e.g., #4A90D9)');
  }

  // Icon validation (should be single emoji or character)
  if (typeof folder.icon !== 'string' || folder.icon.length === 0) {
    errors.push('Icon must be a non-empty string');
  }

  // CreatedAt validation
  if (!isValidISODate(folder.createdAt)) {
    errors.push('CreatedAt must be a valid ISO 8601 date string');
  }

  // Order validation
  if (typeof folder.order !== 'number' || folder.order < 0 || !Number.isInteger(folder.order)) {
    errors.push('Order must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate settings object
 * @param {object} settings - Settings object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSettings(settings) {
  const errors = [];

  if (!settings || typeof settings !== 'object') {
    return { valid: false, errors: ['Settings must be an object'] };
  }

  // Theme validation
  if (!ENUMS.THEME.includes(settings.theme)) {
    errors.push(`Theme must be one of: ${ENUMS.THEME.join(', ')}`);
  }

  // Default priority validation
  if (!ENUMS.PRIORITY.includes(settings.defaultPriority)) {
    errors.push(`Default priority must be one of: ${ENUMS.PRIORITY.join(', ')}`);
  }

  // Display settings validation
  if (settings.display) {
    if (!ENUMS.SORT_BY.includes(settings.display.taskSortBy)) {
      errors.push(`taskSortBy must be one of: ${ENUMS.SORT_BY.join(', ')}`);
    }
    if (!ENUMS.SORT_ORDER.includes(settings.display.taskSortOrder)) {
      errors.push(`taskSortOrder must be one of: ${ENUMS.SORT_ORDER.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize task object - remove disallowed fields, set defaults
 * @param {object} task - Task object to sanitize
 * @returns {object} Sanitized task object
 */
function sanitizeTask(task) {
  const sanitized = {
    id: task.id || generateId('task'),
    title: typeof task.title === 'string' ? task.title.trim().slice(0, 120) : '',
    note: typeof task.note === 'string' ? task.note.slice(0, 500) : '',
    url: sanitizeUrl(task.url),
    pageTitle: typeof task.pageTitle === 'string' ? task.pageTitle.slice(0, 200) : '',
    favicon: sanitizeFaviconUrl(task.favicon),
    domain: typeof task.domain === 'string' ? task.domain : '',
    domainTag: typeof task.domainTag === 'string' ? task.domainTag : 'Link',
    folderId: typeof task.folderId === 'string' ? task.folderId : null,
    priority: ENUMS.PRIORITY.includes(task.priority) ? task.priority : DEFAULTS.TASK.priority,
    status: ENUMS.STATUS.includes(task.status) ? task.status : DEFAULTS.TASK.status,
    reminder: task.reminder || null,
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null,
    order: typeof task.order === 'number' ? task.order : DEFAULTS.TASK.order
  };

  return sanitized;
}

/**
 * Sanitize folder object - remove disallowed fields, set defaults
 * @param {object} folder - Folder object to sanitize
 * @returns {object} Sanitized folder object
 */
function sanitizeFolder(folder) {
  const sanitized = {
    id: folder.id || generateId('folder'),
    name: typeof folder.name === 'string' ? folder.name.trim().slice(0, 50) : 'Untitled',
    color: PATTERNS.HEX_COLOR.test(folder.color) ? folder.color : DEFAULTS.FOLDER.color,
    icon: typeof folder.icon === 'string' ? folder.icon : DEFAULTS.FOLDER.icon,
    createdAt: folder.createdAt || new Date().toISOString(),
    order: typeof folder.order === 'number' ? folder.order : DEFAULTS.FOLDER.order
  };

  return sanitized;
}

/**
 * Get default settings
 * @returns {object} Default settings object
 */
function getDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULTS.SETTINGS));
}

/**
 * Get default meta
 * @returns {object} Default meta object
 */
function getDefaultMeta() {
  return {
    ...DEFAULTS.META,
    installedAt: new Date().toISOString()
  };
}

// Export functions
export {
  // Validation
  validateTask,
  validateFolder,
  validateSettings,
  
  // Sanitization
  sanitizeTask,
  sanitizeFolder,
  sanitizeUrl,
  sanitizeFaviconUrl,
  
  // Utilities
  extractDomain,
  generateId,
  getDefaultSettings,
  getDefaultMeta,
  
  // Constants
  PATTERNS,
  ENUMS,
  DEFAULTS
};