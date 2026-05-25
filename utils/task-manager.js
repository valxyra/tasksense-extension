/**
 * TaskSense - Task Manager
 * CRUD operations untuk task dan folder
 */

import { getAllTasks, getTasksByFolder, getAllFolders, getSettings, setData, clearAll } from './storage.js';
import { generateId, sanitizeTask, sanitizeFolder, validateTask, validateFolder } from './validator.js';

// Storage keys
const STORAGE_KEYS = {
  FOLDERS: 'folders',
  TASKS: 'tasks',
  SETTINGS: 'settings',
  META: 'meta'
};

/**
 * Create a new task
 * @param {Object} payload - Task data
 * @param {string} payload.title - Task title
 * @param {string} [payload.note=''] - Optional note
 * @param {string} [payload.url=null] - Optional URL
 * @param {string} [payload.pageTitle=''] - Page title from content script
 * @param {string} [payload.favicon=null] - Favicon URL
 * @param {string} [payload.domain=''] - Domain extracted from URL
 * @param {string} [payload.folderId=null] - Folder ID
 * @param {string} [payload.priority='medium'] - Priority level
 * @param {Object} [payload.reminder=null] - Reminder config
 * @returns {Promise<Object|null>} Created task or null on error
 */
async function createTask(payload) {
  try {
    const task = sanitizeTask({
      ...payload,
      id: payload.id || generateId('task'),
      createdAt: payload.createdAt || new Date().toISOString(),
      status: payload.status || 'active',
      completedAt: null,
      order: payload.order || 0
    });

    const validation = validateTask(task);
    if (!validation.valid) {
      console.error('Task validation failed:', validation.errors);
      return null;
    }

    const tasks = await getAllTasks();
    tasks.push(task);
    
    await setData(STORAGE_KEYS.TASKS, tasks);
    return task;
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

/**
 * Update an existing task
 * @param {string} taskId - Task ID
 * @param {Object} changes - Fields to update
 * @returns {Promise<Object|null>} Updated task or null on error
 */
async function updateTask(taskId, changes) {
  try {
    const tasks = await getAllTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      console.error(`Task with ID ${taskId} not found`);
      return null;
    }

    // Prevent changing immutable fields
    const immutableFields = ['id', 'createdAt'];
    for (const field of immutableFields) {
      if (changes[field] !== undefined) {
        console.warn(`Cannot change immutable field: ${field}`);
        delete changes[field];
      }
    }

    // Update task
    const updatedTask = { ...tasks[taskIndex], ...changes };
    
    // Validate updated task
    const validation = validateTask(updatedTask);
    if (!validation.valid) {
      console.error('Updated task validation failed:', validation.errors);
      return null;
    }

    tasks[taskIndex] = updatedTask;
    await setData(STORAGE_KEYS.TASKS, tasks);
    return updatedTask;
  } catch (error) {
    console.error(`Error updating task ${taskId}:`, error);
    return null;
  }
}

/**
 * Delete a task
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteTask(taskId) {
  try {
    const tasks = await getAllTasks();
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    
    if (filteredTasks.length === tasks.length) {
      console.warn(`Task with ID ${taskId} not found`);
      return false;
    }
    
    await setData(STORAGE_KEYS.TASKS, filteredTasks);
    return true;
  } catch (error) {
    console.error(`Error deleting task ${taskId}:`, error);
    return false;
  }
}

/**
 * Mark a task as completed
 * @param {string} taskId - Task ID
 * @returns {Promise<Object|null>} Updated task or null on error
 */
async function completeTask(taskId) {
  try {
    const tasks = await getAllTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      console.error(`Task with ID ${taskId} not found`);
      return null;
    }

    const updatedTask = {
      ...tasks[taskIndex],
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;
    await setData(STORAGE_KEYS.TASKS, tasks);
    return updatedTask;
  } catch (error) {
    console.error(`Error completing task ${taskId}:`, error);
    return null;
  }
}

/**
 * Reorder a task within its folder or globally
 * @param {string} taskId - Task ID
 * @param {number} newOrder - New order position
 * @returns {Promise<boolean>} Success status
 */
async function reorderTask(taskId, newOrder) {
  try {
    const tasks = await getAllTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      console.error(`Task with ID ${taskId} not found`);
      return false;
    }

    // Remove task from current position
    const [task] = tasks.splice(taskIndex, 1);
    
    // Clamp newOrder to valid range
    const clampedOrder = Math.max(0, Math.min(newOrder, tasks.length));
    
    // Insert at new position
    tasks.splice(clampedOrder, 0, { ...task, order: clampedOrder });
    
    // Reorder all tasks to ensure sequential order
    const reorderedTasks = tasks.map((t, index) => ({ ...t, order: index }));
    
    await setData(STORAGE_KEYS.TASKS, reorderedTasks);
    return true;
  } catch (error) {
    console.error(`Error reordering task ${taskId}:`, error);
    return false;
  }
}

