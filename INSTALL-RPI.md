# 🍓 Raspberry Pi Installation Guide

Complete guide to install and run DotBox Monitor on a Raspberry Pi with automatic startup.

## 📋 Prerequisites

- Raspberry Pi (any model with network connectivity)
- Raspberry Pi OS (Lite or Desktop)
- SSH access to your Pi
- Internet connection

## 🚀 Quick Installation

### 1. Connect to your Raspberry Pi

```bash
ssh pi@your-pi-ip-address
```

### 2. Install Node.js 18.x

```bash
# Download and install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Clone and Setup Application

```bash
# Navigate to home directory
cd /home/pi

# Clone the repository (replace with your actual repo URL)
git clone https://github.com/your-username/dotbox-monitor.git
cd dotbox-monitor

# Install dependencies
npm install

# Make startup script executable
chmod +x start-monitor.sh
```

### 4. Initial Configuration

```bash
# Set your admin password (optional)
export ADMIN_PASSWORD="your-secure-password"

# Test the application
npm start
```

Visit `http://your-pi-ip:3000` to verify it's working, then stop with `Ctrl+C`.

## ⚙️ Automatic Startup (Systemd Service)

### 1. Install Systemd Service

```bash
# Copy service file to systemd directory
sudo cp dotbox-monitor.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start at boot
sudo systemctl enable dotbox-monitor

# Start the service now
sudo systemctl start dotbox-monitor
```

### 2. Manage the Service

```bash
# Check service status
sudo systemctl status dotbox-monitor

# View logs
sudo journalctl -u dotbox-monitor -f

# Stop service
sudo systemctl stop dotbox-monitor

# Restart service
sudo systemctl restart dotbox-monitor

# Disable auto-start
sudo systemctl disable dotbox-monitor
```

## 🔧 Configuration

### Environment Variables

Edit the service file to customize settings:

```bash
sudo nano /etc/systemd/system/dotbox-monitor.service
```

Available environment variables:
- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD` - Admin login password (default: admin123)
- `NODE_ENV` - Environment mode (production/development)

After editing, reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart dotbox-monitor
```

### Firewall Setup

If you have a firewall enabled, allow the port:

```bash
# For ufw firewall
sudo ufw allow 3000/tcp

# For iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

## 🌐 Access Your Monitor

- **Local Access**: `http://localhost:3000`
- **Network Access**: `http://your-pi-ip:3000`
- **Default Password**: `admin123`

## 📊 Database

The application uses SQLite database stored in:
- Database file: `/home/pi/dotbox-monitor/data/services.db`
- Automatic backups recommended

### Backup Database

```bash
# Create backup
cp /home/pi/dotbox-monitor/data/services.db /home/pi/dotbox-monitor-backup.db

# Restore from backup
cp /home/pi/dotbox-monitor-backup.db /home/pi/dotbox-monitor/data/services.db
sudo systemctl restart dotbox-monitor
```

## 🔄 Updates

### Update Application

```bash
cd /home/pi/dotbox-monitor

# Stop service
sudo systemctl stop dotbox-monitor

# Pull latest changes
git pull

# Update dependencies
npm install

# Start service
sudo systemctl start dotbox-monitor
```

### Update Node.js

```bash
# Update to latest LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Restart service
sudo systemctl restart dotbox-monitor
```

## 📈 Performance Tips

### For Raspberry Pi Zero/1
- Increase swap space for Node.js builds
- Consider using PM2 for better memory management

```bash
# Install PM2 globally
sudo npm install -g pm2

# Update service to use PM2 (optional)
sudo nano /etc/systemd/system/dotbox-monitor.service
```

### Memory Optimization

```bash
# Check memory usage
free -h
sudo systemctl status dotbox-monitor

# Monitor process
htop
```

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status dotbox-monitor

# Check logs
sudo journalctl -u dotbox-monitor --no-pager

# Check file permissions
ls -la /home/pi/dotbox-monitor/
```

### Can't Access Web Interface

1. Check if service is running: `sudo systemctl status dotbox-monitor`
2. Verify port is open: `sudo netstat -tlnp | grep 3000`
3. Check firewall settings
4. Verify Pi's IP address: `hostname -I`

### Database Issues

```bash
# Check database file exists
ls -la /home/pi/dotbox-monitor/data/

# Check directory permissions
sudo chown -R pi:pi /home/pi/dotbox-monitor/
```

### High CPU Usage

```bash
# Monitor processes
htop

# Check service logs for errors
sudo journalctl -u dotbox-monitor -f
```

## 🔐 Security Recommendations

1. **Change default password** immediately
2. **Use HTTPS** with reverse proxy (nginx/apache)
3. **Firewall rules** to restrict access
4. **Regular updates** of system and application
5. **SSH key authentication** instead of passwords

### Setup Nginx Reverse Proxy (Optional)

```bash
# Install nginx
sudo apt install nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/dotbox-monitor

# Content:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/dotbox-monitor /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## 📝 Logs

Application logs are available through systemd:

```bash
# Real-time logs
sudo journalctl -u dotbox-monitor -f

# Last 100 lines
sudo journalctl -u dotbox-monitor -n 100

# Logs since yesterday
sudo journalctl -u dotbox-monitor --since yesterday
```

---

**Your DotBox Monitor is now running on Raspberry Pi! 🚀**

Access it at `http://your-pi-ip:3000` with password `admin123`. 