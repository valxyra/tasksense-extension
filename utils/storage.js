/**
 * TaskSense - Storage Utility
 * Abstraksi semua operasi chrome.storage.local dengan migrasi data
 */

import { getDefaultSettings, getDefaultMeta, validateTask, validateFolder, validateSettings, sanitizeTask, sanitizeFolder } from './validator.js';

// Constants
const STORAGE_KEYS = {
  FOLDERS: 'folders',
  TASKS: 'tasks',
  SETTINGS: 'settings',
  META: 'meta'
};

const CURRENT_DATA_VERSION = '1.0.0';

/**
 * Get default data structure
 */
function getDefaultData() {
  return {
    folders: [],
    tasks: [],
    settings: getDefaultSettings(),
    meta: getDefaultMeta()
  };
}

/**
 * Data migrations - run sequentially when version mismatch
 */
const MIGRATIONS = {
  // Example migration from hypothetical v0.9.0 to v1.0.0
  '0.9.0_to_1.0.0': async (data) => {
    // Add domainTag field to existing tasks if missing
    if (Array.isArray(data.tasks)) {
      data.tasks = data.tasks.map(task => ({
        ...task,
        domainTag: task.domainTag || 'Link' // Default value for new field
      }));
    }
    return data;
  }
};

/**
 * Migrate data to current version
 * @param {Object} data - Raw data from storage
 * @returns {Promise<Object>} Migrated data
 */
async function migrateData(data) {
  try {
    const currentVersion = data.meta?.version || '0.0.0';
    
    // If already current version, no migration needed
    if (currentVersion === CURRENT_DATA_VERSION) {
      return data;
    }
    
    console.log(`Migrating data from version ${currentVersion} to ${CURRENT_DATA_VERSION}`);
    
    // Start with validated default structure
    let migratedData = { ...getDefaultData() };
    
    // Preserve existing data where possible
    if (Array.isArray(data.folders)) {
      migratedData.folders = data.folders;
    }
    if (Array.isArray(data.tasks)) {
      migratedData.tasks = data.tasks;
    }
    if (data.settings && typeof data.settings === 'object') {
      migratedData.settings = { ...migratedData.settings, ...data.settings };
    }
    if (data.meta && typeof data.meta === 'object') {
      migratedData.meta = { ...migratedData.meta, ...data.meta };
    }
    
    // Apply migrations in sequence (sorted by version)
    const migrationKeys = Object.keys(MIGRATIONS).sort();
    for (const migrationKey of migrationKeys) {
      const [fromVersion] = migrationKey.split('_to_');
      if (isVersionGreaterThanOrEqual(currentVersion, fromVersion)) {
        console.log(`Applying migration: ${migrationKey}`);
        migratedData = await MIGRATIONS[migrationKey](migratedData);
      }
    }
    
    // Ensure meta version is current
    migratedData.meta.version = CURRENT_DATA_VERSION;
    migratedData.meta.installedAt = migratedData.meta.installedAt || new Date().toISOString();
    
    return migratedData;
  } catch (error) {
    console.error('Error during data migration:', error);
    // Fallback to default data on migration failure
    return getDefaultData();
  }
}

/**
 * Compare semantic versions (simplified)
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 >= version2
 */
function isVersionGreaterThanOrEqual(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    if (v1 > v2) return true;
    if (v1 < v2) return false;
  }
  return true; // equal
}

/**
 * Get data by key with migration
 * @param {string} key - Storage key
 * @returns {Promise<any>} Data or null if not found
 */
