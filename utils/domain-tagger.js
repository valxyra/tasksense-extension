/**
 * TaskSense - Domain Tagger
 * Auto-tagging berdasarkan domain URL dengan support custom tags
 */

// Default domain tag mapping
const DEFAULT_DOMAIN_TAG_MAP = {
  // Development & Docs
  'github.com': { tag: 'Dev', color: '#24292E' },
  'gitlab.com': { tag: 'Dev', color: '#FC6D26' },
  'bitbucket.org': { tag: 'Dev', color: '#0052CC' },
  'stackoverflow.com': { tag: 'Dev', color: '#F48024' },
  'developer.mozilla.org': { tag: 'Docs', color: '#005AF0' },
  'docs.docker.com': { tag: 'Docs', color: '#2496ED' },
  'docs.microsoft.com': { tag: 'Docs', color: '#0078D7' },
  'npmjs.com': { tag: 'Dev', color: '#CB3837' },
  'pypi.org': { tag: 'Dev', color: '#3775AB' },
  'rubygems.org': { tag: 'Dev', color: '#CC342D' },
  'packagist.org': { tag: 'Dev', color: '#885630' },
  'crates.io': { tag: 'Dev', color: '#dea584' },
  'hackage.haskell.org': { tag: 'Dev', color: '#A068D6' },
  
  // Learning & Content
  'youtube.com': { tag: 'Video', color: '#FF0000' },
  'vimeo.com': { tag: 'Video', color: '#1AB7EA' },
  'twitch.tv': { tag: 'Video', color: '#9146FF' },
  'udemy.com': { tag: 'Course', color: '#A435F0' },
  'coursera.org': { tag: 'Course', color: '#2E7DFF' },
  'edX.org': { tag: 'Course', color: '#24469A' },
  'khanacademy.org': { tag: 'Course', color: '#18B300' },
  'freeCodeCamp.org': { tag: 'Course', color: '#0A0A23' },
  'codecademy.com': { tag: 'Course', color: '#1F4056' },
  'pluralsight.com': { tag: 'Course', color: '#F15C20' },
  'lynda.com': { tag: 'Course', color: '#00A4CC' },
  'skillshare.com': { tag: 'Course', color: '#F26522' },
  'treehouse.com': { tag: 'Course', color: '#5E8E5A' },
  'teamtreehouse.com': { tag: 'Course', color: '#5E8E5A' },
  'egghead.io': { tag: 'Course', color: '#F0DB4F' },
  'frontendmentor.io': { tag: 'Course', color: '#3888FC' },
  'scrimba.com': { tag: 'Course', color: '#5D3FD3' },
  'css-tricks.com': { tag: 'Article', color: '#E74C3C' },
  'smashingmagazine.com': { tag: 'Article', color: '#E74C3C' },
  'alistapart.com': { tag: 'Article', color: '#3366CC' },
  'csswizardry.com': { tag: 'Article', color: '#3366CC' },
  'philipwalton.com': { tag: 'Article', color: '#3366CC' },
  'medium.com': { tag: 'Article', color: '#000000' },
  'dev.to': { tag: 'Article', color: '#0A0A0A' },
  'hashnode.com': { tag: 'Article', color: '#0072C6' },
  'substack.com': { tag: 'Article', color: '#4F6DF2' },
  'notion.so': { tag: 'Notes', color: '#000000' },
  'notion.site': { tag: 'Notes', color: '#000000' },
  'trello.com': { tag: 'Project', color: '#0052CC' },
  'asana.com': { tag: 'Project', color: '#3C8D2F' },
  'jira.com': { tag: 'Project', color: '#0052CC' },
  'figma.com': { tag: 'Design', color: '#F24E1E' },
  'dribbble.com': { tag: 'Design', color: '#EA4C89' },
  'behance.net': { tag: 'Design', color: '#1769FF' },
  'artstation.com': { tag: 'Design', color: '#6880BC' },
  'pixiv.net': { tag: 'Design', color: '#0098FF' },
  'sketch.com': { tag: 'Design', color: '#FA324A' },
  'adobe.com': { tag: 'Design', color: '#EE0000' },
  'photoshop.com': { tag: 'Design', color: '#31A9FF' },
  'illustrator.com': { tag: 'Design', color: '#FF9A00' },
  'indesign.com': { tag: 'Design', color: '#FF3366' },
  'premierepro.com': { tag: 'Design', color: '#9999FF' },
  'aftereffects.com': { tag: 'Design', color: '#CC99FF' },
  'lightroom.com': { tag: 'Design', color: '#008CFF' },
  'xd.adobe.com': { tag: 'Design', color: '#6880BC' },
  'blender.org': { tag: 'Design', color: '#F4842F' },
  'unity.com': { tag: 'Design', color: '#2296F3' },
  'unrealengine.com': { tag: 'Design', color: '#0E1528' },
  'godotengine.org': { tag: 'Design', color: '#478CBF' },
  
  // Social & Communication
  'twitter.com': { tag: 'Social', color: '#1DA1F2' },
  'x.com': { tag: 'Social', color: '#000000' },
  'facebook.com': { tag: 'Social', color: '#4267B2' },
  'instagram.com': { tag: 'Social', color: '#E1306C' },
  'linkedin.com': { tag: 'Social', color: '#0077B5' },
  'reddit.com': { tag: 'Social', color: '#FF4500' },
  'redd.it': { tag: 'Social', color: '#FF4500' },
  'discord.com': { tag: 'Chat', color: '#5865F2' },
  'discordapp.com': { tag: 'Chat', color: '#5865F2' },
  'slack.com': { tag: 'Chat', color: '#4A154B' },
  'mattermost.com': { tag: 'Chat', color: '#0052CC' },
  'telegram.org': { tag: 'Chat', color: '#2481CC' },
  'whatsapp.com': { tag: 'Chat', color: '#25D366' },
  'zoom.us': { tag: 'Video', color: '#2D8CFF' },
  'meet.google.com': { tag: 'Video', color: '#EA4335' },
  'meet.microsoft.com': { tag: 'Video', color: '#0078D7' },
  'webex.com': { tag: 'Video', color: '#EB0045' },
  
  // Productivity & Tools
  'notion.so': { tag: 'Notes', color: '#000000' },
  'trello.com': { tag: 'Project', color: '#0052CC' },
  'asana.com': { tag: 'Project', color: '#3C8D2F' },
  'jira.com': { tag: 'Project', color: '#0052CC' },
  'figma.com': { tag: 'Design', color: '#F24E1E' },
  'dribbble.com': { tag: 'Design', color: '#EA4C89' },
  'behance.net': { tag: 'Design', color: '#1769FF' },
  'artstation.com': { tag: 'Design', color: '#6880BC' },
  'pixiv.net': { tag: 'Design', color: '#0098FF' },
  'sketch.com': { tag: 'Design', color: '#FA324A' },
  'adobe.com': { tag: 'Design', color: '#EE0000' },
  'photoshop.com': { tag: 'Design', color: '#31A9FF' },
  'illustrator.com': { tag: 'Design', color: '#FF9A00' },
  'indesign.com': { tag: 'Design', color: '#FF3366' },
  'premierepro.com': { tag: 'Design', color: '#9999FF' },
  'aftereffects.com': { tag: 'Design', color: '#CC99FF' },
  'lightroom.com': { tag: 'Design', color: '#008CFF' },
  'xd.adobe.com': { tag: 'Design', color: '#6880BC' },
  'blender.org': { tag: 'Design', color: '#F4842F' },
  'unity.com': { tag: 'Design', color: '#2296F3' },
  'unrealengine.com': { tag: 'Design', color: '#0E1528' },
  'godotengine.org': { tag: 'Design', color: '#478CBF' },
  'cloudflare.com': { tag: 'Dev', color: '#F38020' },
  'aws.amazon.com': { tag: 'Dev', color: '#232F3E' },
  'azure.microsoft.com': { tag: 'Dev', color: '#0078D7' },
  'google.com': { tag: 'Search', color: '#4285F4' },
  'google.co.id': { tag: 'Search', color: '#4285F4' },
  'google.com.au': { tag: 'Search', color: '#4285F4' },
  'google.co.uk': { tag: 'Search', color: '#4285F4' },
  'google.de': { tag: 'Search', color: '#4285F4' },
  'google.fr': { tag: 'Search', color: '#4285F4' },
  'google.jp': { tag: 'Search', color: '#4285F4' },
  'google.cn': { tag: 'Search', color: '#4285F4' },
  'wikipedia.org': { tag: 'Info', color: '#EEEEEE' },
  'wikiwand.com': { tag: 'Info', color: '#4A90D9' },
  'quora.com': { tag: 'Info', color: '#B92B27' },
  'stackexchange.com': { tag: 'Info', color: '#1E4E8C' },
  'stackoverflow.blog': { tag: 'Info', color: '#EC8A3B' },
  'w3.org': { tag: 'Docs', color: '#5B8CFF' },
  'whatwg.org': { tag: 'Docs', color: '#D33682' },
  'caniuse.com': { tag: 'Docs', color: '#77B737' },
  'web.dev': { tag: 'Docs', color: '#4285F4' },
  'webplatform.org': { tag: 'Docs', color: '#5B8CFF' },
  'mdn-blogs.mozilla.org': { tag: 'Docs', color: '#005AF0' },
  'developer.mozilla.org': { tag: 'Docs', color: '#005AF0' },
  'html5rocks.com': { tag: 'Docs', color: '#FFCC00' },
  'html5doctor.com': { tag: 'Docs', color: '#C92028' },
  'alistapart.com': { tag: 'Docs', color: '#3366CC' },
  'css-tricks.com': { tag: 'Docs', color: '#E74C3C' },
  'smashingmagazine.com': { tag: 'Docs', color: '#E74C3C' },
  'filamentgroup.com': { tag: 'Docs', color: '#3C8D2F' },
  'nngroup.com': { tag: 'Docs', color: '#F26522' },
  'uxdesign.cc': { tag: 'Docs', color: '#000000' },
  'uxplanet.org': { tag: 'Docs', color: '#2D333A' },
  'boxesandarrows.com': { tag: 'Docs', color: '#333333' },
  'a11yproject.com': { tag: 'Docs', color: '#EB4D4B' },
  'accessibility-developer-guide.com': { tag: 'Docs', color: '#0074D9' },
  'webaim.org': { tag: 'Docs', color: '#4A90D9' },
  'wuhcag.org': { tag: 'Docs', color: '#0074D9' },
  'w3.org/WAI': { tag: 'Docs', color: '#5B8CFF' },
  
  // E-commerce & Shopping
  'amazon.com': { tag: 'Shopping', color: '#FF9900' },
  'amazon.co.id': { tag: 'Shopping', color: '#FF9900' },
  'amazon.co.jp': { tag: 'Shopping', color: '#FF9900' },
  'amazon.co.uk': { tag: 'Shopping', color: '#FF9900' },
  'amazon.de': { tag: 'Shopping', color: '#FF9900' },
  'amazon.fr': { tag: 'Shopping', color: '#FF9900' },
  'amazon.cn': { tag: 'Shopping', color: '#FF9900' },
  'shopee.co.id': { tag: 'Shopping', color: '#EE4D2D' },
  'tokopedia.com': { tag: 'Shopping', color: '#3366FF' },
  'lazada.co.id': { tag: 'Shopping', color: '#ED2E2E' },
  'blibli.com': { tag: 'Shopping', color: '#FF5500' },
  'jd.id': { tag: 'Shopping', color: '#D81E05' },
  'zalando.co.id': { tag: 'Shopping', color: '#FDB914' },
  'zara.com': { tag: 'Shopping', color: '#000000' },
  'uniqlo.com': { tag: 'Shopping', color: '#FF0000' },
  'netflix.com': { tag: 'Entertainment', color: '#E50914' },
  'spotify.com': { tag: 'Entertainment', color: '#1DB954' },
  'youtube.com': { tag: 'Entertainment', color: '#FF0000' },
  'twitch.tv': { tag: 'Entertainment', color: '#9146FF' },
  'steamcommunity.com': { tag: 'Entertainment', color: '#171A21' },
  'epicgames.com': { tag: 'Entertainment', color: '#333333' },
  'playstation.com': { tag: 'Entertainment', color: '#003791' },
  'xbox.com': { tag: 'Entertainment', color: '#107C10' },
  
  // News & Media
  'bbc.com': { tag: 'News', color: '#C8102E' },
  'cnn.com': { tag: 'News', color: '#CC0000' },
  'reuters.com': { tag: 'News', color: '#114477' },
  'bloomberg.com': { tag: 'News', color: '#00AEE1' },
  'cnbc.com': { tag: 'News', color: '#00B362' },
  'foxnews.com': { tag: 'News', color: '#A52624' },
  'nytimes.com': { tag: 'News', color: '#000000' },
  'theguardian.com': { tag: 'News', color: '#052962' },
  'washingtonpost.com': { tag: 'News', color: '#000000' },
  'latimes.com': { tag: 'News', color: '#000000' },
  'theatlantic.com': { tag: 'News', color: '#000000' },
  'newyorker.com': { tag: 'News', color: '#000000' },
  'medium.com': { tag: 'News', color: '#000000' },
  'substack.com': { tag: 'News', color: '#4F6DF2' },
  'twitch.tv': { tag: 'Entertainment', color: '#9146FF' },
  'tiktok.com': { tag: 'Entertainment', color: '#000000' },
  'instagram.com': { tag: 'Entertainment', color: '#E1306C' },
  'facebook.com': { tag: 'Social', color: '#4267B2' },
  'twitter.com': { tag: 'Social', color: '#1DA1F2' },
  'x.com': { tag: 'Social', color: '#000000' },
  'linkedin.com': { tag: 'Social', color: '#0077B5' },
  'reddit.com': { tag: 'Social', color: '#FF4500' },
  'redd.it': { tag: 'Social', color: '#FF4500' },
  
  // Default fallback
  'default': { tag: 'Link', color: '#6B7280' }
};

