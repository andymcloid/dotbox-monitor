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

            this.db.run(createServicesTable, (err) => {
                if (err) {
                    console.error('Error creating services table:', err);
                    reject(err);
                } else {
                    console.log('Services table ready');
                    // Lägg till warning_threshold kolumn om den saknas
                    this.db.run('ALTER TABLE services ADD COLUMN warning_threshold INTEGER', (altErr) => {
                        // Ignorera fel om kolumnen redan finns
                        this.seedDefaultServices().then(resolve).catch(reject);
                    });
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
                        },
                        {
                            name: 'GitHub',
                            type: 'http',
                            url: 'https://github.com',
                            icon: '💻',
                            category: 'network',
                            warning_threshold: 1000
                        },
                        {
                            name: 'GitHub SSL',
                            type: 'ssl',
                            url: 'https://github.com',
                            icon: '🔒',
                            category: 'security',
                            warning_threshold: 30
                        },
                        {
                            name: 'Home Assistant',
                            type: 'http',
                            url: 'http://homeassistant:8123',
                            icon: '🏠',
                            category: 'smart_home',
                            warning_threshold: 1000
                        },
                        {
                            name: 'Atlas SSH',
                            type: 'tcp',
                            host: 'atlas.local',
                            port: 22,
                            icon: '🖥️',
                            category: 'network',
                            warning_threshold: 500
                        },
                        {
                            name: 'Atlas SMB Share',
                            type: 'tcp',
                            host: 'atlas.local',
                            port: 445,
                            icon: '💾',
                            category: 'storage',
                            warning_threshold: 500
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