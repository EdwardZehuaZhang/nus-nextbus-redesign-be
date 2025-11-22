#!/bin/bash

# Test local build and deployment script
echo "=== NUS NextBus Backend - Local Build Test ==="
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

echo "1. Cleaning old build..."
rm -rf dist node_modules
echo "   ✓ Cleaned"
echo ""

echo "2. Installing dependencies..."
npm install
echo "   ✓ Dependencies installed"
echo ""

echo "3. Building TypeScript..."
npm run build
echo "   ✓ Build completed"
echo ""

echo "4. Verifying build output..."
if [ -d "dist" ]; then
    echo "   ✓ dist/ directory exists"
    ls -la dist/
else
    echo "   ✗ dist/ directory missing!"
    exit 1
fi
echo ""

echo "5. Starting server (Press Ctrl+C to stop)..."
npm start
