/**
 * Base Button Component - Generic and reusable button
 * Following SOLID principles for button functionality
 */
class Button {
    constructor(options = {}) {
        this.options = {
            text: 'Button',
            type: 'button',
            variant: 'primary', // primary, secondary, danger, success
            size: 'medium', // small, medium, large
            disabled: false,
            loading: false,
            icon: null,
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
        this.element.type = this.options.type;
        this.element.disabled = this.options.disabled;
        
        this.updateClasses();
        this.updateContent();
        
        return this.element;
    }
    
    updateClasses() {
        let classes = ['btn'];
        
        // Add variant class
        classes.push(`btn-${this.options.variant}`);
        
        // Add size class
        classes.push(`btn-${this.options.size}`);
        
        // Add loading class
        if (this.options.loading) {
            classes.push('btn-loading');
        }
        
        // Add custom classes
        if (this.options.className) {
            classes.push(this.options.className);
        }
        
        this.element.className = classes.join(' ');
    }
    
    updateContent() {
        let content = '';
        
        if (this.options.loading) {
            content = '<span class="btn-spinner">⟳</span> Loading...';
        } else {
            if (this.options.icon) {
                content = `${this.options.icon} ${this.options.text}`;
            } else {
                content = this.options.text;
            }
        }
        
        this.element.innerHTML = content;
    }
    
    bindEvents() {
        if (this.onClick) {
            this.element.addEventListener('click', (e) => {
                if (!this.options.disabled && !this.options.loading) {
                    this.onClick(e);
                }
            });
        }
    }
    
    // Public methods
    setText(text) {
        this.options.text = text;
        this.updateContent();
        return this;
    }
    
    setIcon(icon) {
        this.options.icon = icon;
        this.updateContent();
        return this;
    }
    
    setLoading(loading) {
        this.options.loading = loading;
        this.element.disabled = loading || this.options.disabled;
        this.updateClasses();
        this.updateContent();
        return this;
    }
    
    setDisabled(disabled) {
        this.options.disabled = disabled;
        this.element.disabled = disabled || this.options.loading;
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