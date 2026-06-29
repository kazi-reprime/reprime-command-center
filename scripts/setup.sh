#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 Bootstrapping Command Center OS Rebuild..."
echo "=========================================================="

# 1. Copy env file if not exists
if [ ! -f .env.local ]; then
  echo "📄 Creating .env.local template..."
  cp .env.example .env.local
  echo "⚠️  Action Required: Open .env.local and fill in your credentials!"
else
  echo "✔ .env.local already exists."
fi

# 2. Run npm install logic validation
echo "📦 Checking package installations..."
npm install --legacy-peer-deps

# 3. Migration commands documentation
echo "🛢️  Database Schema Migration Tooling:"
echo "  To push your Drizzle schema directly to Supabase, run:"
echo "  npx drizzle-kit push"
echo ""
echo "⚙ Setup Complete! Run 'npm run dev' to boot the local environment."
