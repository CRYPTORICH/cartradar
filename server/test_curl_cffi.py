"""Test curl_cffi Chrome impersonation against each store"""
import curl_cffi
import json

stores = [
    ("Walmart", "https://www.walmart.com/orchestra/home/api/search/query?query=milk&page=1&prg=desktop&size=3"),
    ("Target", "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?keyword=milk&count=3&default_purchasability_filter=true&pricing_store_id=DEFAULT"),
    ("Aldi", "https://api.aldi.us/v1/product-search?currency=USD&servicePoint=479-030&testVariant=A&q=milk&limit=3&offset=0"),
]

for name, url in stores:
    try:
        resp = curl_cffi.get(url, impersonate="chrome124", timeout=15, 
                             headers={"Accept": "application/json, */*",
                                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"})
        print(f"\n=== {name} ===")
        print(f"  HTTP {resp.status_code}")
        print(f"  Content-Type: {resp.headers.get('content-type', '?')}")
        content = resp.text[:300]
        
        try:
            data = resp.json()
            if "redirectUrl" in data:
                print(f"  ❌ Bot redirect: {data.get('redirectUrl','')[:80]}")
            elif "data" in data:
                items = data.get("data", [])
                print(f"  ✅ JSON response: {len(items)} items")
            elif "searchContent" in data:
                items = data.get("searchContent", {}).get("preso", {}).get("items", [])
                print(f"  ✅ Orchestra: {len(items)} items")
            else:
                print(f"  JSON keys: {list(data.keys())[:5]}")
        except:
            if "Robot or human" in content:
                print(f"  ❌ CAPTCHA page")
            elif "blocked" in content.lower():
                print(f"  ❌ Block page")
            else:
                print(f"  HTML: {content[:150]}")
    except Exception as e:
        print(f"\n=== {name} ===")
        print(f"  ❌ Error: {type(e).__name__}: {e}")
