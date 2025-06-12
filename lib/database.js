const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'services.db');
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const fs = require('fs');
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(() => {
                        this.initialized = true;
                        resolve();
                    }).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createServicesTable = `
                CREATE TABLE IF NOT EXISTS services (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'http',
                    url TEXT,
                    visit_url TEXT,
                    icon TEXT DEFAULT '🔧',
                    timeout INTEGER DEFAULT 5,
                    interval INTEGER DEFAULT 30,
                    expected_status INTEGER DEFAULT 200,
                    category TEXT NOT NULL,
                    host TEXT,
                    port INTEGER,
                    warning_threshold INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createHistoryTable = `
                CREATE TABLE IF NOT EXISTS service_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    service_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    response_time INTEGER,
                    status_code INTEGER,
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    additional_data TEXT,
                    FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
                )
            `;

            const createSettingsTable = `
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create services table first
            this.db.run(createServicesTable, (err) => {
                if (err) {
                    console.error('Error creating services table:', err);
                    reject(err);
                    return;
                }
                console.log('Services table ready');

                // Create history table
                this.db.run(createHistoryTable, (err) => {
                    if (err) {
                        console.error('Error creating history table:', err);
                        reject(err);
                        return;
                    }
                    console.log('History table ready');

                    // Create settings table
                    this.db.run(createSettingsTable, (err) => {
                        if (err) {
                            console.error('Error creating settings table:', err);
                            reject(err);
                            return;
                        }
                        console.log('Settings table ready');

                        // Add warning_threshold column if missing (backwards compatibility)
                        this.db.run('ALTER TABLE services ADD COLUMN warning_threshold INTEGER', (altErr) => {
                            // Ignore error if column already exists
                            this.seedDefaultSettings()
                                .then(() => this.seedDefaultServices())
                                .then(resolve)
                                .catch(reject);
                        });
                    });
                });
            });
        });
    }

    async seedDefaultSettings() {
        return new Promise((resolve, reject) => {
            // Check if we already have settings
            this.db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row.count === 0) {
                    const defaultSettings = [
                        {
                            key: 'history_retention_days',
                            value: '30',
                            description: 'Number of days to keep service history data'
                        },
                        {
                            key: 'cleanup_interval_hours',
                            value: '24',
                            description: 'How often to clean up old history data (in hours)'
                        },
                        {
                            key: 'max_history_entries_per_service',
                            value: '10000',
                            description: 'Maximum number of history entries per service before cleanup'
                        },
                        {
                            key: 'min_check_interval',
                            value: '10',
                            description: 'Minimum allowed check interval in seconds'
                        }
                    ];

                    const insertStmt = this.db.prepare(`
                        INSERT INTO settings (key, value, description)
                        VALUES (?, ?, ?)
                    `);

                    defaultSettings.forEach(setting => {
                        insertStmt.run([setting.key, setting.value, setting.description]);
                    });

                    insertStmt.finalize((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('Default settings inserted');
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    async seedDefaultServices() {
        return new Promise((resolve, reject) => {
            // Check if we already have services
            this.db.get('SELECT COUNT(*) as count FROM services', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row.count === 0) {
                    // Insert default services (without specifying ID - let it auto-increment)
                    const defaultServices = [
                        {
                            name: 'Google',
                            type: 'http',
                            url: 'https://www.google.com',
                            icon: '🌐',
                            category: 'network',
                            warning_threshold: 1000
                        }
                    ];

                    const insertStmt = this.db.prepare(`
                        INSERT INTO services (name, type, url, icon, category, host, port, warning_threshold)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    defaultServices.forEach(service => {
                        insertStmt.run([
                            service.name,
                            service.type,
                            service.url || null,
                            service.icon,
                            service.category,
                            service.host || null,
                            service.port || null,
                            service.warning_threshold
                        ]);
                    });

                    insertStmt.finalize((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('Default services inserted');
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    async getAllServices() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM services ORDER BY category, name', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getServicesByCategory() {
        return new Promise((resolve, reject) => {
            this.getAllServices().then(services => {
                const categorized = {};
                services.forEach(service => {
                    if (!categorized[service.category]) {
                        categorized[service.category] = [];
                    }
                    categorized[service.category].push(service);
                });
                resolve(categorized);
            }).catch(reject);
        });
    }

    async getService(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM services WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getDefaultWarningThreshold(serviceType) {
        switch(serviceType) {
            case 'ssl': return 30; // dagar
            case 'http': return 1000; // millisekunder
            case 'tcp': return 500; // millisekunder
            default: return null;
        }
    }

    async createService(service) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO services (name, type, url, visit_url, icon, timeout, interval, expected_status, category, host, port, warning_threshold)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const warningThreshold = service.warning_threshold !== undefined 
                ? service.warning_threshold 
                : this.getDefaultWarningThreshold(service.type || 'http');

            console.log(`[DB Debug] Creating service: ${service.name} (${service.type})`);
            console.log(`[DB Debug] URL: ${service.url || 'null'}, Host: ${service.host || 'null'}, Port: ${service.port || 'null'}`);

            stmt.run([
                service.name,
                service.type || 'http',
                service.url || null,
                service.visit_url || null,
                service.icon || '🔧',
                service.timeout || 5,
                service.interval || 30,
                service.expected_status || 200,
                service.category,
                service.host || null,
                service.port || null,
                warningThreshold
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`[DB Debug] Service created with ID: ${this.lastID}`);
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });

            stmt.finalize();
        });
    }

    async updateService(id, updates) {
        return new Promise((resolve, reject) => {
            console.log(`[DB Debug] Updating service ID ${id}:`);
            console.log(`[DB Debug] Updates:`, updates);
            
            const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(id);

            const sql = `UPDATE services SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`[DB Debug] Service updated, ${this.changes} rows affected`);
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async deleteService(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM services WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // History methods
    async saveServiceHistory(serviceId, status, responseTime, statusCode = null, errorMessage = null, additionalData = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO service_history (service_id, status, response_time, status_code, error_message, additional_data)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            const additionalDataJson = additionalData ? JSON.stringify(additionalData) : null;

            stmt.run([
                serviceId,
                status,
                responseTime,
                statusCode,
                errorMessage,
                additionalDataJson
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });

            stmt.finalize();
        });
    }

    async getServiceHistory(serviceId, limit = 100, hours = 24) {
        return new Promise((resolve, reject) => {
            // Handle null limit by removing LIMIT clause entirely
            const sql = limit && limit > 0 ? `
                SELECT * FROM service_history 
                WHERE service_id = ? 
                AND timestamp > datetime('now', '-${hours} hours')
                ORDER BY timestamp DESC 
                LIMIT ?
            ` : `
                SELECT * FROM service_history 
                WHERE service_id = ? 
                AND timestamp > datetime('now', '-${hours} hours')
                ORDER BY timestamp DESC
            `;

            const params = limit && limit > 0 ? [serviceId, limit] : [serviceId];

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parse additional_data JSON
                    const processedRows = rows.map(row => ({
                        ...row,
                        additional_data: row.additional_data ? JSON.parse(row.additional_data) : null
                    }));
                    resolve(processedRows);
                }
            });
        });
    }

    async getServiceGraphData(serviceId, hours = 24, maxPoints = 100) {
        return new Promise((resolve, reject) => {
            // Calculate bucket size in minutes to get approximately maxPoints
            const totalMinutes = hours * 60;
            const bucketMinutes = Math.max(1, Math.ceil(totalMinutes / maxPoints));
            
            const sql = `
                SELECT 
                    -- Create time buckets by rounding timestamps
                    datetime(
                        (strftime('%s', timestamp) / (${bucketMinutes} * 60)) * (${bucketMinutes} * 60), 
                        'unixepoch'
                    ) as bucket_time,
                    
                    -- Average response time per bucket
                    ROUND(AVG(response_time)) as avg_response_time,
                    
                    -- Most common status in bucket (or worst status if tie)
                    CASE 
                        WHEN SUM(CASE WHEN status = 'unhealthy' THEN 1 ELSE 0 END) > 0 THEN 'unhealthy'
                        WHEN SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) > 0 THEN 'warning'
                        ELSE 'healthy'
                    END as status,
                    
                    COUNT(*) as data_points_in_bucket
                    
                FROM service_history 
                WHERE service_id = ? 
                AND timestamp > datetime('now', '-${hours} hours')
                GROUP BY bucket_time
                ORDER BY bucket_time ASC
            `;

            this.db.all(sql, [serviceId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Format for chart consumption
                    const processedRows = rows.map(row => ({
                        timestamp: row.bucket_time,
                        response_time: row.avg_response_time || 0,
                        status: row.status,
                        bucket_size_minutes: bucketMinutes,
                        data_points_averaged: row.data_points_in_bucket
                    }));
                    resolve(processedRows);
                }
            });
        });
    }

    async getAllServicesHistory(hours = 24, limit = 1000) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT h.*, s.name as service_name, s.type as service_type
                FROM service_history h
                JOIN services s ON h.service_id = s.id
                WHERE h.timestamp > datetime('now', '-${hours} hours')
                ORDER BY h.timestamp DESC
                LIMIT ?
            `;

            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const processedRows = rows.map(row => ({
                        ...row,
                        additional_data: row.additional_data ? JSON.parse(row.additional_data) : null
                    }));
                    resolve(processedRows);
                }
            });
        });
    }

    async cleanupOldHistory() {
        return new Promise(async (resolve, reject) => {
            try {
                const retentionDays = await this.getSetting('history_retention_days', '30');
                const maxEntries = await this.getSetting('max_history_entries_per_service', '10000');

                // Delete old entries based on retention period
                const deleteOldSql = `
                    DELETE FROM service_history 
                    WHERE timestamp < datetime('now', '-${retentionDays} days')
                `;

                this.db.run(deleteOldSql, [], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    console.log(`[Cleanup] Removed ${this.changes} old history entries (older than ${retentionDays} days)`);
                });

                // Delete excess entries per service
                const services = await this.getAllServices();
                let totalExcessDeleted = 0;

                for (const service of services) {
                    const deleteExcessSql = `
                        DELETE FROM service_history 
                        WHERE service_id = ? 
                        AND id NOT IN (
                            SELECT id FROM service_history 
                            WHERE service_id = ? 
                            ORDER BY timestamp DESC 
                            LIMIT ?
                        )
                    `;

                    await new Promise((resolveInner, rejectInner) => {
                        this.db.run(deleteExcessSql, [service.id, service.id, parseInt(maxEntries)], function(err) {
                            if (err) {
                                rejectInner(err);
                            } else {
                                totalExcessDeleted += this.changes;
                                resolveInner();
                            }
                        });
                    });
                }

                console.log(`[Cleanup] Removed ${totalExcessDeleted} excess history entries (keeping max ${maxEntries} per service)`);
                resolve();

            } catch (error) {
                reject(error);
            }
        });
    }

    // Settings methods
    async getSetting(key, defaultValue = null) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.value : defaultValue);
                }
            });
        });
    }

    async setSetting(key, value, description = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO settings (key, value, description, updated_at)
                VALUES (?, ?, COALESCE(?, (SELECT description FROM settings WHERE key = ?)), CURRENT_TIMESTAMP)
            `;

            this.db.run(sql, [key, value, description, key], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async getAllSettings() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM settings ORDER BY key', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database; 