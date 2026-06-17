// CartRadar UPC Database
// Maps common grocery UPCs to canonical product names
// This grows over time — seed with top 100 grocery items
// Format: UPC → { name, category, brand, size }

const UPC_DB = {
  // Dairy — Milk
  "01111042050": { name: "Great Value Whole Milk", category: "Dairy", subcategory: "Milk", brand: "Great Value", size: "1 gal" },
  "01111042043": { name: "Great Value 2% Milk", category: "Dairy", subcategory: "Milk", brand: "Great Value", size: "1 gal" },
  "01111042036": { name: "Great Value 1% Milk", category: "Dairy", subcategory: "Milk", brand: "Great Value", size: "1 gal" },
  "01111042029": { name: "Great Value Skim Milk", category: "Dairy", subcategory: "Milk", brand: "Great Value", size: "1 gal" },
  "01111051234": { name: "Great Value Whole Milk", category: "Dairy", subcategory: "Milk", brand: "Great Value", size: "0.5 gal" },

  // Dairy — Eggs
  "01111088999": { name: "Great Value Large White Eggs", category: "Dairy", subcategory: "Eggs", brand: "Great Value", size: "12 ct" },
  "01111089001": { name: "Great Value Large White Eggs", category: "Dairy", subcategory: "Eggs", brand: "Great Value", size: "18 ct" },
  "01111089002": { name: "Great Value Large White Eggs", category: "Dairy", subcategory: "Eggs", brand: "Great Value", size: "36 ct" },

  // Dairy — Butter
  "01111046000": { name: "Great Value Salted Butter", category: "Dairy", subcategory: "Butter", brand: "Great Value", size: "16 oz" },
  "01111046001": { name: "Great Value Unsalted Butter", category: "Dairy", subcategory: "Butter", brand: "Great Value", size: "16 oz" },

  // Dairy — Cheese
  "01111085010": { name: "Great Value Shredded Mild Cheddar", category: "Dairy", subcategory: "Cheese", brand: "Great Value", size: "8 oz" },
  "01111085011": { name: "Great Value Shredded Mozzarella", category: "Dairy", subcategory: "Cheese", brand: "Great Value", size: "8 oz" },
  "01111085012": { name: "Great Value Shredded Mexican Blend", category: "Dairy", subcategory: "Cheese", brand: "Great Value", size: "8 oz" },

  // Bread
  "01111061001": { name: "Great Value White Sandwich Bread", category: "Bakery", subcategory: "Bread", brand: "Great Value", size: "20 oz" },
  "01111061002": { name: "Great Value Wheat Sandwich Bread", category: "Bakery", subcategory: "Bread", brand: "Great Value", size: "20 oz" },
  "01111061003": { name: "Great Value White Sandwich Bread", category: "Bakery", subcategory: "Bread", brand: "Great Value", size: "24 oz" },

  // Meat — Chicken
  "01111032001": { name: "Great Value Boneless Skinless Chicken Breast", category: "Meat", subcategory: "Chicken", brand: "Great Value", size: "3 lb" },
  "01111032002": { name: "Great Value Chicken Thighs", category: "Meat", subcategory: "Chicken", brand: "Great Value", size: "3 lb" },
  "01111032003": { name: "Great Value Chicken Wings", category: "Meat", subcategory: "Chicken", brand: "Great Value", size: "3 lb" },

  // Meat — Ground Beef
  "01111033001": { name: "Great Value Ground Beef 80/20", category: "Meat", subcategory: "Beef", brand: "Great Value", size: "1 lb" },
  "01111033002": { name: "Great Value Ground Beef 85/15", category: "Meat", subcategory: "Beef", brand: "Great Value", size: "1 lb" },
  "01111033003": { name: "Great Value Ground Beef 93/7", category: "Meat", subcategory: "Beef", brand: "Great Value", size: "1 lb" },

  // Produce — Bananas
  "00000004011": { name: "Bananas", category: "Produce", subcategory: "Fruit", brand: "Generic", size: "1 lb" },
  "00000004012": { name: "Organic Bananas", category: "Produce", subcategory: "Fruit", brand: "Generic", size: "1 lb" },

  // Cereal
  "01111056001": { name: "Great Value Frosted Flakes", category: "Breakfast", subcategory: "Cereal", brand: "Great Value", size: "17 oz" },
  "01111056002": { name: "Great Value Honey Nut O's", category: "Breakfast", subcategory: "Cereal", brand: "Great Value", size: "16.5 oz" },
  "01111056003": { name: "Great Value Crunchy Corn Squares", category: "Breakfast", subcategory: "Cereal", brand: "Great Value", size: "16 oz" },

  // Pasta
  "01111071001": { name: "Great Value Spaghetti", category: "Pantry", subcategory: "Pasta", brand: "Great Value", size: "16 oz" },
  "01111071002": { name: "Great Value Penne", category: "Pantry", subcategory: "Pasta", brand: "Great Value", size: "16 oz" },
  "01111071003": { name: "Great Value Elbow Macaroni", category: "Pantry", subcategory: "Pasta", brand: "Great Value", size: "16 oz" },

  // Canned Goods
  "01111081001": { name: "Great Value Diced Tomatoes", category: "Pantry", subcategory: "Canned", brand: "Great Value", size: "14.5 oz" },
  "01111081002": { name: "Great Value Tomato Sauce", category: "Pantry", subcategory: "Canned", brand: "Great Value", size: "8 oz" },
  "01111081003": { name: "Great Value Black Beans", category: "Pantry", subcategory: "Canned", brand: "Great Value", size: "15 oz" },

  // Beverages
  "01111091001": { name: "Great Value Bottled Water", category: "Beverages", subcategory: "Water", brand: "Great Value", size: "40 ct 16.9 oz" },
  "01111091002": { name: "Great Value Orange Juice", category: "Beverages", subcategory: "Juice", brand: "Great Value", size: "64 oz" },
  "01111091003": { name: "Great Value Apple Juice", category: "Beverages", subcategory: "Juice", brand: "Great Value", size: "64 oz" },

  // Snacks
  "01111094001": { name: "Great Value Potato Chips Classic", category: "Snacks", subcategory: "Chips", brand: "Great Value", size: "8 oz" },
  "01111094002": { name: "Great Value Tortilla Chips", category: "Snacks", subcategory: "Chips", brand: "Great Value", size: "13 oz" },
  "01111094003": { name: "Great Value Pretzel Sticks", category: "Snacks", subcategory: "Pretzels", brand: "Great Value", size: "16 oz" },

  // Frozen
  "01111087001": { name: "Great Value Frozen Mixed Vegetables", category: "Frozen", subcategory: "Vegetables", brand: "Great Value", size: "12 oz" },
  "01111087002": { name: "Great Value Frozen Broccoli", category: "Frozen", subcategory: "Vegetables", brand: "Great Value", size: "12 oz" },
  "01111087003": { name: "Great Value Frozen Pizza", category: "Frozen", subcategory: "Pizza", brand: "Great Value", size: "20 oz" },

  // Condiments
  "01111051001": { name: "Great Value Ketchup", category: "Condiments", subcategory: "Ketchup", brand: "Great Value", size: "32 oz" },
  "01111051002": { name: "Great Value Yellow Mustard", category: "Condiments", subcategory: "Mustard", brand: "Great Value", size: "20 oz" },
  "01111051003": { name: "Great Value Mayonnaise", category: "Condiments", subcategory: "Mayo", brand: "Great Value", size: "30 oz" },

  // Coffee
  "01111044001": { name: "Great Value Medium Roast Coffee", category: "Beverages", subcategory: "Coffee", brand: "Great Value", size: "12 oz" },
  "01111044002": { name: "Great Value Colombian Coffee", category: "Beverages", subcategory: "Coffee", brand: "Great Value", size: "12 oz" },
  "01111044003": { name: "Great Value French Roast Coffee", category: "Beverages", subcategory: "Coffee", brand: "Great Value", size: "12 oz" },
};

// Lookup a UPC
function lookupUPC(upc) {
  if (!upc) return null;
  return UPC_DB[upc] || null;
}

// Search by name (fuzzy)
function searchByName(name) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const results = [];

  for (const [upc, entry] of Object.entries(UPC_DB)) {
    const entryStr = `${entry.name} ${entry.category} ${entry.subcategory}`.toLowerCase();
    const words = normalized.split(' ').filter(w => w.length > 2);

    let score = 0;
    for (const word of words) {
      if (entryStr.includes(word)) score++;
    }

    if (score > 0) {
      results.push({ upc, ...entry, score: score / words.length });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UPC_DB, lookupUPC, searchByName };
}
