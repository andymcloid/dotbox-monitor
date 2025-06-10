const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

class HealthCheckService {
    constructor(database) {
        this.database = database;
        this.services = [];
        this.status = new Map();
        this.intervals = new Map();
        this.history = new Map();
        this.monitoring = false;
        this.cleanupInterval = null;
    }

    async init() {
        await this.loadServices();
        if (!this.monitoring) {
            this.startMonitoring();
        }
        await this.startHistoryCleanup();
    }

    async loadServices() {
        try {
            this.services = await this.database.getAllServices();
            console.log(`Loaded ${this.services.length} services for monitoring`);
        } catch (error) {
            console.warn('Could not load services from database, using empty list');
            this.services = [];
        }
    }

    async checkHttpService(service) {
        return new Promise((resolve) => {
            try {
                const url = new URL(service.url);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;
                
                const startTime = Date.now();
                
                const req = client.request({
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'GET',
                    timeout: (service.timeout || 5) * 1000,
                    headers: {
                        'User-Agent': 'DotBox-Portal-HealthCheck/1.0'
                    }
                }, (res) => {
                    const responseTime = Date.now() - startTime;
                    const isStatusOk = res.statusCode === (service.expected_status || 200);
                    const warningThreshold = service.warning_threshold || 1000;
                    
                    let status;
                    let error = null;
                    
                    if (!isStatusOk) {
                        status = 'unhealthy';
                        error = `HTTP ${res.statusCode}`;
                    } else if (responseTime > warningThreshold) {
                        status = 'warning';
                        error = `Slow response: ${responseTime}ms`;
                    } else {
                        status = 'healthy';
                    }
                    
                    resolve({
                        status,
                        responseTime,
                        statusCode: res.statusCode,
                        error
                    });
                });

                req.on('error', (error) => {
                    const responseTime = Date.now() - startTime;
                    resolve({
                        status: 'unhealthy',
                        responseTime,
                        error: error.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    const responseTime = Date.now() - startTime;
                    resolve({
                        status: 'unhealthy',
                        responseTime,
                        error: 'Timeout'
                    });
                });

                req.end();
            } catch (error) {
                resolve({
                    status: 'unhealthy',
                    responseTime: 0,
                    error: error.message
                });
            }
        });
    }

    async checkTcpService(service) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const socket = new net.Socket();
            
            console.log(`[TCP Debug] Attempting to connect to ${service.host}:${service.port} (${service.name})`);
            
            socket.setTimeout((service.timeout || 5) * 1000);
            
            socket.connect(service.port, service.host, () => {
                const responseTime = Date.now() - startTime;
                const warningThreshold = service.warning_threshold || 500;
                
                console.log(`[TCP Debug] Successfully connected to ${service.host}:${service.port} in ${responseTime}ms`);
                
                let status;
                let error = null;
                
                if (responseTime > warningThreshold) {
                    status = 'warning';
                    error = `Slow connection: ${responseTime}ms`;
                } else {
                    status = 'healthy';
                }
                
                socket.destroy();
                resolve({
                    status,
                    responseTime,
                    error
                });
            });

            socket.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                console.log(`[TCP Debug] Connection error to ${service.host}:${service.port}: ${error.message} (code: ${error.code})`);
                
                // More specific error messages
                let errorMsg = error.message;
                if (error.code === 'ECONNREFUSED') {
                    errorMsg = `Connection refused - service not running on ${service.host}:${service.port}`;
                } else if (error.code === 'ENOTFOUND') {
                    errorMsg = `Host not found: ${service.host}`;
                } else if (error.code === 'ETIMEDOUT') {
                    errorMsg = `Connection timed out to ${service.host}:${service.port}`;
                } else if (error.code === 'EHOSTUNREACH') {
                    errorMsg = `Host unreachable: ${service.host}`;
                }
                
                resolve({
                    status: 'unhealthy',
                    responseTime,
                    error: errorMsg
                });
            });

