/**
 * TaskSense - Import Manager
 * Import data dari JSON backup dengan merge strategy
 */

import { getAllTasks, getAllFolders, setData } from './storage.js';
import { validateTask, validateFolder, sanitizeTask, sanitizeFolder } from './validator.js';

// Storage keys
const STORAGE_KEYS = {
  FOLDERS: 'folders',
  TASKS: 'tasks',
  SETTINGS: 'settings'
};

/**
 * Validate import file structure
 * @param {Object} data - Parsed JSON data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateImportFile(data) {
  const errors = [];
  
  // Check required fields
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format');
    return { valid: false, errors };
  }
  
  if (data.source !== 'tasksense') {
    errors.push('Invalid source. This file is not from TaskSense.');
  }
  
  if (!data.version) {
    errors.push('Missing version field');
  }
  
  if (!data.exportedAt) {
    errors.push('Missing exportedAt field');
  }
  
  // Check data arrays
  if (!Array.isArray(data.folders)) {
    errors.push('folders must be an array');
  }
  
  if (!Array.isArray(data.tasks)) {
    errors.push('tasks must be an array');
  }
  
  if (data.settings && typeof data.settings !== 'object') {
    errors.push('settings must be an object');
  }
  
  // Validate each folder
  if (Array.isArray(data.folders)) {
    data.folders.forEach((folder, index) => {
      const validation = validateFolder(folder);
      if (!validation.valid) {
        errors.push(`Folder ${index}: ${validation.errors.join(', ')}`);
      }
    });
  }
  
  // Validate each task
  if (Array.isArray(data.tasks)) {
    data.tasks.forEach((task, index) => {
      const validation = validateTask(task);
      if (!validation.valid) {
        errors.push(`Task ${index}: ${validation.errors.join(', ')}`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Import data with overwrite strategy
 * Hapus semua data existing, ganti dengan data impor
 * @param {Object} data - Import data
 * @returns {Promise<Object>} Result object
 */
