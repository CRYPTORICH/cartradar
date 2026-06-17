#!/usr/bin/env python3
# CartRadar v5 — Single URL app (API + frontend in one server)
# Visit http://localhost:8766 → full grocery search app
import asyncio, os, re, time, json, random, sys, hashlib, io
sys.path = [p for p in sys.path if 'hermes-agent' not in p]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="CartRadar")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TIMEOUT = 20
CACHE_TTL = 300
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID", "")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET", "")
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

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
def cache_key(q: str, z: str) -> str:
    return hashlib.md5(f"{q}:{z}".encode()).hexdigest()
def cache_get(q: str, z: str):
    key = cache_key(q, z)
    if key in _cache:
        ts, items, results = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return items, results
        del _cache[key]
    return None, None
def cache_set(q: str, z: str, items: list, results: dict):
    _cache[cache_key(q, z)] = (time.time(), items, results)

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

# ===== DEMO DATA (correct brand → store mapping) =====
STORE_BRAND_MAP = {
    "walmart":    {"brand": "Great Value",    "prefix": "Great Value"},
    "kroger":     {"brand": "Kroger",         "prefix": "Kroger"},
    "target":     {"brand": "Good & Gather",  "prefix": "Market Pantry"},
    "aldi":       {"brand": "Friendly Farms", "prefix": "Friendly Farms"},
    "albertsons": {"brand": "Lucerne",        "prefix": "Lucerne"},
    "publix":     {"brand": "Publix",         "prefix": "Publix"},
    "wholefoods": {"brand": "365 by Whole Foods", "prefix": "365"},
    "heb":        {"brand": "H-E-B",          "prefix": "H-E-B"},
}

