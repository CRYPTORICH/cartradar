// CartRadar Web App v4 — Warm consumer UI
// Features: yearly savings calc, GasBuddy-style cards, ZIP region filtering

const CFG = {
  apiBase: 'http://localhost:8767',
  allStores: ['walmart', 'kroger', 'target', 'aldi', 'albertsons', 'publix', 'wholefoods', 'heb'],
  storeMeta: {
    walmart:    { name:'Walmart',    cls:'sb-walmart',    domain:'walmart.com',    regions:['all'] },
    kroger:     { name:'Kroger',     cls:'sb-kroger',     domain:'kroger.com',     regions:['all'] },
    target:     { name:'Target',     cls:'sb-target',     domain:'target.com',     regions:['all'] },
    aldi:       { name:'Aldi',       cls:'sb-aldi',       domain:'aldi.us',        regions:['all'] },
    albertsons: { name:'Albertsons', cls:'sb-albertsons', domain:'albertsons.com', regions:['west','southwest','mountain'] },
    publix:     { name:'Publix',     cls:'sb-publix',     domain:'publix.com',     regions:['southeast'] },
    wholefoods: { name:'Whole Foods',cls:'sb-wholefoods', domain:'wholefoodsmarket.com', regions:['all'] },
    heb:        { name:'H-E-B',      cls:'sb-heb',        domain:'heb.com',        regions:['texas'] },
  },
  // Yearly savings assumes: avg household buys 4 of each item type per month, 1 shopping/week
  TRIPS_PER_YEAR: 52,
};

// State
let enabledStores = ['walmart','kroger','target','aldi'];
let detectedZipRegion = null;

// DOM
const $ = id => document.getElementById(id);
const q = $('query'), zip = $('zip'), btn = $('search-btn'),
  statusEl = $('status'), resultsSection = $('results-section'),
  resultGrid = $('result-grid'), empty = $('empty'),
  summary = $('summary'), breakdown = $('breakdown'),
  toggles = $('store-toggles');

// ========== INIT ==========
function init() {
  loadPrefs();
  renderToggles();
  detectLocation();
  checkServer();

  btn.addEventListener('click', doSearch);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  zip.addEventListener('input', () => {
    if (zip.value.length === 5) detectRegion();
  });
  if (zip.value.length === 5) detectRegion();
}

// ========== LOCATION & REGION ==========
function detectLocation() {
  if (zip.value && zip.value.length === 5) return;

  zip.classList.add('loading');
  zip.placeholder = 'Detecting...';

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const resp = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
          );
          const data = await resp.json();
          if (data.postcode) {
            zip.value = data.postcode;
            savePrefs();
            detectRegion();
          }
        } catch(e) { /* fallback */ }
        zip.classList.remove('loading');
        zip.placeholder = 'ZIP code';
      },
      () => {
        zip.classList.remove('loading');
        zip.placeholder = 'ZIP code';
      },
      { timeout: 5000, maximumAge: 3600000 }
    );
  } else {
    zip.classList.remove('loading');
    zip.placeholder = 'ZIP code';
  }
}

async function detectRegion() {
  const z = zip.value.trim();
  if (z.length !== 5) return;

  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const state = data.places?.[0]?.state || '';
    detectedZipRegion = stateToRegion(state);
    renderToggles();
  } catch(e) { /* offline — keep all stores */ }
}

function stateToRegion(state) {
  const map = {
    'AL':'southeast','FL':'southeast','GA':'southeast','SC':'southeast','TN':'southeast','VA':'southeast','NC':'southeast','MS':'southeast',
    'TX':'texas','OK':'texas','AR':'texas','LA':'texas',
    'CA':'west','OR':'west','WA':'west','NV':'west','AZ':'mountain','NM':'mountain','CO':'mountain','UT':'mountain','ID':'mountain','MT':'mountain','WY':'mountain',
    'IL':'midwest','MI':'midwest','OH':'midwest','IN':'midwest','WI':'midwest','MN':'midwest','IA':'midwest','MO':'midwest','KS':'midwest','NE':'midwest','SD':'midwest','ND':'midwest',
    'NY':'northeast','NJ':'northeast','PA':'northeast','MA':'northeast','CT':'northeast','RI':'northeast','NH':'northeast','VT':'northeast','ME':'northeast','MD':'northeast','DE':'northeast','DC':'northeast',
    'KY':'southeast','WV':'southeast',
  };
  return map[state] || 'all';
}

// ========== SERVER CHECK ==========
async function checkServer() {
  try {
    const resp = await fetch(`${CFG.apiBase}/`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) setStatus('✅ Ready — search any grocery item above');
  } catch(e) {
    setStatus('⚠️ Server offline — start with: python3 server.py (try demo items: milk, eggs, chicken)');
  }
}
setInterval(checkServer, 30000);

// ========== PREFERENCES ==========
function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem('cartradar_prefs') || '{}');
    if (saved.zip) zip.value = saved.zip;
    if (saved.stores) enabledStores = saved.stores;
  } catch(e) { /* ignore */ }
}
function savePrefs() {
  localStorage.setItem('cartradar_prefs', JSON.stringify({
    zip: zip.value,
    stores: enabledStores,
  }));
}

