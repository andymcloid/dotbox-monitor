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
            port: null,
            url: null,
            container: null,
            onStart: null,
            onStop: null,
            onRestart: null,
            onDelete: null,
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
        this.element.innerHTML = `
            <div class="service-card-header">
                <h3 class="service-card-title">${this.options.name}</h3>
                <span class="service-card-status ${this.options.status}">${this.options.status}</span>
            </div>
            <div class="service-card-details">
                ${this.options.port ? `
                    <div class="service-card-detail">
                        <span class="service-card-detail-label">Port</span>
                        <span class="service-card-detail-value">${this.options.port}</span>
                    </div>
                ` : ''}
                ${this.options.url ? `
                    <div class="service-card-detail">
                        <span class="service-card-detail-label">URL</span>
                        <span class="service-card-detail-value">
                            <a href="${this.options.url}" target="_blank">${this.options.url}</a>
                        </span>
                    </div>
                ` : ''}
            </div>
            <div class="service-card-actions">
                <button class="service-card-action primary" data-action="start">Start</button>
                <button class="service-card-action" data-action="restart">Restart</button>
                <button class="service-card-action" data-action="stop">Stop</button>
                <button class="service-card-action danger" data-action="delete">Delete</button>
            </div>
        `;
        this.updateActionStates();
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
        }
    }

    updateStatus(status) {
        this.options.status = status;
        const statusElement = this.element.querySelector('.service-card-status');
        if (statusElement) {
            statusElement.className = `service-card-status ${status}`;
            statusElement.textContent = status;
        }
        this.updateActionStates();
    }

    updateActionStates() {
        const startBtn = this.element.querySelector('[data-action="start"]');
        const stopBtn = this.element.querySelector('[data-action="stop"]');
        const restartBtn = this.element.querySelector('[data-action="restart"]');
        
        if (this.options.status === 'running') {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            restartBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            restartBtn.disabled = true;
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