            socket.on('timeout', () => {
                console.log(`[TCP Debug] Connection timeout to ${service.host}:${service.port} after ${service.timeout || 5}s`);
                socket.destroy();
                const responseTime = Date.now() - startTime;
                resolve({
                    status: 'unhealthy',
                    responseTime,
                    error: `Connection timeout (${service.timeout || 5}s)`
                });
            });
        });
    }

    async checkSslService(service) {
        return new Promise((resolve) => {
            try {
                const url = new URL(service.url);
                const hostname = url.hostname;
                const port = url.port || 443;
                const startTime = Date.now();
                
                const socket = tls.connect(port, hostname, {
                    servername: hostname,
                    timeout: (service.timeout || 5) * 1000,
                    rejectUnauthorized: false // Vi vill kolla certifikatet även om det är invalid
                }, () => {
                    const responseTime = Date.now() - startTime;
                    const cert = socket.getPeerCertificate();
                    
                    if (!cert || !cert.valid_to) {
                        socket.destroy();
                        resolve({
                            status: 'unhealthy',
                            responseTime,
                            error: 'No certificate found'
                        });
                        return;
                    }

                    const now = new Date();
                    const expiry = new Date(cert.valid_to);
                    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                    const warningThreshold = service.warning_threshold || 30;
                    
                    let status;
                    let error = null;
                    
                    if (daysUntilExpiry < 0) {
                        status = 'unhealthy'; // Röd - utgått
                        error = `Certificate expired ${Math.abs(daysUntilExpiry)} days ago`;
                    } else if (daysUntilExpiry < warningThreshold) {
                        status = 'warning'; // Gul - under threshold
                        error = `Certificate expires in ${daysUntilExpiry} days`;
                    } else {
                        status = 'healthy'; // Grön - över threshold
                    }
                    
                    socket.destroy();
                    resolve({
                        status,
                        responseTime,
                        error,
                        daysUntilExpiry,
                        issuer: cert.issuer?.CN || 'Unknown',
                        subject: cert.subject?.CN || hostname,
                        validFrom: cert.valid_from,
                        validTo: cert.valid_to
                    });
                });

                socket.on('error', (error) => {
                    const responseTime = Date.now() - startTime;
                    resolve({
                        status: 'unhealthy',
                        responseTime,
                        error: error.message
                    });
                });

                socket.on('timeout', () => {
                    socket.destroy();
                    const responseTime = Date.now() - startTime;
                    resolve({
                        status: 'unhealthy',
                        responseTime,
                        error: 'Connection timeout'
                    });
                });

            } catch (error) {
                resolve({
                    status: 'unhealthy',
                    responseTime: 0,
                    error: error.message
                });
            }
        });
    }

    async checkService(service) {
        const timestamp = new Date().toISOString();
        let result;

        try {
            if (service.type === 'http') {
                result = await this.checkHttpService(service);
            } else if (service.type === 'tcp') {
                result = await this.checkTcpService(service);
            } else if (service.type === 'ssl') {
                result = await this.checkSslService(service);
            } else {
                throw new Error(`Unknown service type: ${service.type}`);
            }
        } catch (error) {
            result = {
                status: 'unhealthy',
                responseTime: 0,
                error: error.message
            };
        }

        const fullResult = {
            ...result,
            timestamp,
            service: service.name
        };

        // Update current status
        this.status.set(service.id, fullResult);

        // Update in-memory history (for backwards compatibility)
        if (!this.history.has(service.id)) {
            this.history.set(service.id, []);
        }
        
        const history = this.history.get(service.id);
        history.push(fullResult);
        
        // Keep only last 100 entries in memory
        if (history.length > 100) {
            history.shift();
        }

        // Save to database history
        try {
            const additionalData = {};
            
            // Store type-specific data
            if (service.type === 'ssl' && result.daysUntilExpiry !== undefined) {
                additionalData.daysUntilExpiry = result.daysUntilExpiry;
                additionalData.issuer = result.issuer;
                additionalData.subject = result.subject;
                additionalData.validFrom = result.validFrom;
                additionalData.validTo = result.validTo;
            }
            
            if (service.type === 'http' && result.statusCode) {
                additionalData.expectedStatus = service.expected_status || 200;
            }

            await this.database.saveServiceHistory(
                service.id,
                result.status,
                result.responseTime || 0,
                result.statusCode || null,
                result.error || null,
                Object.keys(additionalData).length > 0 ? additionalData : null
            );
        } catch (error) {
            console.error(`[History] Failed to save history for ${service.name}:`, error.message);
        }

        console.log(`[${timestamp}] ${service.name}: ${result.status} (${result.responseTime}ms)`);
        return fullResult;
    }

    startMonitoring() {
        if (this.monitoring) {
            return;
        }
        
        this.monitoring = true;
        console.log(`Starting health monitoring for ${this.services.length} services`);
        
        this.services.forEach(service => {
            // Initial check after a short delay to prevent spam
            setTimeout(() => {
                this.checkService(service);
            }, Math.random() * 1000);
            
            // Set up interval - convert seconds to milliseconds
            const intervalMs = (service.interval || 30) * 1000;
            const interval = setInterval(() => {
                this.checkService(service);
            }, intervalMs);
            
            this.intervals.set(service.id, interval);
        });
    }

    stopMonitoring() {
        console.log('Stopping health monitoring');
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();
        this.monitoring = false;
        this.stopHistoryCleanup();
    }

    getServiceStatus(serviceId) {
        return this.status.get(serviceId);
    }

    getAllStatus() {
        const result = {};
        this.services.forEach(service => {
            const status = this.status.get(service.id);
            result[service.id] = {
                ...service,
                ...status,
                uptime: this.calculateUptime(service.id)
            };
        });
        return result;
    }

    getServicesByCategory() {
        const categories = {};
        this.services.forEach(service => {
            const category = service.category || 'other';
            if (!categories[category]) {
                categories[category] = [];
            }
            
            const status = this.status.get(service.id);
            categories[category].push({
                ...service,
                ...status,
                uptime: this.calculateUptime(service.id)
            });
        });
        return categories;
    }

    calculateUptime(serviceId) {
        const history = this.history.get(serviceId);
        if (!history || history.length === 0) return 0;

        const healthyCount = history.filter(entry => entry.status === 'healthy').length;
        return Math.round((healthyCount / history.length) * 100);
    }

    getOverallHealth() {
        const statuses = Array.from(this.status.values());
        if (statuses.length === 0) return { status: 'unknown', percentage: 0 };

        const healthyCount = statuses.filter(s => s.status === 'healthy').length;
        const warningCount = statuses.filter(s => s.status === 'warning').length;
        const unhealthyCount = statuses.filter(s => s.status === 'unhealthy').length;
        
        // Healthy percentage includes both healthy and warning (partially working)
        const workingCount = healthyCount + warningCount;
        const percentage = Math.round((workingCount / statuses.length) * 100);
        
        let status;
        if (unhealthyCount === 0 && warningCount === 0) {
            status = 'healthy'; // All services healthy
        } else if (unhealthyCount === 0) {
            status = 'degraded'; // No unhealthy, but some warnings
        } else if (percentage >= 70) {
            status = 'degraded'; // Mostly working
        } else {
            status = 'unhealthy'; // Many failures
        }

        return {
            status,
            percentage,
            total: statuses.length,
            healthy: healthyCount,
            warning: warningCount,
            unhealthy: unhealthyCount
        };
    }

    async reloadServices() {
        console.log('Reloading services - stopping current monitoring...');
        this.stopMonitoring();
        this.status.clear();
        this.history.clear();
        await this.loadServices();
        
        if (this.services.length > 0) {
            console.log(`Restarting monitoring for ${this.services.length} services`);
            this.startMonitoring();
        } else {
            console.log('No services to monitor');
        }
    }

    async startHistoryCleanup() {
        try {
            const cleanupIntervalHours = await this.database.getSetting('cleanup_interval_hours', '24');
            const intervalMs = parseInt(cleanupIntervalHours) * 60 * 60 * 1000; // Convert hours to milliseconds

            console.log(`[History] Starting cleanup timer - running every ${cleanupIntervalHours} hours`);

            // Run initial cleanup
            await this.database.cleanupOldHistory();

            // Set up recurring cleanup
            this.cleanupInterval = setInterval(async () => {
                try {
                    console.log('[History] Running scheduled cleanup...');
                    await this.database.cleanupOldHistory();
                } catch (error) {
                    console.error('[History] Cleanup failed:', error.message);
                }
            }, intervalMs);

        } catch (error) {
            console.error('[History] Failed to start cleanup timer:', error.message);
        }
    }

    stopHistoryCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[History] Cleanup timer stopped');
        }
    }

    async getServiceHistory(serviceId, hours = 24, limit = 100) {
        try {
            return await this.database.getServiceHistory(serviceId, limit, hours);
        } catch (error) {
            console.error(`[History] Failed to get history for service ${serviceId}:`, error.message);
            return [];
        }
    }

    async getAllServicesHistory(hours = 24, limit = 1000) {
        try {
            return await this.database.getAllServicesHistory(hours, limit);
        } catch (error) {
            console.error('[History] Failed to get all services history:', error.message);
            return [];
        }
    }
}

module.exports = HealthCheckService; 