// ========== STORE TOGGLES ==========
function renderToggles() {
  const region = detectedZipRegion;
  toggles.innerHTML = CFG.allStores.map(store => {
    const meta = CFG.storeMeta[store];
    const active = enabledStores.includes(store);

    // Region hint
    let regionNote = '';
    if (region && !meta.regions.includes('all') && !meta.regions.includes(region)) {
      regionNote = ` — may not be in your area`;
    }

    return `<label class="store-toggle ${active ? 'active' : ''}" data-store="${store}">
      <input type="checkbox" ${active ? 'checked' : ''} onchange="toggleStore('${store}', this.checked)">
      <span class="dot"></span>${meta.name}${regionNote}
    </label>`;
  }).join('');
}
function toggleStore(store, on) {
  if (on) {
    if (!enabledStores.includes(store)) enabledStores.push(store);
  } else {
    enabledStores = enabledStores.filter(s => s !== store);
  }
  savePrefs();
  renderToggles();
}
window.toggleStore = toggleStore;

// ========== SEARCH ==========
async function doSearch() {
  const queryStr = q.value.trim();
  const zipcode = zip.value.trim();

  if (!queryStr) return setStatus('Type a grocery item to compare prices');
  if (!zipcode || zipcode.length !== 5) return setStatus('Enter a 5-digit ZIP code');

  savePrefs();
  detectRegion();

  btn.disabled = true;
  btn.textContent = `Checking ${enabledStores.length} stores...`;
  setStatus(`<span class="spinner"></span> Comparing prices across ${enabledStores.length} stores...`);
  resultsSection.classList.remove('show');
  empty.style.display = 'none';

  const start = Date.now();

  try {
    const resp = await fetch(`${CFG.apiBase}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryStr, zipcode, stores: enabledStores })
    });

    const data = await resp.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!data.items || data.items.length === 0) {
      setStatus(`No results — try a common item like "milk" or "eggs" (${elapsed}s)`);
      empty.style.display = 'block';
      resultsSection.classList.remove('show');
      return;
    }

    renderResults(data.items, elapsed);
  } catch (err) {
    setStatus('❌ Cannot reach the server. Make sure server.py is running on port 8766.');
    empty.style.display = 'block';
    resultsSection.classList.remove('show');
  }

  btn.disabled = false;
  btn.textContent = 'Compare Prices';
}

// ========== RENDER ==========
function renderResults(items, elapsed) {
  // Sort by price ascending
  items.sort((a, b) => a.price - b.price);

  const cheapest = items[0];
  const mostExpensive = items[items.length - 1];
  const savingsVsMostExpensive = mostExpensive.price - cheapest.price;
  const yearlySavings = Math.round(savingsVsMostExpensive * CFG.TRIPS_PER_YEAR);

  // Summary bar
  const storeCount = [...new Set(items.map(i => i.store))].length;
  if (yearlySavings > 0) {
    summary.innerHTML = `💰 <span class="savings-highlight">$${yearlySavings.toLocaleString()}</span> you could save per year by buying from the cheapest store — ${items.length} results across ${storeCount} stores (${elapsed}s)`;
  } else {
    summary.innerHTML = `📊 ${items.length} results across ${storeCount} stores — prices are similar (${elapsed}s)`;
  }

  // Result cards
  resultGrid.innerHTML = items.map((item, idx) => {
    const meta = CFG.storeMeta[item.store] || { name: item.store, cls: '', domain: '' };
    const isBest = idx === 0;
    const diffFromBest = item.price - cheapest.price;

    // Yearly loss if always buying from this store
    const yearlyLoss = Math.round(diffFromBest * CFG.TRIPS_PER_YEAR);

    let savingsHtml = '';
    if (isBest) {
      savingsHtml = `<div class="result-savings good">Best price 🏆</div>`;
    } else if (diffFromBest > 0) {
      const pct = Math.round((diffFromBest / cheapest.price) * 100);
      savingsHtml = `<div class="result-savings bad">+$${diffFromBest.toFixed(2)} more (${pct}% higher)</div>`;
      if (yearlyLoss > 0) {
        savingsHtml += `<div class="yearly-loss">That's <strong>$${yearlyLoss.toLocaleString()}/year</strong> lost choosing ${meta.name}</div>`;
      }
    }

    const url = item.url || `https://www.${meta.domain}/search?q=${encodeURIComponent(item.name || '')}`;

    return `<div class="result-card ${isBest ? 'best-deal' : ''}" onclick="window.open('${escAttr(url)}', '_blank')">
      <div class="store-badge ${meta.cls}">${meta.name}</div>
      <div class="result-info">
        <div class="result-name">${escHtml(item.name)}</div>
        ${item.size ? `<div class="result-size">${escHtml(item.size)}</div>` : ''}
      </div>
      <div class="result-price-col">
        <div class="result-price">$${item.price.toFixed(2)}</div>
        ${item.unitPrice ? `<div class="result-unit">${escHtml(item.unitPrice)}</div>` : ''}
        ${savingsHtml}
      </div>
      <div class="result-arrow">→</div>
    </div>`;
  }).join('');

  resultsSection.classList.add('show');
  empty.style.display = 'none';

  // Store breakdown
  renderBreakdown(items, elapsed);

  setStatus(`✅ Done — ${items.length} prices compared (${elapsed}s)`);
}

function renderBreakdown(items, elapsed) {
  const storesFound = new Set(items.map(i => i.store));
  let html = '';

  enabledStores.forEach(store => {
    const meta = CFG.storeMeta[store];
    const found = storesFound.has(store);
    html += `<span class="bd-item ${found ? 'ok' : ''}">${found ? '✓' : '—'} ${meta.name}</span> `;
  });

  breakdown.innerHTML = html;
}

function setStatus(msg) { statusEl.innerHTML = msg; }

// ========== HELPERS ==========
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function escAttr(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== q && document.activeElement !== zip) {
    e.preventDefault();
    q.focus();
  }
});

// Boot
init();
