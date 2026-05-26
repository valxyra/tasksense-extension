/**
 * TaskSense - Export Manager
 * Generate TXT dan Markdown export dari tasks dan folders
 */

import { getAllTasks, getAllFolders } from './storage.js';

/**
 * Format date untuk display
 * @param {string} isoDate - ISO 8601 date string
 * @returns {string} Formatted date (e.g., "14 Nov 2024")
 */
function formatDate(isoDate) {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '';
  }
}

/**
 * Format datetime untuk header
 * @returns {string} Formatted datetime (e.g., "14 November 2024 10:00")
 */
function formatHeaderDate() {
  const date = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/**
 * Capitalize first letter
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Export tasks to TXT format
 * @returns {Promise<string>} TXT content
 */
async function exportToTxt() {
  try {
    const [tasks, folders] = await Promise.all([getAllTasks(), getAllFolders()]);
    
    let output = 'TASKSENSE — EXPORT\n';
    output += `Generated: ${formatHeaderDate()}\n\n`;
    
    // Group tasks by folder
    const tasksByFolder = {};
    const noFolderTasks = [];
    
    tasks.forEach(task => {
      if (task.folderId) {
        if (!tasksByFolder[task.folderId]) {
          tasksByFolder[task.folderId] = [];
        }
        tasksByFolder[task.folderId].push(task);
      } else {
        noFolderTasks.push(task);
      }
    });
    
    // Export tasks by folder
    folders.forEach(folder => {
      const folderTasks = tasksByFolder[folder.id] || [];
      if (folderTasks.length === 0) return;
      
      output += `=== FOLDER: ${folder.name} ===\n\n`;
      
      folderTasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[✓]' : '[ ]';
        output += `${checkbox} ${task.title}\n`;
        
        if (task.url) {
          output += `    URL  : ${task.url}\n`;
        }
        
        if (task.note) {
          output += `    Note : ${task.note}\n`;
        }
        
        output += `    Prio : ${capitalize(task.priority)}\n`;
        
        if (task.status === 'completed' && task.completedAt) {
          output += `    Selesai: ${formatDate(task.completedAt)}\n`;
        } else {
          output += `    Dibuat: ${formatDate(task.createdAt)}\n`;
        }
        
        if (task.reminder && task.reminder.enabled) {
          output += `    Reminder: ${formatDate(task.reminder.datetime)}\n`;
        }
        
        output += '\n';
      });
    });
    
    // Export tasks without folder
    if (noFolderTasks.length > 0) {
      output += '=== TANPA FOLDER ===\n\n';
      
      noFolderTasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[✓]' : '[ ]';
        output += `${checkbox} ${task.title}\n`;
        
        if (task.url) {
          output += `    URL  : ${task.url}\n`;
        }
        
        if (task.note) {
          output += `    Note : ${task.note}\n`;
        }
        
        output += `    Prio : ${capitalize(task.priority)}\n`;
        
        if (task.status === 'completed' && task.completedAt) {
          output += `    Selesai: ${formatDate(task.completedAt)}\n`;
        } else {
          output += `    Dibuat: ${formatDate(task.createdAt)}\n`;
        }
        
        if (task.reminder && task.reminder.enabled) {
          output += `    Reminder: ${formatDate(task.reminder.datetime)}\n`;
        }
        
        output += '\n';
      });
    }
    
    // Summary
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    
    output += '=== SUMMARY ===\n';
    output += `Total Tasks: ${totalTasks}\n`;
    output += `Active: ${activeTasks}\n`;
    output += `Completed: ${completedTasks}\n`;
    output += `Folders: ${folders.length}\n`;
    
    return output;
  } catch (error) {
    console.error('Error exporting to TXT:', error);
    throw error;
  }
}

/**
 * Export tasks to Markdown format
 * @returns {Promise<string>} Markdown content
 */
