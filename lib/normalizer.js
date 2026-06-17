// CartRadar Product Normalizer
// Normalizes grocery products across stores for comparison
// Matches by: UPC > name fuzzy match > category + size

const Normalizer = {
  // Main entry: takes raw items from all stores, returns deduplicated + matched list
  normalize(items) {
    if (!items || items.length === 0) return [];

    // Group by UPC first (exact match)
    const byUpc = this.groupByUpc(items);

    // Then fuzzy-match remaining unmatched items by name
    const matched = this.fuzzyMatchNames(byUpc.unmatched);

    // Combine matched groups
    return [...byUpc.groups, ...matched];
  },

  groupByUpc(items) {
    const groups = [];
    const matched = new Set();
    const upcMap = new Map();

    items.forEach((item, i) => {
      if (!item.upc) return;
      const existing = upcMap.get(item.upc);
      if (existing) {
        existing.items.push(item);
        matched.add(i);
        matched.add(existing.indices[0]);
      } else {
        upcMap.set(item.upc, { items: [item], indices: [i] });
      }
    });

    // Collect groups with 2+ stores
    for (const [upc, group] of upcMap) {
      if (group.items.length >= 2) {
        group.items.forEach((_, j) => matched.add(group.indices[j]));
        groups.push({
          upc,
          items: group.items.sort((a, b) => a.price - b.price),
          matchType: 'upc'
        });
      }
    }

    const unmatched = items.filter((_, i) => !matched.has(i));
    return { groups, unmatched };
  },

  fuzzyMatchNames(items) {
    if (items.length < 2) return [];
    const groups = [];
    const matched = new Set();

    for (let i = 0; i < items.length; i++) {
      if (matched.has(i)) continue;

      const group = [items[i]];
      const baseName = this.normalizeName(items[i].name);

      for (let j = i + 1; j < items.length; j++) {
        if (matched.has(j)) continue;
        if (items[i].store === items[j].store) continue;

        const compareName = this.normalizeName(items[j].name);
        const similarity = this.similarity(baseName, compareName);

        if (similarity > 0.65) {
          group.push(items[j]);
          matched.add(j);
        }
      }

      if (group.length >= 2) {
        matched.add(i);
        groups.push({
          upc: null,
          items: group.sort((a, b) => a.price - b.price),
          matchType: 'name'
        });
      }
    }

    // Remaining singletons: still add as unmatched groups
    const singletons = items.filter((_, i) => !matched.has(i));
    singletons.forEach(item => {
      groups.push({
        upc: null,
        items: [item],
        matchType: 'none'
      });
    });

    return groups;
  },

  normalizeName(name) {
    return name
      .toLowerCase()
      // Remove brand names for comparison
      .replace(/great value|kroger|market pantry|good \& gather|simple truth|private selection|favorite day|archived/g, '')
      // Normalize sizes
      .replace(/(\d+)\s*(oz|ounce|fl oz|fluid ounce|lb|lbs|pound|gal|gallon|qt|quart|pt|pint)/gi, '$1 $2')
      // Remove punctuation
      .replace(/[^\w\s]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  },

  similarity(a, b) {
    // Simple word overlap similarity
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const w of wordsA) {
      if (w.length < 3) continue; // skip small words
      if (wordsB.has(w)) overlap++;
    }

    const union = new Set([...wordsA, ...wordsB].filter(w => w.length >= 3));
    return union.size > 0 ? overlap / union.size : 0;
  }
};

// Expose for content scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Normalizer;
}
