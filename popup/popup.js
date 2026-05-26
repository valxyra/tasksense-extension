/**
 * TaskSense Popup Logic
 * Handle UI interactions, event listeners, and rendering
 */

import { createTask, updateTask, deleteTask, completeTask, reorderTask, createFolder } from '../utils/task-manager.js';
import { getAllTasks, getAllFolders, getSettings } from '../utils/storage.js';
import { getDomainTag } from '../utils/domain-tagger.js';
import { createReminder, clearReminder } from '../utils/reminder-manager.js';
import { searchTasks } from '../utils/search.js';
import { initI18n } from '../utils/i18n.js';

// State
let tasks = [];
let folders = [];
let settings = {};
let currentFolderId = null;
let searchQuery = '';

// Reminder state
let reminderEnabled = false;
let reminderDatetime = '';
let fpInstance = null;

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
  initI18n(); // Initialize translations
  await loadSettings();
  applyTheme();
  await loadData();
  renderFolderSelect();
  renderFolderList();
  renderTaskList();
  setupEventListeners();
  updateFaviconFromActiveTab();
  
  // Initialize Flatpickr
  fpInstance = flatpickr(elements.reminderDatetime, {
    enableTime: true,
    dateFormat: "Y-m-d\\TH:i",
    minDate: "today",
    onChange: function(selectedDates, dateStr) {
      reminderDatetime = dateStr;
    }
  });
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
  
  // Reminder datetime change (fallback/sync)
  elements.reminderDatetime.addEventListener('change', (e) => {
    reminderDatetime = e.target.value;
  });
  
  // Sidebar toggle
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

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
    alert(chrome.i18n.getMessage("failCreateTask") || 'Gagal membuat task. Silakan coba lagi.');
  }
}

// Handle adding a new folder
async function handleAddFolder() {
  const folderName = prompt(chrome.i18n.getMessage("promptNewFolder") || 'Nama folder baru:', '');
  if (!folderName || folderName.trim() === '') return;

  const trimmedName = folderName.trim();
  if (trimmedName.length > 50) {
    alert(chrome.i18n.getMessage("errFolderLength") || 'Nama folder maksimal 50 karakter');
    return;
  }

  try {
    const newFolder = await createFolder({
      name: trimmedName,
      color: '#CC785C', // Default coral color
      icon: '' // No longer use emoji
    });

    if (!newFolder) {
      alert(chrome.i18n.getMessage("failCreateFolder") || 'Gagal membuat folder. Silakan coba lagi.');
      return;
    }

    // Refresh folder list and select new folder
    await refreshData();
    elements.folderSelect.value = newFolder.id;
    currentFolderId = newFolder.id;
    renderTaskList();
  } catch (error) {
    console.error('Failed to create folder:', error);
    alert(chrome.i18n.getMessage("failCreateFolder") || 'Gagal membuat folder. Silakan coba lagi.');
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
    if (fpInstance) {
      fpInstance.setDate(defaultTime);
    } else {
      elements.reminderDatetime.value = localStr;
    }
    reminderDatetime = localStr;
  }
}

// Handle clear reminder button click
function handleClearReminder() {
  reminderEnabled = false;
  reminderDatetime = '';
  if (fpInstance) {
    fpInstance.clear();
  } else {
    elements.reminderDatetime.value = '';
  }
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
  const defaultText = chrome.i18n.getMessage("folderSelectDefault") || '[Pilih folder]';
  elements.folderSelect.innerHTML = `<option value="">${defaultText}</option>`;
  
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
  
  // All Folders Item
  const allFoldersElement = document.createElement('div');
  const allFoldersText = chrome.i18n.getMessage("allFolders") || 'Semua Folder';
  allFoldersElement.className = `folder-item ${currentFolderId === null ? 'active' : ''}`;
  allFoldersElement.innerHTML = `
    <div class="folder-dot" style="background: var(--ts-coral)"></div>
    <div class="folder-name">${escapeHtml(allFoldersText)}</div>
  `;
  allFoldersElement.addEventListener('click', () => {
    currentFolderId = null;
    elements.folderSelect.value = '';
    renderFolderList();
    renderTaskList();
  });
  elements.folderList.appendChild(allFoldersElement);
  
  folders.forEach(folder => {
    const folderElement = document.createElement('div');
    folderElement.className = `folder-item ${folder.id === currentFolderId ? 'active' : ''}`;
    folderElement.innerHTML = `
      <div class="folder-dot" style="background: ${folder.color || '#CC785C'}"></div>
      <div class="folder-name">${escapeHtml(folder.name)}</div>
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
  const sortBy = settings.display?.taskSortBy || 'priority'; // Change default to priority
  const sortOrder = settings.display?.taskSortOrder || 'desc';
  
  const priorityValue = { high: 3, medium: 2, low: 1 };
  
  filteredTasks.sort((a, b) => {
    let valueA = a[sortBy];
    let valueB = b[sortBy];
    
    if (sortBy === 'createdAt' || sortBy === 'completedAt') {
      valueA = valueA ? new Date(valueA).getTime() : 0;
      valueB = valueB ? new Date(valueB).getTime() : 0;
    } else if (sortBy === 'priority') {
      valueA = priorityValue[a.priority || 'medium'] || 0;
      valueB = priorityValue[b.priority || 'medium'] || 0;
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
    const title = currentFolderId ? (chrome.i18n.getMessage('emptyFolder') || 'Folder kosong') : (chrome.i18n.getMessage('emptyTasks') || 'Belum ada task');
    const subtitle = currentFolderId ? (chrome.i18n.getMessage('emptyFolderSub') || 'Belum ada task di folder ini.') : (chrome.i18n.getMessage('emptyTasksSub') || 'Tambahkan task pertama Anda di atas.');
    
    emptyState.innerHTML = `
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-subtitle">${subtitle}</div>
    `;
    elements.taskContainer.appendChild(emptyState);
    return;
  }

  filteredTasks.forEach(task => {
    const taskElement = document.createElement('div');
    taskElement.className = `task-item ${task.status === 'completed' ? 'completed' : ''}`;
    taskElement.setAttribute('data-id', task.id);
    taskElement.setAttribute('data-priority', task.priority || 'medium');
    
    const tagInfo = getDomainTag(task.url || task.domain);

    taskElement.innerHTML = `
      <div class="task-checkbox-wrapper">
        <input type="checkbox" class="task-checkbox" aria-label="Tandai selesai" ${task.status === 'completed' ? 'checked' : ''}>
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${task.domainTag ? `<span class="domain-tag ${tagInfo.tagClass || 'tag-link'}">${escapeHtml(task.domainTag)}</span>` : ''}
          ${task.url ? `
          <a href="${escapeHtml(task.url)}" target="_blank" class="task-url-link" title="${escapeHtml(extractDomain(task.url))}">
            ${escapeHtml(extractDomain(task.url))}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px;vertical-align:middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : ''}
          ${task.reminder && task.reminder.enabled ? `
          <span class="task-reminder-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </span>
          ` : ''}
        </div>
      </div>
      <button class="task-delete-btn" aria-label="Hapus task" title="Hapus task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
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

    const deleteBtn = taskElement.querySelector('.task-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(chrome.i18n.getMessage("confirmDeleteTask") || 'Yakin ingin menghapus task ini?')) {
          await deleteTask(task.id);
          await refreshData();
        }
      });
    }

    // Double click to edit task title (simplified - in real app would have edit modal)
    taskElement.querySelector('.task-title').addEventListener('dblclick', async () => {
      const newTitle = prompt(chrome.i18n.getMessage("promptEditTask") || 'Edit task title:', task.title);
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