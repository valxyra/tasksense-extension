/**
 * TaskSense Options Page Logic
 * Handle settings, import/export, and data management
 */

import { getSettings, getAllFolders, setData, clearAll } from '../utils/storage.js';
import { exportAndDownloadTxt, exportAndDownloadMarkdown, exportAndDownloadJson } from '../utils/export-manager.js';
import { importData } from '../utils/import-manager.js';

// DOM Elements
const elements = {
  themeSelect: document.getElementById('theme-select'),
  defaultFolderSelect: document.getElementById('default-folder-select'),
  defaultPrioritySelect: document.getElementById('default-priority-select'),
  startupReminderEnabled: document.getElementById('startup-reminder-enabled'),
  startupReminderCount: document.getElementById('startup-reminder-count'),
  notificationsEnabled: document.getElementById('notifications-enabled'),
  showFavicon: document.getElementById('show-favicon'),
  showDomainTag: document.getElementById('show-domain-tag'),
  sortBySelect: document.getElementById('sort-by-select'),
  sortOrderSelect: document.getElementById('sort-order-select'),
  importFileInput: document.getElementById('import-file-input'),
  importStrategySelect: document.getElementById('import-strategy-select'),
  importBtn: document.getElementById('import-btn'),
  importResult: document.getElementById('import-result'),
  exportTxtBtn: document.getElementById('export-txt-btn'),
  exportMdBtn: document.getElementById('export-md-btn'),
  exportJsonBtn: document.getElementById('export-json-btn'),
  resetBtn: document.getElementById('reset-btn')
};

// Initialize options page
async function initOptions() {
  await loadSettings();
  await loadFolders();
  setupEventListeners();
  applyTheme();
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await getSettings();
    
    // Theme
    elements.themeSelect.value = settings.theme || 'light';
    
    // Default settings
    elements.defaultFolderSelect.value = settings.defaultFolderId || '';
    elements.defaultPrioritySelect.value = settings.defaultPriority || 'medium';
    
    // Browser startup reminder
    elements.startupReminderEnabled.checked = settings.browserStartupReminder?.enabled !== false;
    elements.startupReminderCount.checked = settings.browserStartupReminder?.showPendingCount !== false;
    
    // Notifications
    elements.notificationsEnabled.checked = settings.notifications?.enabled !== false;
    
    // Display
    elements.showFavicon.checked = settings.display?.showFavicon !== false;
    elements.showDomainTag.checked = settings.display?.showDomainTag !== false;
    elements.sortBySelect.value = settings.display?.taskSortBy || 'createdAt';
    elements.sortOrderSelect.value = settings.display?.taskSortOrder || 'desc';
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load folders for default folder select
async function loadFolders() {
  try {
    const folders = await getAllFolders();
    
    // Clear existing options except the first one
    elements.defaultFolderSelect.innerHTML = '<option value="">Tidak ada (task tanpa folder)</option>';
    
    // Add folder options
    folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = `${folder.icon} ${folder.name}`;
      elements.defaultFolderSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading folders:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Theme change
  elements.themeSelect.addEventListener('change', handleThemeChange);
  
  // Settings changes - auto-save
  elements.defaultFolderSelect.addEventListener('change', saveSettings);
  elements.defaultPrioritySelect.addEventListener('change', saveSettings);
  elements.startupReminderEnabled.addEventListener('change', saveSettings);
  elements.startupReminderCount.addEventListener('change', saveSettings);
  elements.notificationsEnabled.addEventListener('change', saveSettings);
  elements.showFavicon.addEventListener('change', saveSettings);
  elements.showDomainTag.addEventListener('change', saveSettings);
  elements.sortBySelect.addEventListener('change', saveSettings);
  elements.sortOrderSelect.addEventListener('change', saveSettings);
  
  // Import/Export
  elements.importBtn.addEventListener('click', handleImport);
  elements.exportTxtBtn.addEventListener('click', handleExportTxt);
  elements.exportMdBtn.addEventListener('click', handleExportMarkdown);
  elements.exportJsonBtn.addEventListener('click', handleExportJson);
  
  // Reset
  elements.resetBtn.addEventListener('click', handleReset);
}

// Handle theme change
async function handleThemeChange() {
  const theme = elements.themeSelect.value;
  document.documentElement.setAttribute('data-theme', theme);
  await saveSettings();
}

// Apply theme to page
function applyTheme() {
  const theme = elements.themeSelect.value;
  document.documentElement.setAttribute('data-theme', theme);
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      theme: elements.themeSelect.value,
      defaultFolderId: elements.defaultFolderSelect.value || null,
      defaultPriority: elements.defaultPrioritySelect.value,
      browserStartupReminder: {
        enabled: elements.startupReminderEnabled.checked,
        showPendingCount: elements.startupReminderCount.checked
      },
      notifications: {
        enabled: elements.notificationsEnabled.checked,
        sound: false
      },
      display: {
        showFavicon: elements.showFavicon.checked,
        showDomainTag: elements.showDomainTag.checked,
        taskSortBy: elements.sortBySelect.value,
        taskSortOrder: elements.sortOrderSelect.value
      }
    };
    
    await setData('settings', settings);
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Gagal menyimpan pengaturan. Silakan coba lagi.');
  }
}

