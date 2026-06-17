// CartRadar — Walmart Content Script
// Extracts product data from Walmart search results pages
// Uses DOM extraction + internal API interception where available

(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT') {
      extractProducts(message.query)
        .then(items => sendResponse(items))
        .catch(err => sendResponse([]));
      return true; // async
    }
  });

  async function extractProducts(query) {
    // Wait for search results to render
    await waitForSelector('[data-testid="search-results"] [data-testid="item-stack"]', 5000);

    const items = [];
    const cards = document.querySelectorAll('[data-testid="item-stack"]');

    cards.forEach((card, i) => {
      if (i >= 15) return; // top 15 results

      try {
        const item = extractCard(card);
        if (item && item.name && item.price > 0) {
          items.push(item);
        }
      } catch (e) {
        // skip malformed cards
      }
    });

    // Fallback: try API-driven extraction if DOM is sparse
    if (items.length === 0) {
      try {
        const apiItems = await extractFromAPI(query);
        return apiItems;
      } catch (e) {
        // both methods failed
      }
    }

    return items;
  }

  function extractCard(card) {
    const nameEl = card.querySelector('[data-automation-id="product-title"], .w_iUH7, span[data-testid="product-title"]');
    const priceEl = card.querySelector('[data-automation-id="product-price"], .w_iUH7 .f2, [data-testid="price"]');
    const sizeEl = card.querySelector('.f7, [data-testid="product-size"]');
    const imgEl = card.querySelector('img[data-testid="product-image"], img[src*="i5.walmartimages"]');
    const linkEl = card.querySelector('a[link-identifier="item-title"], a[href*="/ip/"]');

    const name = nameEl?.textContent?.trim() || '';
    const priceStr = priceEl?.textContent?.trim() || '';
    const price = parsePrice(priceStr);
    const size = sizeEl?.textContent?.trim() || '';
    const image = imgEl?.src || imgEl?.dataset?.src || '';
    const url = linkEl?.href || '';

    if (!name || price <= 0) return null;

    // Calculate unit price
    const unitPrice = calcUnitPrice(price, size);

    return {
      name: cleanName(name),
      price,
      size,
      image,
      url,
      unitPrice,
      upc: null // Walmart doesn't expose UPC in search results DOM
    };
  }

  async function extractFromAPI(query) {
    // Walmart's internal search API (used by their SPA)
    // This endpoint requires no auth token — it's called by the search page
    const apiUrl = `https://www.walmart.com/orchestra/home/api/search/query?query=${encodeURIComponent(query)}&page=1&prg=desktop&size=20`;

    const resp = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) throw new Error(`API ${resp.status}`);

    const data = await resp.json();
    const itemStacks = data?.searchContent?.preso?.items || [];

    return itemStacks.map(item => {
      const product = item.product || item;
      const priceInfo = product.priceInfo || product.price || {};
      const price = priceInfo.currentPrice || priceInfo.price || 0;

      return {
        name: cleanName(product.name || product.title || ''),
        price: typeof price === 'number' ? price : parseFloat(price) || 0,
        size: product.size || product.description || '',
        image: product.imageUrl || product.image || '',
        url: product.productPageURL || `https://www.walmart.com/ip/${product.usItemId || product.id}`,
        unitPrice: calcUnitPrice(
          typeof price === 'number' ? price : parseFloat(price) || 0,
          product.size || product.description || ''
        ),
        upc: product.upc || product.gtin || null
      };
    }).filter(item => item.name && item.price > 0);
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