/**
 * Create a new folder
 * @param {Object} payload - Folder data
 * @param {string} payload.name - Folder name
 * @param {string} [payload.color='#4A90D9'] - Folder color
 * @param {string} [payload.icon='📁'] - Folder icon
 * @returns {Promise<Object|null>} Created folder or null on error
 */
async function createFolder(payload) {
  try {
    const folder = sanitizeFolder({
      ...payload,
      id: payload.id || generateId('folder'),
      createdAt: payload.createdAt || new Date().toISOString(),
      order: payload.order || 0
    });

    const validation = validateFolder(folder);
    if (!validation.valid) {
      console.error('Folder validation failed:', validation.errors);
      return null;
    }

    const folders = await getAllFolders();
    folders.push(folder);
    
    await setData(STORAGE_KEYS.FOLDERS, folders);
    return folder;
  } catch (error) {
    console.error('Error creating folder:', error);
    return null;
  }
}

/**
 * Update an existing folder
 * @param {string} folderId - Folder ID
 * @param {Object} changes - Fields to update
 * @returns {Promise<Object|null>} Updated folder or null on error
 */
async function updateFolder(folderId, changes) {
  try {
    const folders = await getAllFolders();
    const folderIndex = folders.findIndex(f => f.id === folderId);
    
    if (folderIndex === -1) {
      console.error(`Folder with ID ${folderId} not found`);
      return null;
    }

    // Prevent changing immutable fields
    const immutableFields = ['id', 'createdAt'];
    for (const field of immutableFields) {
      if (changes[field] !== undefined) {
        console.warn(`Cannot change immutable field: ${field}`);
        delete changes[field];
      }
    }

    // Update folder
    const updatedFolder = { ...folders[folderIndex], ...changes };
    
    // Validate updated folder
    const validation = validateFolder(updatedFolder);
    if (!validation.valid) {
      console.error('Updated folder validation failed:', validation.errors);
      return null;
    }

    folders[folderIndex] = updatedFolder;
    await setData(STORAGE_KEYS.FOLDERS, folders);
    return updatedFolder;
  } catch (error) {
    console.error(`Error updating folder ${folderId}:`, error);
    return null;
  }
}

/**
 * Delete a folder and optionally move its tasks to another folder
 * @param {string} folderId - Folder ID
 * @param {string|null} moveTasksToFolderId - ID of folder to move tasks to, or null to remove from folder
 * @returns {Promise<boolean>} Success status
 */
async function deleteFolder(folderId, moveTasksToFolderId = null) {
  try {
    const folders = await getAllFolders();
    const folderIndex = folders.findIndex(f => f.id === folderId);
    
    if (folderIndex === -1) {
      console.error(`Folder with ID ${folderId} not found`);
      return false;
    }

    // Remove folder
    folders.splice(folderIndex, 1);
    await setData(STORAGE_KEYS.FOLDERS, folders);

    // Move or remove tasks from deleted folder
    const tasks = await getAllTasks();
    let tasksUpdated = false;
    
    const updatedTasks = tasks.map(task => {
      if (task.folderId === folderId) {
        tasksUpdated = true;
        return {
          ...task,
          folderId: moveTasksToFolderId
        };
      }
      return task;
    });

    if (tasksUpdated) {
      await setData(STORAGE_KEYS.TASKS, updatedTasks);
    }

    return true;
  } catch (error) {
    console.error(`Error deleting folder ${folderId}:`, error);
    return false;
  }
}

/**
 * Get task statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getStats() {
  try {
    const tasks = await getAllTasks();
    const folders = await getAllFolders();
    
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    
    const highPriority = tasks.filter(t => t.priority === 'high' && t.status === 'active').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium' && t.status === 'active').length;
    const lowPriority = tasks.filter(t => t.priority === 'low' && t.status === 'active').length;

    return {
      totalTasks,
      activeTasks,
      completedTasks,
      folders: folders.length,
      highPriority,
      mediumPriority,
      lowPriority
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      totalTasks: 0,
      activeTasks: 0,
      completedTasks: 0,
      folders: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0
    };
  }
}

/**
 * Clear all data (wrapper for storage.clearAll with additional cleanup)
 * @returns {Promise<boolean>} Success status
 */
async function clearAllData() {
  try {
    return await clearAll();
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
}

// Export functions
export {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reorderTask,
  createFolder,
  updateFolder,
  deleteFolder,
  getStats,
  clearAllData
};