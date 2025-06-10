/**
 * NavBar Component - Application-specific navigation bar
 * Following SOLID principles for navigation functionality
 */
class NavBar {
    constructor(options = {}) {
        this.options = {
            logoSrc: '/img/logo.svg',
            logoAlt: 'DotBox Monitor',
            showLogo: true,
            showStatus: true,
            className: '',
            ...options
        };
        
        this.element = null;
        this.logoElement = null;
        this.statusElement = null;
        this.actionsElement = null;
        this.buttons = new Map();
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        this.element = document.createElement('nav');
        this.element.className = `navbar ${this.options.className}`;
        
        // Create brand section
        const brand = document.createElement('div');
        brand.className = 'navbar-brand';
        
        if (this.options.showLogo) {
            const logoContainer = document.createElement('div');
            logoContainer.className = 'logo';
            
            this.logoElement = document.createElement('img');
            this.logoElement.src = this.options.logoSrc;
            this.logoElement.alt = this.options.logoAlt;
            this.logoElement.className = 'logo-image';
            
            logoContainer.appendChild(this.logoElement);
            brand.appendChild(logoContainer);
        }
        
        this.element.appendChild(brand);
        
        // Create center section (status)
        if (this.options.showStatus) {
            const center = document.createElement('div');
            center.className = 'navbar-center';
            
            this.statusElement = document.createElement('div');
            this.statusElement.className = 'system-status-mini';
            this.statusElement.innerHTML = `
                <div class="status-mini-item">
                    <span class="status-mini-label">Health:</span>
                    <span class="status-mini-value" id="overallHealthText">Loading...</span>
                </div>
                <div class="status-mini-item">
                    <span class="status-mini-label">Services:</span>
                    <span class="status-mini-value" id="servicesCountText">0/0</span>
                </div>
                <div class="status-mini-item">
                    <span class="status-mini-label">Updated:</span>
                    <span class="status-mini-value" id="lastUpdatedText">Never</span>
                    <span class="connection-status" id="connectionStatus" title="WebSocket Connection">🔴</span>
                </div>
            `;
            
            center.appendChild(this.statusElement);
            this.element.appendChild(center);
        }
        
        // Create actions section
        this.actionsElement = document.createElement('div');
        this.actionsElement.className = 'navbar-actions';
        this.element.appendChild(this.actionsElement);
        
        return this.element;
    }
    
    bindEvents() {
        // Logo click handler
        if (this.logoElement) {
            this.logoElement.addEventListener('click', () => {
                window.location.href = '/';
            });
        }
    }
    
    // Add a button to the navbar
    addButton(id, options = {}) {
        const buttonOptions = {
            variant: 'default',
            size: 'medium',
            className: 'navbar-btn',
            ...options
        };
        
        const toolButton = new ToolButton(buttonOptions);
        const buttonElement = toolButton.getElement();
        
        this.actionsElement.appendChild(buttonElement);
        this.buttons.set(id, {
            toolButton,
            element: buttonElement
        });
        
        return toolButton;
    }
    
    // Remove a button from the navbar
    removeButton(id) {
        const button = this.buttons.get(id);
        if (button) {
            button.toolButton.destroy();
            this.buttons.delete(id);
        }
    }
    
    // Get a button by ID
    getButton(id) {
        const button = this.buttons.get(id);
        return button ? button.toolButton : null;
    }
    
    // Update status values
    updateStatus(status = {}) {
        if (!this.statusElement) return;
        
        if (status.health !== undefined) {
            const healthElement = this.statusElement.querySelector('#overallHealthText');
            if (healthElement) {
                healthElement.textContent = status.health;
                healthElement.className = `status-mini-value status-${status.health.toLowerCase()}`;
            }
        }
        
        if (status.services !== undefined) {
            const servicesElement = this.statusElement.querySelector('#servicesCountText');
            if (servicesElement) {
                servicesElement.textContent = status.services;
            }
        }
        
        if (status.lastUpdated !== undefined) {
            const updatedElement = this.statusElement.querySelector('#lastUpdatedText');
            if (updatedElement) {
                updatedElement.textContent = status.lastUpdated;
            }
        }
        
        if (status.connectionStatus !== undefined) {
            const connectionElement = this.statusElement.querySelector('#connectionStatus');
            if (connectionElement) {
                connectionElement.textContent = status.connectionStatus === 'connected' ? '🟢' : '🔴';
                connectionElement.title = status.connectionStatus === 'connected' 
                    ? 'WebSocket Connected' 
                    : 'WebSocket Disconnected';
            }
        }
    }
    
    // Set logo source
    setLogo(src, alt = '') {
        if (this.logoElement) {
            this.logoElement.src = src;
            if (alt) this.logoElement.alt = alt;
        }
    }
    
    // Show/hide status section
    setStatusVisible(visible) {
        if (this.statusElement) {
            this.statusElement.style.display = visible ? 'flex' : 'none';
        }
    }
    
    // Add custom content to center section
    setCenterContent(content) {
        const center = this.element.querySelector('.navbar-center');
        if (center) {
            if (typeof content === 'string') {
                center.innerHTML = content;
            } else {
                center.innerHTML = '';
                center.appendChild(content);
            }
        }
    }
    
    // Set sticky behavior
    setSticky(sticky) {
        this.element.classList.toggle('navbar-sticky', sticky);
    }
    
    // Set transparent background
    setTransparent(transparent) {
        this.element.classList.toggle('navbar-transparent', transparent);
    }
    
    // Get the DOM element
    getElement() {
        return this.element;
    }
    
    // Destroy navbar
    destroy() {
        // Destroy all buttons
        this.buttons.forEach(button => {
            button.toolButton.destroy();
        });
        this.buttons.clear();
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.logoElement = null;
        this.statusElement = null;
        this.actionsElement = null;
    }
} 