DEMO_ITEMS = {
    "milk": [
        {"name":"Great Value Whole Milk","price":3.24,"size":"1 gal","url":"https://www.walmart.com/ip/10451075","unitPrice":"$0.20/floz","store":"walmart"},
        {"name":"Kroger Whole Milk","price":3.49,"size":"1 gal","url":"https://www.kroger.com/p/whole-milk","unitPrice":"$0.22/floz","store":"kroger"},
        {"name":"Market Pantry Whole Milk","price":3.39,"size":"1 gal","url":"https://www.target.com/p/milk","unitPrice":"$0.21/floz","store":"target"},
        {"name":"Friendly Farms Whole Milk","price":2.89,"size":"1 gal","url":"https://www.aldi.us/product/whole-milk","unitPrice":"$0.18/floz","store":"aldi"},
        {"name":"Lucerne Whole Milk","price":3.79,"size":"1 gal","url":"https://www.albertsons.com/product/milk","unitPrice":"$0.24/floz","store":"albertsons"},
        {"name":"Publix Whole Milk","price":3.59,"size":"1 gal","url":"https://www.publix.com/product/milk","unitPrice":"$0.22/floz","store":"publix"},
        {"name":"365 by Whole Foods Organic Whole Milk","price":4.29,"size":"1 gal","url":"https://www.wholefoodsmarket.com/product/milk","unitPrice":"$0.27/floz","store":"wholefoods"},
        {"name":"H-E-B Whole Milk","price":3.19,"size":"1 gal","url":"https://www.heb.com/product/milk","unitPrice":"$0.20/floz","store":"heb"},
    ],
    "eggs": [
        {"name":"Great Value Large White Eggs","price":3.98,"size":"12 ct","url":"https://www.walmart.com/ip/eggs","unitPrice":"$0.33/ct","store":"walmart"},
        {"name":"Kroger Large White Eggs","price":4.29,"size":"12 ct","url":"https://www.kroger.com/p/eggs","unitPrice":"$0.36/ct","store":"kroger"},
        {"name":"Good & Gather Large White Eggs","price":4.19,"size":"12 ct","url":"https://www.target.com/p/eggs","unitPrice":"$0.35/ct","store":"target"},
        {"name":"Goldhen Large White Eggs","price":3.49,"size":"12 ct","url":"https://www.aldi.us/product/eggs","unitPrice":"$0.29/ct","store":"aldi"},
        {"name":"Lucerne Large White Eggs","price":4.49,"size":"12 ct","url":"https://www.albertsons.com/product/eggs","unitPrice":"$0.37/ct","store":"albertsons"},
        {"name":"Publix Large White Eggs","price":4.09,"size":"12 ct","url":"https://www.publix.com/product/eggs","unitPrice":"$0.34/ct","store":"publix"},
        {"name":"365 by Whole Foods Large Brown Eggs","price":5.29,"size":"12 ct","url":"https://www.wholefoodsmarket.com/product/eggs","unitPrice":"$0.44/ct","store":"wholefoods"},
        {"name":"H-E-B Large White Eggs","price":3.89,"size":"12 ct","url":"https://www.heb.com/product/eggs","unitPrice":"$0.32/ct","store":"heb"},
    ],
    "chicken": [
        {"name":"Great Value Boneless Chicken Breast","price":8.97,"size":"3 lb","url":"https://www.walmart.com/ip/chicken","unitPrice":"$2.99/lb","store":"walmart"},
        {"name":"Kroger Boneless Chicken Breast","price":9.99,"size":"3 lb","url":"https://www.kroger.com/p/chicken","unitPrice":"$3.33/lb","store":"kroger"},
        {"name":"Good & Gather Boneless Chicken Breast","price":9.49,"size":"3 lb","url":"https://www.target.com/p/chicken","unitPrice":"$3.16/lb","store":"target"},
        {"name":"Kirkwood Boneless Chicken Breast","price":7.99,"size":"3 lb","url":"https://www.aldi.us/product/chicken","unitPrice":"$2.66/lb","store":"aldi"},
        {"name":"Lucerne Boneless Chicken Breast","price":10.49,"size":"3 lb","url":"https://www.albertsons.com/product/chicken","unitPrice":"$3.50/lb","store":"albertsons"},
        {"name":"Publix Boneless Chicken Breast","price":10.49,"size":"3 lb","url":"https://www.publix.com/product/chicken","unitPrice":"$3.50/lb","store":"publix"},
        {"name":"365 by Whole Foods Organic Chicken Breast","price":11.99,"size":"3 lb","url":"https://www.wholefoodsmarket.com/product/chicken","unitPrice":"$4.00/lb","store":"wholefoods"},
        {"name":"H-E-B Boneless Chicken Breast","price":8.49,"size":"3 lb","url":"https://www.heb.com/product/chicken","unitPrice":"$2.83/lb","store":"heb"},
    ],
    "bread": [
        {"name":"Great Value White Sandwich Bread","price":1.48,"size":"20 oz","url":"https://www.walmart.com/ip/bread","unitPrice":"$0.07/oz","store":"walmart"},
        {"name":"Kroger White Sandwich Bread","price":1.69,"size":"20 oz","url":"https://www.kroger.com/p/bread","unitPrice":"$0.08/oz","store":"kroger"},
        {"name":"Good & Gather White Sandwich Bread","price":1.79,"size":"20 oz","url":"https://www.target.com/p/bread","unitPrice":"$0.09/oz","store":"target"},
        {"name":"L'oven Fresh White Bread","price":1.29,"size":"20 oz","url":"https://www.aldi.us/product/bread","unitPrice":"$0.06/oz","store":"aldi"},
        {"name":"Lucerne White Sandwich Bread","price":1.99,"size":"20 oz","url":"https://www.albertsons.com/product/bread","unitPrice":"$0.10/oz","store":"albertsons"},
        {"name":"Publix White Sandwich Bread","price":1.89,"size":"20 oz","url":"https://www.publix.com/product/bread","unitPrice":"$0.09/oz","store":"publix"},
        {"name":"365 by Whole Foods Organic White Bread","price":2.49,"size":"20 oz","url":"https://www.wholefoodsmarket.com/product/bread","unitPrice":"$0.12/oz","store":"wholefoods"},
        {"name":"H-E-B White Sandwich Bread","price":1.59,"size":"20 oz","url":"https://www.heb.com/product/bread","unitPrice":"$0.08/oz","store":"heb"},
    ],
    "butter": [
        {"name":"Great Value Salted Butter","price":3.98,"size":"16 oz","url":"https://www.walmart.com/ip/butter","unitPrice":"$0.25/oz","store":"walmart"},
        {"name":"Kroger Salted Butter","price":4.29,"size":"16 oz","url":"https://www.kroger.com/p/butter","unitPrice":"$0.27/oz","store":"kroger"},
        {"name":"Good & Gather Salted Butter","price":4.19,"size":"16 oz","url":"https://www.target.com/p/butter","unitPrice":"$0.26/oz","store":"target"},
        {"name":"Countryside Creamery Butter","price":3.49,"size":"16 oz","url":"https://www.aldi.us/product/butter","unitPrice":"$0.22/oz","store":"aldi"},
        {"name":"Lucerne Salted Butter","price":4.49,"size":"16 oz","url":"https://www.albertsons.com/product/butter","unitPrice":"$0.28/oz","store":"albertsons"},
        {"name":"Publix Salted Butter","price":4.39,"size":"16 oz","url":"https://www.publix.com/product/butter","unitPrice":"$0.27/oz","store":"publix"},
        {"name":"365 by Whole Foods Organic Butter","price":5.29,"size":"16 oz","url":"https://www.wholefoodsmarket.com/product/butter","unitPrice":"$0.33/oz","store":"wholefoods"},
        {"name":"H-E-B Salted Butter","price":3.79,"size":"16 oz","url":"https://www.heb.com/product/butter","unitPrice":"$0.24/oz","store":"heb"},
    ],
    "ground beef": [
        {"name":"Great Value 80/20 Ground Beef","price":4.98,"size":"1 lb","url":"https://www.walmart.com/ip/ground-beef","unitPrice":"$4.98/lb","store":"walmart"},
        {"name":"Kroger 80/20 Ground Beef","price":5.49,"size":"1 lb","url":"https://www.kroger.com/p/ground-beef","unitPrice":"$5.49/lb","store":"kroger"},
        {"name":"Good & Gather 80/20 Ground Beef","price":5.29,"size":"1 lb","url":"https://www.target.com/p/ground-beef","unitPrice":"$5.29/lb","store":"target"},
        {"name":"Simply Nature 85/15 Ground Beef","price":4.79,"size":"1 lb","url":"https://www.aldi.us/product/ground-beef","unitPrice":"$4.79/lb","store":"aldi"},
        {"name":"Lucerne 80/20 Ground Beef","price":5.79,"size":"1 lb","url":"https://www.albertsons.com/product/ground-beef","unitPrice":"$5.79/lb","store":"albertsons"},
        {"name":"Publix 80/20 Ground Beef","price":5.69,"size":"1 lb","url":"https://www.publix.com/product/ground-beef","unitPrice":"$5.69/lb","store":"publix"},
        {"name":"365 by Whole Foods Organic Ground Beef","price":6.99,"size":"1 lb","url":"https://www.wholefoodsmarket.com/product/ground-beef","unitPrice":"$6.99/lb","store":"wholefoods"},
        {"name":"H-E-B 80/20 Ground Beef","price":4.99,"size":"1 lb","url":"https://www.heb.com/product/ground-beef","unitPrice":"$4.99/lb","store":"heb"},
    ],
    "coffee": [
        {"name":"Great Value Classic Roast Coffee","price":7.98,"size":"30.5 oz","url":"https://www.walmart.com/ip/coffee","unitPrice":"$0.26/oz","store":"walmart"},
        {"name":"Kroger Classic Roast Coffee","price":8.49,"size":"30.5 oz","url":"https://www.kroger.com/p/coffee","unitPrice":"$0.28/oz","store":"kroger"},
        {"name":"Good & Gather Classic Roast Coffee","price":8.29,"size":"30.5 oz","url":"https://www.target.com/p/coffee","unitPrice":"$0.27/oz","store":"target"},
        {"name":"Beaumont Classic Roast Coffee","price":6.99,"size":"30.5 oz","url":"https://www.aldi.us/product/coffee","unitPrice":"$0.23/oz","store":"aldi"},
        {"name":"Lucerne Classic Roast Coffee","price":8.99,"size":"30.5 oz","url":"https://www.albertsons.com/product/coffee","unitPrice":"$0.29/oz","store":"albertsons"},
        {"name":"Publix Classic Roast Coffee","price":8.69,"size":"30.5 oz","url":"https://www.publix.com/product/coffee","unitPrice":"$0.28/oz","store":"publix"},
        {"name":"365 by Whole Foods Organic Coffee","price":10.49,"size":"24 oz","url":"https://www.wholefoodsmarket.com/product/coffee","unitPrice":"$0.44/oz","store":"wholefoods"},
        {"name":"H-E-B Cafe Ole Coffee","price":7.49,"size":"30.5 oz","url":"https://www.heb.com/product/coffee","unitPrice":"$0.25/oz","store":"heb"},
    ],
    "bananas": [
        {"name":"Great Value Bananas","price":0.52,"size":"1 lb","url":"https://www.walmart.com/ip/bananas","unitPrice":"$0.52/lb","store":"walmart"},
        {"name":"Kroger Bananas","price":0.59,"size":"1 lb","url":"https://www.kroger.com/p/bananas","unitPrice":"$0.59/lb","store":"kroger"},
        {"name":"Good & Gather Bananas","price":0.55,"size":"1 lb","url":"https://www.target.com/p/bananas","unitPrice":"$0.55/lb","store":"target"},
        {"name":"Fresh Bananas","price":0.45,"size":"1 lb","url":"https://www.aldi.us/product/bananas","unitPrice":"$0.45/lb","store":"aldi"},
        {"name":"Lucerne Bananas","price":0.69,"size":"1 lb","url":"https://www.albertsons.com/product/bananas","unitPrice":"$0.69/lb","store":"albertsons"},
        {"name":"Publix Bananas","price":0.65,"size":"1 lb","url":"https://www.publix.com/product/bananas","unitPrice":"$0.65/lb","store":"publix"},
        {"name":"365 by Whole Foods Organic Bananas","price":0.79,"size":"1 lb","url":"https://www.wholefoodsmarket.com/product/bananas","unitPrice":"$0.79/lb","store":"wholefoods"},
        {"name":"H-E-B Bananas","price":0.49,"size":"1 lb","url":"https://www.heb.com/product/bananas","unitPrice":"$0.49/lb","store":"heb"},
    ],
}

