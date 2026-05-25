/**
 * TaskSense - Content Script
 * Mengambil metadata dari halaman aktif (DOM) dan mengirimkannya ke popup.
 *
 * PENTING: Content script berjalan di konteks halaman web.
 * chrome.tabs.query TIDAK tersedia di sini — metadata diambil dari DOM.
 */

/**
 * Ekstrak URL favicon dari elemen <link> di halaman.
 * Prioritas: apple-touch-icon > shortcut icon > icon > /favicon.ico
 * @returns {string|null}
 */
function getFaviconUrl() {
  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="icon"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.href) {
      return el.href;
    }
  }

  // Fallback ke /favicon.ico di root domain
  try {
    const { origin } = new URL(window.location.href);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * Ekstrak metadata dari halaman saat ini.
 * @returns {Object} metadata
 */
function getPageMetadata() {
  const url = window.location.href;
  let domain = '';

  try {
    domain = new URL(url).hostname;
  } catch {
    domain = '';
  }

  // Coba ambil deskripsi dari meta tag
  const descriptionEl = document.querySelector('meta[name="description"]');
  const description = descriptionEl ? descriptionEl.getAttribute('content') || '' : '';

  return {
    url,
    pageTitle: document.title || '',
    favicon: getFaviconUrl(),
    domain,
    description,
  };
}

// Dengarkan pesan dari popup.js
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_TAB_METADATA') {
    try {
      const metadata = getPageMetadata();
      sendResponse({ success: true, metadata });
    } catch (error) {
      console.error('[TaskSense] Error getting page metadata:', error);
      sendResponse({ success: false, error: error.message, metadata: null });
    }
    // Tidak perlu return true karena sendResponse dipanggil secara sinkron
  }
});