async function getData(key) {
  try {
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    
    if (value === undefined) {
      return null;
    }
    
    // Apply validation/sanitization based on key
    switch (key) {
      case STORAGE_KEYS.FOLDERS:
        if (Array.isArray(value)) {
          return value.map(folder => sanitizeFolder(folder)).filter(folder => validateFolder(folder).valid);
        }
        break;
      case STORAGE_KEYS.TASKS:
        if (Array.isArray(value)) {
          return value.map(task => sanitizeTask(task)).filter(task => validateTask(task).valid);
        }
        break;
      case STORAGE_KEYS.SETTINGS:
        if (value && typeof value === 'object') {
          const validated = validateSettings(value);
          if (validated.valid) {
            return value;
          }
        }
        break;
      case STORAGE_KEYS.META:
        if (value && typeof value === 'object') {
          return value;
        }
        break;
      default:
        return value;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting data for key ${key}:`, error);
    return null;
  }
}

/**
 * Set data by key with validation
 * @param {string} key - Storage key
 * @param {any} value - Data to store
 * @returns {Promise<boolean>} Success status
 */
async function setData(key, value) {
  try {
    // Validate/sanitize before storage
    let validatedValue = value;
    
    switch (key) {
      case STORAGE_KEYS.FOLDERS:
        if (Array.isArray(value)) {
          validatedValue = value
            .map(folder => sanitizeFolder(folder))
            .filter(folder => validateFolder(folder).valid);
        } else {
          throw new Error('Folders must be an array');
        }
        break;
      case STORAGE_KEYS.TASKS:
        if (Array.isArray(value)) {
          validatedValue = value
            .map(task => sanitizeTask(task))
            .filter(task => validateTask(task).valid);
        } else {
          throw new Error('Tasks must be an array');
        }
        break;
      case STORAGE_KEYS.SETTINGS:
        if (value && typeof value === 'object') {
          const validation = validateSettings(value);
          if (!validation.valid) {
            throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
          }
          validatedValue = value;
        } else {
          throw new Error('Settings must be an object');
        }
        break;
      case STORAGE_KEYS.META:
        if (value && typeof value === 'object') {
          validatedValue = value;
        } else {
          throw new Error('Meta must be an object');
        }
        break;
      default:
        // No validation for other keys
        break;
    }
    
    const obj = {};
    obj[key] = validatedValue;
    await chrome.storage.local.set(obj);
    return true;
  } catch (error) {
    console.error(`Error setting data for key ${key}:`, error);
    return false;
  }
}

/**
 * Get all tasks with sorting based on settings
 * @returns {Promise<Array>} Sorted tasks array
 */
async function getAllTasks() {
  try {
    const [tasks, settings] = await Promise.all([
      getData(STORAGE_KEYS.TASKS),
      getData(STORAGE_KEYS.SETTINGS)
    ]);
    
    if (!Array.isArray(tasks)) {
      return [];
    }
    
    const sortBy = settings && settings.display ? settings.display.taskSortBy : 'createdAt';
    const sortOrder = settings && settings.display ? settings.display.taskSortOrder : 'desc';
    
    return [...tasks].sort((a, b) => {
      let valueA = a[sortBy];
      let valueB = b[sortBy];
      
      // Handle date strings
      if (sortBy === 'createdAt' || sortBy === 'completedAt') {
        valueA = valueA ? new Date(valueA).getTime() : 0;
        valueB = valueB ? new Date(valueB).getTime() : 0;
      }
      
      if (sortOrder === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  } catch (error) {
    console.error('Error getting all tasks:', error);
    return [];
  }
}

/**
 * Get tasks by folder ID
 * @param {string} folderId - Folder ID
 * @returns {Promise<Array>} Tasks in folder
 */
async function getTasksByFolder(folderId) {
  try {
    const tasks = await getAllTasks();
    if (!folderId) {
      return tasks.filter(task => !task.folderId);
    }
    return tasks.filter(task => task.folderId === folderId);
  } catch (error) {
    console.error(`Error getting tasks for folder ${folderId}:`, error);
    return [];
  }
}

/**
 * Get all folders with order
 * @returns {Promise<Array>} Sorted folders array
 */
async function getAllFolders() {
  try {
    const folders = await getData(STORAGE_KEYS.FOLDERS);
    if (!Array.isArray(folders)) {
      return [];
    }
    
    return [...folders].sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error('Error getting all folders:', error);
    return [];
  }
}

/**
 * Get settings with fallback to defaults
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  try {
    const settings = await getData(STORAGE_KEYS.SETTINGS);
    if (settings && typeof settings === 'object') {
      // Merge with defaults to ensure all fields exist
      const defaults = getDefaultSettings();
      return { ...defaults, ...settings };
    }
    return getDefaultSettings();
  } catch (error) {
    console.error('Error getting settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Get meta data
 * @returns {Promise<Object>} Meta object
 */
async function getMeta() {
  try {
    const meta = await getData(STORAGE_KEYS.META);
    if (meta && typeof meta === 'object') {
      return meta;
    }
    return getDefaultMeta();
  } catch (error) {
    console.error('Error getting meta:', error);
    return getDefaultMeta();
  }
}

/**
 * Clear all data
 * @returns {Promise<boolean>} Success status
 */
async function clearAll() {
  try {
    await chrome.storage.local.clear();
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
}

// Export functions
export {
  getData,
  setData,
  getAllTasks,
  getTasksByFolder,
  getAllFolders,
  getSettings,
  getMeta,
  clearAll,
  migrateData // For use in service worker
};