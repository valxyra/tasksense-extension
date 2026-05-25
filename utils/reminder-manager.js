/**
 * TaskSense - Reminder Manager
 * Membuat, mengubah, dan menghapus alarm untuk task reminders.
 */

/**
 * Create a reminder alarm for a task
 * @param {string} taskId - Task ID
 * @param {string} datetime - ISO 8601 datetime string
 * @returns {Promise<{enabled: boolean, datetime: string, alarmName: string}|null>}
 */
async function createReminder(taskId, datetime) {
  try {
    if (!taskId || !datetime) {
      console.error('[TaskSense] createReminder: taskId and datetime are required');
      return null;
    }

    const reminderTime = new Date(datetime).getTime();
    const now = Date.now();

    if (reminderTime <= now) {
      console.warn('[TaskSense] Reminder time is in the past');
      return null;
    }

    const alarmName = `reminder_${taskId}`;

    // Create chrome alarm
    await chrome.alarms.create(alarmName, {
      when: reminderTime
    });

    return {
      enabled: true,
      datetime: datetime,
      alarmName: alarmName
    };
  } catch (error) {
    console.error('[TaskSense] Error creating reminder:', error);
    return null;
  }
}

/**
 * Update an existing reminder
 * @param {string} taskId - Task ID
 * @param {string} newDatetime - New ISO 8601 datetime string
 * @returns {Promise<{enabled: boolean, datetime: string, alarmName: string}|null>}
 */
async function updateReminder(taskId, newDatetime) {
  try {
    // Clear existing alarm first
    await clearReminder(taskId);

    // Create new alarm
    return await createReminder(taskId, newDatetime);
  } catch (error) {
    console.error('[TaskSense] Error updating reminder:', error);
    return null;
  }
}

/**
 * Clear/delete a reminder alarm
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>} Success status
 */
async function clearReminder(taskId) {
  try {
    const alarmName = `reminder_${taskId}`;
    await chrome.alarms.clear(alarmName);
    return true;
  } catch (error) {
    console.error('[TaskSense] Error clearing reminder:', error);
    return false;
  }
}

/**
 * Check if a reminder alarm exists
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>}
 */
async function hasReminder(taskId) {
  try {
    const alarmName = `reminder_${taskId}`;
    const alarm = await chrome.alarms.get(alarmName);
    return alarm !== undefined && alarm !== null;
  } catch (error) {
    console.error('[TaskSense] Error checking reminder:', error);
    return false;
  }
}

/**
 * Get all active reminder alarms
 * @returns {Promise<Array>} Array of alarm objects
 */
async function getAllReminders() {
  try {
    const alarms = await chrome.alarms.getAll();
    return alarms.filter(a => a.name.startsWith('reminder_'));
  } catch (error) {
    console.error('[TaskSense] Error getting all reminders:', error);
    return [];
  }
}

/**
 * Clear all reminder alarms
 * @returns {Promise<boolean>} Success status
 */
async function clearAllReminders() {
  try {
    const reminders = await getAllReminders();
    for (const reminder of reminders) {
      await chrome.alarms.clear(reminder.name);
    }
    return true;
  } catch (error) {
    console.error('[TaskSense] Error clearing all reminders:', error);
    return false;
  }
}

/**
 * Build a reminder object for a task (without creating the alarm)
 * @param {string} taskId - Task ID
 * @param {string} datetime - ISO 8601 datetime
 * @returns {Object} Reminder config object
 */
function buildReminderObject(taskId, datetime) {
  return {
    enabled: true,
    datetime: datetime,
    alarmName: `reminder_${taskId}`
  };
}

/**
 * Get disabled reminder object
 * @returns {Object}
 */
function getDisabledReminder() {
  return {
    enabled: false,
    datetime: null,
    alarmName: null
  };
}

// Export functions
export {
  createReminder,
  updateReminder,
  clearReminder,
  hasReminder,
  getAllReminders,
  clearAllReminders,
  buildReminderObject,
  getDisabledReminder
};