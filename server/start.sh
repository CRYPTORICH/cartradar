#!/bin/bash
# CartRadar — Start the backend server
# Usage: bash start.sh

cd "$(dirname "$0")"

echo "🛒 CartRadar Backend"
echo ""

# Check for venv
if [ ! -d "venv" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv venv
    ./venv/Scripts/python.exe -m pip install fastapi uvicorn curl_cffi pydantic
fi

# Check for Kroger API credentials
if [ -z "$KROGER_CLIENT_ID" ]; then
    echo ""
    echo "⚠️  Kroger API not configured"
    echo "   Get free API keys at: https://developer.kroger.com"
    echo "   Then run:"
    echo "     export KROGER_CLIENT_ID=your_id"
    echo "     export KROGER_CLIENT_SECRET=your_secret"
    echo ""
fi

echo "🚀 Starting server on http://localhost:8765"
echo "   Open web/index.html in your browser"
echo ""

./venv/Scripts/python.exe server.py
