#!/usr/bin/env node

const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

class DotBoxAgent {
    constructor(config = {}) {
        this.config = {
            portalUrl: config.portalUrl || 'http://dotbox.se:3000',
            apiKey: config.apiKey || 'default-agent-key',
            interval: config.interval || 60000, // 1 minute
            hostname: config.hostname || os.hostname(),
            ...config
        };
        
        this.metrics = {};
        this.isRunning = false;
        
        console.log(`DotBox Agent starting on ${this.config.hostname}`);
        console.log(`Reporting to: ${this.config.portalUrl}`);
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.collectAndSend();
        
        // Set up interval
        this.intervalId = setInterval(() => {
            this.collectAndSend();
        }, this.config.interval);
        
        console.log(`Agent started, reporting every ${this.config.interval/1000}s`);
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        console.log('Agent stopped');
    }

    async collectMetrics() {
        const timestamp = new Date().toISOString();
        
        try {
            // System metrics
            const cpuUsage = this.getCpuUsage();
            const memoryUsage = this.getMemoryUsage();
            const diskUsage = this.getDiskUsage();
            const networkStats = this.getNetworkStats();
            const uptime = os.uptime();
            const loadAvg = os.loadavg();
            
            // Docker containers (if Docker is available)
            const dockerStats = this.getDockerStats();
            
            // System services
            const services = this.getSystemServices();
            
            this.metrics = {
                timestamp,
                hostname: this.config.hostname,
                uptime,
                cpu: {
                    usage: cpuUsage,
                    loadAvg: loadAvg,
                    cores: os.cpus().length
                },
                memory: memoryUsage,
                disk: diskUsage,
                network: networkStats,
                docker: dockerStats,
                services: services,
                agent: {
                    version: '1.0.0',
                    pid: process.pid
                }
            };
            
        } catch (error) {
            console.error('Error collecting metrics:', error.message);
        }
    }

    getCpuUsage() {
        try {
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;
            
            cpus.forEach(cpu => {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            });
            
            const idle = totalIdle / cpus.length;
            const total = totalTick / cpus.length;
            const usage = 100 - ~~(100 * idle / total);
            
            return usage;
        } catch (error) {
            return 0;
        }
    }

    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        
        return {
            total: Math.round(total / 1024 / 1024 / 1024 * 100) / 100, // GB
            used: Math.round(used / 1024 / 1024 / 1024 * 100) / 100,
            free: Math.round(free / 1024 / 1024 / 1024 * 100) / 100,
            usage: Math.round((used / total) * 100)
        };
    }

    getDiskUsage() {
        try {
            if (process.platform === 'win32') {
                const output = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8' });
                // Parse Windows disk info
                return { root: { usage: 0, total: 0, free: 0 } };
            } else {
                const output = execSync('df -h /', { encoding: 'utf8' });
                const lines = output.trim().split('\n');
                if (lines.length > 1) {
                    const parts = lines[1].split(/\s+/);
                    return {
                        root: {
                            total: parts[1],
                            used: parts[2],
                            free: parts[3],
                            usage: parseInt(parts[4])
                        }
                    };
                }
            }
        } catch (error) {
            return { root: { usage: 0, total: 0, free: 0 } };
        }
    }

    getNetworkStats() {
        try {
            const interfaces = os.networkInterfaces();
            const stats = {};
            
            Object.keys(interfaces).forEach(name => {
                const iface = interfaces[name].find(i => i.family === 'IPv4' && !i.internal);
                if (iface) {
                    stats[name] = {
                        address: iface.address,
                        netmask: iface.netmask,
                        mac: iface.mac
                    };
                }
            });
            
            return stats;
        } catch (error) {
            return {};
        }
    }

    getDockerStats() {
        try {
            const output = execSync('docker ps --format "table {{.Names}}\\t{{.Status}}"', { encoding: 'utf8' });
            const lines = output.trim().split('\n');
            
            if (lines.length > 1) {
                const containers = lines.slice(1).map(line => {
                    const [name, status] = line.split('\t');
                    return {
                        name: name.trim(),
                        status: status.trim(),
                        healthy: status.includes('Up')
                    };
                });
                
                return {
                    available: true,
                    containers: containers,
                    running: containers.filter(c => c.healthy).length,
                    total: containers.length
                };
            }
        } catch (error) {
            return { available: false, error: error.message };
        }
        
        return { available: false };
    }

    getSystemServices() {
        const services = [];
        
        try {
            if (process.platform !== 'win32') {
                // Check common services
                const commonServices = ['ssh', 'nginx', 'apache2', 'mysql', 'postgresql', 'redis'];
                
                commonServices.forEach(service => {
                    try {
                        execSync(`systemctl is-active ${service}`, { encoding: 'utf8' });
                        services.push({ name: service, status: 'active' });
                    } catch (error) {
                        // Service not active or not installed
                    }
                });
            }
        } catch (error) {
            // Ignore systemctl errors
        }
        
        return services;
    }

    async sendMetrics() {
        if (!this.metrics.timestamp) return;
        
        try {
            const url = new URL('/api/agent/metrics', this.config.portalUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const data = JSON.stringify(this.metrics);
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'User-Agent': 'DotBox-Agent/1.0.0'
                }
            };
            
            const req = client.request(options, (res) => {
                if (res.statusCode === 200) {
                    console.log(`✓ Metrics sent successfully (${Object.keys(this.metrics).length} metrics)`);
                } else {
                    console.error(`✗ Failed to send metrics: HTTP ${res.statusCode}`);
                }
            });
            
            req.on('error', (error) => {
                console.error('✗ Error sending metrics:', error.message);
            });
            
            req.write(data);
            req.end();
            
        } catch (error) {
            console.error('✗ Error preparing metrics:', error.message);
        }
    }

    async collectAndSend() {
        await this.collectMetrics();
        await this.sendMetrics();
    }
}

// CLI usage
if (require.main === module) {
    const configFile = process.argv[2] || './agent-config.json';
    let config = {};
    
    try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        console.log(`Loaded config from ${configFile}`);
    } catch (error) {
        console.log('Using default configuration');
    }
    
    const agent = new DotBoxAgent(config);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down agent...');
        agent.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\nShutting down agent...');
        agent.stop();
        process.exit(0);
    });
    
    agent.start();
}

module.exports = DotBoxAgent; 