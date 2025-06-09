#!/bin/bash

# DotBox Agent Installation Script

set -e

AGENT_USER="dotbox-agent"
AGENT_HOME="/opt/dotbox-agent"
SERVICE_NAME="dotbox-agent"

echo "🚀 Installing DotBox Monitoring Agent..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    echo "Install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Create agent user
if ! id "$AGENT_USER" &>/dev/null; then
    echo "📝 Creating agent user..."
    useradd --system --home-dir "$AGENT_HOME" --shell /bin/false "$AGENT_USER"
else
    echo "✅ Agent user already exists"
fi

# Create agent directory
echo "📁 Creating agent directory..."
mkdir -p "$AGENT_HOME"
chown "$AGENT_USER:$AGENT_USER" "$AGENT_HOME"

# Copy agent files
echo "📦 Installing agent files..."
cp dotbox-agent.js "$AGENT_HOME/"
cp agent-config.example.json "$AGENT_HOME/agent-config.json"
chmod +x "$AGENT_HOME/dotbox-agent.js"
chown -R "$AGENT_USER:$AGENT_USER" "$AGENT_HOME"

# Create systemd service
echo "🔧 Creating systemd service..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=DotBox Monitoring Agent
After=network.target
Wants=network.target

[Service]
Type=simple
User=$AGENT_USER
Group=$AGENT_USER
WorkingDirectory=$AGENT_HOME
ExecStart=$(which node) $AGENT_HOME/dotbox-agent.js $AGENT_HOME/agent-config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo ""
echo "✅ DotBox Agent installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit the configuration: nano $AGENT_HOME/agent-config.json"
echo "2. Update portalUrl and apiKey in the config file"
echo "3. Start the agent: systemctl start $SERVICE_NAME"
echo "4. Check status: systemctl status $SERVICE_NAME"
echo "5. View logs: journalctl -u $SERVICE_NAME -f"
echo ""
echo "🔧 Management commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "📁 Agent files located at: $AGENT_HOME" 