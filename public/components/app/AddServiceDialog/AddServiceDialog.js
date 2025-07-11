/**
 * AddServiceDialog Component - Application-specific service management modal
 * Extends the base ModalDialog component
 */
class AddServiceDialog extends ModalDialog {
    constructor() {
        super('addServiceModal', {
            closeOnOverlayClick: true,
            closeOnEsc: true
        });
        
        this.form = null;
        this.isEditing = false;
        this.editingId = null;
        this.emojiSearchTimeout = null; // For debouncing searches
        
        this.initialize();
    }
    
    initialize() {
        this.setTitle('➕ Add New Service');
        this.createForm();
        this.createFooterButtons();
        this.bindFormEvents();
    }
    
    createForm() {
        this.form = document.createElement('form');
        this.form.id = 'addServiceForm';
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.form.innerHTML = `
            <div class="form-group">
                <label for="serviceName">Service Name</label>
                <input type="text" id="serviceName" name="name" required placeholder="e.g., Home Assistant">
            </div>
            
            <div class="form-group">
                <label for="serviceType">Service Type</label>
                <select id="serviceType" name="type" required>
                    <option value="http">HTTP/HTTPS</option>
                    <option value="tcp">TCP Port</option>
                    <option value="ssl">SSL Certificate</option>
                </select>
            </div>
            
            <!-- HTTP/SSL URL Field -->
            <div class="form-group" id="urlGroup">
                <label for="serviceUrl">URL</label>
                <input type="text" id="serviceUrl" name="url" required placeholder="e.g., https://example.com">
                <small style="color: var(--text-secondary); font-size: 12px;">
                    Full URL including protocol (https://example.com)
                </small>
            </div>
            
            <!-- TCP Host Field -->
            <div class="form-group" id="hostGroup" style="display: none;">
                <label for="serviceHost">Host</label>
                <input type="text" id="serviceHost" name="host" placeholder="e.g., atlas.local or 192.168.1.100">
                <small style="color: var(--text-secondary); font-size: 12px;">
                    Hostname or IP address to connect to
                </small>
            </div>
            
            <div class="form-group" id="portGroup" style="display: none;">
                <label for="servicePort">Port</label>
                <input type="number" id="servicePort" name="port" placeholder="e.g., 22, 80, 443">
            </div>
            
            <div class="form-group">
                <label for="serviceVisitUrl">Visit URL (optional)</label>
                <input type="text" id="serviceVisitUrl" name="visit_url" placeholder="e.g., https://example.com/login">
                <small style="color: var(--text-secondary); font-size: 12px;">Optional URL for the link button</small>
            </div>
            
            <div class="form-group">
                <label for="serviceIcon">Icon (emoji)</label>
                <div class="emoji-input-container">
                    <div class="emoji-search-wrapper">
                        <input type="text" id="emojiSearch" placeholder="Search for emoji...">
                        <div id="emojiDropdown" class="emoji-dropdown hidden">
                            <div class="emoji-option" onclick="selectEmoji('🏠')">🏠 house</div>
                            <div class="emoji-option" onclick="selectEmoji('🌐')">🌐 globe</div>
                            <div class="emoji-option" onclick="selectEmoji('🔧')">🔧 wrench</div>
                            <div class="emoji-option" onclick="selectEmoji('💻')">💻 laptop</div>
                            <div class="emoji-option" onclick="selectEmoji('📱')">📱 mobile</div>
                            <div class="emoji-option" onclick="selectEmoji('⚡')">⚡ lightning</div>
                            <div class="emoji-option" onclick="selectEmoji('🔐')">🔐 security</div>
                            <div class="emoji-option" onclick="selectEmoji('🔒')">🔒 lock</div>
                            <div class="emoji-option" onclick="selectEmoji('📊')">📊 chart</div>
                            <div class="emoji-option" onclick="selectEmoji('🎵')">🎵 music</div>
                            <div class="emoji-option" onclick="selectEmoji('📺')">📺 tv</div>
                        </div>
                    </div>
                    <div class="emoji-preview">
                        <div class="emoji-preview-icon" id="emojiPreview">🔧</div>
                        <input type="hidden" id="serviceIcon" name="icon" value="🔧">
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="serviceCategory">Category</label>
                <select id="serviceCategory" name="category">
                    <option value="web">Web Services</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="home">Home Automation</option>
                    <option value="media">Media</option>
                    <option value="network">Network</option>
                    <option value="security">Security</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <div style="margin: 2rem 0 1rem 0;">
                <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1rem;">⚙️ Advanced Settings</h4>
                    
                    <div class="form-group">
                        <label for="warningThreshold">Warning Threshold</label>
                        <input type="number" id="warningThreshold" name="warning_threshold" min="1" value="1000">
                        <small style="color: var(--text-secondary); font-size: 12px;">
                            HTTP/TCP: Response time in ms. SSL: Days before expiry
                        </small>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="serviceTimeout">Timeout (seconds)</label>
                            <input type="number" id="serviceTimeout" name="timeout" value="5" min="1" max="60">
                        </div>
                        
                        <div class="form-group">
                            <label for="serviceInterval">Check Interval (seconds)</label>
                            <input type="number" id="serviceInterval" name="interval" value="30" min="10" max="3600">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setBody(this.form);
    }
    
    createFooterButtons() {
        this.addFooterButton('Cancel', 'action-btn cancel', () => this.close());
        this.addFooterButton('Add Service', 'action-btn save', () => this.handleSubmit());
    }
    
    bindFormEvents() {
        const serviceTypeSelect = this.form.querySelector('#serviceType');
        serviceTypeSelect.addEventListener('change', () => this.handleServiceTypeChange());
        this.handleServiceTypeChange();
        
        // Add emoji search functionality
        this.bindEmojiEvents();
    }

    bindEmojiEvents() {
        const emojiSearch = this.form.querySelector('#emojiSearch');
        const emojiDropdown = this.form.querySelector('#emojiDropdown');
        
        if (emojiSearch && emojiDropdown) {
            // Show dropdown on focus
            emojiSearch.addEventListener('focus', () => {
                emojiDropdown.classList.remove('hidden');
                this.filterEmojis('');
            });
            
            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.emoji-search-wrapper')) {
                    emojiDropdown.classList.add('hidden');
                }
            });
            
            // Filter emojis on input
            emojiSearch.addEventListener('input', (e) => {
                this.filterEmojis(e.target.value);
            });
        }
    }

        filterEmojis(searchTerm) {
        const emojiDropdown = this.form.querySelector('#emojiDropdown');
        if (!emojiDropdown) return;
        
        // Debounce searches to improve performance
        if (this.emojiSearchTimeout) {
            clearTimeout(this.emojiSearchTimeout);
        }
        
        this.emojiSearchTimeout = setTimeout(() => {
            // Wait for emoji database to load if not ready
            if (!window.emojiDatabase) {
                emojiDropdown.innerHTML = '<div class="emoji-no-results">Loading emojis...</div>';
                return;
            }
            
            try {
                let emojis = [];
                
                if (searchTerm.trim() === '') {
                    // Show popular service-related emojis when no search term
                    const popularPatterns = [
                        'house', 'home', 'globe', 'computer', 'laptop', 'desktop', 'mobile', 'phone',
                        'wrench', 'gear', 'tool', 'lock', 'key', 'security', 'shield', 'chart', 
                        'graph', 'bar', 'server', 'database', 'cloud', 'rocket', 'lightning',
                        'satellite', 'antenna', 'television', 'monitor', 'disk', 'package',
                        'clipboard', 'file', 'cabinet', 'link', 'chain', 'magnifying', 'search'
                    ];
                    
                    emojis = window.emojiDatabase.filter(emoji => 
                        popularPatterns.some(pattern => 
                            emoji.name && emoji.name.toLowerCase().includes(pattern)
                        )
                    ).slice(0, 20); // Show top 20 popular emojis
                } else {
                    // Search in the loaded emoji database
                    const searchLower = searchTerm.toLowerCase();
                    emojis = window.emojiDatabase.filter(emoji => 
                        (emoji.name && emoji.name.toLowerCase().includes(searchLower)) ||
                        (emoji.category && emoji.category.toLowerCase().includes(searchLower)) ||
                        (emoji.subcategory && emoji.subcategory.toLowerCase().includes(searchLower))
                    ).slice(0, 30); // Show more results for search
                }
                
                if (emojis.length === 0) {
                    emojiDropdown.innerHTML = '<div class="emoji-no-results">No emojis found</div>';
                } else {
                    emojiDropdown.innerHTML = emojis.map(emoji => {
                        const char = emoji.emoji;
                        const name = emoji.name || 'emoji';
                        const displayName = name.split(' ')[0];
                        return `<div class="emoji-option" onclick="selectEmoji('${char}')">${char} ${displayName}</div>`;
                    }).join('');
                }
            } catch (error) {
                console.error('Emoji search error:', error);
                emojiDropdown.innerHTML = '<div class="emoji-no-results">Error loading emojis</div>';
            }
        }, 150); // 150ms debounce for faster response
    }
    
    handleServiceTypeChange() {
        const serviceType = this.form.querySelector('#serviceType').value;
        const urlGroup = this.form.querySelector('#urlGroup');
        const hostGroup = this.form.querySelector('#hostGroup');
        const portGroup = this.form.querySelector('#portGroup');
        const urlInput = this.form.querySelector('#serviceUrl');
        const hostInput = this.form.querySelector('#serviceHost');
        const portInput = this.form.querySelector('#servicePort');
        const warningThresholdInput = this.form.querySelector('#warningThreshold');
        
        urlInput.required = false;
        hostInput.required = false;
        portInput.required = false;
        
        switch(serviceType) {
            case 'http':
                urlGroup.style.display = 'block';
                hostGroup.style.display = 'none';
                portGroup.style.display = 'none';
                urlInput.required = true;
                warningThresholdInput.value = '1000';
                break;
            case 'tcp':
                urlGroup.style.display = 'none';
                hostGroup.style.display = 'block';
                portGroup.style.display = 'block';
                hostInput.required = true;
                portInput.required = true;
                warningThresholdInput.value = '500';
                break;
            case 'ssl':
                urlGroup.style.display = 'block';
                hostGroup.style.display = 'none';
                portGroup.style.display = 'none';
                urlInput.required = true;
                warningThresholdInput.value = '30';
                break;
        }
    }
    
    async show() {
        await this.populateCategoryDropdown();
        super.show();
    }

    close() {
        // Reset edit mode when closing
        this.resetForm();
        super.close();
        return this;
    }
    
    resetForm() {
        this.isEditing = false;
        this.editingId = null;
        this.setTitle('➕ Add New Service');
        this.footer.querySelector('.action-btn.save').textContent = 'Add Service';
        
        this.form.reset();
        this.form.querySelector('#emojiPreview').textContent = '🔧';
        this.form.querySelector('#serviceIcon').value = '🔧';
        this.form.querySelector('#warningThreshold').value = '1000';
        
        // Reset emoji search
        const emojiSearch = this.form.querySelector('#emojiSearch');
        const emojiDropdown = this.form.querySelector('#emojiDropdown');
        if (emojiSearch) {
            emojiSearch.value = '';
        }
        if (emojiDropdown) {
            emojiDropdown.classList.add('hidden');
        }
        
        this.handleServiceTypeChange();
    }
    
    async handleSubmit(e) {
        if (e) e.preventDefault();
        
        const submitBtn = this.footer.querySelector('.action-btn.save');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = this.isEditing ? 'Updating...' : 'Adding...';
        submitBtn.disabled = true;
        
        const formData = new FormData(this.form);
        const serviceData = Object.fromEntries(formData.entries());
        
        if (serviceData.type === 'tcp') {
            delete serviceData.url;
        } else {
            delete serviceData.host;
        }
        
        serviceData.timeout = parseInt(serviceData.timeout);
        serviceData.interval = parseInt(serviceData.interval);
        if (serviceData.port) serviceData.port = parseInt(serviceData.port);
        if (serviceData.warning_threshold) serviceData.warning_threshold = parseInt(serviceData.warning_threshold);
        serviceData.expected_status = serviceData.type === 'http' ? 200 : null;
        
        try {
            const url = this.isEditing ? `/api/services/${this.editingId}` : '/api/services';
            const method = this.isEditing ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serviceData),
            });
            
            if (response.ok) {
                const result = await response.json();
                this.close();
                
                const action = this.isEditing ? 'updated' : 'added';
                const id = this.isEditing ? this.editingId : result.id;
                this.showNotification(`Service "${serviceData.name}" ${action} successfully!`, 'success');
                
                if (window.monitor) {
                    // Small delay to ensure server has processed the update
                    setTimeout(() => {
                        window.monitor.refreshHealth();
                    }, 200);
                }
            } else {
                const error = await response.json();
                const action = this.isEditing ? 'update' : 'add';
                this.showNotification(`Failed to ${action} service: ${error.error || error.message}`, 'danger');
            }
        } catch (error) {
            const action = this.isEditing ? 'update' : 'add';
            this.showNotification(`Error ${action}ing service: ${error.message}`, 'danger');
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

    async showForEdit(serviceId) {
        await this.populateCategoryDropdown();
        // Find the service in our data
        let serviceToEdit = null;
        if (window.monitor && window.monitor.services) {
            Object.values(window.monitor.services).forEach(categoryServices => {
                if (Array.isArray(categoryServices)) {
                    categoryServices.forEach(service => {
                        const id = service.id || service.name.toLowerCase().replace(/\s+/g, '-');
                        if (id == serviceId) {
                            serviceToEdit = service;
                        }
                    });
                }
            });
        }

        if (!serviceToEdit) {
            this.showNotification('Service not found', 'danger');
            return;
        }

        // Set editing mode BEFORE showing
        this.isEditing = true;
        this.editingId = serviceId;

        // Show the dialog directly without resetting form
        super.show();

        // Set edit mode UI after showing
        this.setTitle('✏️ Edit Service');
        this.footer.querySelector('.action-btn.save').textContent = 'Update Service';

        // Populate the form with existing data
        this.form.querySelector('#serviceName').value = serviceToEdit.name || '';
        this.form.querySelector('#serviceType').value = serviceToEdit.type || 'http';
        
        // Set URL or Host based on service type
        if (serviceToEdit.type === 'tcp') {
            this.form.querySelector('#serviceHost').value = serviceToEdit.host || '';
            this.form.querySelector('#serviceUrl').value = ''; // Clear URL field for TCP
        } else {
            this.form.querySelector('#serviceUrl').value = serviceToEdit.url || '';
            this.form.querySelector('#serviceHost').value = ''; // Clear host field for HTTP/SSL
        }
        
        this.form.querySelector('#serviceVisitUrl').value = serviceToEdit.visit_url || '';
        this.form.querySelector('#servicePort').value = serviceToEdit.port || '';
        this.form.querySelector('#serviceIcon').value = serviceToEdit.icon || '🔧';
        this.form.querySelector('#emojiPreview').textContent = serviceToEdit.icon || '🔧';
        this.form.querySelector('#emojiSearch').value = ''; // Clear search field
        this.form.querySelector('#serviceCategory').value = serviceToEdit.category || '';
        this.form.querySelector('#serviceTimeout').value = serviceToEdit.timeout || 5;
        this.form.querySelector('#serviceInterval').value = serviceToEdit.interval || 30;
        this.form.querySelector('#warningThreshold').value = serviceToEdit.warning_threshold || this.getDefaultThreshold(serviceToEdit.type || 'http');
        
        // Update field visibility based on service type
        this.handleServiceTypeChange();
    }

    getDefaultThreshold(serviceType) {
        switch(serviceType) {
            case 'ssl': return 30;
            case 'http': return 1000;
            case 'tcp': return 500;
            default: return 1000;
        }
    }

    async populateCategoryDropdown() {
        const select = this.form.querySelector('#serviceCategory');
        if (!select) return;
        try {
            const response = await fetch('/api/categories');
            let categories = [];
            if (response.ok) {
                categories = await response.json();
            }
            select.innerHTML = '';
            if (categories.length === 0) {
                select.innerHTML = '<option value="">Other</option>';
            } else {
                categories.forEach(cat => {
                    select.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
                });
                select.innerHTML += '<option value="">Other</option>';
            }
        } catch (e) {
            select.innerHTML = '<option value="">Other</option>';
        }
    }
}

// Global instance
let addServiceDialog = null;

// Global functions for backward compatibility
function showAddServiceModal() {
    if (!addServiceDialog) {
        addServiceDialog = new AddServiceDialog();
    }
    addServiceDialog.show();
}

function hideAddServiceModal() {
    if (addServiceDialog) {
        addServiceDialog.close();
    }
}

// Global emoji selection function for HTML onclick handlers
function selectEmoji(emoji) {
    // Find the emoji elements that exist in the current AddServiceDialog
    const emojiPreview = document.querySelector('#emojiPreview');
    const serviceIcon = document.querySelector('#serviceIcon');
    const emojiDropdown = document.querySelector('#emojiDropdown');
    const emojiSearch = document.querySelector('#emojiSearch');
    
    if (emojiPreview && serviceIcon) {
        serviceIcon.value = emoji;
        emojiPreview.textContent = emoji;
        if (emojiDropdown) {
            emojiDropdown.classList.add('hidden');
        }
        if (emojiSearch) {
            emojiSearch.value = ''; // Clear search after selection
        }
    }
}

// Edit service function
async function editService(serviceId) {
    if (!addServiceDialog) {
        addServiceDialog = new AddServiceDialog();
    }
    addServiceDialog.showForEdit(serviceId);
} 