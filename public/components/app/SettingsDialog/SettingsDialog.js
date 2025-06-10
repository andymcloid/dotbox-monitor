/**
 * SettingsDialog Component - Application-specific settings modal
 * Extends the base ModalDialog component
 */
class SettingsDialog extends ModalDialog {
    constructor() {
        super('settingsModal', {
            closeOnOverlayClick: true,
            closeOnEsc: true
        });
        
        this.settings = [];
        this.form = null;
        
        this.initialize();
    }
    
    initialize() {
        this.setTitle('⚙️ System Settings');
        this.createForm();
        this.createFooterButtons();
        this.bindFormEvents();
    }
    
    bindFormEvents() {
        // Settings form doesn't need dynamic events like AddService, but keeping consistent structure
    }
    
    createForm() {
        this.form = document.createElement('form');
        this.form.id = 'settingsForm';
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        const container = document.createElement('div');
        container.id = 'settingsContainer';
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-primary);">Loading settings...</div>';
        
        this.form.appendChild(container);
        this.setBody(this.form);
    }
    
    createFooterButtons() {
        this.addFooterButton('Cancel', 'action-btn cancel', () => this.close());
        this.addFooterButton('Save Settings', 'action-btn save', () => this.handleSubmit());
    }
    
    show() {
        super.show();
        this.loadSettings(); // Load async in background
        return this;
    }
    
    async loadSettings() {
        const container = this.form.querySelector('#settingsContainer');
        
        try {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-primary);">Loading settings...</div>';
            
            const response = await fetch('/api/settings');
            if (response.ok) {
                this.settings = await response.json();
                console.log('Settings loaded:', this.settings);
                
                if (this.settings && this.settings.length > 0) {
                    this.renderSettingsForm();
                } else {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No settings configured yet. Settings will appear here once the system initializes.</div>';
                }
            } else {
                console.error('Failed to load settings, status:', response.status);
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-red);">Failed to load settings. Please try again.</div>';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-red);">Error loading settings: ' + error.message + '</div>';
        }
    }
    
    renderSettingsForm() {
        const container = this.form.querySelector('#settingsContainer');
        
        const settingsHtml = this.settings.map(setting => {
            const inputType = setting.key.includes('days') || setting.key.includes('hours') || 
                            setting.key.includes('interval') || setting.key.includes('entries') ? 'number' : 'text';
            
            let min = '';
            if (inputType === 'number') {
                if (setting.key.includes('interval') && setting.key.includes('min')) {
                    min = 'min="1"';
                } else if (setting.key.includes('hours') || setting.key.includes('days')) {
                    min = 'min="1"';
                } else if (setting.key.includes('entries')) {
                    min = 'min="100"';
                }
            }
            
            return `
                <div class="form-group">
                    <label for="setting_${setting.key}">${this.formatSettingLabel(setting.key)}</label>
                    <input type="${inputType}" 
                           id="setting_${setting.key}" 
                           name="${setting.key}" 
                           value="${setting.value || ''}" 
                           ${min}
                           required>
                    <small style="color: var(--text-secondary); font-size: 12px;">
                        ${setting.description || ''}
                    </small>
                </div>
            `;
        }).join('');
        
        container.innerHTML = settingsHtml;
    }
    
    formatSettingLabel(key) {
        return key.split('_')
                 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                 .join(' ');
    }
    
    async handleSubmit(e) {
        if (e) {
            e.preventDefault();
        }
        
        const submitBtn = this.footer.querySelector('.action-btn.save');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        const formData = new FormData(this.form);
        const settings = Object.fromEntries(formData.entries());
        
        try {
            const updatePromises = Object.entries(settings).map(([key, value]) => {
                return fetch(`/api/settings/${key}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ value: value }),
                });
            });
            
            const responses = await Promise.all(updatePromises);
            const allSuccessful = responses.every(response => response.ok);
            
            if (allSuccessful) {
                this.close();
                this.showNotification('Settings saved successfully!', 'success');
                
                // Reload min check interval for service form
                if (typeof loadMinCheckInterval === 'function') {
                    loadMinCheckInterval();
                }
            } else {
                this.showNotification('Failed to save some settings', 'danger');
            }
        } catch (error) {
            this.showNotification('Error saving settings: ' + error.message, 'danger');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
    
    showNotification(message, type) {
        if (window.monitor) {
            window.monitor.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Global instance
let settingsDialog = null;

// Global functions for backward compatibility
function showSettingsModal() {
    if (!settingsDialog) {
        settingsDialog = new SettingsDialog();
    }
    settingsDialog.show();
}

function hideSettingsModal() {
    if (settingsDialog) {
        settingsDialog.close();
    }
} 