def get_demo_results(query: str, stores: list[str] = None) -> tuple[list, dict]:
    q = query.lower().strip()
    for key in DEMO_ITEMS:
        if key in q or q in key:
            items = [it for it in DEMO_ITEMS[key] if not stores or it["store"] in stores]
            results = {}
            for item in items:
                store = item["store"]
                results[store] = StoreResult(count=1, status="demo")
            return items, results
    # Generic fallback
    items = []
    results = {}
    all_stores = list(STORE_BRAND_MAP.keys())
    base_price = random.uniform(2.49, 5.99)
    for store in all_stores:
        meta = STORE_BRAND_MAP[store]
        offset = (all_stores.index(store) - 3) * 0.35 + random.uniform(-0.20, 0.20)
        price = round(max(1.49, base_price + offset), 2)
        item = {
            "name": f"{meta['brand']} {query.title()}",
            "price": price,
            "size": random.choice(["16 oz", "1 lb", "12 ct", "1 gal"]),
            "url": f"https://www.{store}.com/search?q={query}",
            "unitPrice": "",
            "store": store,
        }
        items.append(item)
        results[store] = StoreResult(count=1, status="demo")
    return items, results

# ===== Kroger Public API =====
_kroger_token, _kroger_token_expiry = None, 0

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
    except: return None

