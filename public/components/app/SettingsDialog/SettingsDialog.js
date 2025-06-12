/**
 * SettingsDialog Component - Application-specific settings modal with tabs
 * Extends the base ModalDialog component
 */
class SettingsDialog extends ModalDialog {
    constructor() {
        super('settingsModal', {
            closeOnOverlayClick: true,
            closeOnEsc: true,
            maxWidth: '800px'
        });
        
        this.settings = [];
        this.categories = [];
        this.form = null;
        this.currentTab = 'general';
        this.editingCategory = null;
    }
    
    show() {
        this.setTitle('⚙️ Settings');
        this.setBodyContainerMode(true);
        this.modal = this.element; // For compatibility
        this.modal.addEventListener('dialogShown', () => {
            this.createTabbedInterface();
            this.bindTabEvents();
            this.loadGeneralSettings();
        }, { once: true });
        super.show();
        return this;
    }
    
    createTabbedInterface() {
        // Remove old inline tab logic
        // Instead, use TabView
        const generalTabContent = document.createElement('div');
        generalTabContent.id = 'generalSettingsContainer';
        generalTabContent.innerHTML = '<div class="loading-state">Loading general settings...</div>';

        const categoriesTabContent = document.createElement('div');
        categoriesTabContent.id = 'categoriesContainer';
        categoriesTabContent.innerHTML = '<div class="loading-state">Loading categories...</div>';

        this.tabView = new TabView([
            { id: 'general', label: 'General', icon: '⚙️', content: generalTabContent },
            { id: 'categories', label: 'Categories', icon: '📁', content: categoriesTabContent }
        ]);

        this.setBody(this.tabView.getElement());
        this.createFooterButtons();

        // Handle tab switching
        this.tabView.onTabChange(tabId => {
            this.currentTab = tabId;
            if (tabId === 'categories') {
                this.loadCategories();
            }
        });
    }
    
