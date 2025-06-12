// Global emoji database - loaded at startup
window.emojiDatabase = null;

class DotBoxMonitor {
    constructor() {
        this.socket = null;
        this.services = {};
        this.overallHealth = { status: 'unknown', percentage: 0 };
        this.currentPage = 'monitoring';
        this.editMode = false;
        this.updateTimeout = null; // For debouncing updates
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadEmojiDatabase(); // Load emojis at startup
        this.checkAuth();
    }

    bindEvents() {
        // Login form (only exists on login page)
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        // Health monitoring (only exists on main app page)
        const refreshHealthBtn = document.getElementById('refreshHealthBtn');
        if (refreshHealthBtn) {
            refreshHealthBtn.addEventListener('click', () => {
                this.refreshHealth();
            });
        }

        const refreshAllBtn = document.getElementById('refreshAllBtn');
        if (refreshAllBtn) {
            refreshAllBtn.addEventListener('click', () => {
                this.refreshHealth();
            });
        }

        // Edit mode functionality (only exists on main app page)
        const editModeBtn = document.getElementById('editModeBtn');
        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => {
                this.toggleEditMode();
            });
        }
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                this.showApp();
            } else {
                this.showLogin();
            }
        } catch (error) {
            this.showLogin();
        }
    }

    async loadEmojiDatabase() {
        // Only load if not already loaded
        if (window.emojiDatabase) return;
        
        try {
            console.log('Loading emoji database...');
            const response = await fetch('https://raw.githubusercontent.com/chalda-pnuzig/emojis.json/refs/heads/master/dist/list.min.json');
            
            if (response.ok) {
                const data = await response.json();
                window.emojiDatabase = data.emojis || [];
                console.log(`✅ Loaded ${window.emojiDatabase.length} emojis from database`);
            } else {
                console.warn('Failed to load emoji database, using fallback');
                this.createFallbackEmojiDatabase();
            }
        } catch (error) {
            console.error('Error loading emoji database:', error);
            this.createFallbackEmojiDatabase();
        }
    }

    createFallbackEmojiDatabase() {
        // Fallback emoji list for when the remote database fails
        window.emojiDatabase = [
            { emoji: '🏠', name: 'house', category: 'Objects' },
            { emoji: '🌐', name: 'globe with meridians', category: 'Objects' },
            { emoji: '🔧', name: 'wrench', category: 'Objects' },
            { emoji: '💻', name: 'laptop computer', category: 'Objects' },
            { emoji: '🖥️', name: 'desktop computer', category: 'Objects' },
            { emoji: '📱', name: 'mobile phone', category: 'Objects' },
            { emoji: '⚙️', name: 'gear', category: 'Objects' },
            { emoji: '🔐', name: 'closed lock with key', category: 'Objects' },
            { emoji: '🔒', name: 'locked', category: 'Objects' },
            { emoji: '🔑', name: 'key', category: 'Objects' },
            { emoji: '📊', name: 'bar chart', category: 'Objects' },
            { emoji: '📈', name: 'chart increasing', category: 'Objects' },
            { emoji: '📉', name: 'chart decreasing', category: 'Objects' },
            { emoji: '📺', name: 'television', category: 'Objects' },
            { emoji: '☁️', name: 'cloud', category: 'Travel & Places' },
            { emoji: '🚀', name: 'rocket', category: 'Travel & Places' },
            { emoji: '🛡️', name: 'shield', category: 'Objects' },
            { emoji: '⚡', name: 'high voltage', category: 'Travel & Places' },
            { emoji: '🗄️', name: 'file cabinet', category: 'Objects' },
            { emoji: '💾', name: 'floppy disk', category: 'Objects' },
            { emoji: '🔗', name: 'link', category: 'Objects' },
            { emoji: '📡', name: 'satellite antenna', category: 'Objects' },
            { emoji: '🌍', name: 'globe showing Europe-Africa', category: 'Travel & Places' },
            { emoji: '🎯', name: 'direct hit', category: 'Activities' },
            { emoji: '🔍', name: 'magnifying glass tilted left', category: 'Objects' },
            { emoji: '📋', name: 'clipboard', category: 'Objects' },
            { emoji: '📦', name: 'package', category: 'Objects' },
            { emoji: '🎵', name: 'musical note', category: 'Objects' },
            { emoji: '📧', name: 'e-mail', category: 'Objects' },
            { emoji: '⭐', name: 'star', category: 'Travel & Places' }
        ];
        console.log(`⚠️ Using fallback emoji database with ${window.emojiDatabase.length} emojis`);
    }

    async login() {
        const password = document.getElementById('passwordInput').value;
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                this.showApp();
            } else {
                const error = await response.json();
                this.showNotification('Login failed: ' + error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Login error: ' + error.message, 'danger');
        }
    }

    async logout() {
        try {
            await fetch('/logout', { method: 'POST' });
            this.showLogin();
            if (this.socket) {
                this.socket.disconnect();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
        }
        if (appContainer) {
            appContainer.classList.add('hidden');
        }
    }

    showApp() {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loginScreen) {
            loginScreen.classList.add('hidden');
        }
        if (appContainer) {
            appContainer.classList.remove('hidden');
        }
        this.refreshHealth();
    }

    setupSocketEvents() {
        const connectionStatus = document.getElementById('connectionStatus');

        this.socket.on('connect', () => {
            console.log('🟢 Connected to WebSocket - real-time updates enabled');
            if (connectionStatus) {
                connectionStatus.textContent = '🟢';
                connectionStatus.title = 'WebSocket Connected - Real-time updates';
            }
            // Update navbar connection status if available
            this.updateNavBarConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('🔴 Disconnected from WebSocket');
            if (connectionStatus) {
                connectionStatus.textContent = '🔴';
                connectionStatus.title = 'WebSocket Disconnected - Using manual refresh';
            }
            // Update navbar connection status if available
            this.updateNavBarConnectionStatus(false);
        });

        this.socket.on('health-overview', (data) => {
            this.overallHealth = data;
            this.updateHealthOverview();
        });

        this.socket.on('health-services', (data) => {
            // Debounce updates to prevent excessive re-rendering
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
            }
            
            this.updateTimeout = setTimeout(() => {
                // Smart update instead of full re-render
                this.updateHealthServices(data);
                
                // Update detail pane if it's open
                this.updateDetailPaneIfOpen(data);
                
                // Show that we got real-time data
                const lastUpdatedEl = document.getElementById('lastUpdatedText');
                if (lastUpdatedEl) {
                    lastUpdatedEl.textContent = new Date().toLocaleTimeString();
                }
                
                this.updateTimeout = null;
            }, 100); // 100ms debounce
        });
    }

    updateHealthServices(newServicesData) {
        try {
            // Check if we need to do a full re-render (services added/removed)
            const oldServiceIds = this.getAllServiceIds(this.services);
            const newServiceIds = this.getAllServiceIds(newServicesData);
            
            const needsFullRender = !this.arraysEqual(oldServiceIds.sort(), newServiceIds.sort());
            
            if (needsFullRender) {
                // Full re-render needed
                this.services = newServicesData;
                this.renderHealthServices();
                return;
            }
            
            // Smart update: only update changed services
            this.services = newServicesData;
            this.updateChangedServices(newServicesData);
            
        } catch (error) {
            console.error('Error in updateHealthServices:', error);
            // Fallback to full render
            this.services = newServicesData;
            this.renderHealthServices();
        }
    }

    updateNavBarConnectionStatus(connected) {
        // Update navbar if it exists (global appNavBar)
        if (window.appNavBar) {
            window.appNavBar.updateStatus({
                connectionStatus: connected ? 'connected' : 'disconnected'
            });
        }
        
        // Also update direct connectionStatus element for backward compatibility
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.textContent = connected ? '🟢' : '🔴';
            connectionStatus.title = connected 
                ? 'WebSocket Connected - Real-time updates' 
                : 'WebSocket Disconnected - Using manual refresh';
        }
    }

    getAllServiceIds(servicesData) {
        const ids = [];
        Object.values(servicesData || {}).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                categoryServices.forEach(service => {
                    ids.push(service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-'));
                });
            }
        });
        return ids;
    }

    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }

    updateChangedServices(newServicesData) {
        Object.values(newServicesData).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                categoryServices.forEach(service => {
                    this.updateServiceCard(service);
                });
            }
        });
    }

    updateServiceCard(service) {
        const serviceId = service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-');
        const serviceCard = document.querySelector(`[data-service-id="${serviceId}"]`);
        
        if (!serviceCard) return;

        // Update status class
        serviceCard.className = `service-card ${service.status || 'unknown'}`;
        
        // Update service name
        const nameElement = serviceCard.querySelector('.service-name');
        if (nameElement) {
            nameElement.textContent = service.name;
        }
        
        // Update service icon
        const iconElement = serviceCard.querySelector('.service-icon');
        if (iconElement) {
            iconElement.textContent = service.icon || '🔧';
        }
        
        // Update status text  
        const statusElement = serviceCard.querySelector('.service-status');
        if (statusElement) {
            const statusText = service.status === 'healthy' ? 'Healthy' : 
                              service.status === 'warning' ? 'Warning' :
                              service.status === 'unhealthy' ? 'Unhealthy' : 'Unknown';
            statusElement.className = `service-status ${service.status || 'unknown'}`;
            statusElement.textContent = statusText;
        }

        // Update metrics using new layout structure
        const uptimeElement = serviceCard.querySelector('.service-uptime');
        if (uptimeElement) {
            uptimeElement.textContent = `${service.uptime || 0}%`;
        }

        const timestampElement = serviceCard.querySelector('.service-timestamp');
        if (timestampElement) {
            timestampElement.textContent = service.timestamp ? new Date(service.timestamp).toLocaleTimeString() : 'Never';
        }

        // Note: Expanded details functionality removed with new horizontal layout
    }

    // Legacy methods removed - expanded details functionality replaced with detail pane

    loadDetailChart(serviceId, chartHistory) {
        const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
        const statusLoadingEl = document.getElementById(`status-chart-loading-${serviceId}`);
        const canvasEl = document.getElementById(`detail-chart-${serviceId}`);
        const statusCanvasEl = document.getElementById(`status-chart-${serviceId}`);
        
        if (!canvasEl || !statusCanvasEl) return;
        
        try {
            if (loadingEl) {
                loadingEl.textContent = 'Loading chart data...';
                loadingEl.style.display = 'block';
            }
            if (statusLoadingEl) {
                statusLoadingEl.textContent = 'Loading status data...';
                statusLoadingEl.style.display = 'block';
            }
            
            // Use WebSocket data if available, otherwise fetch from API
            if (chartHistory && chartHistory.length > 0) {
                this.renderDetailCharts(serviceId, chartHistory);
            } else {
                // Fallback to API fetch if no WebSocket data
                this.fetchAndRenderDetailCharts(serviceId);
            }
        } catch (error) {
            console.error('Error loading detail charts:', error);
            if (loadingEl) {
                loadingEl.textContent = 'Failed to load chart data';
                canvasEl.style.display = 'none';
            }
            if (statusLoadingEl) {
                statusLoadingEl.textContent = 'Failed to load status data';
                statusCanvasEl.style.display = 'none';
            }
        }
    }

    async fetchAndRenderDetailCharts(serviceId) {
        try {
            const response = await fetch(`/api/services/${serviceId}/graphdata?hours=24&maxPoints=100`);
            if (!response.ok) {
                throw new Error('Failed to fetch chart data');
            }
            
            const graphData = await response.json();
            this.renderDetailCharts(serviceId, graphData);
        } catch (error) {
            console.error('Error fetching chart data:', error);
            const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
            const statusLoadingEl = document.getElementById(`status-chart-loading-${serviceId}`);
            if (loadingEl) {
                loadingEl.textContent = 'Failed to load chart data';
            }
            if (statusLoadingEl) {
                statusLoadingEl.textContent = 'Failed to load status data';
            }
        }
    }

    renderDetailCharts(serviceId, historyData) {
        const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
        const statusLoadingEl = document.getElementById(`status-chart-loading-${serviceId}`);
        const canvasEl = document.getElementById(`detail-chart-${serviceId}`);
        const statusCanvasEl = document.getElementById(`status-chart-${serviceId}`);
        
        if (!canvasEl || !statusCanvasEl) return;
        
        if (historyData.length === 0) {
            if (loadingEl) {
                loadingEl.textContent = 'No data available yet';
                canvasEl.style.display = 'none';
            }
            if (statusLoadingEl) {
                statusLoadingEl.textContent = 'No status data available yet';
                statusCanvasEl.style.display = 'none';
            }
            return;
        }
        
        // Destroy existing charts if they exist
        const responseChartKey = `detail-response-${serviceId}`;
        const statusChartKey = `detail-status-${serviceId}`;
        
        if (serviceCharts.has(responseChartKey)) {
            serviceCharts.get(responseChartKey).destroy();
        }
        if (serviceCharts.has(statusChartKey)) {
            serviceCharts.get(statusChartKey).destroy();
        }
        
        // Create Status Chart (first)
        this.createStatusChart(serviceId, historyData, statusCanvasEl);
        
        // Create Response Time Chart (second)
        this.createResponseTimeChart(serviceId, historyData, canvasEl);
        
        // Hide loading indicators
        if (loadingEl) {
            loadingEl.style.display = 'none';
            canvasEl.style.display = 'block';
        }
        if (statusLoadingEl) {
            statusLoadingEl.style.display = 'none';
            statusCanvasEl.style.display = 'block';
        }
    }

    createResponseTimeChart(serviceId, historyData, canvasEl) {
        // Sort by timestamp (oldest first for proper line chart)
        const sortedData = historyData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Prepare labels and response time data
        const labels = sortedData.map(entry => {
            const date = new Date(entry.timestamp);
            return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        });
        
        const responseTimeData = sortedData.map(entry => entry.response_time || 0);
        
        // Create chart context
        const ctx = canvasEl.getContext('2d');
        
        // Force canvas size
        canvasEl.width = 400;
        canvasEl.height = 160;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '160px';
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Response Time (ms)',
                    data: responseTimeData,
                    borderColor: '#4a9eff',
                    backgroundColor: 'rgba(74, 158, 255, 0.1)',
                    tension: 0.5,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                animation: {
                    duration: 800,
                    easing: 'easeInOutQuart'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#ccc'
                        },
                        ticks: {
                            color: '#ccc',
                            maxTicksLimit: 8
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            color: '#4a9eff'
                        },
                        ticks: {
                            color: '#4a9eff'
                        },
                        grid: {
                            color: 'rgba(74, 158, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#4a9eff',
                        borderWidth: 2,
                        cornerRadius: 8
                    }
                }
            }
        });
        
        serviceCharts.set(`detail-response-${serviceId}`, chart);
    }

    createStatusChart(serviceId, historyData, canvasEl) {
        // Sort by timestamp (oldest first for proper line chart)
        const sortedData = historyData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Prepare labels
        const labels = sortedData.map(entry => {
            const date = new Date(entry.timestamp);
            return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        });
        
        // Create background colors based on status
        const backgroundColors = sortedData.map(entry => {
            switch(entry.status) {
                case 'healthy': return 'rgba(40, 167, 69, 0.8)';
                case 'warning': return 'rgba(255, 193, 7, 0.8)';
                case 'unhealthy': return 'rgba(234, 76, 136, 0.8)';
                default: return 'rgba(108, 117, 125, 0.8)';
            }
        });
        
        const borderColors = sortedData.map(entry => {
            switch(entry.status) {
                case 'healthy': return '#28a745';
                case 'warning': return '#ffc107';
                case 'unhealthy': return '#ea4c88';
                default: return '#6c757d';
            }
        });
        
        // Use numeric values for bar height (all same height, color shows status)
        const statusValues = sortedData.map(() => 1);
        
        // Create chart context
        const ctx = canvasEl.getContext('2d');
        
        // Force canvas size
        canvasEl.width = 400;
        canvasEl.height = 120;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '120px';
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Status',
                    data: statusValues,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    barThickness: 'flex',
                    maxBarThickness: 20
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                animation: {
                    duration: 600,
                    easing: 'easeInOutQuart'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#ccc'
                        },
                        ticks: {
                            color: '#ccc',
                            maxTicksLimit: 8
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: false, // Hide Y-axis since all bars are same height
                        max: 1.2,
                        min: 0
                    }
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#ccc',
                        borderWidth: 2,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const dataIndex = context.dataIndex;
                                const status = sortedData[dataIndex].status;
                                const statusText = status === 'healthy' ? '🟢 Healthy' :
                                                 status === 'warning' ? '🟡 Warning' :
                                                 status === 'unhealthy' ? '🔴 Unhealthy' : '⚫ Unknown';
                                return statusText;
                            },
                            title: function(context) {
                                return `Time: ${context[0].label}`;
                            }
                        }
                    }
                }
            }
        });
        
        serviceCharts.set(`detail-status-${serviceId}`, chart);
    }

    async refreshHealth() {
        try {
            // Setup socket connection if not exists
            if (!this.socket) {
                this.socket = io();
                this.setupSocketEvents();
                
                // Set initial connection status after a short delay
                setTimeout(() => {
                    if (this.socket && this.socket.connected) {
                        this.updateNavBarConnectionStatus(true);
                    } else {
                        this.updateNavBarConnectionStatus(false);
                    }
                }, 100);
            }
            
            // Request fresh health data via WebSocket (preferred)
            if (this.socket && this.socket.connected) {
                this.socket.emit('request-health-update');
                // Removed annoying "Requesting fresh data..." notification
            } else {
                // Fallback to HTTP if WebSocket not connected
                const [overviewRes, servicesRes] = await Promise.all([
                    fetch('/api/health/overview'),
                    fetch('/api/health/categories')
                ]);
                
                if (overviewRes.ok && servicesRes.ok) {
                    this.overallHealth = await overviewRes.json();
                    this.services = await servicesRes.json();
                    
                    this.updateHealthOverview();
                    this.renderHealthServices();
                } else {
                    const overviewError = overviewRes.ok ? null : await overviewRes.text();
                    const servicesError = servicesRes.ok ? null : await servicesRes.text();
                    console.error('API responses not OK - Overview:', overviewError, 'Services:', servicesError);
                    this.showNotification('Failed to fetch health data', 'danger');
                }
            }
        } catch (error) {
            console.error('Error refreshing health data:', error);
            this.showNotification('Failed to refresh health data', 'danger');
        }
    }

    updateHealthOverview() {
        const overallHealthText = document.getElementById('overallHealthText');
        const servicesCountText = document.getElementById('servicesCountText');
        const lastUpdatedText = document.getElementById('lastUpdatedText');

        if (overallHealthText) {
            const statusText = this.overallHealth.status === 'healthy' ? 'Healthy' :
                              this.overallHealth.status === 'warning' ? 'Warning' :
                              this.overallHealth.status === 'unhealthy' ? 'Issues' : 'Unknown';
            
            overallHealthText.textContent = statusText;
            // Remove old class and add color classes if needed
            overallHealthText.className = 'status-mini-value';
            if (this.overallHealth.status === 'healthy') {
                overallHealthText.style.color = 'var(--accent-green)';
            } else if (this.overallHealth.status === 'warning') {
                overallHealthText.style.color = 'var(--accent-orange)';
            } else if (this.overallHealth.status === 'unhealthy') {
                overallHealthText.style.color = 'var(--accent-red)';
            } else {
                overallHealthText.style.color = 'var(--text-muted)';
            }
        }

        if (servicesCountText) {
            const healthy = this.overallHealth.healthy || 0;
            const warning = this.overallHealth.warning || 0;
            const total = this.overallHealth.total || 0;
            servicesCountText.textContent = warning > 0 
                ? `${healthy}/${warning}/${total}` 
                : `${healthy}/${total}`;
        }

        if (lastUpdatedText) {
            lastUpdatedText.textContent = new Date().toLocaleTimeString();
        }
    }

    // Edit mode removed - now handled in detail pane

    renderHealthServices() {
        const servicesContainer = document.getElementById('servicesContainer');
        const emptyState = document.getElementById('emptyState');
        if (!servicesContainer) return;

        // Flatten all services from all categories into one array
        const allServices = [];
        Object.values(this.services).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                allServices.push(...categoryServices);
            }
        });

        if (allServices.length === 0) {
            // Show empty state, hide services container
            servicesContainer.classList.add('hidden');
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }

        // Hide empty state, show services container
        servicesContainer.classList.remove('hidden');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        const servicesHtml = allServices.map(service => {
            const statusClass = service.status || 'unknown';
            const statusText = service.status === 'healthy' ? 'Healthy' : 
                              service.status === 'warning' ? 'Warning' :
                              service.status === 'unhealthy' ? 'Unhealthy' : 'Unknown';
            
            // Use database ID first, fallback to name-based ID for consistency
            const serviceId = service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-');
            
            return `
                <div class="service-card ${statusClass}" data-service-id="${serviceId}">
                    <div class="service-info">
                        <div class="service-icon">${service.icon || '🔧'}</div>
                        <div class="service-details">
                            <div class="service-name">${service.name}</div>
                            <div class="service-status ${statusClass}">${statusText}</div>
                        </div>
                    </div>
                    
                    <div class="service-stats">
                        <div class="service-uptime">${service.uptime || 0}%</div>
                        <div class="service-timestamp">${service.timestamp ? new Date(service.timestamp).toLocaleTimeString() : 'Never'}</div>
                    </div>
                    
                    <div class="service-actions">
                        <button class="btn-icon info" onclick="monitor.showServiceDetail('${serviceId}')" title="Show details">
                            ℹ
                        </button>
                        ${service.visit_url ? `
                            <a href="${service.visit_url}" target="_blank" class="btn-icon link" title="Open service">
                                🔗
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        servicesContainer.innerHTML = servicesHtml;
        
        // Make sure charts are cleaned up for services that no longer exist
        this.cleanupOrphanedCharts();
    }

    cleanupOrphanedCharts() {
        // Remove charts for services that no longer exist in DOM
        const orphanedCharts = [];
        
        serviceCharts.forEach((chart, chartKey) => {
            // Check for different chart types
            if (chartKey.startsWith('detail-response-')) {
                const serviceId = chartKey.replace('detail-response-', '');
                const canvasEl = document.getElementById(`detail-chart-${serviceId}`);
                if (!canvasEl) {
                    orphanedCharts.push(chartKey);
                }
            } else if (chartKey.startsWith('detail-status-')) {
                const serviceId = chartKey.replace('detail-status-', '');
                const statusCanvasEl = document.getElementById(`status-chart-${serviceId}`);
                if (!statusCanvasEl) {
                    orphanedCharts.push(chartKey);
                }
            } else {
                // Legacy chart cleanup
                const canvasEl = document.getElementById(`chart-${chartKey}`);
                const detailCanvasEl = document.getElementById(`detail-chart-${chartKey}`);
                if (!canvasEl && !detailCanvasEl) {
                    orphanedCharts.push(chartKey);
                }
            }
        });
        
        orphanedCharts.forEach(chartKey => {
            try {
                const chart = serviceCharts.get(chartKey);
                if (chart) {
                    chart.destroy();
                }
            } catch (error) {
                console.warn(`Error destroying orphaned chart ${chartKey}:`, error);
            }
            serviceCharts.delete(chartKey);
        });
        
        if (orphanedCharts.length > 0) {
            console.log(`Cleaned up ${orphanedCharts.length} orphaned charts`);
        }
    }

    updateDetailPaneIfOpen(servicesData) {
        const detailPane = document.getElementById('detailPane');
        if (!detailPane || !detailPane.classList.contains('open')) {
            return;
        }

        const currentServiceId = detailPane.getAttribute('data-service-id');
        if (!currentServiceId) {
            return;
        }

        // Find the current service in new data
        let currentService = null;
        Object.values(servicesData).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                categoryServices.forEach(service => {
                    const dbId = service.id ? service.id.toString() : null;
                    const nameId = service.name.toLowerCase().replace(/\s+/g, '-');
                    
                    if (currentServiceId === dbId || currentServiceId === nameId) {
                        currentService = service;
                    }
                });
            }
        });

        if (currentService) {
            // Update detail pane with live data (smooth updates, no re-rendering)
            this.updateDetailPaneLive(currentService);
        }
    }

    updateDetailPaneLive(service) {
        // Update traffic light in header
        const detailPaneTitle = document.getElementById('detailPaneTitle');
        if (detailPaneTitle) {
            const statusIndicator = service.status === 'healthy' ? '🟢' : 
                                   service.status === 'warning' ? '🟡' :
                                   service.status === 'unhealthy' ? '🔴' : '⚪';
            detailPaneTitle.textContent = `${statusIndicator} ${service.icon || '🔧'} ${service.name}`;
        }

        // Update metrics that can change
        const updateMetric = (label, value) => {
            const metrics = document.querySelectorAll('.detail-metric-item');
            metrics.forEach(metric => {
                const labelEl = metric.querySelector('.detail-metric-label');
                const valueEl = metric.querySelector('.detail-metric-value');
                if (labelEl && valueEl && labelEl.textContent === label) {
                    valueEl.textContent = value;
                }
            });
        };

        updateMetric('Response Time', `${service.responseTime || 0}ms`);
        updateMetric('Uptime', `${service.uptime || 0}%`);
        updateMetric('Last Check', service.timestamp ? new Date(service.timestamp).toLocaleString() : 'Never');
        
        if (service.type === 'ssl' && service.daysUntilExpiry !== undefined) {
            updateMetric('Days Until Expiry', `${service.daysUntilExpiry} days`);
        }

        // Update chart if new data is available
        if (service.chartHistory && service.chartHistory.length > 0) {
            const serviceId = service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-');
            this.updateDetailChart(serviceId, service.chartHistory);
        }
    }

    updateDetailChart(serviceId, historyData) {
        const responseChartKey = `detail-response-${serviceId}`;
        const statusChartKey = `detail-status-${serviceId}`;
        const responseChart = serviceCharts.get(responseChartKey);
        const statusChart = serviceCharts.get(statusChartKey);
        
        if (historyData && historyData.length > 0) {
            try {
                const chartData = this.prepareChartDataForUpdate(historyData);
                
                // Update response time chart
                if (responseChart) {
                    responseChart.data.labels = chartData.labels;
                    responseChart.data.datasets[0].data = chartData.responseTimeData;
                    responseChart.update('none'); // No animation for live updates
                }
                
                // Update status chart
                if (statusChart) {
                    statusChart.data.labels = chartData.labels;
                    
                    // Update colors based on new status data
                    const backgroundColors = historyData.map(entry => {
                        switch(entry.status) {
                            case 'healthy': return 'rgba(40, 167, 69, 0.8)';
                            case 'warning': return 'rgba(255, 193, 7, 0.8)';
                            case 'unhealthy': return 'rgba(234, 76, 136, 0.8)';
                            default: return 'rgba(108, 117, 125, 0.8)';
                        }
                    });
                    
                    const borderColors = historyData.map(entry => {
                        switch(entry.status) {
                            case 'healthy': return '#28a745';
                            case 'warning': return '#ffc107';
                            case 'unhealthy': return '#ea4c88';
                            default: return '#6c757d';
                        }
                    });
                    
                    statusChart.data.datasets[0].backgroundColor = backgroundColors;
                    statusChart.data.datasets[0].borderColor = borderColors;
                    statusChart.update('none'); // No animation for live updates
                }
            } catch (error) {
                console.warn('Error updating chart data:', error);
                // Fallback to reload if update fails
                this.loadDetailChart(serviceId, historyData);
            }
        }
    }

    prepareChartDataForUpdate(historyData) {
        // Sort by timestamp (oldest first for proper line chart)
        const sortedData = historyData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Prepare labels (timestamps) and data points
        const labels = sortedData.map(entry => {
            const date = new Date(entry.timestamp);
            return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        });
        
        // Response time data
        const responseTimeData = sortedData.map(entry => entry.response_time || 0);
        
        // Status data (convert to numeric: healthy=1, warning=0.5, unhealthy=0)
        const statusData = sortedData.map(entry => {
            switch(entry.status) {
                case 'healthy': return 1;
                case 'warning': return 0.5;
                case 'unhealthy': return 0;
                default: return 0;
            }
        });
        
        return { labels, responseTimeData, statusData };
    }

    showServiceDetail(serviceId) {
        // Find service data
        let service = null;
        Object.values(this.services || {}).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                categoryServices.forEach(s => {
                    // Compare with both ID formats for compatibility
                    const dbId = s.id ? s.id.toString() : null;
                    const nameId = s.name.toLowerCase().replace(/\s+/g, '-');
                    
                    if (serviceId === dbId || serviceId === nameId) {
                        service = s;
                    }
                });
            }
        });

        if (!service) {
            console.warn(`Service ${serviceId} not found. Available services:`, 
                Object.values(this.services || {}).flat().map(s => ({
                    id: s.id,
                    name: s.name,
                    nameId: s.name.toLowerCase().replace(/\s+/g, '-')
                }))
            );
            return;
        }

        const detailPane = document.getElementById('detailPane');
        const detailPaneOverlay = document.getElementById('detailPaneOverlay');
        const detailPaneTitle = document.getElementById('detailPaneTitle');

        // Set service ID for future updates  
        const finalServiceId = service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-');
        detailPane.setAttribute('data-service-id', finalServiceId);
        
        // Update title with traffic light status
        const statusIndicator = service.status === 'healthy' ? '🟢' : 
                               service.status === 'warning' ? '🟡' :
                               service.status === 'unhealthy' ? '🔴' : '⚪';
        detailPaneTitle.textContent = `${statusIndicator} ${service.icon || '🔧'} ${service.name}`;

        // Render content
        this.renderDetailPaneContent(service);

        // Show pane and overlay
        detailPaneOverlay.classList.add('visible');
        detailPane.classList.add('open');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    renderDetailPaneContent(service) {
        const serviceId = service.id ? service.id.toString() : service.name.toLowerCase().replace(/\s+/g, '-');
        const detailPaneContent = document.getElementById('detailPaneContent');

        const statusClass = service.status || 'unknown';
        const statusText = service.status === 'healthy' ? 'Healthy' : 
                          service.status === 'warning' ? 'Warning' :
                          service.status === 'unhealthy' ? 'Unhealthy' : 'Unknown';

        detailPaneContent.innerHTML = `
            <div class="detail-chart-section">
                <h4>Status History (24h)</h4>
                <div id="status-chart-loading-${serviceId}" class="chart-loading">Loading status data...</div>
                <div class="detail-chart-container">
                    <canvas id="status-chart-${serviceId}" class="detail-chart-canvas" width="400" height="120"></canvas>
                </div>
            </div>

            <div class="detail-chart-section">
                <h4>Response Time (24h)</h4>
                <div id="detail-chart-loading-${serviceId}" class="chart-loading">Loading chart data...</div>
                <div class="detail-chart-container">
                    <canvas id="detail-chart-${serviceId}" class="detail-chart-canvas" width="400" height="160"></canvas>
                </div>
            </div>

            <div class="detail-metrics-grid">
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Response Time</div>
                    <div class="detail-metric-value">${service.responseTime || 0}ms</div>
                </div>
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Uptime</div>
                    <div class="detail-metric-value">${service.uptime || 0}%</div>
                </div>
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Type</div>
                    <div class="detail-metric-value">${service.type?.toUpperCase() || 'UNKNOWN'}</div>
                </div>
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Category</div>
                    <div class="detail-metric-value">${service.category || 'Other'}</div>
                </div>
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Last Check</div>
                    <div class="detail-metric-value">${service.timestamp ? new Date(service.timestamp).toLocaleString() : 'Never'}</div>
                </div>
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Warning Threshold</div>
                    <div class="detail-metric-value">${service.warning_threshold || 'N/A'}${service.type === 'ssl' ? ' days' : 'ms'}</div>
                </div>
            </div>

            ${service.url ? `
                <div class="detail-metric-item">
                    <div class="detail-metric-label">URL</div>
                    <div class="detail-metric-value" style="font-family: monospace; font-size: 0.8em; word-break: break-all;">${service.url}</div>
                </div>
            ` : ''}

            ${service.visit_url ? `
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Visit URL</div>
                    <div class="detail-metric-value">
                        <a href="${service.visit_url}" target="_blank" style="color: var(--accent-blue); text-decoration: none;">
                            ${service.visit_url} 🔗
                        </a>
                    </div>
                </div>
            ` : ''}

            ${service.type === 'ssl' && service.daysUntilExpiry !== undefined ? `
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Days Until Expiry</div>
                    <div class="detail-metric-value">${service.daysUntilExpiry} days</div>
                </div>
            ` : ''}

            ${service.type === 'ssl' && service.issuer ? `
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Certificate Issuer</div>
                    <div class="detail-metric-value">${service.issuer}</div>
                </div>
            ` : ''}

            ${service.type === 'ssl' && service.validTo ? `
                <div class="detail-metric-item">
                    <div class="detail-metric-label">Valid Until</div>
                    <div class="detail-metric-value">${new Date(service.validTo).toLocaleDateString()}</div>
                </div>
            ` : ''}

            ${service.error ? `
                <div class="detail-metric-item" style="grid-column: 1/-1;">
                    <div class="detail-metric-label">Error</div>
                    <div class="detail-metric-value" style="color: var(--accent-red);">${service.error}</div>
                </div>
            ` : ''}
        `;

        // Destroy any existing chart for this service in detail pane
        const existingChartKey = `detail-${serviceId}`;
        if (serviceCharts.has(existingChartKey)) {
            try {
                serviceCharts.get(existingChartKey).destroy();
                serviceCharts.delete(existingChartKey);
            } catch (error) {
                console.warn('Error destroying existing detail chart:', error);
            }
        }

        // Load chart with data from WebSocket if available, otherwise fetch
        setTimeout(() => {
            this.loadDetailChart(serviceId, service.chartHistory);
        }, 100);
    }

    showNotification(message, variant = 'primary') {
        // Create notification using CSS classes from app.css
        const notification = document.createElement('div');
        notification.className = `notification notification-${variant}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

// Global functions
function logout() {
    if (window.monitor) {
        window.monitor.logout();
    }
}

function closeDetailPane() {
    const detailPane = document.getElementById('detailPane');
    const detailPaneOverlay = document.getElementById('detailPaneOverlay');
    
    // Destroy any detail charts before closing
    const serviceId = detailPane.getAttribute('data-service-id');
    if (serviceId) {
        const responseChartKey = `detail-response-${serviceId}`;
        const statusChartKey = `detail-status-${serviceId}`;
        
        // Clean up both charts
        [responseChartKey, statusChartKey].forEach(chartKey => {
            if (serviceCharts.has(chartKey)) {
                try {
                    serviceCharts.get(chartKey).destroy();
                    serviceCharts.delete(chartKey);
                } catch (error) {
                    console.warn(`Error destroying chart ${chartKey} on close:`, error);
                }
            }
        });
    }
    
    detailPane.classList.remove('open');
    detailPaneOverlay.classList.remove('visible');
    
    // Re-enable body scroll
    document.body.style.overflow = 'auto';
    
    // Clear service ID
    detailPane.removeAttribute('data-service-id');
}

async function refreshDetailChart(serviceId) {
    if (window.monitor) {
        // Get serviceId from detail pane if not provided
        if (!serviceId) {
            const detailPane = document.getElementById('detailPane');
            serviceId = detailPane ? detailPane.getAttribute('data-service-id') : null;
        }
        
        if (serviceId) {
            // Add loading state to refresh button
            const refreshBtn = document.getElementById('detailRefreshBtn');
            if (refreshBtn) {
                const originalText = refreshBtn.innerHTML;
                refreshBtn.innerHTML = '<span style="animation: spin 1s linear infinite;">🔄</span>';
                refreshBtn.disabled = true;
                refreshBtn.style.opacity = '0.6';
                refreshBtn.style.cursor = 'not-allowed';
                
                try {
                    // Fetch fresh data and re-render both charts
                    await window.monitor.fetchAndRenderDetailCharts(serviceId);
                } finally {
                    // Restore button state
                    setTimeout(() => {
                        refreshBtn.innerHTML = originalText;
                        refreshBtn.disabled = false;
                        refreshBtn.style.opacity = '1';
                        refreshBtn.style.cursor = 'pointer';
                    }, 500); // Small delay to show completion
                }
            } else {
                // Fallback if button not found
                await window.monitor.fetchAndRenderDetailCharts(serviceId);
            }
        }
    }
}

function editServiceFromDetail() {
    const detailPane = document.getElementById('detailPane');
    const serviceId = detailPane.getAttribute('data-service-id');
    
    if (serviceId) {
        closeDetailPane();
        editService(serviceId);
    }
}

function deleteServiceFromDetail() {
    const detailPane = document.getElementById('detailPane');
    const serviceId = detailPane.getAttribute('data-service-id');
    
    if (serviceId) {
        closeDetailPane();
        deleteService(serviceId);
    }
}

function getDefaultThreshold(serviceType) {
    switch(serviceType) {
        case 'ssl': return 30;
        case 'http': return 1000;
        case 'tcp': return 500;
        default: return 1000;
    }
}

// Chart management
const serviceCharts = new Map(); // Cache for Chart.js instances

// Gradient cache for status line
let statusGradient = null;
let gradientWidth = 0;
let gradientHeight = 0;

function getStatusGradient(ctx, chartArea) {
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    
    // Create new gradient if this is first render or chart size changed
    if (!statusGradient || gradientWidth !== chartWidth || gradientHeight !== chartHeight) {
        gradientWidth = chartWidth;
        gradientHeight = chartHeight;
        
        // Create vertical gradient from bottom (red) to top (green)
        statusGradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        statusGradient.addColorStop(0, '#ea4c88');    // Red for unhealthy (0)
        statusGradient.addColorStop(0.5, '#ffc107');  // Yellow for warning (0.5)  
        statusGradient.addColorStop(1, '#28a745');    // Green for healthy (1)
    }
    
    return statusGradient;
}

// Background gradient for status area
let statusBackgroundGradient = null;

function getStatusBackgroundGradient(ctx, chartArea) {
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    
    if (!statusBackgroundGradient || gradientWidth !== chartWidth || gradientHeight !== chartHeight) {
        // Create semi-transparent background gradient
        statusBackgroundGradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        statusBackgroundGradient.addColorStop(0, 'rgba(234, 76, 136, 0.1)');    // Red (transparent)
        statusBackgroundGradient.addColorStop(0.5, 'rgba(255, 193, 7, 0.1)');   // Yellow (transparent)
        statusBackgroundGradient.addColorStop(1, 'rgba(40, 167, 69, 0.1)');     // Green (transparent)
    }
    
    return statusBackgroundGradient;
}

async function loadServiceChart(serviceId) {
    const loadingEl = document.getElementById(`chart-loading-${serviceId}`);
    const canvasEl = document.getElementById(`chart-${serviceId}`);
    
    if (!canvasEl) return;
    
    try {
        loadingEl.textContent = 'Loading chart data...';
        loadingEl.style.display = 'block';
        
        // Fetch service graph data from API (optimized for charts)
        const response = await fetch(`/api/services/${serviceId}/graphdata?hours=24&maxPoints=100`);
        if (!response.ok) {
            throw new Error('Failed to fetch chart data');
        }
        
        const historyData = await response.json();
        
        if (historyData.length === 0) {
            loadingEl.textContent = 'No data available yet';
            canvasEl.style.display = 'none';
            return;
        }
        
        // Prepare chart data
        const chartData = prepareChartData(historyData);
        
        // Destroy existing chart if it exists
        if (serviceCharts.has(serviceId)) {
            serviceCharts.get(serviceId).destroy();
        }
        
        // Reset gradients for new chart
        statusGradient = null;
        statusBackgroundGradient = null;
        gradientWidth = 0;
        gradientHeight = 0;
        
        // Create new chart
        const ctx = canvasEl.getContext('2d');
        
        // Update chartData to use gradients for status line
        chartData.datasets[1].borderColor = function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return '#28a745'; // Fallback color
            return getStatusGradient(ctx, chartArea);
        };
        
        chartData.datasets[1].backgroundColor = function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return 'rgba(40, 167, 69, 0.1)'; // Fallback color
            return getStatusBackgroundGradient(ctx, chartArea);
        };
        
        // Make status line thicker to show gradient better
        chartData.datasets[1].borderWidth = 3;
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: getChartOptions()
        });
        
        serviceCharts.set(serviceId, chart);
        
        loadingEl.style.display = 'none';
        canvasEl.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading chart:', error);
        loadingEl.textContent = 'Failed to load chart data';
        canvasEl.style.display = 'none';
    }
}

function prepareChartData(historyData) {
    // Sort by timestamp (oldest first for proper line chart)
    const sortedData = historyData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Prepare labels (timestamps) and data points
    const labels = sortedData.map(entry => {
        const date = new Date(entry.timestamp);
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    });
    
    // Response time data
    const responseTimeData = sortedData.map(entry => entry.response_time || 0);
    
    // Status data (convert to numeric: healthy=1, warning=0.5, unhealthy=0)
    const statusData = sortedData.map(entry => {
        switch(entry.status) {
            case 'healthy': return 1;
            case 'warning': return 0.5;
            case 'unhealthy': return 0;
            default: return 0;
        }
    });
    
    return {
        labels: labels,
        datasets: [
            {
                label: 'Response Time (ms)',
                data: responseTimeData,
                borderColor: '#4a9eff',
                backgroundColor: 'rgba(74, 158, 255, 0.1)',
                tension: 0.5,
                fill: true,
                yAxisID: 'y',
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2
            },
            {
                label: 'Status',
                data: statusData,
                borderColor: '#28a745', // Will be overridden by gradient
                backgroundColor: 'rgba(40, 167, 69, 0.1)', // Will be overridden by gradient
                tension: 0.5,
                fill: true, // Enable fill to show background gradient
                yAxisID: 'y1',
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: function(context) {
                    const value = context.parsed.y;
                    if (value === 1) return '#28a745';      // Green for healthy
                    if (value === 0.5) return '#ffc107';    // Yellow for warning
                    if (value === 0) return '#ea4c88';      // Red for unhealthy
                    return '#28a745';
                },
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }
        ]
    };
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        animation: {
            duration: 800,
            easing: 'easeInOutQuart'
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Time',
                    color: '#ccc'
                },
                ticks: {
                    color: '#ccc',
                    maxTicksLimit: 8
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Response Time (ms)',
                    color: '#4a9eff'
                },
                ticks: {
                    color: '#4a9eff'
                },
                grid: {
                    color: 'rgba(74, 158, 255, 0.1)'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: '🟢 Healthy  🟡 Warning  🔴 Down',
                    color: '#ccc',
                    font: {
                        size: 10
                    }
                },
                ticks: {
                    color: '#28a745',
                    min: 0,
                    max: 1,
                    stepSize: 0.5
                },
                grid: {
                    drawOnChartArea: false,
                }
            }
        },
        plugins: {
            title: {
                display: false
            },
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#ccc',
                    usePointStyle: true,
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#4a9eff',
                borderWidth: 2,
                cornerRadius: 8,
                callbacks: {
                    labelColor: function(context) {
                        if (context.datasetIndex === 1) {
                            const statusValue = context.parsed.y;
                            if (statusValue === 1) return { borderColor: '#28a745', backgroundColor: '#28a745' };
                            if (statusValue === 0.5) return { borderColor: '#ffc107', backgroundColor: '#ffc107' };
                            if (statusValue === 0) return { borderColor: '#ea4c88', backgroundColor: '#ea4c88' };
                        }
                        return { borderColor: '#4a9eff', backgroundColor: '#4a9eff' };
                    },
                    afterLabel: function(context) {
                        if (context.datasetIndex === 1) {
                            const statusValue = context.parsed.y;
                            if (statusValue === 1) return '🟢 Status: Healthy';
                            if (statusValue === 0.5) return '🟡 Status: Warning';
                            if (statusValue === 0) return '🔴 Status: Unhealthy';
                        }
                        return '';
                    },
                    title: function(context) {
                        return `Time: ${context[0].label}`;
                    }
                }
            }
        }
    };
}

function showAddServiceModal() {
    const modal = document.getElementById('addServiceModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function hideAddServiceModal() {
    const modal = document.getElementById('addServiceModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        const form = document.getElementById('addServiceForm');
        if (form) {
            form.reset();
        }
    }
}



async function editService(serviceId) {
    // Use the AddServiceDialog component for editing
    if (!window.addServiceDialog) {
        // Create the dialog if it doesn't exist
        window.addServiceDialog = new AddServiceDialog();
    }
    
    // Use the component's showForEdit method
    window.addServiceDialog.showForEdit(serviceId);
}

async function deleteService(serviceId) {
    // Always delete directly - no pending/save system
    if (!confirm('Are you sure you want to delete this service?')) {
        return;
    }

    try {
        const response = await fetch(`/api/services/${serviceId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            window.monitor.showNotification('Service deleted successfully', 'success');
            window.monitor.refreshHealth();
        } else {
            const error = await response.json();
            window.monitor.showNotification('Failed to delete service: ' + error.error, 'danger');
        }
    } catch (error) {
        window.monitor.showNotification('Error deleting service: ' + error.message, 'danger');
    }
}

// Load minimum check interval from settings
async function loadMinCheckInterval() {
    try {
        const response = await fetch('/api/settings/min_check_interval');
        if (response.ok) {
            const data = await response.json();
            const minInterval = parseInt(data.value) || 10;
            
            // Update the form's min attribute
            const intervalInput = document.getElementById('serviceInterval');
            if (intervalInput) {
                intervalInput.min = minInterval;
            }
        }
    } catch (error) {
        console.warn('Failed to load min check interval setting:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.monitor = new DotBoxMonitor();
    loadMinCheckInterval();
}); 