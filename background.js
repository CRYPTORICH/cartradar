// CartRadar Background Service Worker
// Fans out search requests to store content scripts via tab injection

const STORE_CONFIG = {
  walmart: {
    name: 'Walmart',
    url: (query, zip) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}&stores=${zip}`,
    icon: '🟦'
  },
  kroger: {
    name: 'Kroger',
    url: (query, zip) => `https://www.kroger.com/search?query=${encodeURIComponent(query)}&fulfillment=all`,
    icon: '🔷'
  },
  target: {
    name: 'Target',
    url: (query, zip) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}&zip=${zip}`,
    icon: '🎯'
  },
  aldi: {
    name: 'Aldi',
    url: (query, zip) => `https://www.aldi.us/en/search/?q=${encodeURIComponent(query)}`,
    icon: '🟧'
  },
  albertsons: {
    name: 'Albertsons',
    url: (query, zip) => `https://www.albertsons.com/shop/search?q=${encodeURIComponent(query)}`,
    icon: '🔴'
  },
  publix: {
    name: 'Publix',
    url: (query, zip) => `https://www.publix.com/search?q=${encodeURIComponent(query)}`,
    icon: '🟢'
  },
  wholefoods: {
    name: 'Whole Foods',
    url: (query, zip) => `https://www.wholefoodsmarket.com/search?text=${encodeURIComponent(query)}`,
    icon: '🌿'
  },
  heb: {
    name: 'H-E-B',
    url: (query, zip) => `https://www.heb.com/search/?q=${encodeURIComponent(query)}`,
    icon: '🔴'
  }
};

// In-memory cache: 5 min TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    handleSearch(message.store, message.query, message.zipcode)
      .then(sendResponse)
      .catch(err => sendResponse({ items: [], error: err.message }));
    return true; // async response
  }
});

async function handleSearch(store, query, zipcode) {
  const cacheKey = `${store}:${query}:${zipcode}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { items: cached.items };
  }

  const config = STORE_CONFIG[store];
  if (!config) return { items: [], error: `Unknown store: ${store}` };

  const url = config.url(query, zipcode);

  try {
    // Create or reuse a tab for this store
    let tab = await findOrCreateTab(store, url);

    // Wait for page load + content script to inject
    await waitForTabLoad(tab.id, 8000);

    // Ask the content script to extract results
    const items = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT',
      store,
      query
    });

    // Cache
    cache.set(cacheKey, { items, ts: Date.now() });

    return { items: items || [] };
  } catch (err) {
    console.error(`CartRadar ${store} error:`, err.message);
    return { items: [], error: err.message };
  }
}

// Tab management — keep one tab per store, reuse for subsequent searches
const storeTabs = {};

async function findOrCreateTab(store, url) {
  // Check if existing tab is still alive
  try {
    const existing = storeTabs[store];
    if (existing) {
      const tab = await chrome.tabs.get(existing);
      // Reuse: navigate to new URL
      await chrome.tabs.update(existing, { url, active: false });
      return tab;
    }
  } catch (e) {
    // Tab was closed, create new
  }

  const tab = await chrome.tabs.create({ url, active: false });
  storeTabs[store] = tab.id;
  return tab;
}

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Don't reject — content script may still work
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // Extra wait for SPA hydration
        setTimeout(resolve, 1500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Cleanup tabs older than 30 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > CACHE_TTL * 2) cache.delete(key);
  }
}, 60 * 1000);
