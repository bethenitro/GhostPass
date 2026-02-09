#!/bin/bash

# Fix ESM imports by adding .js extensions for Vercel deployment
# This script adds .js to relative imports that don't already have an extension

echo "Fixing ESM imports in API folder..."

find api -name "*.ts" -type f | while read -r file; do
  # Add .js to imports from '../_lib/...' without extension
  sed -i "s|from '\.\./\([^']*\)'|from '../\1.js'|g" "$file"
  sed -i 's|from "\.\./\([^"]*\)"|from "../\1.js"|g' "$file"
  
  # Fix double .js.js if it was already there
  sed -i 's|\.js\.js|.js|g' "$file"
  sed -i 's|\.ts\.js|.js|g' "$file"
  
  # Remove .js from .ts imports (TypeScript files)
  sed -i "s|from '\([^']*\)\.ts\.js'|from '\1.js'|g" "$file"
  sed -i 's|from "\([^"]*\)\.ts\.js"|from "\1.js"|g' "$file"
done

echo "Done! All imports fixed."
