#!/bin/bash

# GhostPass Wallet API Deployment Script

echo "🚀 Deploying GhostPass Wallet API..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with your Supabase credentials."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Setup database (optional - run manually first time)
echo "🗄️ Setting up database..."
python setup_database.py

# Run tests
echo "🧪 Running basic tests..."
python test_api.py &
API_PID=$!

# Start the API server
echo "🌐 Starting API server..."
python main.py &
SERVER_PID=$!

echo "✅ GhostPass Wallet API is running!"
echo "📍 API URL: http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo "🔍 Health Check: http://localhost:8000/health"

# Cleanup function
cleanup() {
    echo "🛑 Shutting down..."
    kill $SERVER_PID 2>/dev/null
    kill $API_PID 2>/dev/null
    exit 0
}

# Handle Ctrl+C
trap cleanup SIGINT

# Wait for server
wait $SERVER_PID