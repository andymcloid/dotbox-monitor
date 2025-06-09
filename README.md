# 📡 DotBox Monitor

A sleek network service monitoring dashboard built with Node.js. Clean, modern interface for real-time monitoring of your home network services and infrastructure.

## ✨ Features

- **🔐 Secure Authentication** - Simple password-based admin login
- **📊 Real-time Monitoring** - Live service health checks and status updates
- **🎯 Service Health Checks** - HTTP/TCP connectivity monitoring  
- **🎨 Modern UI** - Beautiful interface with Shoelace components and dark theme
- **🐳 Docker Ready** - Easy deployment with Docker Compose
- **🔄 Live Updates** - Real-time status updates via WebSocket
- **⚙️ JSON Configuration** - Easy service configuration through JSON
- **📱 Responsive Design** - Works great on desktop and mobile

## 🏗️ Architecture

### Core Components
- **Express.js** - Web server and API routes
- **Socket.IO** - Real-time communication for live updates
- **Shoelace** - Modern web components for UI
- **Health Check Service** - Automated service monitoring with HTTP/TCP checks

### Configuration
- `config/services.json` - Service monitoring configuration
- `.env` - Environment variables

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
git clone <repository>
cd dotbox-monitor
docker-compose up -d
```

### Option 2: Local Development
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and login with password `admin123` (configurable via env).

## 📁 Project Structure

```
dotbox-monitor/
├── public/                 # Frontend assets
│   ├── index.html         # Main UI
│   └── app.js             # Frontend JavaScript
├── config/                # Configuration files
│   └── services.json      # Service monitoring config
├── lib/                   # Backend libraries
│   └── healthCheck.js     # Health monitoring service
├── agent/                 # Monitoring agents
│   ├── dotbox-agent.js    # Server monitoring agent
│   └── install-agent.sh   # Agent installation script
├── server.js              # Main server
├── docker-compose.yml     # Docker orchestration
└── Dockerfile             # Container definition
```

## ⚙️ Configuration

### Service Monitoring (`config/services.json`)
```json
{
  "smart_home": [
    {
      "name": "Home Assistant",
      "url": "http://homeassistant:8123",
      "icon": "🏠",
      "timeout": 5000
    }
  ],
  "storage": [
    {
      "name": "NAS Storage",
      "url": "http://nas.local:5000",
      "icon": "💾",
      "timeout": 3000
    }
  ],
  "network": [
    {
      "name": "Router Admin",
      "url": "http://192.168.1.1",
      "icon": "🌐",
      "timeout": 5000
    }
  ]
}
```

### Service Configuration Options
- `name` - Display name for the service
- `url` - HTTP URL to check (for HTTP checks)
- `host` + `port` - For TCP port checks
- `icon` - Emoji icon to display
- `timeout` - Request timeout in milliseconds
- `interval` - Check interval in seconds (default: 30)

## 🔧 Environment Variables

Create a `.env` file:
```bash
# Server Configuration
PORT=3000
ADMIN_PASSWORD=admin123
```

## 🖥️ Features Deep Dive

### Service Health Monitoring
- **HTTP Checks** - Monitor web services and APIs
- **TCP Checks** - Monitor network ports and services
- **Real-time Status** - Live updates via WebSocket
- **Categorized Services** - Organize services by type
- **Uptime Tracking** - Monitor service availability percentage
- **Response Time Tracking** - Monitor service performance

### Modern Interface
- **Grid Layout** - Compact service cards in responsive grid
- **Status Indicators** - Clear healthy/unhealthy visual states
- **Service Details** - Expandable details with metrics
- **Direct Links** - Quick access to services via link button
- **Auto-refresh** - Configurable automatic status updates

### Service Monitoring Agent

Deploy on your servers for system metrics:

```bash
# Install on target server
curl -o install-agent.sh https://your-domain/install-agent.sh
chmod +x install-agent.sh
sudo ./install-agent.sh http://your-monitor:3000

# Agent sends: CPU, memory, disk, network stats
```

## 🎨 Customization

### Theming
Modern dark theme with Catppuccin-inspired colors:
- Primary: Blue (`#89b4fa`)
- Secondary: Pink (`#f5c2e7`) 
- Success: Green (`#a6e3a1`)
- Warning: Orange (`#fab387`)
- Error: Red (`#f38ba8`)

### Service Icons
Services automatically get appropriate icons based on names:
- Home Assistant: 🏠
- Plex/Media: 🎬
- Storage/NAS: 💾
- Router/Network: 🌐
- API Services: ⚡

## 🐳 Docker Deployment

### Production Setup
```yaml
# docker-compose.yml
version: '3.8'
services:
  dotbox-monitor:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
    environment:
      - ADMIN_PASSWORD=your-secure-password
    restart: unless-stopped
```

### Portainer Integration
1. Create new stack in Portainer
2. Upload `docker-compose.yml`
3. Configure environment variables
4. Deploy and access via `http://your-server:3000`

## 🔐 Security Notes

- Change the default admin password
- Use HTTPS in production (nginx proxy recommended)
- Restrict network access appropriately
- Keep dependencies updated

## 🛠️ Development

### Adding New Services
1. Edit `config/services.json`
2. Add service configuration with URL/host+port
3. System automatically detects changes and reloads

### Adding New Check Types
1. Extend `lib/healthCheck.js`
2. Add new check method
3. Update service configuration schema

## 📊 Monitoring Details

### Health Check Types
- **HTTP** - Web service availability and response time
- **TCP** - Port connectivity and response time
- **Agent** - System metrics from deployed monitoring agents

### Status Indicators
- 🟢 **Healthy** - Service responding normally
- 🔴 **Unhealthy** - Service down or error
- 🟡 **Unknown** - No recent check data

### Metrics Tracked
- **Response Time** - Service response latency
- **Uptime Percentage** - Availability over time
- **Last Check Time** - When service was last verified
- **Error Details** - Specific error messages when unhealthy

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Shoelace** - Web components library
- **Socket.IO** - Real-time communication
- **Express.js** - Web framework

---

**DotBox Monitor** - Your clean network service monitoring solution! 📡 