/**
 * TaskSense Popup Logic
 * Handle UI interactions, event listeners, and rendering
 */

import { createTask, updateTask, deleteTask, completeTask, reorderTask, createFolder } from '../utils/task-manager.js';
import { getAllTasks, getAllFolders, getSettings } from '../utils/storage.js';
import { getDomainTag } from '../utils/domain-tagger.js';
import { createReminder, clearReminder } from '../utils/reminder-manager.js';
import { searchTasks } from '../utils/search.js';

// State
let tasks = [];
let folders = [];
let settings = {};
let currentFolderId = null;
let searchQuery = '';

// Reminder state
let reminderEnabled = false;
let reminderDatetime = '';

// DOM Elements
const elements = {
  popupContainer: document.getElementById('popup-container'),
  searchInput: document.getElementById('search-input'),
  taskTitleInput: document.getElementById('task-title'),
  quickAddFavicon: document.getElementById('quick-add-favicon'),
  folderSelect: document.getElementById('folder-select'),
  prioritySelect: document.getElementById('priority-select'),
  addTaskBtn: document.getElementById('add-task-btn'),
  folderList: document.getElementById('folder-list'),
  taskContainer: document.getElementById('task-container'),
  addFolderBtn: document.getElementById('add-folder-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  reminderToggle: document.getElementById('reminder-toggle'),
  reminderPickerContainer: document.getElementById('reminder-picker-container'),
  reminderDatetime: document.getElementById('reminder-datetime'),
  clearReminderBtn: document.getElementById('clear-reminder-btn')
};

// Initialize popup
async function initPopup() {
  await loadSettings();
  applyTheme();
  await loadData();
  renderFolderSelect();
  renderFolderList();
  renderTaskList();
  setupEventListeners();
  updateFaviconFromActiveTab();
}

// Apply theme from settings
function applyTheme() {
  const theme = settings.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

// Load settings from storage
async function loadSettings() {
  settings = await getSettings();
}

// Load tasks and folders from storage
async function loadData() {
  [tasks, folders] = await Promise.all([
    getAllTasks(),
    getAllFolders()
  ]);
}

// Setup all event listeners
function setupEventListeners() {
  // Quick add task
  elements.addTaskBtn.addEventListener('click', handleAddTask);
  elements.taskTitleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTask();
  });

  // Search
  elements.searchInput.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim();
    renderTaskList();
  }, 300));

  // Folder select change
  elements.folderSelect.addEventListener('change', (e) => {
    currentFolderId = e.target.value || null;
    renderTaskList();
  });

  // Add folder button
  elements.addFolderBtn.addEventListener('click', handleAddFolder);

  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Reminder toggle
  elements.reminderToggle.addEventListener('click', handleReminderToggle);
  
  // Clear reminder button
  elements.clearReminderBtn.addEventListener('click', handleClearReminder);
  
  // Reminder datetime change
  elements.reminderDatetime.addEventListener('change', (e) => {
    reminderDatetime = e.target.value;
  });

  // Listen for updates from content script or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TAB_METADATA') {
      updateQuickAddBar(message.payload);
    } else if (message.type === 'TASK_CREATED' || message.type === 'TASK_UPDATED' || 
               message.type === 'TASK_DELETED' || message.type === 'TASK_COMPLETED') {
      refreshData();
    }
  });
}

// Debounce utility function
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Update quick add bar with tab metadata
async function updateQuickAddBar(metadata) {
  if (!metadata) return;

  // Update favicon
  if (metadata.favicon) {
    elements.quickAddFavicon.src = metadata.favicon;
    elements.quickAddFavicon.onerror = () => {
      elements.quickAddFavicon.src = ''; // Hide if invalid
    };
  } else {
    elements.quickAddFavicon.src = '';
  }

  // Auto-fill task title from page title if empty
  if (elements.taskTitleInput.value.trim() === '' && metadata.pageTitle) {
    elements.taskTitleInput.value = metadata.pageTitle.substring(0, 120);
  }
}

