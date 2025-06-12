// TabView base component - generic, reusable tabbed interface
class TabView {
    constructor(tabs = [], options = {}) {
        this.tabs = tabs;
        this.options = { ...options };
        this.activeTab = tabs[0]?.id || null;
        this.container = null;
        this.tabNav = null;
        this.tabContent = null;
        this.tabChangeCallbacks = [];
        this.createElement();
    }

    createElement() {
        this.container = document.createElement('div');
        this.container.className = 'tabview-container';

        // Tab navigation
        this.tabNav = document.createElement('div');
        this.tabNav.className = 'tabview-nav';
        this.tabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = 'tabview-btn' + (tab.id === this.activeTab ? ' active' : '');
            btn.dataset.tab = tab.id;
            btn.innerHTML = `${tab.icon ? `<span class="tabview-icon">${tab.icon}</span>` : ''}${tab.label}`;
            btn.addEventListener('click', () => this.switchTab(tab.id));
            this.tabNav.appendChild(btn);
        });
        this.container.appendChild(this.tabNav);

        // Tab content
        this.tabContent = document.createElement('div');
        this.tabContent.className = 'tabview-content';
        this.tabs.forEach(tab => {
            const pane = document.createElement('div');
            pane.className = 'tabview-pane' + (tab.id === this.activeTab ? ' active' : '');
            pane.id = `tabview-pane-${tab.id}`;
            if (typeof tab.content === 'string') {
                pane.innerHTML = tab.content;
            } else if (tab.content instanceof HTMLElement) {
                pane.appendChild(tab.content);
            }
            this.tabContent.appendChild(pane);
        });
        this.container.appendChild(this.tabContent);
    }

    switchTab(tabId) {
        if (tabId === this.activeTab) return;
        this.activeTab = tabId;
        // Update nav
        this.tabNav.querySelectorAll('.tabview-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        // Update panes
        this.tabContent.querySelectorAll('.tabview-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tabview-pane-${tabId}`);
        });
        // Callbacks
        this.tabChangeCallbacks.forEach(cb => cb(tabId));
    }

    onTabChange(cb) {
        this.tabChangeCallbacks.push(cb);
    }

    getElement() {
        return this.container;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabView;
} 