async function importWithOverwrite(data) {
  try {
    const result = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    // Sanitize data
    const sanitizedFolders = data.folders.map(f => sanitizeFolder(f));
    const sanitizedTasks = data.tasks.map(t => sanitizeTask(t));
    
    // Overwrite storage
    await setData(STORAGE_KEYS.FOLDERS, sanitizedFolders);
    await setData(STORAGE_KEYS.TASKS, sanitizedTasks);
    
    if (data.settings) {
      await setData(STORAGE_KEYS.SETTINGS, data.settings);
    }
    
    result.imported = sanitizedFolders.length + sanitizedTasks.length;
    
    return result;
  } catch (error) {
    console.error('Error in importWithOverwrite:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}

/**
 * Import data with merge strategy
 * Gabungkan data, skip jika ID sudah ada (preserve local)
 * @param {Object} data - Import data
 * @returns {Promise<Object>} Result object
 */
async function importWithMerge(data) {
  try {
    const result = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    // Get existing data
    const [existingTasks, existingFolders] = await Promise.all([
      getAllTasks(),
      getAllFolders()
    ]);
    
    // Create ID sets for quick lookup
    const existingFolderIds = new Set(existingFolders.map(f => f.id));
    const existingTaskIds = new Set(existingTasks.map(t => t.id));
    
    // Merge folders (skip if ID exists)
    const newFolders = [];
    data.folders.forEach(folder => {
      if (existingFolderIds.has(folder.id)) {
        result.skipped++;
      } else {
        const sanitized = sanitizeFolder(folder);
        newFolders.push(sanitized);
        result.imported++;
      }
    });
    
    // Merge tasks (skip if ID exists)
    const newTasks = [];
    data.tasks.forEach(task => {
      if (existingTaskIds.has(task.id)) {
        result.skipped++;
      } else {
        const sanitized = sanitizeTask(task);
        newTasks.push(sanitized);
        result.imported++;
      }
    });
    
    // Save merged data
    const mergedFolders = [...existingFolders, ...newFolders];
    const mergedTasks = [...existingTasks, ...newTasks];
    
    await setData(STORAGE_KEYS.FOLDERS, mergedFolders);
    await setData(STORAGE_KEYS.TASKS, mergedTasks);
    
    // Merge settings (preserve local if conflict)
    if (data.settings) {
      const existingSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
      const mergedSettings = {
        ...data.settings,
        ...existingSettings[STORAGE_KEYS.SETTINGS] // Local takes precedence
      };
      await setData(STORAGE_KEYS.SETTINGS, mergedSettings);
    }
    
    return result;
  } catch (error) {
    console.error('Error in importWithMerge:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}

/**
 * Import data with merge_prefer_import strategy
 * Gabungkan data, overwrite jika ID sudah ada (prefer import)
 * @param {Object} data - Import data
 * @returns {Promise<Object>} Result object
 */
async function importWithMergePreferImport(data) {
  try {
    const result = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    // Get existing data
    const [existingTasks, existingFolders] = await Promise.all([
      getAllTasks(),
      getAllFolders()
    ]);
    
    // Create ID maps for quick lookup
    const existingFolderMap = new Map(existingFolders.map(f => [f.id, f]));
    const existingTaskMap = new Map(existingTasks.map(t => [t.id, t]));
    
    // Merge folders (overwrite if ID exists)
    const importFolderIds = new Set();
    data.folders.forEach(folder => {
      const sanitized = sanitizeFolder(folder);
      existingFolderMap.set(folder.id, sanitized);
      importFolderIds.add(folder.id);
      result.imported++;
    });
    
    // Merge tasks (overwrite if ID exists)
    const importTaskIds = new Set();
    data.tasks.forEach(task => {
      const sanitized = sanitizeTask(task);
      existingTaskMap.set(task.id, sanitized);
      importTaskIds.add(task.id);
      result.imported++;
    });
    
    // Convert maps back to arrays
    const mergedFolders = Array.from(existingFolderMap.values());
    const mergedTasks = Array.from(existingTaskMap.values());
    
    await setData(STORAGE_KEYS.FOLDERS, mergedFolders);
    await setData(STORAGE_KEYS.TASKS, mergedTasks);
    
    // Merge settings (import takes precedence)
    if (data.settings) {
      const existingSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
      const mergedSettings = {
        ...existingSettings[STORAGE_KEYS.SETTINGS],
        ...data.settings // Import takes precedence
      };
      await setData(STORAGE_KEYS.SETTINGS, mergedSettings);
    }
    
    return result;
  } catch (error) {
    console.error('Error in importWithMergePreferImport:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}

/**
 * Import data from JSON file
 * @param {File} file - File object from input[type="file"]
 * @param {string} strategy - Import strategy: 'overwrite', 'merge', 'merge_prefer_import'
 * @returns {Promise<Object>} Result object { success, imported, skipped, errors }
 */
async function importData(file, strategy = 'merge') {
  try {
    // Read file
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate file structure
    const validation = validateImportFile(data);
    if (!validation.valid) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: validation.errors
      };
    }
    
    // Execute import based on strategy
    switch (strategy) {
      case 'overwrite':
        return await importWithOverwrite(data);
      
      case 'merge':
        return await importWithMerge(data);
      
      case 'merge_prefer_import':
        return await importWithMergePreferImport(data);
      
      default:
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: [`Unknown strategy: ${strategy}`]
        };
    }
  } catch (error) {
    console.error('Error importing data:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}

/**
 * Read and parse import file (for preview before import)
 * @param {File} file - File object
 * @returns {Promise<Object>} Parsed data or null on error
 */
async function readImportFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const validation = validateImportFile(data);
    if (!validation.valid) {
      console.error('Invalid import file:', validation.errors);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error reading import file:', error);
    return null;
  }
}

/**
 * Get import preview statistics
 * @param {Object} data - Import data
 * @returns {Promise<Object>} Preview stats
 */
async function getImportPreview(data) {
  try {
    const [existingTasks, existingFolders] = await Promise.all([
      getAllTasks(),
      getAllFolders()
    ]);
    
    const existingFolderIds = new Set(existingFolders.map(f => f.id));
    const existingTaskIds = new Set(existingTasks.map(t => t.id));
    
    const newFolders = data.folders.filter(f => !existingFolderIds.has(f.id)).length;
    const existingFoldersCount = data.folders.filter(f => existingFolderIds.has(f.id)).length;
    
    const newTasks = data.tasks.filter(t => !existingTaskIds.has(t.id)).length;
    const existingTasksCount = data.tasks.filter(t => existingTaskIds.has(t.id)).length;
    
    return {
      importFile: {
        totalFolders: data.folders.length,
        totalTasks: data.tasks.length,
        exportedAt: data.exportedAt,
        version: data.version
      },
      current: {
        totalFolders: existingFolders.length,
        totalTasks: existingTasks.length
      },
      preview: {
        newFolders,
        newTasks,
        conflictFolders: existingFoldersCount,
        conflictTasks: existingTasksCount
      }
    };
  } catch (error) {
    console.error('Error getting import preview:', error);
    return null;
  }
}

// Export functions
export {
  importData,
  validateImportFile,
  readImportFile,
  getImportPreview,
  importWithOverwrite,
  importWithMerge,
  importWithMergePreferImport
};