/**
 * Extract domain from URL
 * @param {string} url - URL string
 * @returns {string} Domain name
 */
function extractDomain(url) {
  if (!url) return '';
  
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return '';
  }
}

/**
 * Get tag info for a domain
 * @param {string} url - URL to get tag for
 * @param {Object} customTags - Custom tag mappings
 * @returns {{ tag: string, color: string }} Tag info
 */
function getDomainTag(url, customTags = {}) {
  try {
    const domain = extractDomain(url);
    
    if (!domain) {
      return DEFAULT_DOMAIN_TAG_MAP['default'];
    }
    
    // Check custom tags first
    if (customTags[domain]) {
      return {
        tag: customTags[domain].tag || 'Custom',
        color: customTags[domain].color || '#6B7280'
      };
    }
    
    // Check exact domain match
    if (DEFAULT_DOMAIN_TAG_MAP[domain]) {
      return DEFAULT_DOMAIN_TAG_MAP[domain];
    }
    
    // Check subdomain match (e.g., docs.github.com -> github.com)
    const parts = domain.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const possibleDomain = parts.slice(i).join('.');
      if (DEFAULT_DOMAIN_TAG_MAP[possibleDomain]) {
        return DEFAULT_DOMAIN_TAG_MAP[possibleDomain];
      }
    }
    
    // Check partial match (e.g., github.com/* matches github.com)
    for (const [key] of Object.entries(DEFAULT_DOMAIN_TAG_MAP)) {
      if (domain.includes(key) && key !== 'default') {
        return DEFAULT_DOMAIN_TAG_MAP[key];
      }
    }
    
    // Fallback
    return DEFAULT_DOMAIN_TAG_MAP['default'];
  } catch (error) {
    console.error('Error getting domain tag:', error);
    return DEFAULT_DOMAIN_TAG_MAP['default'];
  }
}