async def search_kroger(query: str, zipcode: str) -> tuple[list, StoreResult]:
    token = await kroger_get_token()
    if not token:
        return [], StoreResult(count=0, status="no_credentials", error="Set KROGER_CLIENT_ID + KROGER_CLIENT_SECRET env vars")
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
                return [], StoreResult(count=0, status="blocked_403", error="Access denied")
            if resp.status_code == 412:
                return [], StoreResult(count=0, status="blocked_412", error="Bot detection triggered")
            if resp.status_code == 429:
                return [], StoreResult(count=0, status="rate_limited", error="Too many requests")
            if resp.status_code != 200:
                return [], StoreResult(count=0, status=f"http_{resp.status_code}", error=f"HTTP {resp.status_code}")
            html = resp.text
            if "Robot or human" in html or "captcha" in html.lower():
                return [], StoreResult(count=0, status="captcha", error="CAPTCHA challenge page")
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
                                "name": clean_name(name), "price": float(price),
                                "size": node.get("description", ""), "image": node.get("image", ""),
                                "url": node.get("url", "") or offers.get("url", ""),
                                "unitPrice": calc_unit_price(float(price), node.get("description", "")),
                                "upc": node.get("gtin13") or node.get("sku"),
                            })
                except: pass
            filtered = [r for r in results if r["name"] and r["price"] > 0][:10]
            status = "ok" if filtered else "empty"
            return filtered, StoreResult(count=len(filtered), status=status, error="" if filtered else "No products on page")
    except Exception as e:
        err = str(e)[:80]
        if "Timeout" in str(type(e).__name__):
            return [], StoreResult(count=0, status="timeout", error=err)
        if "Connection" in str(type(e).__name__):
            return [], StoreResult(count=0, status="connection_refused", error=err)
        return [], StoreResult(count=0, status="error", error=err)

