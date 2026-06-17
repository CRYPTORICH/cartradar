#!/usr/bin/env python3
# CartRadar Backend v4 — Caching, demo mode, detailed error reporting
import asyncio, os, re, time, json, random, sys, hashlib
sys.path = [p for p in sys.path if 'hermes-agent' not in p]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CartRadar API v4")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TIMEOUT = 20
CACHE_TTL = 300  # 5 min
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID", "")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET", "")

class SearchRequest(BaseModel):
    query: str
    zipcode: str
    stores: list[str] = []

class StoreResult(BaseModel):
    count: int = 0
    status: str = "unknown"
    error: str = ""

class SearchResponse(BaseModel):
    items: list = []
    store_results: dict[str, StoreResult] = {}
    elapsed_ms: float = 0
    cached: bool = False

# ===== Cache =====
_cache: dict[str, tuple[float, list, dict]] = {}

def cache_key(query: str, zipcode: str) -> str:
    return hashlib.md5(f"{query}:{zipcode}".encode()).hexdigest()

def cache_get(query: str, zipcode: str):
    key = cache_key(query, zipcode)
    if key in _cache:
        ts, items, results = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return items, results
        del _cache[key]
    return None, None

def cache_set(query: str, zipcode: str, items: list, results: dict):
    _cache[cache_key(query, zipcode)] = (time.time(), items, results)

# ===== Utils =====
def parse_price(text) -> float:
    if not text: return 0
    if isinstance(text, (int, float)): return float(text)
    m = re.search(r'\$?([\d,]+\.?\d*)', str(text))
    return float(m.group(1).replace(',', '')) if m else 0

def calc_unit_price(price: float, size_str: str) -> str:
    if not price or not size_str: return ""
    m = re.search(r'([\d.]+)\s*(oz|lb|lbs|fl\s*oz|gal|qt|pt|ct|count|each)', size_str, re.IGNORECASE)
    if not m: return ""
    qty = float(m.group(1))
    return f"${price/qty:.2f}/{m.group(2).lower().replace(' ', '')}" if qty else ""

def clean_name(name: str) -> str:
    return re.sub(r'\s+', ' ', name).strip()[:120]

