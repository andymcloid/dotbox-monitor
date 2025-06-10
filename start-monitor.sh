#!/bin/bash

# DotBox Monitor Startup Script for Raspberry Pi
# Place this in /home/pi/dotbox-monitor/start-monitor.sh
# Make executable: chmod +x start-monitor.sh

echo "Starting DotBox Monitor..."

# Change to the application directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Install with: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create logs directory
mkdir -p logs

# Set environment variables
export NODE_ENV=production
export PORT=3000
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

# Start the application with PM2 (if installed) or node directly
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 start server.js --name "dotbox-monitor" --log logs/app.log --error logs/error.log
    pm2 save
else
    echo "Starting with Node.js directly..."
    echo "Tip: Install PM2 for better process management: npm install -g pm2"
    node server.js > logs/app.log 2>&1 &
    echo $! > logs/app.pid
    echo "Application started with PID: $(cat logs/app.pid)"
fi

echo "DotBox Monitor should be running on http://localhost:3000"
echo "Default password: admin123"
echo ""
echo "To stop the application:"
if command -v pm2 &> /dev/null; then
    echo "  pm2 stop dotbox-monitor"
else
    echo "  kill \$(cat logs/app.pid)"
fi 