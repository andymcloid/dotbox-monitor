/**
 * Base MetricItem Component
 * Generic reusable metric display component
 */
class MetricItem {
    constructor(id, options = {}) {
        this.id = id;
        this.options = {
            label: 'Metric',
            value: 0,
            unit: '',
            threshold: null,
            warningThreshold: null,
            container: null,
            ...options
        };
        this.element = null;
        this.initialize();
    }

    initialize() {
        this.createElement();
        this.render();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'metric-item';
        this.element.id = this.id;
        
        if (this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }

    render() {
        this.element.innerHTML = `
            <div class="metric-item-label">${this.options.label}</div>
            <div class="metric-item-value">
                ${this.options.value}
                <span class="metric-item-unit">${this.options.unit}</span>
            </div>
        `;
        this.updateStatus();
    }

    updateValue(value) {
        this.options.value = value;
        const valueElement = this.element.querySelector('.metric-item-value');
        if (valueElement) {
            valueElement.innerHTML = `
                ${value}
                <span class="metric-item-unit">${this.options.unit}</span>
            `;
        }
        this.updateStatus();
    }

    updateStatus() {
        // Remove existing status classes
        this.element.classList.remove('warning', 'error', 'success');
        
        const value = parseFloat(this.options.value);
        
        if (this.options.threshold && value >= this.options.threshold) {
            this.element.classList.add('error');
        } else if (this.options.warningThreshold && value >= this.options.warningThreshold) {
            this.element.classList.add('warning');
        } else {
            this.element.classList.add('success');
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