// CartRadar — Target Content Script
// Extracts product data from Target search results
// Target uses React + internal API at redsky.target.com

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
    // Primary: intercept Target's internal search API
    // Target's SPA calls redsky.target.com for search results
    try {
      const items = await extractFromAPI(query);
      if (items.length > 0) return items;
    } catch (e) {
      // fall through to DOM
    }

    // Fallback: DOM extraction
    await waitForSelector('[data-test="product-grid"] [data-test="product-card"], [data-testid="productCard"]', 5000);

    const items = [];
    const cards = document.querySelectorAll(
      '[data-test="product-card"], [data-testid="productCard"], [class*="ProductCard"]'
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

  async function extractFromAPI(query) {
    // Target's RedSky API — powers their search
    const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&keyword=${encodeURIComponent(query)}&count=20&default_purchasability_filter=true&pricing_store_id=DEFAULT`;

    const resp = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) throw new Error(`API ${resp.status}`);

    const data = await resp.json();
    const products = data?.data?.search?.products || [];

    return products.map(product => {
      const item = product.item || product;
      const price = item?.price?.formatted_current_price ||
                    item?.price?.current_retail ||
                    0;
      const priceNum = typeof price === 'string'
        ? parseFloat(price.replace(/[^0-9.]/g, ''))
        : (price || 0);

      return {
        name: cleanName(item?.product_description?.title || product.title || ''),
        price: priceNum,
        size: item?.product_description?.downstream_description || '',
        image: item?.enrichment?.images?.primary_image_url ||
               item?.images?.[0]?.url || '',
        url: `https://www.target.com/p/${item?.tcin || product.tcin}`,
        unitPrice: calcUnitPrice(priceNum, item?.product_description?.downstream_description || ''),
        upc: item?.product_description?.upc || null,
        tcin: item?.tcin || product.tcin || null
      };
    }).filter(item => item.name && item.price > 0).slice(0, 15);
  }

  function extractCard(card) {
    const nameEl =
      card.querySelector('[data-test="product-title"]') ||
      card.querySelector('[data-testid="productTitle"]') ||
      card.querySelector('a[data-test="product-title"]');

    const priceEl =
      card.querySelector('[data-test="current-price"]') ||
      card.querySelector('[data-testid="price"]') ||
      card.querySelector('span[class*="Price"]');

    const sizeEl =
      card.querySelector('[data-test="product-size"]') ||
      card.querySelector('[class*="size"]');

    const imgEl =
      card.querySelector('img[data-test="product-image"]') ||
      card.querySelector('img');

    const linkEl =
      card.querySelector('a[data-test="product-title"]') ||
      card.querySelector('a[href*="/p/"]');

    const name = nameEl?.textContent?.trim() || '';
    const priceStr = priceEl?.textContent?.trim() || '';
    const price = parsePrice(priceStr);
    const size = sizeEl?.textContent?.trim() || '';
    const image = imgEl?.src || imgEl?.dataset?.src || '';
    const url = linkEl?.href || '';

    if (!name || price <= 0) return null;

    return {
      name: cleanName(name),
      price,
      size,
      image,
      url,
      unitPrice: calcUnitPrice(price, size),
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
