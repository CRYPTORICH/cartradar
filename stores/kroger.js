// CartRadar — Kroger Content Script
// Extracts product data from Kroger search results
// Kroger has a public API (developer.kroger.com) — this is the legitimate path
// DOM extraction as fallback

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
    // Primary: DOM extraction from search results
    await waitForSelector('[data-testid="SearchResults"], .SearchResults, .kds-Card', 6000);

    const items = [];
    const cards = document.querySelectorAll(
      '[data-testid="SearchResult"], .SearchResult, [class*="ProductCard"], .kds-Card'
    );

    cards.forEach((card, i) => {
      if (i >= 15) return;

      try {
        const item = extractCard(card);
        if (item && item.name && item.price > 0) {
          items.push(item);
        }
      } catch (e) {
        // skip
      }
    });

    return items;
  }

  function extractCard(card) {
    // Kroger's DOM structure — multiple selectors for resilience
    const nameEl =
      card.querySelector('[data-testid="product-title"]') ||
      card.querySelector('.kds-Text--l') ||
      card.querySelector('h3') ||
      card.querySelector('[class*="title"]');

    const priceEl =
      card.querySelector('[data-testid="product-price"]') ||
      card.querySelector('.kds-Price') ||
      card.querySelector('[class*="price"]') ||
      card.querySelector('[class*="Price"]');

    const sizeEl =
      card.querySelector('[data-testid="product-size"]') ||
      card.querySelector('.kds-Text--s') ||
      card.querySelector('[class*="size"]');

    const imgEl =
      card.querySelector('img[data-testid="product-image"]') ||
      card.querySelector('img[src*="kroger"]') ||
      card.querySelector('img');

    const linkEl =
      card.querySelector('a[data-testid="product-link"]') ||
      card.querySelector('a[href*="/p/"]') ||
      card.querySelector('a');

    const name = nameEl?.textContent?.trim() || '';
    const priceStr = priceEl?.textContent?.trim() || '';
    const price = parsePrice(priceStr);
    const size = sizeEl?.textContent?.trim() || '';
    const image = imgEl?.src || imgEl?.dataset?.src || '';
    const url = linkEl?.href || '';

    if (!name || price <= 0) return null;

    const unitPrice = calcUnitPrice(price, size);

    return {
      name: cleanName(name),
      price,
      size,
      image,
      url,
      unitPrice,
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
      .replace(/kroger\s*brand\s*/i, '')
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
    const unitPrice = price / qty;
    return `$${unitPrice.toFixed(2)}/${match[2].toLowerCase()}`;
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
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }
})();