# ===== DEMO MODE =====
DEMO_ITEMS = {
    "milk": [
        {"name": "Great Value Whole Milk", "price": 3.24, "size": "1 gal", "url": "https://www.walmart.com/ip/10451075", "unitPrice": "$0.20/floz", "upc": "01111042050"},
        {"name": "Kroger Whole Milk", "price": 3.49, "size": "1 gal", "url": "https://www.kroger.com/p/whole-milk/0001111042050", "unitPrice": "$0.22/floz", "upc": "01111042050"},
        {"name": "Market Pantry Whole Milk", "price": 3.39, "size": "1 gal", "url": "https://www.target.com/p/milk/-/A-12946294", "unitPrice": "$0.21/floz", "upc": "01111042050"},
        {"name": "Friendly Farms Whole Milk", "price": 2.89, "size": "1 gal", "url": "https://www.aldi.us/product/whole-milk", "unitPrice": "$0.18/floz", "upc": "01111042050"},
        {"name": "Lucerne Whole Milk", "price": 3.79, "size": "1 gal", "url": "https://www.albertsons.com/product/milk", "unitPrice": "$0.24/floz", "upc": "01111042050"},
        {"name": "Publix Whole Milk", "price": 3.59, "size": "1 gal", "url": "https://www.publix.com/product/milk", "unitPrice": "$0.22/floz", "upc": "01111042050"},
        {"name": "365 Whole Milk", "price": 4.29, "size": "1 gal", "url": "https://www.wholefoodsmarket.com/product/milk", "unitPrice": "$0.27/floz", "upc": "01111042050"},
        {"name": "H-E-B Whole Milk", "price": 3.19, "size": "1 gal", "url": "https://www.heb.com/product/milk", "unitPrice": "$0.20/floz", "upc": "01111042050"},
    ],
    "eggs": [
        {"name": "Great Value Large White Eggs", "price": 3.98, "size": "12 ct", "url": "https://www.walmart.com/ip/eggs", "unitPrice": "$0.33/ct", "upc": "01111088999"},
        {"name": "Kroger Large White Eggs", "price": 4.29, "size": "12 ct", "url": "https://www.kroger.com/p/eggs", "unitPrice": "$0.36/ct", "upc": "01111088999"},
        {"name": "Good & Gather Large White Eggs", "price": 4.19, "size": "12 ct", "url": "https://www.target.com/p/eggs", "unitPrice": "$0.35/ct", "upc": "01111088999"},
        {"name": "Goldhen Large White Eggs", "price": 3.49, "size": "12 ct", "url": "https://www.aldi.us/product/eggs", "unitPrice": "$0.29/ct", "upc": "01111088999"},
        {"name": "Lucerne Large White Eggs", "price": 4.49, "size": "12 ct", "url": "https://www.albertsons.com/product/eggs", "unitPrice": "$0.37/ct", "upc": "01111088999"},
        {"name": "365 Large White Eggs", "price": 5.29, "size": "12 ct", "url": "https://www.wholefoodsmarket.com/product/eggs", "unitPrice": "$0.44/ct", "upc": "01111088999"},
        {"name": "H-E-B Large White Eggs", "price": 3.89, "size": "12 ct", "url": "https://www.heb.com/product/eggs", "unitPrice": "$0.32/ct", "upc": "01111088999"},
    ],
    "chicken breast": [
        {"name": "Great Value Boneless Chicken Breast", "price": 8.97, "size": "3 lb", "url": "https://www.walmart.com/ip/chicken-breast", "unitPrice": "$2.99/lb", "upc": "01111032001"},
        {"name": "Kroger Boneless Chicken Breast", "price": 9.99, "size": "3 lb", "url": "https://www.kroger.com/p/chicken-breast", "unitPrice": "$3.33/lb", "upc": "01111032001"},
        {"name": "Target Boneless Chicken Breast", "price": 9.49, "size": "3 lb", "url": "https://www.target.com/p/chicken-breast", "unitPrice": "$3.16/lb", "upc": "01111032001"},
        {"name": "Kirkwood Boneless Chicken Breast", "price": 7.99, "size": "3 lb", "url": "https://www.aldi.us/product/chicken-breast", "unitPrice": "$2.66/lb", "upc": "01111032001"},
        {"name": "Publix Boneless Chicken Breast", "price": 10.49, "size": "3 lb", "url": "https://www.publix.com/product/chicken", "unitPrice": "$3.50/lb", "upc": "01111032001"},
        {"name": "H-E-B Boneless Chicken Breast", "price": 8.49, "size": "3 lb", "url": "https://www.heb.com/product/chicken", "unitPrice": "$2.83/lb", "upc": "01111032001"},
    ],
}

STORE_ORDER = ["aldi", "walmart", "heb", "target", "kroger", "publix", "albertsons", "wholefoods"]

def get_demo_results(query: str) -> tuple[list, dict]:
    """Return realistic demo data for common grocery queries"""
    q = query.lower().strip()
    # Find best matching demo key
    for key in DEMO_ITEMS:
        if key in q or q in key:
            items = []
            results = {}
            for i, item in enumerate(DEMO_ITEMS[key]):
                store = STORE_ORDER[i % len(STORE_ORDER)]
                entry = {**item, "store": store}
                items.append(entry)
                results[store] = StoreResult(count=1, status="demo")
            return items, results

    # Generic fallback — generate plausible results
    items = []
    results = {}
    base_price = random.uniform(2.49, 5.99)
    for i, store in enumerate(STORE_ORDER):
        offset = (i - 3) * 0.35 + random.uniform(-0.20, 0.20)
        price = round(base_price + offset, 2)
        item = {
            "name": f"{store.title()} {query.title()}",
            "price": max(1.49, price),
            "size": random.choice(["16 oz", "1 lb", "12 ct", "1 gal", "8 oz"]),
            "url": f"https://www.{store}.com/search?q={query}",
            "unitPrice": f"${max(1.49, price)/16:.2f}/oz" if "oz" in random.choice(["16 oz"]) else "",
        }
        items.append({**item, "store": store})
        results[store] = StoreResult(count=1, status="demo")
    return items, results

# ===== Kroger Public API =====
_kroger_token = None
_kroger_token_expiry = 0

