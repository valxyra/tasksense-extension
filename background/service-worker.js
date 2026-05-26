/**
 * TaskSense - Service Worker (Background Script)
 * Menangani alarm, notifikasi, dan event startup.
 *
 * PENTING: Service Worker MV3 TIDAK mendukung ES module imports secara langsung
 * (kecuali dengan bundler). Semua akses storage dilakukan inline via chrome.storage API.
 */

// Constants
const NOTIFICATION_ICON_URL = chrome.runtime.getURL('assets/icons/icon128.png');
const DEFAULT_SETTINGS = {
  theme: 'light',
  defaultFolderId: null,
  defaultPriority: 'medium',
  browserStartupReminder: { enabled: true, showPendingCount: true },
  notifications: { enabled: true, sound: false },
  display: { showFavicon: true, showDomainTag: true, taskSortBy: 'createdAt', taskSortOrder: 'desc' }
};

/**
 * Get all tasks from storage
 * @returns {Promise<Array>}
 */
async function getAllTasks() {
  try {
    const result = await chrome.storage.local.get('tasks');
    return Array.isArray(result.tasks) ? result.tasks : [];
  } catch (error) {
    console.error('[TaskSense] Error getting tasks:', error);
    return [];
  }
}

/**
 * Get settings from storage
 * @returns {Promise<Object>}
 */
async function getSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    return result.settings && typeof result.settings === 'object'
      ? { ...DEFAULT_SETTINGS, ...result.settings }
      : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('[TaskSense] Error getting settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Update a task in storage
 * @param {string} taskId
 * @param {Object} changes
 * @returns {Promise<Object|null>}
 */
async function updateTask(taskId, changes) {
  try {
    const tasks = await getAllTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return null;

    const immutableFields = ['id', 'createdAt'];
    for (const field of immutableFields) delete changes[field];

    tasks[idx] = { ...tasks[idx], ...changes };
    await chrome.storage.local.set({ tasks });
    return tasks[idx];
  } catch (error) {
    console.error(`[TaskSense] Error updating task ${taskId}:`, error);
    return null;
  }
}

/**
 * Initialize service worker
 */
async function initialize() {
  console.log('[TaskSense] Service worker initialized');
  await migrateData();
}

/**
 * Data migration — inline karena service worker tidak bisa import ES module
 */
async function migrateData() {
  try {
    const result = await chrome.storage.local.get('meta');
    const meta = result.meta;
    const currentVersion = '1.0.0';

    if (meta && meta.version === currentVersion) return;

    // Migration from unknown version → 1.0.0
    console.log('[TaskSense] Running data migration');
    const data = await chrome.storage.local.get(null);

    // Ensure all storage keys exist with defaults
    if (!Array.isArray(data.tasks)) {
      await chrome.storage.local.set({ tasks: [] });
    }
    if (!Array.isArray(data.folders)) {
      await chrome.storage.local.set({ folders: [] });
    }
    if (!data.settings || typeof data.settings !== 'object') {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }

    // Set meta
    const now = new Date().toISOString();
    const newMeta = {
      version: currentVersion,
      installedAt: (meta && meta.installedAt) ? meta.installedAt : now,
      lastBackupAt: (meta && meta.lastBackupAt) || null,
      totalTasksCreated: (meta && meta.totalTasksCreated) || 0,
      totalTasksCompleted: (meta && meta.totalTasksCompleted) || 0
    };
    await chrome.storage.local.set({ meta: newMeta });

    console.log('[TaskSense] Migration complete');
  } catch (error) {
    console.error('[TaskSense] Migration failed:', error);
  }
}

/**
 * Show startup reminder
 */
async function showStartupReminder() {
  try {
    const [settings, tasks] = await Promise.all([getSettings(), getAllTasks()]);
    if (!settings.browserStartupReminder.enabled) return;

    const activeCount = tasks.filter(t => t.status === 'active').length;
    if (activeCount === 0) return;

    const msg = settings.browserStartupReminder.showPendingCount
      ? `Kamu punya ${activeCount} task aktif hari ini. Semangat!`
      : 'Kamu punya task yang menunggu. Semangat!';

    chrome.notifications.create('startup-reminder', {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON_URL,
      title: 'TaskSense',
      message: msg,
      priority: 1,
      requireInteraction: false
    });
  } catch (error) {
    console.error('[TaskSense] Startup reminder error:', error);
  }
}

/**
 * Handle reminder alarm
 * @param {string} alarmName
 */
async function handleTaskReminder(alarmName) {
  try {
    const taskId = alarmName.replace('reminder_', '');
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.warn(`[TaskSense] Task ${taskId} not found`);
      return;
    }

    const notifId = `reminder-${taskId}`;
    await chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON_URL,
      title: 'TaskSense Reminder',
      message: task.title,
      contextMessage: 'Klik untuk buka halaman atau tandai selesai',
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: 'Buka URL' }, { title: 'Tandai Selesai' }]
    });

    await chrome.storage.local.set({
      [`notification_task_${taskId}`]: { taskId, url: task.url, title: task.title }
    });
  } catch (error) {
    console.error('[TaskSense] Reminder error:', error);
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[TaskSense] Installed/updated:', details.reason);
  if (details.reason === 'install') {
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON_URL,
      title: 'TaskSense Installed',
      message: 'Terima kasih telah menginstal TaskSense! Klik ikon extension untuk mulai menambahkan task.',
      priority: 1,
      requireInteraction: false
    });
  }
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[TaskSense] Browser started');
  initialize();
  showStartupReminder();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reminder_')) {
    await handleTaskReminder(alarm.name);
  }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('reminder-')) return;

  const taskId = notificationId.replace('reminder-', '');
  const key = `notification_task_${taskId}`;
  const result = await chrome.storage.local.get(key);
  const taskInfo = result[key];

  if (!taskInfo) {
    console.warn(`[TaskSense] No task info for ${taskId}`);
    return;
  }

  if (buttonIndex === 0 && taskInfo.url) {
    chrome.tabs.create({ url: taskInfo.url });
  } else if (buttonIndex === 1) {
    await updateTask(taskId, { status: 'completed', completedAt: new Date().toISOString() });
  }

  await chrome.storage.local.remove(key);
  chrome.notifications.clear(notificationId);
});

// Initialize on load
initialize();