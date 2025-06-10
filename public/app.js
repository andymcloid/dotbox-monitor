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
                // Store expanded states before full re-render
                const expandedServices = this.getExpandedServiceStates();
                this.services = newServicesData;
                this.renderHealthServices();
                this.restoreExpandedServiceStates(expandedServices);
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
        
        // Update status text
        const statusElement = serviceCard.querySelector('.service-status');
        if (statusElement) {
            const statusText = service.status === 'healthy' ? 'Healthy' : 
                              service.status === 'warning' ? 'Warning' :
                              service.status === 'unhealthy' ? 'Unhealthy' : 'Unknown';
            statusElement.className = `service-status ${service.status || 'unknown'}`;
            statusElement.querySelector('span').textContent = statusText;
        }

        // Update metrics
        const uptimeElement = serviceCard.querySelector('.service-metric:first-child span:last-child');
        if (uptimeElement) {
            uptimeElement.textContent = `${service.uptime || 0}%`;
        }

        const timestampElement = serviceCard.querySelector('.service-metric:last-child span:last-child');
        if (timestampElement) {
            timestampElement.textContent = service.timestamp ? new Date(service.timestamp).toLocaleTimeString() : 'Never';
        }

        // Update error message in details if expanded
        const detailsElement = document.getElementById(`details-${serviceId}`);
        if (detailsElement && detailsElement.classList.contains('expanded')) {
            this.updateServiceDetails(detailsElement, service);
            // Update chart with new data (non-destructive)
            this.updateServiceChart(serviceId);
        }
    }

    updateServiceDetails(detailsElement, service) {
        // Update response time
        const responseTimeElement = detailsElement.querySelector('.detail-item .detail-value');
        if (responseTimeElement) {
            responseTimeElement.textContent = `${service.responseTime || 0}ms`;
        }

        // Update last check time
        const lastCheckElement = detailsElement.querySelector('.detail-item:nth-child(3) .detail-value');
        if (lastCheckElement) {
            lastCheckElement.textContent = service.timestamp ? new Date(service.timestamp).toLocaleString() : 'Never';
        }

        // Update or add error message
        let errorElement = detailsElement.querySelector('.service-error');
        if (service.error) {
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'service-error';
                detailsElement.appendChild(errorElement);
            }
            errorElement.innerHTML = `<strong>Error:</strong> ${service.error}`;
        } else if (errorElement) {
            errorElement.remove();
        }
    }

    getExpandedServiceStates() {
        const expandedStates = new Map();
        
        // Find all expanded service details
        Object.values(this.services || {}).forEach(categoryServices => {
            if (Array.isArray(categoryServices)) {
                categoryServices.forEach(service => {
                    const serviceId = service.id || service.name.toLowerCase().replace(/\s+/g, '-');
                    const detailsElement = document.getElementById(`details-${serviceId}`);
                    
                    if (detailsElement && detailsElement.classList.contains('expanded')) {
                        expandedStates.set(serviceId, true);
                    }
                });
            }
        });
        
        return expandedStates;
    }

    restoreExpandedServiceStates(expandedStates) {
        // Restore expanded states after a short delay to ensure DOM is ready
        setTimeout(() => {
            expandedStates.forEach((isExpanded, serviceId) => {
                if (isExpanded) {
                    const detailsElement = document.getElementById(`details-${serviceId}`);
                    if (detailsElement) {
                        detailsElement.classList.add('expanded');
                        // Update chart with new data
                        this.updateServiceChart(serviceId);
                    }
                }
            });
        }, 100);
    }

    loadDetailChart(serviceId, chartHistory) {
        const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
        const canvasEl = document.getElementById(`detail-chart-${serviceId}`);
        
        if (!canvasEl) return;
        
        try {
            loadingEl.textContent = 'Loading chart data...';
            loadingEl.style.display = 'block';
            
            // Use WebSocket data if available, otherwise fetch from API
            if (chartHistory && chartHistory.length > 0) {
                this.renderDetailChart(serviceId, chartHistory);
            } else {
                // Fallback to API fetch if no WebSocket data
                this.fetchAndRenderDetailChart(serviceId);
            }
        } catch (error) {
            console.error('Error loading detail chart:', error);
            loadingEl.textContent = 'Failed to load chart data';
            canvasEl.style.display = 'none';
        }
    }

    async fetchAndRenderDetailChart(serviceId) {
        try {
            const response = await fetch(`/api/services/${serviceId}/history?hours=24&limit=50`);
            if (!response.ok) {
                throw new Error('Failed to fetch chart data');
            }
            
            const historyData = await response.json();
            this.renderDetailChart(serviceId, historyData);
        } catch (error) {
            console.error('Error fetching chart data:', error);
            const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
            if (loadingEl) {
                loadingEl.textContent = 'Failed to load chart data';
            }
        }
    }

    renderDetailChart(serviceId, historyData) {
        const loadingEl = document.getElementById(`detail-chart-loading-${serviceId}`);
        const canvasEl = document.getElementById(`detail-chart-${serviceId}`);
        
        if (!canvasEl) return;
        
        if (historyData.length === 0) {
            loadingEl.textContent = 'No data available yet';
            canvasEl.style.display = 'none';
            return;
        }
        
        // Prepare chart data
        const chartData = prepareChartData(historyData);
        
        // Destroy existing chart if it exists
        const existingChartKey = `detail-${serviceId}`;
        if (serviceCharts.has(existingChartKey)) {
            serviceCharts.get(existingChartKey).destroy();
        }
        
        // Reset gradients for new chart
        statusGradient = null;
        statusBackgroundGradient = null;
        gradientWidth = 0;
        gradientHeight = 0;
        
        // Create new chart
        const ctx = canvasEl.getContext('2d');
        
        // Force canvas size to prevent Chart.js from resizing infinitely
        canvasEl.width = 400;
        canvasEl.height = 250;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '250px';
        
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
            options: {
                ...getChartOptions(),
                responsive: false,  // Disable responsive to prevent size issues
                maintainAspectRatio: false
            }
        });
        
        serviceCharts.set(existingChartKey, chart);
        
        loadingEl.style.display = 'none';
        canvasEl.style.display = 'block';
    }

    async refreshHealth() {
        try {
            // Setup socket connection if not exists
            if (!this.socket) {
                this.socket = io();
                this.setupSocketEvents();
            }
            
            // Request fresh health data
            if (this.socket) {
                this.socket.emit('request-health-update');
            }
            
            // Also fetch via HTTP
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
                    <div class="service-header">
                        <div class="service-name">
                            <span>${service.icon || '🔧'}</span>
                            <span>${service.name}</span>
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
                    
                    <div class="service-content">
                        <div class="service-status ${statusClass}">
                            <span>${statusText}</span>
                        </div>
                        <div class="service-metrics">
                            <div class="service-metric">
                                <span>↗</span>
                                <span>${service.uptime || 0}%</span>
                            </div>
                            <div class="service-metric">
                                <span>🕒</span>
                                <span>${service.timestamp ? new Date(service.timestamp).toLocaleTimeString() : 'Never'}</span>
                            </div>
                        </div>
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
        
        serviceCharts.forEach((chart, serviceId) => {
            const canvasEl = document.getElementById(`chart-${serviceId}`);
            const detailCanvasEl = document.getElementById(`detail-chart-${serviceId}`);
            if (!canvasEl && !detailCanvasEl) {
                orphanedCharts.push(serviceId);
            }
        });
        
        orphanedCharts.forEach(serviceId => {
            try {
                const chart = serviceCharts.get(serviceId);
                if (chart) {
                    chart.destroy();
                }
            } catch (error) {
                console.warn(`Error destroying orphaned chart ${serviceId}:`, error);
            }
            serviceCharts.delete(serviceId);
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
            // Update detail pane with new data
            this.renderDetailPaneContent(currentService);
        }
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
        
        // Update title
        detailPaneTitle.textContent = `${service.icon || '🔧'} ${service.name}`;

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
            <div class="detail-service-status ${statusClass}">
                <div class="detail-service-icon">${service.icon || '🔧'}</div>
                <div class="detail-service-info">
                    <h4>${service.name}</h4>
                    <div class="detail-service-status-text ${statusClass}">${statusText}</div>
                </div>
            </div>

            <div class="detail-chart-section">
                <h4>
                    Response Time Trend (24h)
                    <button class="detail-chart-refresh" onclick="refreshDetailChart('${serviceId}')" title="Refresh chart">🔄</button>
                </h4>
                <div id="detail-chart-loading-${serviceId}" class="chart-loading">Loading chart data...</div>
                <div class="detail-chart-container">
                    <canvas id="detail-chart-${serviceId}" class="detail-chart-canvas" width="400" height="250"></canvas>
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
        const existingChartKey = `detail-${serviceId}`;
        if (serviceCharts.has(existingChartKey)) {
            try {
                serviceCharts.get(existingChartKey).destroy();
                serviceCharts.delete(existingChartKey);
            } catch (error) {
                console.warn('Error destroying chart on close:', error);
            }
        }
    }
    
    detailPane.classList.remove('open');
    detailPaneOverlay.classList.remove('visible');
    
    // Re-enable body scroll
    document.body.style.overflow = 'auto';
    
    // Clear service ID
    detailPane.removeAttribute('data-service-id');
}

function refreshDetailChart(serviceId) {
    if (window.monitor) {
        // Fetch fresh data and re-render chart
        window.monitor.fetchAndRenderDetailChart(serviceId);
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
        
        // Fetch service history from API (fewer points for cleaner chart)
        const response = await fetch(`/api/services/${serviceId}/history?hours=24&limit=50`);
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
        let numericValue;
        switch(entry.status) {
            case 'healthy': numericValue = 1; break;
            case 'warning': numericValue = 0.5; break;
            case 'unhealthy': numericValue = 0; break;
            default: numericValue = 0; break;
        }
        
        // Debug: log status mapping to identify color issue
        console.log(`Status mapping: ${entry.status} -> ${numericValue}`, entry);
        
        return numericValue;
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
    // Find the service in our data
    let serviceToEdit = null;
    Object.values(window.monitor.services).forEach(categoryServices => {
        if (Array.isArray(categoryServices)) {
            categoryServices.forEach(service => {
                const id = service.id || service.name.toLowerCase().replace(/\s+/g, '-');
                if (id == serviceId) {
                    serviceToEdit = service;
                }
            });
        }
    });

    if (!serviceToEdit) {
        window.monitor.showNotification('Service not found', 'danger');
        return;
    }

    // Populate the form with existing data
    document.getElementById('serviceName').value = serviceToEdit.name || '';
    document.getElementById('serviceType').value = serviceToEdit.type || 'http';
    
    // Set URL or Host based on service type
    if (serviceToEdit.type === 'tcp') {
        document.getElementById('serviceHost').value = serviceToEdit.host || '';
        document.getElementById('serviceUrl').value = ''; // Clear URL field for TCP
    } else {
        document.getElementById('serviceUrl').value = serviceToEdit.url || '';
        document.getElementById('serviceHost').value = ''; // Clear host field for HTTP/SSL
    }
    
    document.getElementById('serviceVisitUrl').value = serviceToEdit.visit_url || '';
    document.getElementById('servicePort').value = serviceToEdit.port || '';
    document.getElementById('serviceIcon').value = serviceToEdit.icon || '🔧';
    document.getElementById('emojiPreview').textContent = serviceToEdit.icon || '🔧';
    document.getElementById('emojiSearch').value = ''; // Clear search field
    document.getElementById('serviceCategory').value = serviceToEdit.category || 'web';
    document.getElementById('serviceTimeout').value = serviceToEdit.timeout || 5;
    document.getElementById('serviceInterval').value = serviceToEdit.interval || 30;
    document.getElementById('warningThreshold').value = serviceToEdit.warning_threshold || getDefaultThreshold(serviceToEdit.type || 'http');
    
    // Handle field visibility based on service type
    const urlGroup = document.getElementById('urlGroup');
    const hostGroup = document.getElementById('hostGroup');
    const portGroup = document.getElementById('portGroup');
    const urlInput = document.getElementById('serviceUrl');
    const hostInput = document.getElementById('serviceHost');
    const portInput = document.getElementById('servicePort');
    
    // Reset required attributes
    urlInput.required = false;
    hostInput.required = false;
    portInput.required = false;
    
    // Show/hide fields based on service type
    switch(serviceToEdit.type) {
        case 'tcp':
            urlGroup.style.display = 'none';
            hostGroup.style.display = 'block';
            portGroup.style.display = 'block';
            hostInput.required = true;
            portInput.required = true;
            break;
        default: // http, ssl
            urlGroup.style.display = 'block';
            hostGroup.style.display = 'none';
            portGroup.style.display = 'none';
            urlInput.required = true;
            break;
    }

    // Change modal title and button text
    document.querySelector('#addServiceModal .modal-header h3').textContent = '✏️ Edit Service';
    document.querySelector('button[type="submit"][form="addServiceForm"]').textContent = 'Update Service';
    
    // Store the service ID for update
    document.getElementById('addServiceForm').dataset.editingId = serviceId;
    
    // Show the modal
    showAddServiceModal();
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.monitor = new DotBoxMonitor();
}); 