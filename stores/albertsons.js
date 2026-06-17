// CartRadar — Albertsons Content Script
// Albertsons runs Safeway, Vons, Jewel-Osco, Shaw's, Acme, Tom Thumb
// All use the same platform — shared extraction logic
// Primary: albertsons.com, safeway.com

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
    // Albertsons/Safeway use a common platform with product cards
    await waitForSelector(
      '[data-testid="product-card"], .product-card, [class*="ProductCard"], .product-item',
      6000
    );

    const items = [];
    const cards = document.querySelectorAll(
      '[data-testid="product-card"], .product-card, [class*="ProductCard"], .product-item, [class*="search-result"]'
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

  function extractCard(card) {
    // Albertsons platform selectors — multiple fallbacks for different banner sites
    const nameEl =
      card.querySelector('[data-testid="product-title"]') ||
      card.querySelector('.product-title') ||
      card.querySelector('[class*="title"]') ||
      card.querySelector('h3') ||
      card.querySelector('[class*="description"]');

    const priceEl =
      card.querySelector('[data-testid="product-price"]') ||
      card.querySelector('.product-price') ||
      card.querySelector('[class*="price"]:not([class*="was"]):not([class*="strikethrough"])') ||
      card.querySelector('[class*="Price"]');

    const sizeEl =
      card.querySelector('[data-testid="product-size"]') ||
      card.querySelector('.product-size') ||
      card.querySelector('[class*="size"]');

    const imgEl = card.querySelector('img');
    const linkEl = card.querySelector('a[href*="/product/"], a[href*="/p/"], a');

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
    return name
      .replace(/^sponsored\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 120);
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
