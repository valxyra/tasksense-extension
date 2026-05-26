/**
 * TaskSense - i18n Helper
 * Automatically replaces text for elements with data-i18n attributes
 */

export function initI18n() {
  // Replace text content
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const messageKey = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(messageKey);
    if (message) {
      el.textContent = message;
    }
  });

  // Replace placeholders
  const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
  placeholders.forEach(el => {
    const messageKey = el.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(messageKey);
    if (message) {
      el.placeholder = message;
    }
  });
}
