# CartRadar — Deployment Guide

## Quick Start

### 1. Get Kroger API Access (FREE — 2 minutes)
- Go to https://developer.kroger.com/
- Create account → Register App → Products API
- Copy Client ID + Client Secret

### 2. Start Server
```bash
cd server
export KROGER_CLIENT_ID=your_id_here
export KROGER_CLIENT_SECRET=your_secret_here
pip install curl_cffi fastapi uvicorn
python3 server.py
```

### 3. Open Frontend
Open web/index.html in browser (connects to localhost:8765)

### For All 8 Stores
Add residential proxy:
```bash
export PROXY_ENABLED=true
export PROXY_URL=http://user:***@residential.webshare.io:8080
```

## Architecture
```
Browser (cartradar.com) → POST /search → FastAPI Server → curl_cffi (Chrome TLS) → 8 Stores
                                                                         ↑
                                                            Residential Proxy
```

## Files
- server/server.py — FastAPI backend (8 store scrapers, curl_cffi Chrome impersonation)
- web/index.html — Dark theme SPA frontend
- web/app.js — Frontend search logic
- server/stores/aldi_upstream.py — Aldi pickup API reference (from groceries repo)
- server/stores/kroger_upstream.py — Kroger API reference
