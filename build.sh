#!/bin/bash

set -e # Exit on error

echo "Step 1: Running 'npm run build' to compile the plugin..."
npm run build
if [ $? -ne 0 ]; then
    echo "Step 1 failed: 'npm run build' exited with code $?."
    exit 1
fi

echo "=> Build completed successfully (main.js generated)."

echo "Step 2: Ensuring 'auto-git-sync' directory exists and moving main.js..."  
if [ ! -d "auto-git-sync" ]; then
    mkdir "auto-git-sync"
fi

echo "Step 3: Moving main.js to 'auto-git-sync' directory..."  
mv -f "main.js" "auto-git-sync/main.js"

echo "Step 4: Copying manifest.json and style.css to 'auto-git-sync' directory..."  
[[ -f "manifest.json" ]] && cp -f "manifest.json" "auto-git-sync/manifest.json" && echo "Copied manifest.json" || echo "manifest.json not found"
[[ -f "styles.css" ]] && cp -f "styles.css" "auto-git-sync/styles.css" && echo "Copied styles.css" || echo "styles.css not found"

echo "=> Build completed successfully."