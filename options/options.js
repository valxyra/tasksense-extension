/**
 * TaskSense Options Page Logic
 * Handle settings, import/export, and data management
 */

import { getSettings, getAllFolders, setData, clearAll } from '../utils/storage.js';
import { exportAndDownloadTxt, exportAndDownloadMarkdown, exportAndDownloadJson } from '../utils/export-manager.js';
import { importData } from '../utils/import-manager.js';
import { initI18n } from '../utils/i18n.js';

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
  initI18n(); // Initialize translations
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
    elements.sortBySelect.value = settings.display?.taskSortBy || 'priority';
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
    const noFolderText = chrome.i18n.getMessage("noFolderLabel") || 'Tidak ada (task tanpa folder)';
    elements.defaultFolderSelect.innerHTML = `<option value="">${noFolderText}</option>`;
    
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
    alert(chrome.i18n.getMessage("failSaveSettings") || 'Gagal menyimpan pengaturan. Silakan coba lagi.');
  }
}

// Handle import
async function handleImport() {
  const file = elements.importFileInput.files[0];
  if (!file) {
    showImportResult(chrome.i18n.getMessage("errImportSelect") || 'Pilih file JSON terlebih dahulu', 'error');
    return;
  }
  
  const strategy = elements.importStrategySelect.value;
  
  // Confirm if overwrite strategy
  if (strategy === 'overwrite') {
    const warningText = chrome.i18n.getMessage("warnImportOverwrite") || 'PERINGATAN: Strategi "Ganti semua" akan menghapus semua data existing Anda.\n\nApakah Anda yakin ingin melanjutkan?';
    const confirmed = confirm(warningText);
    if (!confirmed) return;
  }
  
  try {
    elements.importBtn.disabled = true;
    elements.importBtn.textContent = chrome.i18n.getMessage("importing") || 'Importing...';
    
    const result = await importData(file, strategy);
    
    if (result.success) {
      let successMsg = '';
      if (result.skipped > 0) {
        successMsg = (chrome.i18n.getMessage("importSuccess") || 'Berhasil! {IMPORTED} item diimpor, {SKIPPED} item dilewati')
          .replace('{IMPORTED}', result.imported)
          .replace('{SKIPPED}', result.skipped);
      } else {
        successMsg = (chrome.i18n.getMessage("importSuccessNoSkip") || 'Berhasil! {IMPORTED} item diimpor')
          .replace('{IMPORTED}', result.imported);
      }
      showImportResult(successMsg, 'success');
      
      // Reload folders and settings
      await loadFolders();
      await loadSettings();
      
      // Clear file input
      elements.importFileInput.value = '';
    } else {
      const errorMsg = (chrome.i18n.getMessage("importFailed") || 'Gagal: {ERROR}').replace('{ERROR}', result.errors.join(', '));
      showImportResult(errorMsg, 'error');
    }
  } catch (error) {
    console.error('Import error:', error);
    showImportResult(chrome.i18n.getMessage("errImport") || 'Terjadi kesalahan saat import', 'error');
  } finally {
    elements.importBtn.disabled = false;
    elements.importBtn.textContent = chrome.i18n.getMessage("btnImport") || 'Import';
  }
}

// Show import result message
function showImportResult(message, type) {
  elements.importResult.textContent = message;
  elements.importResult.className = `ts-toast ts-toast-${type}`;
  
  // Clear message after 5 seconds
  setTimeout(() => {
    elements.importResult.textContent = '';
    elements.importResult.className = '';
  }, 5000);
}

// Handle export TXT
async function handleExportTxt() {
  try {
    elements.exportTxtBtn.disabled = true;
    const btnText = chrome.i18n.getMessage("btnExportTxt") || 'Export TXT';
    elements.exportTxtBtn.textContent = chrome.i18n.getMessage("exporting") || 'Exporting...';
    
    const success = await exportAndDownloadTxt();
    if (success) {
      console.log('TXT export successful');
    } else {
      alert(chrome.i18n.getMessage("failExportTxt") || 'Gagal mengekspor ke TXT');
    }
  } catch (error) {
    console.error('Export TXT error:', error);
    alert(chrome.i18n.getMessage("errExportTxt") || 'Terjadi kesalahan saat export TXT');
  } finally {
    elements.exportTxtBtn.disabled = false;
    const btnText = chrome.i18n.getMessage("btnExportTxt") || 'Export TXT';
    elements.exportTxtBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> <span data-i18n="btnExportTxt">${btnText}</span>`;
  }
}

// Handle export Markdown
async function handleExportMarkdown() {
  try {
    elements.exportMdBtn.disabled = true;
    elements.exportMdBtn.textContent = chrome.i18n.getMessage("exporting") || 'Exporting...';
    
    const success = await exportAndDownloadMarkdown();
    if (success) {
      console.log('Markdown export successful');
    } else {
      alert(chrome.i18n.getMessage("failExportMd") || 'Gagal mengekspor ke Markdown');
    }
  } catch (error) {
    console.error('Export Markdown error:', error);
    alert(chrome.i18n.getMessage("errExportMd") || 'Terjadi kesalahan saat export Markdown');
  } finally {
    elements.exportMdBtn.disabled = false;
    const btnText = chrome.i18n.getMessage("btnExportMd") || 'Export Markdown';
    elements.exportMdBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> <span data-i18n="btnExportMd">${btnText}</span>`;
  }
}

// Handle export JSON
async function handleExportJson() {
  try {
    elements.exportJsonBtn.disabled = true;
    elements.exportJsonBtn.textContent = chrome.i18n.getMessage("exporting") || 'Exporting...';
    
    const success = await exportAndDownloadJson();
    if (success) {
      console.log('JSON export successful');
    } else {
      alert(chrome.i18n.getMessage("failExportJson") || 'Gagal mengekspor ke JSON');
    }
  } catch (error) {
    console.error('Export JSON error:', error);
    alert(chrome.i18n.getMessage("errExportJson") || 'Terjadi kesalahan saat export JSON');
  } finally {
    elements.exportJsonBtn.disabled = false;
    const btnText = chrome.i18n.getMessage("btnExportJson") || 'Export JSON (Backup)';
    elements.exportJsonBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> <span data-i18n="btnExportJson">${btnText}</span>`;
  }
}

// Handle reset all data
async function handleReset() {
  const warningText = chrome.i18n.getMessage("warnResetData") || 'PERINGATAN: Ini akan menghapus SEMUA data TaskSense Anda.\n\nTindakan ini TIDAK DAPAT DIBATALKAN.\n\nKetik "RESET" untuk konfirmasi:';
  
  // prompt handles both confirmation and text input
  const confirmation = prompt(warningText);
  if (confirmation !== 'RESET') {
    alert(chrome.i18n.getMessage("resetCanceled") || 'Reset dibatalkan');
    return;
  }
  
  try {
    elements.resetBtn.disabled = true;
    elements.resetBtn.textContent = chrome.i18n.getMessage("resetting") || 'Resetting...';
    
    const success = await clearAll();
    if (success) {
      alert(chrome.i18n.getMessage("resetSuccess") || 'Semua data berhasil dihapus. Halaman akan dimuat ulang.');
      window.location.reload();
    } else {
      alert(chrome.i18n.getMessage("failResetData") || 'Gagal menghapus data');
    }
  } catch (error) {
    console.error('Reset error:', error);
    alert(chrome.i18n.getMessage("errResetData") || 'Terjadi kesalahan saat reset data');
  } finally {
    elements.resetBtn.disabled = false;
    elements.resetBtn.textContent = chrome.i18n.getMessage("btnResetData") || 'Reset Semua Data';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initOptions);