// CartRadar Live Test — paste into Chrome DevTools Console on each store's search page
// Tests extraction from Walmart, Kroger, and Target in real time

(async function CartRadarTest() {
  const host = location.hostname;
  console.log(`🛒 CartRadar Test — ${host}`);
  console.log('='.repeat(60));

  // ============ WALMART ============
  if (host.includes('walmart.com')) {
    console.log('📦 TESTING WALMART...');

    // Test 1: DOM extraction
    const cards = document.querySelectorAll('[data-testid="item-stack"]');
    console.log(`  DOM cards found: ${cards.length}`);

    if (cards.length > 0) {
      const first = cards[0];
      const name = first.querySelector('[data-automation-id="product-title"], span[data-testid="product-title"]');
      const price = first.querySelector('[data-automation-id="product-price"], [data-testid="price"]');
      const size = first.querySelector('.f7, [data-testid="product-size"]');
      const img = first.querySelector('img[data-testid="product-image"], img[src*="i5.walmartimages"]');
      const link = first.querySelector('a[link-identifier="item-title"], a[href*="/ip/"]');

      console.log('  ✅ DOM extraction:');
      console.log(`    Name:  ${name?.textContent?.trim()?.substring(0, 60) || '❌ NOT FOUND'}`);
      console.log(`    Price: ${price?.textContent?.trim() || '❌ NOT FOUND'}`);
      console.log(`    Size:  ${size?.textContent?.trim() || '⚠️  not found'}`);
      console.log(`    Image: ${img?.src ? '✅' : '❌'}`);
      console.log(`    URL:   ${link?.href ? '✅' : '❌'}`);
    }

    // Test 2: API extraction
    try {
      const query = new URLSearchParams(location.search).get('q') || 'milk';
      const resp = await fetch(
        `https://www.walmart.com/orchestra/home/api/search/query?query=${encodeURIComponent(query)}&page=1&prg=desktop&size=5`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await resp.json();
      const items = data?.searchContent?.preso?.items || [];
      console.log(`  ✅ API results: ${items.length} items`);

      if (items.length > 0) {
        const first = items[0];
        const product = first.product || first;
        const priceInfo = product.priceInfo || product.price || {};
        console.log(`    Name:  ${(product.name || product.title || '?').substring(0, 60)}`);
        console.log(`    Price: $${priceInfo.currentPrice || priceInfo.price || '?'}`);
        console.log(`    UPC:   ${product.upc || product.gtin || '⚠️  not in API'}`);
      }
    } catch (e) {
      console.log(`  ❌ API failed: ${e.message}`);
    }
  }

  // ============ TARGET ============
  if (host.includes('target.com')) {
    console.log('🎯 TESTING TARGET...');

    // Test 1: DOM extraction
    const cards = document.querySelectorAll('[data-test="product-card"], [data-testid="productCard"]');
    console.log(`  DOM cards found: ${cards.length}`);

    if (cards.length > 0) {
      const first = cards[0];
      const name = first.querySelector('[data-test="product-title"]');
      const price = first.querySelector('[data-test="current-price"]');
      const img = first.querySelector('img');
      const link = first.querySelector('a[href*="/p/"]');

      console.log('  ✅ DOM extraction:');
      console.log(`    Name:  ${name?.textContent?.trim()?.substring(0, 60) || '❌ NOT FOUND'}`);
      console.log(`    Price: ${price?.textContent?.trim() || '❌ NOT FOUND'}`);
      console.log(`    Image: ${img?.src ? '✅' : '❌'}`);
      console.log(`    URL:   ${link?.href ? '✅' : '❌'}`);
    }

    // Test 2: RedSky API
    try {
      const query = new URLSearchParams(location.search).get('searchTerm') || 'milk';
      const resp = await fetch(
        `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?keyword=${encodeURIComponent(query)}&count=5&default_purchasability_filter=true&pricing_store_id=DEFAULT`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await resp.json();
      const products = data?.data?.search?.products || [];
      console.log(`  ✅ RedSky API results: ${products.length} items`);

      if (products.length > 0) {
        const first = products[0];
        const item = first.item || first;
        console.log(`    Name:  ${(item?.product_description?.title || '?').substring(0, 60)}`);
        console.log(`    Price: ${item?.price?.formatted_current_price || '?'}`);
        console.log(`    UPC:   ${item?.product_description?.upc || '⚠️  not in API'}`);
        console.log(`    TCIN:  ${item?.tcin || '?'}`);
      }
    } catch (e) {
      console.log(`  ❌ API failed: ${e.message}`);
    }
  }

  // ============ KROGER ============
  if (host.includes('kroger.com')) {
    console.log('🔷 TESTING KROGER...');

    const selectors = [
      '[data-testid="SearchResult"]',
      '[class*="ProductCard"]',
      '.kds-Card',
      '[data-testid="SearchResults"] > div'
    ];

    for (const sel of selectors) {
      const cards = document.querySelectorAll(sel);
      if (cards.length > 0) {
        console.log(`  ✅ Found ${cards.length} cards with: ${sel}`);

        const first = cards[0];
        const name = first.querySelector('h3, [class*="title"], [data-testid="product-title"]');
        const price = first.querySelector('[class*="price"], [class*="Price"], [data-testid="product-price"]');
        const link = first.querySelector('a[href*="/p/"], a');

        console.log(`    Name:  ${name?.textContent?.trim()?.substring(0, 60) || '⚠️  check selector'}`);
        console.log(`    Price: ${price?.textContent?.trim() || '⚠️  check selector'}`);
        console.log(`    URL:   ${link?.href ? '✅' : '⚠️  check selector'}`);
        break;
      }
    }
  }

  console.log('='.repeat(60));
  console.log('✅ CartRadar test complete — check results above');
  console.log('💡 To test: go to walmart.com/search?q=milk, target.com/s?searchTerm=milk, kroger.com/search?query=milk');
  console.log('   Then paste this entire script in the console');
})();