/**
 * Get all available default tags
 * @returns {Array} Array of tag objects
 */
function getAllDefaultTags() {
  const tags = new Set();
  
  for (const value of Object.values(DEFAULT_DOMAIN_TAG_MAP)) {
    tags.add(value.tag);
  }
  
  return Array.from(tags).sort();
}

/**
 * Get all default tag colors
 * @returns {Object} Map of tag to color
 */
function getTagColors() {
  const tagColors = {};
  
  for (const [domain, info] of Object.entries(DEFAULT_DOMAIN_TAG_MAP)) {
    if (!tagColors[info.tag]) {
      tagColors[info.tag] = info.color;
    }
  }
  
  return tagColors;
}

/**
 * Add custom domain tag mapping
 * @param {Object} customTags - Existing custom tags
 * @param {string} domain - Domain to add
 * @param {string} tag - Tag name
 * @param {string} color - Hex color
 * @returns {Object} Updated custom tags
 */
function addCustomTag(customTags, domain, tag, color) {
  return {
    ...customTags,
    [domain]: { tag, color }
  };
}

/**
 * Remove custom domain tag mapping
 * @param {Object} customTags - Existing custom tags
 * @param {string} domain - Domain to remove
 * @returns {Object} Updated custom tags
 */
function removeCustomTag(customTags, domain) {
  const { [domain]: _, ...rest } = customTags;
  return rest;
}

/**
 * Update custom domain tag mapping
 * @param {Object} customTags - Existing custom tags
 * @param {string} domain - Domain to update
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated custom tags
 */
function updateCustomTag(customTags, domain, updates) {
  if (!customTags[domain]) {
    return customTags;
  }
  
  return {
    ...customTags,
    [domain]: {
      ...customTags[domain],
      ...updates
    }
  };
}

// Export functions
export {
  extractDomain,
  getDomainTag,
  getAllDefaultTags,
  getTagColors,
  addCustomTag,
  removeCustomTag,
  updateCustomTag,
  DEFAULT_DOMAIN_TAG_MAP
};