/**
 * Base ToolButton Component - Generic toolbar/navbar button
 * Following SOLID principles for tool button functionality
 */
class ToolButton {
    constructor(options = {}) {
        this.options = {
            icon: '⚙️',
            text: '',
            tooltip: '',
            variant: 'default', // default, primary, danger
            size: 'medium', // small, medium, large
            disabled: false,
            active: false,
            className: '',
            ...options
        };
        
        this.element = null;
        this.onClick = options.onClick || null;
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        this.element = document.createElement('button');
        this.element.type = 'button';
        this.element.disabled = this.options.disabled;
        
        if (this.options.tooltip) {
            this.element.title = this.options.tooltip;
        }
        
        this.updateClasses();
        this.updateContent();
        
        return this.element;
    }
    
    updateClasses() {
        let classes = ['tool-btn'];
        
        // Add variant class
        classes.push(`tool-btn-${this.options.variant}`);
        
        // Add size class
        classes.push(`tool-btn-${this.options.size}`);
        
        // Add active state
        if (this.options.active) {
            classes.push('tool-btn-active');
        }
        
        // Add custom classes
        if (this.options.className) {
            classes.push(this.options.className);
        }
        
        this.element.className = classes.join(' ');
    }
    
    updateContent() {
        let content = this.options.icon;
        
        if (this.options.text) {
            content += ` <span class="tool-btn-text">${this.options.text}</span>`;
        }
        
        this.element.innerHTML = content;
    }
    
    bindEvents() {
        if (this.onClick) {
            this.element.addEventListener('click', (e) => {
                if (!this.options.disabled) {
                    this.onClick(e);
                }
            });
        }
    }
    
    // Public methods
    setIcon(icon) {
        this.options.icon = icon;
        this.updateContent();
        return this;
    }
    
    setText(text) {
        this.options.text = text;
        this.updateContent();
        return this;
    }
    
    setTooltip(tooltip) {
        this.options.tooltip = tooltip;
        this.element.title = tooltip;
        return this;
    }
    
    setActive(active) {
        this.options.active = active;
        this.updateClasses();
        return this;
    }
    
    setDisabled(disabled) {
        this.options.disabled = disabled;
        this.element.disabled = disabled;
        this.updateClasses();
        return this;
    }
    
    setVariant(variant) {
        this.options.variant = variant;
        this.updateClasses();
        return this;
    }
    
    // Get the DOM element
    getElement() {
        return this.element;
    }
    
    // Destroy button
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
} 