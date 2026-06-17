// CartRadar Popup — orchestrates search across all stores
const STORES = ['walmart', 'kroger', 'target', 'aldi', 'albertsons', 'publix', 'wholefoods', 'heb'];

const STORE_NAMES = {
  walmart: 'Walmart',
  kroger: 'Kroger',
  target: 'Target',
  aldi: 'Aldi',
  albertsons: 'Albertsons',
  publix: 'Publix',
  wholefoods: 'Whole Foods',
  heb: 'H-E-B'
};

const STORE_CSS = {
  walmart: 'store-walmart',
  kroger: 'store-kroger',
  target: 'store-target',
  aldi: 'store-aldi',
  albertsons: 'store-albertsons',
  publix: 'store-publix',
  wholefoods: 'store-wholefoods',
  heb: 'store-heb'
};

const q = document.getElementById('query');
const zip = document.getElementById('zipcode');
const btn = document.getElementById('search-btn');
const status = document.getElementById('status');
const resultsEl = document.getElementById('results');
const resultsList = document.getElementById('results-list');
const emptyState = document.getElementById('empty-state');

// Load saved zip
chrome.storage.local.get('zipcode', (data) => {
  if (data.zipcode) zip.value = data.zipcode;
});

btn.addEventListener('click', search);
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') search();
});

async function search() {
  const query = q.value.trim();
  const zipcode = zip.value.trim();

  if (!query) {
    status.textContent = 'Enter a search term';
    return;
  }
  if (!zipcode || zipcode.length !== 5) {
    status.textContent = 'Enter a 5-digit ZIP code';
    return;
  }

  // Save zip
  chrome.storage.local.set({ zipcode });

  btn.classList.add('loading');
  btn.textContent = 'Searching 8 stores...';
  status.innerHTML = '<span class="spinner"></span> Checking all 8 stores...';
  resultsEl.style.display = 'none';
  emptyState.style.display = 'none';

  // Fan out to all stores simultaneously
  const results = await Promise.allSettled(
    STORES.map(store => searchStore(store, query, zipcode))
  );

  // Flatten and normalize
  let allItems = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      allItems = allItems.concat(r.value.map(item => ({
        ...item,
        store: STORES[i]
      })));
    }
  });

  btn.classList.remove('loading');
  btn.textContent = 'Search All Stores';

  if (allItems.length === 0) {
    status.textContent = 'No results found across any store';
    emptyState.style.display = 'block';
    return;
  }

  // Sort by price
  allItems.sort((a, b) => a.price - b.price);

  // Mark cheapest
  const cheapestPrice = allItems[0].price;
  allItems.forEach(item => {
    item.isCheapest = item.price === cheapestPrice;
  });

  renderResults(allItems);
}

async function searchStore(store, query, zipcode) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SEARCH', store, query, zipcode },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`${store}: ${chrome.runtime.lastError.message}`);
          resolve(null);
        } else {
          resolve(response?.items || null);
        }
      }
    );
  });
}

function renderResults(items) {
  const storeCount = [...new Set(items.map(i => i.store))].length;
  status.textContent = `${items.length} results across ${storeCount} stores`;
  resultsList.innerHTML = '';

  items.forEach((item, idx) => {
    const row = document.createElement('a');
    row.className = `result-row ${item.isCheapest ? 'cheapest' : ''} ${idx % 2 === 1 ? 'alt' : ''}`;
    row.href = item.url;
    row.target = '_blank';
    row.rel = 'noopener';

    const storeClass = STORE_CSS[item.store] || '';
    const storeName = STORE_NAMES[item.store] || item.store;

    row.innerHTML = `
      <span class="store-badge ${storeClass}">${storeName}</span>
      <span class="item-col">
        <span class="item-name">${esc(item.name)}</span>
        <span class="item-size">${esc(item.size || '')}</span>
      </span>
      <span class="price">$${item.price.toFixed(2)}</span>
      <span class="unit-price">${esc(item.unitPrice || '')}</span>
    `;

    resultsList.appendChild(row);
  });

  resultsEl.style.display = 'flex';
  emptyState.style.display = 'none';
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
