// CartRadar — Whole Foods Content Script
// Whole Foods is Amazon-owned — products accessible via wholefoodsmarket.com
// Also available through Amazon Fresh

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
    // Whole Foods search results
    await waitForSelector(
      '[data-testid="product-card"], .product-card, [class*="ProductTile"], [class*="product"]',
      6000
    );

    const items = [];
    const cards = document.querySelectorAll(
      '[data-testid="product-card"], .product-card, [class*="ProductTile"], [class*="product-item"], [class*="search-result"]'
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
    // Whole Foods product card — Amazon-style markup
    const nameEl =
      card.querySelector('[data-testid="product-title"]') ||
      card.querySelector('.product-title') ||
      card.querySelector('[class*="Title"]') ||
      card.querySelector('h3') ||
      card.querySelector('span[class*="name"]');

    const priceEl =
      card.querySelector('[data-testid="product-price"]') ||
      card.querySelector('.product-price') ||
      card.querySelector('[class*="Price"]') ||
      card.querySelector('span[class*="price"]');

    const sizeEl =
      card.querySelector('[data-testid="product-size"]') ||
      card.querySelector('.product-size') ||
      card.querySelector('[class*="Size"]');

    const imgEl = card.querySelector('img');
    const linkEl = card.querySelector('a[href*="/product/"], a');

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
    // Handle Whole Foods "Prime Member Price" dual pricing
    const lines = str.split('\n');
    for (const line of lines) {
      const match = line.match(/\$?([\d,]+\.?\d*)/);
      if (match) return parseFloat(match[1].replace(/,/g, ''));
    }
    return 0;
  }

  function cleanName(name) {
    return name
      .replace(/^sponsored\s*/i, '')
      .replace(/whole foods market\s*/i, '')
      .replace(/365 by whole foods\s*/i, '')
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
