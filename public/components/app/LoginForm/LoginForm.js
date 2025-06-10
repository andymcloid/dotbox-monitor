/**
 * LoginForm Component - Application-specific login form
 * Following SOLID principles and using base components
 */
class LoginForm {
    constructor(options = {}) {
        this.options = {
            action: '/login',
            method: 'POST',
            redirectUrl: '/',
            className: '',
            ...options
        };
        
        this.container = null;
        this.form = null;
        this.passwordTextBox = null;
        this.submitButton = null;
        this.errorElement = null;
        this.statusElement = null;
        
        this.onSubmit = options.onSubmit || null;
        this.onSuccess = options.onSuccess || null;
        this.onError = options.onError || null;
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        // Create main container - matches original login.html structure
        this.container = document.createElement('div');
        this.container.className = `grid ${this.options.className}`;
        
        // Create logo container (above the form)
        const logoContainer = document.createElement('div');
        logoContainer.className = 'logo-container';
        logoContainer.innerHTML = '<img src="/img/logo.svg" alt="DotBox Monitor" class="login-logo">';
        this.container.appendChild(logoContainer);
        
        // Create status element (matches original loginStatus)
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'login-status';
        this.statusElement.style.display = 'none';
        this.statusElement.innerHTML = `
            <div class="status-text">🔐 Checking authentication...</div>
            <div class="status-spinner"></div>
        `;
        this.container.appendChild(this.statusElement);
        
        // Create form (matches original structure)
        this.form = document.createElement('form');
        this.form.id = 'loginForm';
        this.form.method = this.options.method;
        this.form.className = 'form login';
        
        // Create password field using TextBox component
        const passwordFieldDiv = document.createElement('div');
        passwordFieldDiv.className = 'form__field';
        
        // Create label with icon (matches original)
        const label = document.createElement('label');
        label.setAttribute('for', 'login__password');
        label.innerHTML = `
            <svg class="icon">
                <use xlink:href="#icon-lock"></use>
            </svg>
            <span class="hidden">Password</span>
        `;
        passwordFieldDiv.appendChild(label);
        
        // Create password input (matches original exactly)
        const passwordInput = document.createElement('input');
        passwordInput.id = 'login__password';
        passwordInput.type = 'password';
        passwordInput.name = 'password';
        passwordInput.className = 'form__input';
        passwordInput.placeholder = 'Password';
        passwordInput.required = true;
        passwordFieldDiv.appendChild(passwordInput);
        
        this.form.appendChild(passwordFieldDiv);
        
        // Create submit button (matches original exactly)
        const submitFieldDiv = document.createElement('div');
        submitFieldDiv.className = 'form__field';
        
        const submitInput = document.createElement('input');
        submitInput.type = 'submit';
        submitInput.value = 'Sign In';
        submitInput.className = 'form__input';
        
        submitFieldDiv.appendChild(submitInput);
        this.form.appendChild(submitFieldDiv);
        
        // Store reference for disabling during loading
        this.submitElement = submitInput;
        
        this.container.appendChild(this.form);
        
        // Create error message (matches original)
        this.errorElement = document.createElement('div');
        this.errorElement.id = 'errorMessage';
        this.errorElement.className = 'error-message';
        this.errorElement.style.display = 'none';
        this.container.appendChild(this.errorElement);
        
        // Store password input reference
        this.passwordInput = passwordInput;
        
        return this.container;
    }
    
    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Enter key handling
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmit(e);
            }
        });
        
        // Clear error on input
        this.passwordInput.addEventListener('input', () => this.hideError());
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.onSubmit) {
            return this.onSubmit(e, this.getFormData());
        }
        
        const formData = this.getFormData();
        await this.submitLogin(formData);
    }
    
    async submitLogin(formData) {
        this.setLoading(true);
        this.hideError();
        
        try {
            const response = await fetch(this.options.action, {
                method: this.options.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Store token if provided
                if (result.token) {
                    localStorage.setItem('dotbox_auth_token', result.token);
                }
                
                if (this.onSuccess) {
                    this.onSuccess(result);
                } else {
                    // Default redirect
                    window.location.href = this.options.redirectUrl;
                }
            } else {
                this.showError(result.message || 'Login failed. Please try again.');
                if (this.onError) {
                    this.onError(result);
                }
            }
        } catch (error) {
            this.showError('Network error. Please check your connection.');
            if (this.onError) {
                this.onError(error);
            }
        } finally {
            this.setLoading(false);
        }
    }
    
    getFormData() {
        return {
            password: this.passwordInput.value
        };
    }
    
    setLoading(loading) {
        // Show/hide status element during loading
        if (loading) {
            this.statusElement.style.display = 'block';
            this.form.style.display = 'none';
        } else {
            this.statusElement.style.display = 'none';
            this.form.style.display = 'block';
        }
        
        // Also disable submit button
        this.submitElement.disabled = loading;
    }
    
    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        
        // Shake animation
        this.form.classList.add('shake');
        setTimeout(() => {
            this.form.classList.remove('shake');
        }, 500);
    }
    
    hideError() {
        this.errorElement.style.display = 'none';
    }
    
    reset() {
        this.form.reset();
        this.hideError();
        this.setLoading(false);
    }
    
    focus() {
        this.passwordInput.focus();
    }
    
    setValues(password = '') {
        this.passwordInput.value = password;
    }
    
    // Get the DOM elements
    getContainer() {
        return this.container;
    }
    
    getForm() {
        return this.form;
    }
    
    // Destroy form
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.form = null;
    }
} 