// Update favicon from active tab (fallback if content script fails)
async function updateFaviconFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const domain = extractDomain(tab.url);
      const tagInfo = getDomainTag(tab.url);
      const faviconUrl = tab.favicon || `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
      
      elements.quickAddFavicon.src = faviconUrl;
      elements.quickAddFavicon.onerror = () => {
        elements.quickAddFavicon.src = '';
      };
      
      // Auto-fill title if empty
      if (elements.taskTitleInput.value.trim() === '' && tab.title) {
        elements.taskTitleInput.value = tab.title.substring(0, 120);
      }
    }
  } catch (error) {
    console.error('Failed to update favicon from active tab:', error);
  }
}

// Handle adding a new task
async function handleAddTask() {
  const title = elements.taskTitleInput.value.trim();
  if (!title) {
    elements.taskTitleInput.focus();
    return;
  }

  try {
    // Get tab metadata
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab ? tab.url : null;
    const pageTitle = tab ? tab.title : '';
    const favicon = tab ? tab.favicon : null;
    const domain = url ? extractDomain(url) : '';
    const domainTagInfo = url ? getDomainTag(url) : { tag: 'Link', color: '#6B7280' };

    // Build reminder object if enabled
    let reminder = null;
    if (reminderEnabled && reminderDatetime) {
      const reminderTime = new Date(reminderDatetime);
      if (reminderTime.getTime() > Date.now()) {
        reminder = {
          enabled: true,
          datetime: reminderTime.toISOString(),
          alarmName: '' // Will be set by task-manager after task ID is generated
        };
      }
    }

    // Create task
    const newTask = await createTask({
      title: title,
      note: '', // Empty note for quick add
      url: url,
      pageTitle: pageTitle,
      favicon: favicon,
      domain: domain,
      folderId: currentFolderId,
      priority: elements.prioritySelect.value,
      reminder: reminder
    });

    // Create actual alarm if reminder is set
    if (newTask && newTask.reminder && newTask.reminder.enabled) {
      const alarmResult = await createReminder(newTask.id, newTask.reminder.datetime);
      if (alarmResult) {
        // Update task with alarm name
        await updateTask(newTask.id, {
          reminder: {
            enabled: true,
            datetime: newTask.reminder.datetime,
            alarmName: alarmResult.alarmName
          }
        });
      }
    }

    // Clear inputs and reset reminder state
    elements.taskTitleInput.value = '';
    handleClearReminder();
    elements.taskTitleInput.focus();

    // Refresh data and UI
    await refreshData();
  } catch (error) {
    console.error('Failed to create task:', error);
    alert('Gagal membuat task. Silakan coba lagi.');
  }
}

// Handle adding a new folder
async function handleAddFolder() {
  const folderName = prompt('Nama folder baru:', '');
  if (!folderName || folderName.trim() === '') return;

  const trimmedName = folderName.trim();
  if (trimmedName.length > 50) {
    alert('Nama folder maksimal 50 karakter');
    return;
  }

  try {
    const newFolder = await createFolder({
      name: trimmedName,
      color: '#4A90D9', // Default color
      icon: '📁' // Default icon
    });

    if (!newFolder) {
      alert('Gagal membuat folder. Silakan coba lagi.');
      return;
    }

    // Refresh folder list and select new folder
    await refreshData();
    elements.folderSelect.value = newFolder.id;
    currentFolderId = newFolder.id;
    renderTaskList();
  } catch (error) {
    console.error('Failed to create folder:', error);
    alert('Gagal membuat folder. Silakan coba lagi.');
  }
}

// Handle reminder toggle button click
function handleReminderToggle() {
  if (reminderEnabled) {
    // Hide picker and reset
    reminderEnabled = false;
    reminderDatetime = '';
    elements.reminderPickerContainer.style.display = 'none';
    elements.reminderToggle.classList.remove('active');
  } else {
    // Show picker
    reminderEnabled = true;
    elements.reminderPickerContainer.style.display = 'flex';
    elements.reminderToggle.classList.add('active');
    
    // Set default time to 1 hour from now
    const defaultTime = new Date(Date.now() + 3600000);
    const localStr = defaultTime.toISOString().slice(0, 16);
    elements.reminderDatetime.value = localStr;
    reminderDatetime = localStr;
  }
}

// Handle clear reminder button click
function handleClearReminder() {
  reminderEnabled = false;
  reminderDatetime = '';
  elements.reminderDatetime.value = '';
  elements.reminderPickerContainer.style.display = 'none';
  elements.reminderToggle.classList.remove('active');
}

// Refresh all data from storage
async function refreshData() {
  await loadData();
  renderFolderSelect();
  renderFolderList();
  renderTaskList();
}

// Render folder select dropdown
function renderFolderSelect() {
  elements.folderSelect.innerHTML = '<option value="">[Pilih folder]</option>';
  
  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = `${folder.icon} ${folder.name}`;
    elements.folderSelect.appendChild(option);
  });
  
  if (currentFolderId) {
    elements.folderSelect.value = currentFolderId;
  }
}

// Render folder list in sidebar
function renderFolderList() {
  elements.folderList.innerHTML = '';
  
  folders.forEach(folder => {
    const folderElement = document.createElement('div');
    folderElement.className = `folder-item ${folder.id === currentFolderId ? 'active' : ''}`;
    folderElement.innerHTML = `
      <div class="folder-icon">${folder.icon}</div>
      <div class="folder-name">${folder.name}</div>
    `;
    folderElement.addEventListener('click', () => {
      currentFolderId = folder.id;
      elements.folderSelect.value = folder.id;
      renderFolderList();
      renderTaskList();
    });
    elements.folderList.appendChild(folderElement);
  });
}

// Render task list
function renderTaskList() {
  // Filter tasks based on search query and folder
  let filteredTasks = tasks;
  
  if (currentFolderId !== null) {
    filteredTasks = filteredTasks.filter(task => task.folderId === currentFolderId);
  }
  
  if (searchQuery) {
    const queryLower = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(task => 
      task.title.toLowerCase().includes(queryLower) ||
      task.note.toLowerCase().includes(queryLower) ||
      (task.url && task.url.toLowerCase().includes(queryLower)) ||
      (task.pageTitle && task.pageTitle.toLowerCase().includes(queryLower)) ||
      (task.domain && task.domain.toLowerCase().includes(queryLower)) ||
      (task.domainTag && task.domainTag.toLowerCase().includes(queryLower))
    );
  }

  // Sort tasks based on settings
  const sortBy = settings.display?.taskSortBy || 'createdAt';
  const sortOrder = settings.display?.taskSortOrder || 'desc';
  
  filteredTasks.sort((a, b) => {
    let valueA = a[sortBy];
    let valueB = b[sortBy];
    
    if (sortBy === 'createdAt' || sortBy === 'completedAt') {
      valueA = valueA ? new Date(valueA).getTime() : 0;
      valueB = valueB ? new Date(valueB).getTime() : 0;
    }
    
    return sortOrder === 'asc' 
      ? (valueA > valueB ? 1 : valueA < valueB ? -1 : 0) 
      : (valueA < valueB ? 1 : valueA > valueB ? -1 : 0);
  });

  // Render tasks
  elements.taskContainer.innerHTML = '';
  
  if (filteredTasks.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = currentFolderId 
      ? 'Belum ada task di folder ini' 
      : 'Belum ada task. Tambahkan task pertama!';
    elements.taskContainer.appendChild(emptyState);
    return;
  }

  filteredTasks.forEach(task => {
    const taskElement = document.createElement('div');
    taskElement.className = `task-item ${task.status === 'completed' ? 'completed' : ''}`;
    taskElement.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${task.domainTag ? `<span class="domain-tag" style="background-color: ${getDomainTagColor(task.url || task.domain)};">${task.domainTag}</span>` : ''}
          <span class="priority-dot priority-${task.priority}" title="Prioritas: ${task.priority}"></span>
          ${task.url ? `<a href="${escapeHtml(task.url)}" target="_blank" class="task-url-link">${extractDomain(task.url)}</a>` : ''}
        </div>
        ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
      </div>
    `;

    const checkbox = taskElement.querySelector('.task-checkbox');
    checkbox.addEventListener('change', async () => {
      if (checkbox.checked) {
        await completeTask(task.id);
      } else {
        // Reopen task - set status back to active
        await updateTask(task.id, { status: 'active', completedAt: null });
      }
      await refreshData();
    });

    // Double click to edit task title (simplified - in real app would have edit modal)
    taskElement.querySelector('.task-title').addEventListener('dblclick', async () => {
      const newTitle = prompt('Edit task title:', task.title);
      if (newTitle !== null && newTitle.trim() !== '') {
        await updateTask(task.id, { title: newTitle.trim() });
        await refreshData();
      }
    });

    elements.taskContainer.appendChild(taskElement);
  });
}

// Extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

// Get color for domain tag
function getDomainTagColor(domain) {
  const tagInfo = getDomainTag(domain);
  return tagInfo.color || '#6B7280';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);