/**
 * App ServiceCard Component
 * Application-specific service card display and management
 */
class ServiceCard {
    constructor(id, options = {}) {
        this.id = id;
        this.options = {
            name: 'Service',
            status: 'unknown',
            icon: '🔧',
            uptime: '0%',
            port: null,
            url: null,
            container: null,
            showActions: false,
            onStart: null,
            onStop: null,
            onRestart: null,
            onDelete: null,
            onInfo: null,
            ...options
        };
        this.element = null;
        this.initialize();
    }

    initialize() {
        this.createElement();
        this.render();
        this.bindEvents();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'service-card';
        this.element.id = this.id;
        
        if (this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }

    render() {
        // Use existing service card structure from app.css
        this.element.innerHTML = `
            <div class="service-info">
                <div class="service-icon">${this.options.icon || '🔧'}</div>
                <div class="service-details">
                    <div class="service-name">${this.options.name}</div>
                    <div class="service-status ${this.getStatusClass()}">${this.getStatusText()}</div>
                </div>
            </div>
            <div class="service-stats">
                <div class="service-uptime">${this.options.uptime || '0%'}</div>
                <div class="service-timestamp">${this.formatTimestamp()}</div>
            </div>
            <div class="service-actions">
                ${this.options.url ? `<a href="${this.options.url}" target="_blank" class="btn-icon link" title="Open Service">🔗</a>` : ''}
                <button class="btn-icon info" title="View Details" data-action="info">ℹ️</button>
            </div>
        `;
        
        // Add action buttons if explicitly enabled
        if (this.options.showActions) {
            this.element.classList.add('with-actions');
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'service-card-actions';
            actionsDiv.innerHTML = `
                <button class="service-card-action primary" data-action="start">Start</button>
                <button class="service-card-action" data-action="restart">Restart</button>
                <button class="service-card-action" data-action="stop">Stop</button>
                <button class="service-card-action danger" data-action="delete">Delete</button>
            `;
            this.element.appendChild(actionsDiv);
        }
        
        this.updateStatus(this.options.status);
    }

    getStatusClass() {
        switch (this.options.status) {
            case 'running':
            case 'healthy':
                return 'healthy';
            case 'warning':
                return 'warning';
            case 'stopped':
            case 'unhealthy':
                return 'unhealthy';
            default:
                return 'unknown';
        }
    }

    getStatusText() {
        switch (this.options.status) {
            case 'running':
                return 'Running';
            case 'healthy':
                return 'Healthy';
            case 'warning':
                return 'Warning';
            case 'stopped':
                return 'Stopped';
            case 'unhealthy':
                return 'Unhealthy';
            default:
                return 'Unknown';
        }
    }

    formatTimestamp() {
        return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    }

    bindEvents() {
        const actions = this.element.querySelectorAll('.service-card-action');
        actions.forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = e.target.dataset.action;
                this.handleAction(actionType);
            });
        });
    }

    handleAction(actionType) {
        switch (actionType) {
            case 'start':
                if (this.options.onStart) {
                    this.options.onStart(this.options.name);
                }
                break;
            case 'stop':
                if (this.options.onStop) {
                    this.options.onStop(this.options.name);
                }
                break;
            case 'restart':
                if (this.options.onRestart) {
                    this.options.onRestart(this.options.name);
                }
                break;
            case 'delete':
                if (this.options.onDelete) {
                    this.options.onDelete(this.options.name);
                }
                break;
            case 'info':
                if (this.options.onInfo) {
                    this.options.onInfo(this.options.name);
                }
                break;
        }
    }

    updateStatus(status) {
        this.options.status = status;
        
        // Update service status element
        const statusElement = this.element.querySelector('.service-status');
        if (statusElement) {
            statusElement.className = `service-status ${this.getStatusClass()}`;
            statusElement.textContent = this.getStatusText();
        }
        
        // Update card border color
        this.element.classList.remove('healthy', 'warning', 'unhealthy');
        this.element.classList.add(this.getStatusClass());
        
        // Update action states if actions are shown
        if (this.options.showActions) {
            this.updateActionStates();
        }
    }

    updateActionStates() {
        const startBtn = this.element.querySelector('[data-action="start"]');
        const stopBtn = this.element.querySelector('[data-action="stop"]');
        const restartBtn = this.element.querySelector('[data-action="restart"]');
        
        if (startBtn && stopBtn && restartBtn) {
            if (this.options.status === 'running' || this.options.status === 'healthy') {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                restartBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                restartBtn.disabled = true;
            }
        }
    }

    updateUptime(uptime) {
        this.options.uptime = uptime;
        const uptimeElement = this.element.querySelector('.service-uptime');
        if (uptimeElement) {
            uptimeElement.textContent = uptime;
        }
    }

    updateTimestamp() {
        const timestampElement = this.element.querySelector('.service-timestamp');
        if (timestampElement) {
            timestampElement.textContent = this.formatTimestamp();
        }
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
} 