# ===== API Routes =====
@app.get("/api")
async def api_root():
    return {
        "service": "CartRadar v5",
        "demo_mode": DEMO_MODE,
        "kroger_api": bool(KROGER_CLIENT_ID),
        "stores": list(STORE_URLS.keys()),
        "cache_ttl": CACHE_TTL,
        "frontend": "/",
    }

@app.post("/api/search", response_model=SearchResponse)
async def api_search(req: SearchRequest):
    start = time.time()
    if not DEMO_MODE:
        cached_items, cached_results = cache_get(req.query, req.zipcode)
        if cached_items is not None:
            elapsed = (time.time() - start) * 1000
            return SearchResponse(items=cached_items, store_results=cached_results, elapsed_ms=round(elapsed,1), cached=True)
    if DEMO_MODE:
        items, results = get_demo_results(req.query, req.stores)
        return SearchResponse(items=items, store_results=results, elapsed_ms=round((time.time()-start)*1000, 1))

    all_items = []
    store_results = {}
    if not req.stores or "kroger" in req.stores:
        k_items, k_result = await search_kroger(req.query, req.zipcode)
        store_results["kroger"] = k_result
        for item in k_items: item["store"] = "kroger"
        all_items.extend(k_items)
    curl_stores = {k: v for k, v in STORE_URLS.items() if k != "kroger"}
    if req.stores:
        curl_stores = {k: v for k, v in curl_stores.items() if k in req.stores}
    tasks = [search_with_curl(build(req.query, req.zipcode), name) for name, build in curl_stores.items()]
    results_list = await asyncio.gather(*tasks, return_exceptions=True)
    for (name, _), result in zip(curl_stores.items(), results_list):
        if isinstance(result, Exception):
            store_results[name] = StoreResult(count=0, status="exception", error=str(result)[:80])
        else:
            items, s_result = result
            store_results[name] = s_result
            for item in items: item["store"] = name
            all_items.extend(items)
    elapsed = (time.time() - start) * 1000
    if all_items and not DEMO_MODE:
        cache_set(req.query, req.zipcode, all_items, store_results)
    return SearchResponse(items=all_items, store_results=store_results, elapsed_ms=round(elapsed,1))

# ===== Mount frontend AFTER API routes =====
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print("🛒 CartRadar v5 — Single URL App")
    print(f"   Open: http://localhost:{os.getenv('PORT','8766')}")
    print(f"   Demo: {'ON' if DEMO_MODE else 'OFF (needs proxies)'}")
    print(f"   Kroger: {'Ready' if KROGER_CLIENT_ID else 'Set KROGER_CLIENT_ID+SECRET'}")
    print(f"   {len(DEMO_ITEMS)} demo categories: {', '.join(DEMO_ITEMS.keys())}")
    port = int(os.getenv("PORT", "8770"))
    uvicorn.run(app, host="0.0.0.0", port=port)
