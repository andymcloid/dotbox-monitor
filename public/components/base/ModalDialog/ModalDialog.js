/**
 * Base ModalDialog Component - Generic and reusable
 * Following SOLID principles for modal functionality
 */
class ModalDialog {
    constructor(id, options = {}) {
        this.id = id;
        this.options = {
            destroyOnClose: false,
            closeOnOverlayClick: true,
            closeOnEsc: true,
            ...options
        };
        
        this.isOpen = false;
        this.element = null;
        this.overlay = null;
        this.content = null;
        this.header = null;
        this.body = null;
        this.footer = null;
        
        this.onOpen = null;
        this.onClose = null;
        this.onDestroy = null;
        
        this.createModal();
        this.bindEvents();
    }
    
    createModal() {
        // Create main modal container
        this.element = document.createElement('div');
        this.element.id = this.id;
        this.element.className = 'modal';
        this.element.style.display = 'none';
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.element.appendChild(this.overlay);
        
        // Create content container
        this.content = document.createElement('div');
        this.content.className = 'modal-content';
        this.element.appendChild(this.content);
        
        // Create header
        this.header = document.createElement('div');
        this.header.className = 'modal-header';
        this.content.appendChild(this.header);
        
        // Create body
        this.body = document.createElement('div');
        this.body.className = 'modal-body';
        this.content.appendChild(this.body);
        
        // Create footer
        this.footer = document.createElement('div');
        this.footer.className = 'modal-footer';
        this.content.appendChild(this.footer);
        
        // Add to DOM
        document.body.appendChild(this.element);
    }
    
    bindEvents() {
        // Close on overlay click
        if (this.options.closeOnOverlayClick) {
            this.overlay.addEventListener('click', () => this.close());
        }
        
        // Close on ESC key
        if (this.options.closeOnEsc) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }
    }
    
    setTitle(title) {
        this.header.innerHTML = `
            <h3>${title}</h3>
            <button class="modal-close" onclick="this.closest('.modal').modalInstance.close()">✕</button>
        `;
        return this;
    }
    
    setBody(content) {
        if (typeof content === 'string') {
            this.body.innerHTML = content;
        } else {
            this.body.innerHTML = '';
            this.body.appendChild(content);
        }
        return this;
    }
    
    setFooter(content) {
        if (typeof content === 'string') {
            this.footer.innerHTML = content;
        } else {
            this.footer.innerHTML = '';
            this.footer.appendChild(content);
        }
        return this;
    }
    
    addFooterButton(text, className = 'action-btn', onclick = null) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        if (onclick) {
            button.addEventListener('click', onclick);
        }
        this.footer.appendChild(button);
        return button;
    }
    
    show() {
        if (this.isOpen) return this;
        
        // Force close other modals if needed
        this.closeOtherModals();
        
        // Show modal
        this.element.style.display = 'flex';
        this.element.classList.add('show');
        this.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Store reference for close button
        this.element.modalInstance = this;
        
        // Trigger onOpen callback
        if (this.onOpen) {
            this.onOpen();
        }
        
        // Emit custom event after modal is shown
        const event = new CustomEvent('dialogShown', { bubbles: false });
        this.element.dispatchEvent(event);
        
        return this;
    }
    
    close() {
        if (!this.isOpen) return this;
        
        this.element.style.display = 'none';
        this.element.classList.remove('show');
        this.isOpen = false;
        
        // Restore body scroll
        document.body.style.overflow = 'auto';
        
        // Trigger onClose callback
        if (this.onClose) {
            this.onClose();
        }
        
        // Destroy if configured
        if (this.options.destroyOnClose) {
            this.destroy();
        }
        
        return this;
    }
    
    closeOtherModals() {
        // Close any other open modals
        document.querySelectorAll('.modal.show').forEach(modal => {
            if (modal !== this.element && modal.modalInstance) {
                modal.modalInstance.close();
            }
        });
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        if (this.onDestroy) {
            this.onDestroy();
        }
        
        this.element = null;
        this.overlay = null;
        this.content = null;
        this.header = null;
        this.body = null;
        this.footer = null;
    }
    
    // Event handlers
    onOpenCallback(callback) {
        this.onOpen = callback;
        return this;
    }
    
    onCloseCallback(callback) {
        this.onClose = callback;
        return this;
    }
    
    onDestroyCallback(callback) {
        this.onDestroy = callback;
        return this;
    }
    
    setPadding(padding) {
        if (this.body) {
            this.body.style.padding = (typeof padding === 'number') ? `${padding}px` : padding;
        }
        return this;
    }
    
    /**
     * setBodyContainerMode(true) disables modal body padding and scrolling, for full-size child components (e.g. TabView)
     * setBodyContainerMode(false) restores default modal body padding and scrolling
     */
    setBodyContainerMode(isContainer = true) {
        if (!this.body) return this;
        if (isContainer) {
            this.body.style.padding = '0';
            this.body.style.maxHeight = 'none';
            // Do NOT set overflow here; let TabView handle it
        } else {
            this.body.style.padding = '';
            this.body.style.maxHeight = '';
            // Do NOT set overflow here; let default CSS handle it
        }
        return this;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalDialog;
} 