    bindTabEvents() {
        const tabButtons = this.modal.querySelectorAll('.settings-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        const tabButtons = this.modal.querySelectorAll('.settings-tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab panes
        const tabPanes = this.modal.querySelectorAll('.settings-tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
        
        // Load tab content if needed
        if (tabName === 'categories' && !this.categoriesLoaded) {
            this.loadCategories();
        }
    }
    
    createFooterButtons() {
        // Only add if not already present
        if (this.footer && this.footer.querySelector('.action-btn.save')) return;
        this.addFooterButton('Cancel', 'action-btn cancel', () => this.close());
        this.addFooterButton('Save Changes', 'action-btn save', () => this.handleSave());
    }
    
    async loadGeneralSettings() {
        const container = this.modal.querySelector('#generalSettingsContainer');
        if (!container) return;
        
        try {
            container.innerHTML = '<div class="loading-state">Loading general settings...</div>';
            
            const response = await fetch('/api/settings');
            if (response.ok) {
                this.settings = await response.json();
                
                if (this.settings && this.settings.length > 0) {
                    this.renderGeneralSettings();
                } else {
                    container.innerHTML = '<div class="empty-state">No settings configured yet.</div>';
                }
            } else {
                container.innerHTML = '<div class="error-state">Failed to load settings.</div>';
            }
        } catch (error) {
            container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
        }
    }
    
    renderGeneralSettings() {
        const container = this.modal.querySelector('#generalSettingsContainer');
        
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
                    <small>${setting.description || ''}</small>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `<form id="generalSettingsForm">${settingsHtml}</form>`;
    }
    
    async loadCategories() {
        const container = this.modal.querySelector('#categoriesContainer');
        
        try {
            container.innerHTML = '<div class="loading-state">Loading categories...</div>';
            
            const response = await fetch('/api/categories');
            if (response.ok) {
                this.categories = await response.json();
                this.renderCategories();
                this.categoriesLoaded = true;
            } else {
                container.innerHTML = '<div class="error-state">Failed to load categories.</div>';
            }
        } catch (error) {
            container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
        }
    }
    
    renderCategories() {
        const container = this.modal.querySelector('#categoriesContainer');
        
        const categoriesHtml = `
            <div class="categories-header">
                <h4>Manage Service Categories</h4>
                <button type="button" class="btn-add-category" onclick="settingsDialog.showCategoryForm()">
                    <span>➕</span> Add Category
                </button>
            </div>
            
            <div class="category-form-container" id="categoryFormContainer" style="display: none;">
                <form id="categoryForm" class="category-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Category Name</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>Icon</label>
                            <input type="text" name="icon" placeholder="📁" maxlength="2">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" name="description" placeholder="Optional description">
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" name="color" value="#6366f1">
                    </div>
                    <div class="category-form-actions">
                        <button type="button" onclick="settingsDialog.hideCategoryForm()">Cancel</button>
                        <button type="submit">Save Category</button>
                    </div>
                </form>
            </div>
            
            <div class="categories-list">
                ${this.categories.map(category => `
                    <div class="category-item" data-id="${category.id}">
                        <div class="category-info">
                            <span class="category-icon" style="background-color: ${category.color}">${category.icon}</span>
                            <div class="category-details">
                                <div class="category-name">${category.name}</div>
                                <div class="category-description">${category.description || 'No description'}</div>
                            </div>
                        </div>
                        <div class="category-actions">
                            <button type="button" class="btn-icon edit" onclick="settingsDialog.editCategory(${category.id})" title="Edit">
                                ✏️
                            </button>
                            <button type="button" class="btn-icon delete" onclick="settingsDialog.deleteCategory(${category.id})" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = categoriesHtml;
        this.bindCategoryFormEvents();
    }
    
    bindCategoryFormEvents() {
        const form = this.modal.querySelector('#categoryForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleCategorySubmit(e));
        }
    }
    
    showCategoryForm() {
        this.editingCategory = null;
        const container = this.modal.querySelector('#categoryFormContainer');
        const form = this.modal.querySelector('#categoryForm');
        
        form.reset();
        form.name.focus();
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }
    
    hideCategoryForm() {
        const container = this.modal.querySelector('#categoryFormContainer');
        container.style.display = 'none';
        this.editingCategory = null;
    }
    
    async editCategory(id) {
        const category = this.categories.find(c => c.id === id);
        if (!category) return;
        
        this.editingCategory = category;
        const container = this.modal.querySelector('#categoryFormContainer');
        const form = this.modal.querySelector('#categoryForm');
        
        // Populate form
        form.name.value = category.name;
        form.icon.value = category.icon;
        form.description.value = category.description || '';
        form.color.value = category.color;
        
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        form.name.focus();
    }
    
    async handleCategorySubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const categoryData = {
            name: formData.get('name'),
            description: formData.get('description'),
            icon: formData.get('icon') || '📁',
            color: formData.get('color')
        };
        
        try {
            let response;
            if (this.editingCategory) {
                response = await fetch(`/api/categories/${this.editingCategory.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(categoryData)
                });
            } else {
                response = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(categoryData)
                });
            }
            
            if (response.ok) {
                this.showNotification(`Category ${this.editingCategory ? 'updated' : 'created'} successfully!`, 'success');
                this.hideCategoryForm();
                this.loadCategories(); // Reload list
            } else {
                const error = await response.json();
                this.showNotification(`Failed to save category: ${error.error}`, 'danger');
            }
        } catch (error) {
            this.showNotification(`Error saving category: ${error.message}`, 'danger');
        }
    }
    
    async deleteCategory(id) {
        const category = this.categories.find(c => c.id === id);
        if (!category) return;
        
        if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/categories/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Category deleted successfully!', 'success');
                this.loadCategories(); // Reload list
            } else {
                const error = await response.json();
                this.showNotification(`Failed to delete category: ${error.error}`, 'danger');
            }
        } catch (error) {
            this.showNotification(`Error deleting category: ${error.message}`, 'danger');
        }
    }
    
    formatSettingLabel(key) {
        return key.split('_')
                 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                 .join(' ');
    }
    
    async handleSave() {
        if (this.currentTab === 'general') {
            await this.saveGeneralSettings();
        }
        // Categories save themselves immediately, no batch save needed
    }
    
    async saveGeneralSettings() {
        const form = this.modal.querySelector('#generalSettingsForm');
        if (!form) return;
        
        const submitBtn = this.footer.querySelector('.action-btn.save');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        const formData = new FormData(form);
        const settings = Object.fromEntries(formData.entries());
        
        try {
            const updatePromises = Object.entries(settings).map(([key, value]) => {
                return fetch(`/api/settings/${key}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
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