async function exportToMarkdown() {
  try {
    const [tasks, folders] = await Promise.all([getAllTasks(), getAllFolders()]);
    
    let output = '# TaskSense — Export\n';
    output += `> Generated: ${formatHeaderDate()}\n\n`;
    output += '---\n\n';
    
    // Group tasks by folder
    const tasksByFolder = {};
    const noFolderTasks = [];
    
    tasks.forEach(task => {
      if (task.folderId) {
        if (!tasksByFolder[task.folderId]) {
          tasksByFolder[task.folderId] = [];
        }
        tasksByFolder[task.folderId].push(task);
      } else {
        noFolderTasks.push(task);
      }
    });
    
    // Export tasks by folder
    folders.forEach(folder => {
      const folderTasks = tasksByFolder[folder.id] || [];
      if (folderTasks.length === 0) return;
      
      output += `## ${folder.icon} ${folder.name}\n\n`;
      
      folderTasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        output += `- ${checkbox} **${task.title}**\n`;
        
        if (task.url) {
          const linkText = task.pageTitle || task.domain || 'Link';
          output += `  - 🔗 [${linkText}](${task.url})\n`;
        }
        
        if (task.note) {
          output += `  - 📝 ${task.note}\n`;
        }
        
        // Priority emoji
        const priorityEmoji = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        };
        output += `  - ${priorityEmoji[task.priority] || '⚪'} Priority: ${capitalize(task.priority)}\n`;
        
        if (task.status === 'completed' && task.completedAt) {
          output += `  - ✅ Completed: ${formatDate(task.completedAt)}\n`;
        } else {
          output += `  - 📅 Created: ${formatDate(task.createdAt)}\n`;
        }
        
        if (task.reminder && task.reminder.enabled) {
          output += `  - ⏰ Reminder: ${formatDate(task.reminder.datetime)}\n`;
        }
        
        output += '\n';
      });
    });
    
    // Export tasks without folder
    if (noFolderTasks.length > 0) {
      output += '## 📋 Tanpa Folder\n\n';
      
      noFolderTasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        output += `- ${checkbox} **${task.title}**\n`;
        
        if (task.url) {
          const linkText = task.pageTitle || task.domain || 'Link';
          output += `  - 🔗 [${linkText}](${task.url})\n`;
        }
        
        if (task.note) {
          output += `  - 📝 ${task.note}\n`;
        }
        
        const priorityEmoji = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        };
        output += `  - ${priorityEmoji[task.priority] || '⚪'} Priority: ${capitalize(task.priority)}\n`;
        
        if (task.status === 'completed' && task.completedAt) {
          output += `  - ✅ Completed: ${formatDate(task.completedAt)}\n`;
        } else {
          output += `  - 📅 Created: ${formatDate(task.createdAt)}\n`;
        }
        
        if (task.reminder && task.reminder.enabled) {
          output += `  - ⏰ Reminder: ${formatDate(task.reminder.datetime)}\n`;
        }
        
        output += '\n';
      });
    }
    
    // Summary
    output += '---\n\n';
    output += '## 📊 Summary\n\n';
    
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    
    output += `- **Total Tasks:** ${totalTasks}\n`;
    output += `- **Active:** ${activeTasks}\n`;
    output += `- **Completed:** ${completedTasks}\n`;
    output += `- **Folders:** ${folders.length}\n`;
    
    return output;
  } catch (error) {
    console.error('Error exporting to Markdown:', error);
    throw error;
  }
}

/**
 * Export tasks to JSON format (for backup/import)
 * @returns {Promise<string>} JSON content
 */
async function exportToJson() {
  try {
    const [tasks, folders, settings] = await Promise.all([
      getAllTasks(),
      getAllFolders(),
      chrome.storage.local.get(['settings'])
    ]);
    
    const exportData = {
      source: 'tasksense',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      folders: folders,
      tasks: tasks,
      settings: settings.settings || {}
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    throw error;
  }
}

/**
 * Download content as file
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Export and download as TXT
 */
async function exportAndDownloadTxt() {
  try {
    const content = await exportToTxt();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `tasksense-export-${timestamp}.txt`;
    downloadFile(content, filename, 'text/plain');
    return true;
  } catch (error) {
    console.error('Error exporting TXT:', error);
    return false;
  }
}

/**
 * Export and download as Markdown
 */
async function exportAndDownloadMarkdown() {
  try {
    const content = await exportToMarkdown();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `tasksense-export-${timestamp}.md`;
    downloadFile(content, filename, 'text/markdown');
    return true;
  } catch (error) {
    console.error('Error exporting Markdown:', error);
    return false;
  }
}

/**
 * Export and download as JSON
 */
async function exportAndDownloadJson() {
  try {
    const content = await exportToJson();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `tasksense-backup-${timestamp}.json`;
    downloadFile(content, filename, 'application/json');
    return true;
  } catch (error) {
    console.error('Error exporting JSON:', error);
    return false;
  }
}

// Export functions
export {
  exportToTxt,
  exportToMarkdown,
  exportToJson,
  exportAndDownloadTxt,
  exportAndDownloadMarkdown,
  exportAndDownloadJson,
  downloadFile
};