async def kroger_get_token():
    global _kroger_token, _kroger_token_expiry
    if _kroger_token and time.time() < _kroger_token_expiry - 60:
        return _kroger_token
    if not KROGER_CLIENT_ID or not KROGER_CLIENT_SECRET:
        return None
    try:
        import base64, urllib.request
        creds = base64.b64encode(f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}".encode()).decode()
        req = urllib.request.Request(
            "https://api.kroger.com/v1/connect/oauth2/token",
            data=b"grant_type=client_credentials&scope=product.compact",
            headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"})
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
        _kroger_token = data["access_token"]
        _kroger_token_expiry = time.time() + data.get("expires_in", 1800)
        return _kroger_token
    except Exception as e:
        return None

async def search_kroger(query: str, zipcode: str) -> tuple[list, StoreResult]:
    token = await kroger_get_token()
    if not token:
        return [], StoreResult(count=0, status="no_credentials", error="Set KROGER_CLIENT_ID + KROGER_CLIENT_SECRET")
    try:
        import urllib.request, urllib.parse
        loc_req = urllib.request.Request(
            f"https://api.kroger.com/v1/locations?filter.zipCode.near={zipcode}&filter.limit=1",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        loc_data = json.loads(urllib.request.urlopen(loc_req, timeout=10).read())
        location_id = loc_data.get("data", [{}])[0].get("locationId", "") if loc_data.get("data") else ""

        params = {"filter.term": query, "filter.limit": 10}
        if location_id: params["filter.locationId"] = location_id
        prod_url = f"https://api.kroger.com/v1/products?{urllib.parse.urlencode(params)}"
        prod_req = urllib.request.Request(prod_url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
        data = json.loads(urllib.request.urlopen(prod_req, timeout=10).read())

        results = []
        for product in data.get("data", [])[:10]:
            items = product.get("items", [{}])
            if not items: continue
            item = items[0]
            price_info = item.get("price", {})
            price = price_info.get("regular") or price_info.get("promo") or 0
            results.append({
                "name": clean_name(product.get("description", "")),
                "price": float(price) if price else 0,
                "size": item.get("size", ""),
                "image": next((img["url"] for img in product.get("images", []) if img.get("perspective") == "front"), ""),
                "url": f"https://www.kroger.com/p/{product.get('productId', '')}",
                "unitPrice": calc_unit_price(float(price) if price else 0, item.get("size", "")),
                "upc": product.get("upc"),
                "wasPrice": float(price_info.get("regular", 0)) if price_info.get("promo") else None,
            })
        filtered = [r for r in results if r["name"] and r["price"] > 0]
        return filtered, StoreResult(count=len(filtered), status="ok")
    except Exception as e:
        return [], StoreResult(count=0, status="error", error=str(e)[:80])

# ===== curl_cffi stores =====
_curl_cffi = None
def get_curl_cffi():
    global _curl_cffi
    if _curl_cffi is None:
        from curl_cffi.requests import AsyncSession
        _curl_cffi = AsyncSession
    return _curl_cffi

STORE_URLS = {
    "walmart":     lambda q,z: f"https://www.walmart.com/search?q={q}",
    "target":      lambda q,z: f"https://www.target.com/s?searchTerm={q}&zip={z}",
    "aldi":        lambda q,z: f"https://www.aldi.us/en/search/?q={q}",
    "albertsons":  lambda q,z: f"https://www.albertsons.com/shop/search?q={q}",
    "publix":      lambda q,z: f"https://www.publix.com/search?q={q}",
    "wholefoods":  lambda q,z: f"https://www.wholefoodsmarket.com/search?text={q}",
    "heb":         lambda q,z: f"https://www.heb.com/search/?q={q}",
}

async def search_with_curl(url: str, store: str) -> tuple[list, StoreResult]:
    Session = get_curl_cffi()
    time.sleep(random.uniform(0.5, 2.0))
    try:
        async with Session(impersonate="chrome124", timeout=TIMEOUT,
                           headers={"Accept": "text/html,application/json,*/*"}) as s:
            resp = await s.get(url)
            if resp.status_code == 403:
                return [], StoreResult(count=0, status="blocked_403", error="Access denied (CAPTCHA)")
            if resp.status_code == 412:
                return [], StoreResult(count=0, status="blocked_412", error="Bot detection triggered")
            if resp.status_code == 429:
                return [], StoreResult(count=0, status="rate_limited", error="Too many requests")
            if resp.status_code != 200:
                return [], StoreResult(count=0, status=f"http_{resp.status_code}", error=f"HTTP {resp.status_code}")

            html = resp.text
            if "Robot or human" in html or "captcha" in html.lower():
                return [], StoreResult(count=0, status="captcha", error="CAPTCHA challenge page")

            # JSON-LD extraction
            results = []
            scripts = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
            for script in scripts:
                try:
                    ld = json.loads(script)
                    items = ld if isinstance(ld, list) else ([ld] if ld.get("@type") == "Product" else ld.get("@graph", []))
                    if not isinstance(items, list): items = [items]
                    for node in items:
                        if not isinstance(node, dict) or node.get("@type") != "Product": continue
                        offers = node.get("offers", {})
                        if isinstance(offers, list): offers = offers[0] if offers else {}
                        price = offers.get("price", 0)
                        name = node.get("name", "")
                        if name and price:
                            results.append({
                                "name": clean_name(name),
                                "price": float(price),
                                "size": node.get("description", ""),
                                "image": node.get("image", ""),
                                "url": node.get("url", "") or offers.get("url", ""),
                                "unitPrice": calc_unit_price(float(price), node.get("description", "")),
                                "upc": node.get("gtin13") or node.get("sku"),
                            })
                except: pass
            filtered = [r for r in results if r["name"] and r["price"] > 0][:10]
            status = "ok" if filtered else "empty"
            return filtered, StoreResult(count=len(filtered), status=status, error="" if filtered else "No products found on page")
    except Exception as e:
        err = str(e)[:80]
        if "Timeout" in str(type(e).__name__):
            return [], StoreResult(count=0, status="timeout", error=err)
        if "Connection" in str(type(e).__name__):
            return [], StoreResult(count=0, status="connection_refused", error=err)
        return [], StoreResult(count=0, status="error", error=err)

# ===== Endpoints =====
@app.get("/")
async def root():
    return {
        "service": "CartRadar API v4",
        "kroger_api": bool(KROGER_CLIENT_ID),
        "demo_mode": DEMO_MODE,
        "stores": list(STORE_URLS.keys()),
        "cache_ttl": CACHE_TTL,
    }

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    start = time.time()

    # Check cache
    if not DEMO_MODE:
        cached_items, cached_results = cache_get(req.query, req.zipcode)
        if cached_items is not None:
            elapsed = (time.time() - start) * 1000
            return SearchResponse(items=cached_items, store_results=cached_results, elapsed_ms=round(elapsed,1), cached=True)

    # Demo mode — instant, realistic results
    if DEMO_MODE:
        items, results = get_demo_results(req.query)
        elapsed = (time.time() - start) * 1000
        return SearchResponse(items=items, store_results=results, elapsed_ms=round(elapsed,1), cached=False)

    all_items = []
    store_results = {}

    # Kroger (Tier 1 — no curl_cffi)
    if not req.stores or "kroger" in req.stores:
        k_items, k_result = await search_kroger(req.query, req.zipcode)
        store_results["kroger"] = k_result
        for item in k_items: item["store"] = "kroger"
        all_items.extend(k_items)

    # Tier 2/3 stores (curl_cffi)
    curl_stores = {k: v for k, v in STORE_URLS.items() if k != "kroger"}
    # Filter by stores param if provided
    if req.stores:
        curl_stores = {k: v for k, v in curl_stores.items() if k in req.stores}
    tasks = [search_with_curl(build(req.query, req.zipcode), name) for name, build in curl_stores.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for (name, _), result in zip(curl_stores.items(), results):
        if isinstance(result, Exception):
            store_results[name] = StoreResult(count=0, status="exception", error=str(result)[:80])
        else:
            items, s_result = result
            store_results[name] = s_result
            for item in items: item["store"] = name
            all_items.extend(items)

    elapsed = (time.time() - start) * 1000

    # Cache (only if we got real data)
    if all_items and not DEMO_MODE:
        cache_set(req.query, req.zipcode, all_items, store_results)

    return SearchResponse(items=all_items, store_results=store_results, elapsed_ms=round(elapsed,1), cached=False)

if __name__ == "__main__":
    import uvicorn, io, codecs
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print("CartRadar API v4")
    print(f"   DEMO_MODE: {'ON (mock data)' if DEMO_MODE else 'OFF (live scraping)'}")
    print(f"   Kroger API: {'OK' if KROGER_CLIENT_ID else 'set KROGER_CLIENT_ID'}")
    print(f"   Cache TTL: {CACHE_TTL}s")
    print(f"   Stores: {list(STORE_URLS.keys())}")
    print(f"   http://localhost:8765")
    port = int(os.getenv("PORT", "8765"))
    uvicorn.run(app, host="0.0.0.0", port=port)
