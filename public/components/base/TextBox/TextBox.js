/**
 * Base TextBox Component - Generic and reusable input field
 * Following SOLID principles for input functionality
 */
class TextBox {
    constructor(options = {}) {
        this.options = {
            type: 'text',
            placeholder: '',
            value: '',
            label: '',
            required: false,
            disabled: false,
            readonly: false,
            min: null,
            max: null,
            step: null,
            pattern: null,
            helpText: '',
            errorText: '',
            className: '',
            ...options
        };
        
        this.container = null;
        this.label = null;
        this.input = null;
        this.helpElement = null;
        this.errorElement = null;
        
        this.onChange = options.onChange || null;
        this.onInput = options.onInput || null;
        this.onFocus = options.onFocus || null;
        this.onBlur = options.onBlur || null;
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = `textbox-group ${this.options.className}`;
        
        // Create label if provided
        if (this.options.label) {
            this.label = document.createElement('label');
            this.label.textContent = this.options.label;
            this.label.className = 'textbox-label';
            this.container.appendChild(this.label);
        }
        
        // Create input
        this.input = document.createElement('input');
        this.input.type = this.options.type;
        this.input.placeholder = this.options.placeholder;
        this.input.value = this.options.value;
        this.input.required = this.options.required;
        this.input.disabled = this.options.disabled;
        this.input.readOnly = this.options.readonly;
        this.input.className = 'textbox-input';
        
        // Set numeric attributes if applicable
        if (this.options.min !== null) this.input.min = this.options.min;
        if (this.options.max !== null) this.input.max = this.options.max;
        if (this.options.step !== null) this.input.step = this.options.step;
        if (this.options.pattern) this.input.pattern = this.options.pattern;
        
        this.container.appendChild(this.input);
        
        // Create help text if provided
        if (this.options.helpText) {
            this.helpElement = document.createElement('small');
            this.helpElement.textContent = this.options.helpText;
            this.helpElement.className = 'textbox-help';
            this.container.appendChild(this.helpElement);
        }
        
        // Create error element (hidden by default)
        this.errorElement = document.createElement('small');
        this.errorElement.className = 'textbox-error hidden';
        this.container.appendChild(this.errorElement);
        
        // Link label to input
        if (this.label && !this.input.id) {
            const id = 'textbox_' + Math.random().toString(36).substr(2, 9);
            this.input.id = id;
            this.label.setAttribute('for', id);
        }
        
        return this.container;
    }
    
    bindEvents() {
        if (this.onChange) {
            this.input.addEventListener('change', (e) => this.onChange(e));
        }
        
        if (this.onInput) {
            this.input.addEventListener('input', (e) => this.onInput(e));
        }
        
        if (this.onFocus) {
            this.input.addEventListener('focus', (e) => this.onFocus(e));
        }
        
        if (this.onBlur) {
            this.input.addEventListener('blur', (e) => this.onBlur(e));
        }
    }
    
    // Public methods
    getValue() {
        return this.input.value;
    }
    
    setValue(value) {
        this.input.value = value;
        return this;
    }
    
    setPlaceholder(placeholder) {
        this.input.placeholder = placeholder;
        return this;
    }
    
    setLabel(label) {
        if (this.label) {
            this.label.textContent = label;
        } else if (label) {
            this.label = document.createElement('label');
            this.label.textContent = label;
            this.label.className = 'textbox-label';
            this.container.insertBefore(this.label, this.input);
        }
        return this;
    }
    
    setHelpText(text) {
        if (this.helpElement) {
            this.helpElement.textContent = text;
        } else if (text) {
            this.helpElement = document.createElement('small');
            this.helpElement.textContent = text;
            this.helpElement.className = 'textbox-help';
            this.container.appendChild(this.helpElement);
        }
        return this;
    }
    
    setDisabled(disabled) {
        this.input.disabled = disabled;
        this.container.classList.toggle('textbox-disabled', disabled);
        return this;
    }
    
    setRequired(required) {
        this.input.required = required;
        this.container.classList.toggle('textbox-required', required);
        return this;
    }
    
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.classList.remove('hidden');
        this.container.classList.add('textbox-error-state');
        return this;
    }
    
    hideError() {
        this.errorElement.classList.add('hidden');
        this.container.classList.remove('textbox-error-state');
        return this;
    }
    
    validate() {
        const isValid = this.input.checkValidity();
        if (!isValid) {
            this.showError(this.input.validationMessage);
        } else {
            this.hideError();
        }
        return isValid;
    }
    
    focus() {
        this.input.focus();
        return this;
    }
    
    blur() {
        this.input.blur();
        return this;
    }
    
    // Get the DOM elements
    getContainer() {
        return this.container;
    }
    
    getInput() {
        return this.input;
    }
    
    // Destroy textbox
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.label = null;
        this.input = null;
        this.helpElement = null;
        this.errorElement = null;
    }
} 