// Handle import
async function handleImport() {
  const file = elements.importFileInput.files[0];
  if (!file) {
    showImportResult('Pilih file JSON terlebih dahulu', 'error');
    return;
  }
  
  const strategy = elements.importStrategySelect.value;
  
  // Confirm if overwrite strategy
  if (strategy === 'overwrite') {
    const confirmed = confirm(
      'PERINGATAN: Strategi "Ganti semua" akan menghapus semua data existing Anda.\n\n' +
      'Apakah Anda yakin ingin melanjutkan?'
    );
    if (!confirmed) return;
  }
  
  try {
    elements.importBtn.disabled = true;
    elements.importBtn.textContent = 'Importing...';
    
    const result = await importData(file, strategy);
    
    if (result.success) {
      showImportResult(
        `Berhasil! ${result.imported} item diimpor${result.skipped > 0 ? `, ${result.skipped} item dilewati` : ''}`,
        'success'
      );
      
      // Reload folders and settings
      await loadFolders();
      await loadSettings();
      
      // Clear file input
      elements.importFileInput.value = '';
    } else {
      showImportResult(
        `Gagal: ${result.errors.join(', ')}`,
        'error'
      );
    }
  } catch (error) {
    console.error('Import error:', error);
    showImportResult('Terjadi kesalahan saat import', 'error');
  } finally {
    elements.importBtn.disabled = false;
    elements.importBtn.textContent = 'Import';
  }
}

// Show import result message
function showImportResult(message, type) {
  elements.importResult.textContent = message;
  elements.importResult.className = `result-message ${type}`;
  
  // Clear message after 5 seconds
  setTimeout(() => {
    elements.importResult.textContent = '';
    elements.importResult.className = 'result-message';
  }, 5000);
}

// Handle export TXT
async function handleExportTxt() {
  try {
    elements.exportTxtBtn.disabled = true;
    elements.exportTxtBtn.textContent = 'Exporting...';
    
    const success = await exportAndDownloadTxt();
    if (success) {
      console.log('TXT export successful');
    } else {
      alert('Gagal mengekspor ke TXT');
    }
  } catch (error) {
    console.error('Export TXT error:', error);
    alert('Terjadi kesalahan saat export TXT');
  } finally {
    elements.exportTxtBtn.disabled = false;
    elements.exportTxtBtn.textContent = '📄 Export TXT';
  }
}

// Handle export Markdown
async function handleExportMarkdown() {
  try {
    elements.exportMdBtn.disabled = true;
    elements.exportMdBtn.textContent = 'Exporting...';
    
    const success = await exportAndDownloadMarkdown();
    if (success) {
      console.log('Markdown export successful');
    } else {
      alert('Gagal mengekspor ke Markdown');
    }
  } catch (error) {
    console.error('Export Markdown error:', error);
    alert('Terjadi kesalahan saat export Markdown');
  } finally {
    elements.exportMdBtn.disabled = false;
    elements.exportMdBtn.textContent = '📝 Export Markdown';
  }
}

// Handle export JSON
async function handleExportJson() {
  try {
    elements.exportJsonBtn.disabled = true;
    elements.exportJsonBtn.textContent = 'Exporting...';
    
    const success = await exportAndDownloadJson();
    if (success) {
      console.log('JSON export successful');
    } else {
      alert('Gagal mengekspor ke JSON');
    }
  } catch (error) {
    console.error('Export JSON error:', error);
    alert('Terjadi kesalahan saat export JSON');
  } finally {
    elements.exportJsonBtn.disabled = false;
    elements.exportJsonBtn.textContent = '💾 Export JSON (Backup)';
  }
}

// Handle reset all data
async function handleReset() {
  const confirmed = confirm(
    'PERINGATAN: Ini akan menghapus SEMUA data TaskSense Anda:\n' +
    '- Semua tasks\n' +
    '- Semua folders\n' +
    '- Semua settings\n\n' +
    'Tindakan ini TIDAK DAPAT DIBATALKAN.\n\n' +
    'Ketik "RESET" untuk konfirmasi:'
  );
  
  if (!confirmed) return;
  
  const confirmation = prompt('Ketik "RESET" untuk konfirmasi:');
  if (confirmation !== 'RESET') {
    alert('Reset dibatalkan');
    return;
  }
  
  try {
    elements.resetBtn.disabled = true;
    elements.resetBtn.textContent = 'Resetting...';
    
    const success = await clearAll();
    if (success) {
      alert('Semua data berhasil dihapus. Halaman akan dimuat ulang.');
      window.location.reload();
    } else {
      alert('Gagal menghapus data');
    }
  } catch (error) {
    console.error('Reset error:', error);
    alert('Terjadi kesalahan saat reset data');
  } finally {
    elements.resetBtn.disabled = false;
    elements.resetBtn.textContent = 'Reset Semua Data';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initOptions);