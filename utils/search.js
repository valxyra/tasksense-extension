/**
 * TaskSense - Search Utility
 * Pencarian task dengan filter multi-kriteria
 */

import { getAllTasks } from './storage.js';

/**
 * Search tasks dengan query dan filters
 * @param {string} query - Search query (substring match di title, note, url, domain)
 * @param {Object} filters - Filter options
 * @param {string} filters.folderId - Filter by folder ID
 * @param {string} filters.priority - Filter by priority (low, medium, high)
 * @param {string} filters.status - Filter by status (active, completed)
 * @param {string} filters.domainTag - Filter by domain tag
 * @returns {Promise<Array>} Filtered and sorted tasks
 */
async function searchTasks(query = '', filters = {}) {
  try {
    let tasks = await getAllTasks();
    
    // Apply filters first
    if (filters.folderId !== undefined) {
      if (filters.folderId === null || filters.folderId === '') {
        // Show tasks without folder
        tasks = tasks.filter(task => !task.folderId);
      } else {
        tasks = tasks.filter(task => task.folderId === filters.folderId);
      }
    }
    
    if (filters.priority) {
      tasks = tasks.filter(task => task.priority === filters.priority);
    }
    
    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status);
    }
    
    if (filters.domainTag) {
      tasks = tasks.filter(task => task.domainTag === filters.domainTag);
    }
    
    // If no query, return filtered tasks
    if (!query || query.trim() === '') {
      return tasks;
    }
    
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search in multiple fields with relevance scoring
    const scoredTasks = tasks.map(task => {
      let score = 0;
      const title = (task.title || '').toLowerCase();
      const note = (task.note || '').toLowerCase();
      const url = (task.url || '').toLowerCase();
      const domain = (task.domain || '').toLowerCase();
      const pageTitle = (task.pageTitle || '').toLowerCase();
      
      // Title match (highest priority)
      if (title.includes(normalizedQuery)) {
        score += 10;
        // Exact match bonus
        if (title === normalizedQuery) {
          score += 5;
        }
        // Starts with bonus
        if (title.startsWith(normalizedQuery)) {
          score += 3;
        }
      }
      
      // Note match
      if (note.includes(normalizedQuery)) {
        score += 5;
      }
      
      // Domain match
      if (domain.includes(normalizedQuery)) {
        score += 4;
      }
      
      // Page title match
      if (pageTitle.includes(normalizedQuery)) {
        score += 3;
      }
      
      // URL match (lowest priority)
      if (url.includes(normalizedQuery)) {
        score += 2;
      }
      
      return { task, score };
    });
    
    // Filter out tasks with score 0 (no match)
    const matchedTasks = scoredTasks.filter(item => item.score > 0);
    
    // Sort by relevance score (descending)
    matchedTasks.sort((a, b) => b.score - a.score);
    
    // Return only the tasks (without scores)
    return matchedTasks.map(item => item.task);
  } catch (error) {
    console.error('Error searching tasks:', error);
    return [];
  }
}

/**
 * Get unique domain tags from all tasks
 * @returns {Promise<Array>} Array of unique domain tags
 */
async function getUniqueDomainTags() {
  try {
    const tasks = await getAllTasks();
    const tags = new Set();
    
    tasks.forEach(task => {
      if (task.domainTag) {
        tags.add(task.domainTag);
      }
    });
    
    return Array.from(tags).sort();
  } catch (error) {
    console.error('Error getting unique domain tags:', error);
    return [];
  }
}

/**
 * Build search index for faster searching (optional, for >100 tasks)
 * @param {Array} tasks - Array of tasks
 * @returns {Object} Inverted index
 */
function buildSearchIndex(tasks) {
  const index = {
    title: {},
    note: {},
    domain: {},
    url: {}
  };
  
  tasks.forEach(task => {
    // Index title
    if (task.title) {
      const words = task.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (!index.title[word]) {
          index.title[word] = [];
        }
        index.title[word].push(task.id);
      });
    }
    
    // Index note
    if (task.note) {
      const words = task.note.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (!index.note[word]) {
          index.note[word] = [];
        }
        index.note[word].push(task.id);
      });
    }
    
    // Index domain
    if (task.domain) {
      const domain = task.domain.toLowerCase();
      if (!index.domain[domain]) {
        index.domain[domain] = [];
      }
      index.domain[domain].push(task.id);
    }
    
    // Index URL
    if (task.url) {
      const url = task.url.toLowerCase();
      if (!index.url[url]) {
        index.url[url] = [];
      }
      index.url[url].push(task.id);
    }
  });
  
  return index;
}

/**
 * Search using pre-built index (faster for large datasets)
 * @param {string} query - Search query
 * @param {Object} index - Pre-built search index
 * @param {Array} tasks - Array of all tasks
 * @returns {Array} Matching tasks
 */
function searchWithIndex(query, index, tasks) {
  const normalizedQuery = query.toLowerCase().trim();
  const matchingIds = new Set();
  
  // Search in title index
  Object.keys(index.title).forEach(word => {
    if (word.includes(normalizedQuery)) {
      index.title[word].forEach(id => matchingIds.add(id));
    }
  });
  
  // Search in note index
  Object.keys(index.note).forEach(word => {
    if (word.includes(normalizedQuery)) {
      index.note[word].forEach(id => matchingIds.add(id));
    }
  });
  
  // Search in domain index
  Object.keys(index.domain).forEach(domain => {
    if (domain.includes(normalizedQuery)) {
      index.domain[domain].forEach(id => matchingIds.add(id));
    }
  });
  
  // Return matching tasks
  return tasks.filter(task => matchingIds.has(task.id));
}

/**
 * Highlight search query in text
 * @param {string} text - Original text
 * @param {string} query - Search query to highlight
 * @returns {string} HTML string with highlighted query
 */
function highlightQuery(text, query) {
  if (!text || !query) return text;
  
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;
  
  // Escape special regex characters
  const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Get search suggestions based on partial query
 * @param {string} partialQuery - Partial search query
 * @param {number} limit - Maximum number of suggestions
 * @returns {Promise<Array>} Array of suggestion strings
 */
async function getSearchSuggestions(partialQuery, limit = 5) {
  try {
    if (!partialQuery || partialQuery.trim().length < 2) {
      return [];
    }
    
    const tasks = await getAllTasks();
    const normalizedQuery = partialQuery.toLowerCase().trim();
    const suggestions = new Set();
    
    tasks.forEach(task => {
      // Suggest from titles
      if (task.title && task.title.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(task.title);
      }
      
      // Suggest from domains
      if (task.domain && task.domain.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(task.domain);
      }
      
      // Suggest from domain tags
      if (task.domainTag && task.domainTag.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(task.domainTag);
      }
    });
    
    return Array.from(suggestions).slice(0, limit);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

// Export functions
export {
  searchTasks,
  getUniqueDomainTags,
  buildSearchIndex,
  searchWithIndex,
  highlightQuery,
  getSearchSuggestions
};