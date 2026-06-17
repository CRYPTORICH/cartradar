// CartRadar — Publix Content Script
// Publix is the dominant Southeast US grocer (Florida, Georgia, Alabama, SC, TN, VA, NC)
// Online shopping at publix.com — products load via their internal API

(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT') {
      extractProducts(message.query)
        .then(items => sendResponse(items))
        .catch(err => sendResponse([]));
      return true;
    }
  });

  async function extractProducts(query) {
    // Try Publix product API first
    try {
      const items = await extractFromAPI(query);
      if (items.length > 0) return items.slice(0, 15);
    } catch (e) {}

    // DOM fallback
    await waitForSelector('[class*="product"], .product-item, [class*="search-result"]', 5000);

    const items = [];
    const cards = document.querySelectorAll(
      '[class*="product-card"], [class*="ProductCard"], .product-item, [class*="search-result-item"]'
    );

    cards.forEach((card, i) => {
      if (i >= 15) return;
      try {
        const item = extractCard(card);
        if (item && item.name && item.price > 0) items.push(item);
      } catch (e) {}
    });

    return items;
  }

  async function extractFromAPI(query) {
    // Publix product search API — their SPA calls this
    const resp = await fetch(
      `https://www.publix.com/api/search?q=${encodeURIComponent(query)}&limit=15`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    const products = data?.products || data?.items || data?.results || [];

    return products.map(p => ({
      name: cleanName(p.name || p.title || p.productName || ''),
      price: parseFloat(p.price || p.currentPrice || p.retailPrice || 0),
      size: p.size || p.packageSize || p.description || '',
      image: p.image || p.imageUrl || p.thumbnail || '',
      url: p.url || `https://www.publix.com/product/${p.id || p.sku || ''}`,
      unitPrice: calcUnitPrice(
        parseFloat(p.price || p.currentPrice || 0),
        p.size || ''
      ),
      upc: p.upc || p.gtin || null
    })).filter(item => item.name && item.price > 0);
  }

  function extractCard(card) {
    const nameEl = card.querySelector('h3, [class*="title"], [class*="name"], [class*="description"]');
    const priceEl = card.querySelector('[class*="price"], [class*="Price"], [class*="amount"]');
    const sizeEl = card.querySelector('[class*="size"], [class*="weight"]');
    const imgEl = card.querySelector('img');
    const linkEl = card.querySelector('a');

    const name = nameEl?.textContent?.trim() || '';
    const priceStr = priceEl?.textContent?.trim() || '';
    const price = parsePrice(priceStr);

    if (!name || price <= 0) return null;

    return {
      name: cleanName(name),
      price,
      size: sizeEl?.textContent?.trim() || '',
      image: imgEl?.src || imgEl?.dataset?.src || '',
      url: linkEl?.href || '',
      unitPrice: calcUnitPrice(price, sizeEl?.textContent?.trim() || ''),
      upc: null
    };
  }

  function parsePrice(str) {
    if (!str) return 0;
    const match = str.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  }

  function cleanName(name) {
    return name.replace(/\s{2,}/g, ' ').trim().substring(0, 120);
  }

  function calcUnitPrice(price, sizeStr) {
    if (!price || !sizeStr) return '';
    const match = sizeStr.match(/([\d.]+)\s*(oz|lb|lbs|fl oz|gal|qt|pt|ct|count|each)/i);
    if (!match) return '';
    const qty = parseFloat(match[1]);
    if (!qty || qty === 0) return '';
    return `$${(price / qty).toFixed(2)}/${match[2].toLowerCase()}`;
  }

  function waitForSelector(selector, timeout) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) return resolve();
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
    });
  }
})();
