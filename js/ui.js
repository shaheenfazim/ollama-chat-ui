import * as Upload from './services/upload.js';
import * as Storage from './storage.js';

// Global state
let currentView = 'chat';
let isAutoScrollEnabled = true;
let ticking = false;

function getCurrentView() {
    return currentView;
}

function setCurrentView(view) {
    currentView = view;
}

// DOM Element Cache
const domCache = {};

function isDOMReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
}

function initializeDOMCache() {
    if (!isDOMReady()) {
        console.warn('Attempting to initialize DOM cache before DOM is ready');
        return false;
    }

    domCache.sendButton = document.getElementById('send-button');
    domCache.stopButton = document.getElementById('stop-button');
    domCache.userInput = document.getElementById('user-input');
    domCache.chatHistory = document.getElementById('chat-history');
    domCache.modelSelect = document.getElementById('prompt-model-select');
    domCache.systemPrompt = document.getElementById('system-prompt');
    domCache.chatContainer = document.getElementById('chat-container');
    domCache.sidebar = document.querySelector('.sidebar');
    domCache.mainContent = document.querySelector('.main-content');
    domCache.rightSidebar = document.querySelector('.right-sidebar');
    domCache.sidebarToggle = document.getElementById('sidebar-toggle');
    domCache.rightSidebarToggle = document.getElementById('right-sidebar-toggle');
    domCache.settingsButton = document.getElementById('settings-button');
    domCache.switchThemeButton = document.getElementById('switch-theme');
    domCache.clearStorageBtn = document.getElementById('clear-storage-btn');
    domCache.recentHistory = document.querySelector('.recent-history');
    domCache.noModelMessage = document.getElementById('no-model-message');
    domCache.emptyMessage = document.getElementById('empty-chat-message');
    domCache.attachmentButton = document.getElementById('attachment-button');
    domCache.favicon = document.getElementById('favicon');
    domCache.highlightStyle = document.getElementById('highlight-style');
    domCache.sunEye = document.getElementById('sun-eye');
    domCache.sunRay = document.getElementById('sun-ray');
    domCache.inputWrapper = document.querySelector('.input-wrapper');
    domCache.footerItems = document.querySelectorAll('.footer-item');
    domCache.typingArea = document.querySelector('.typing-area');
    domCache.settingsContainer = document.getElementById('settings-container');
    domCache.headerNewChat = document.getElementById('header-new-chat');
    domCache.collapsedNewChat = document.getElementById('collapsed-new-chat');
    domCache.searchInput = document.querySelector('.search-input');
    domCache.searchContainer = document.querySelector('.search-container');
    domCache.chatList = document.querySelector('.chat-list');
    domCache.apiErrorMessage = document.getElementById('api-error-message');
    domCache.htmlRoot = document.documentElement;
    domCache.hostAddress = document.getElementById('host-address');
    console.log("domCache initialized", domCache);
    return true;
}

function createElement(tagName, className, attributes = {}) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    Object.entries(attributes).forEach(([key, value]) => element[key] = value);
    return element;
}

function createIconButton(iconName, className, title) {
    const button = createElement('span', `material-symbols-rounded ${className}`, {
        textContent: iconName,
        title: title
    });
    return button;
}

function addMessageButton(container, type, icon, onClick) {
    const button = createIconButton(icon, `${type}-tag`, `${type} message`);
    button.onclick = onClick;
    container.appendChild(button);
    return button;
}

function createMessageContainer(role, content = '') {
    const container = createElement('div', `${role}-message`);
    const messageContent = createElement('div', 'message-content');
    container.hidden_text = content;
    
    // Add buttons based on role
    if (role === 'user') {
        Upload.MessageImage.addImageContainer(messageContent);
        addMessageButton(container, 'edit', 'edit', () => {
            import('./messages.js').then(({ handleMessageEdit }) => {
                handleMessageEdit(container, messageContent);
            });
        });
    } else {
        addMessageButton(container, 'copy', 'content_copy', () => {
            if (container.hidden_text) {
                navigator.clipboard.writeText(container.hidden_text)
                    .then(() => {
                        const copyButton = container.querySelector('.copy-tag');
                        copyButton.textContent = 'done';
                        setTimeout(() => copyButton.textContent = 'content_copy', 2000);
                    });
            }
        });
    }
    
    const textContainer = createElement('div', 'message-text');
    // Convert newlines to <br> tags and preserve whitespace
    if (content) {
        textContainer.innerHTML = content.replace(/\n/g, '<br>').replace(/\s{2,}/g, match => '&nbsp;'.repeat(match.length));
    }
    
    messageContent.appendChild(textContainer);
    container.appendChild(messageContent);

    return container;
}

// Scroll Management
function scrollToBottom({ smooth = true, force = false, enableAutoScroll = false } = {}) {
    const { chatContainer } = domCache;
    if (!chatContainer || currentView !== 'chat') return;
    
    if (enableAutoScroll) {
        isAutoScrollEnabled = true;
    }
    
    if (force || isAutoScrollEnabled) {
        const scrollHeight = chatContainer.scrollHeight;
        chatContainer.scrollTo({
            top: scrollHeight,
            behavior: smooth ? 'smooth' : 'instant'
        });
    }
}

function setupScrollHandler() {
    const { chatContainer } = domCache;
    if (!chatContainer) return;
    
    chatContainer.addEventListener('scroll', () => {
        if (currentView !== 'chat' || ticking) return;
        
        ticking = true;
        window.requestAnimationFrame(() => {
            const scrollPosition = chatContainer.scrollTop;
            const containerHeight = chatContainer.clientHeight;
            const scrollHeight = chatContainer.scrollHeight;
            
            const distanceFromBottom = Math.abs(scrollHeight - (scrollPosition + containerHeight));
            isAutoScrollEnabled = distanceFromBottom <= 50;
            ticking = false;
        });
    });

    const observer = new MutationObserver(() => {
        if (isAutoScrollEnabled) {
            scrollToBottom({ smooth: false, force: true, enableAutoScroll: true });
        }
    });

    observer.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

function handleInputChange(element) {
    const { sendButton, stopButton } = domCache;
    const isEmpty = !element.textContent.trim() && !element.querySelector('img');
    
    sendButton.disabled = isEmpty;
    sendButton.classList.toggle('disabled', isEmpty);
    sendButton.setAttribute('aria-disabled', isEmpty);
    
    if (isEmpty) {
        element.setAttribute('aria-placeholder', 'Enter a prompt');
    } else {
        element.removeAttribute('aria-placeholder');
    }
}

function clearUserInput() {
    const { userInput, sendButton } = domCache;
    if (!userInput) return;

    userInput.textContent = '';
    userInput.setAttribute('placeholder', 'Enter a prompt');
    
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.classList.add('disabled');
    }
    
    Upload.clearFileState();
}

// Theme Management
function updateLinks(theme) {
    const { favicon, highlightStyle } = domCache;
    if (!favicon || !highlightStyle) return;
    
    favicon.href = theme === 'light' ? 'favicon/favicon-light.svg' : 'favicon/favicon-dark.svg';
    highlightStyle.href = theme === 'light' 
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/github.min.css' 
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/github-dark.min.css';
}

async function switchTheme() {
    const { switchThemeButton, htmlRoot, sunEye, sunRay } = domCache;
    if (!switchThemeButton) return;
    
    const isLight = switchThemeButton.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    
    htmlRoot.setAttribute('data-theme', newTheme);
    updateLinks(newTheme);
    await Storage.setTheme(newTheme);
    
    switchThemeButton.classList.toggle('light-theme');
    switchThemeButton.classList.toggle('dark-theme');
    sunEye?.classList.toggle('move-right');
    sunRay?.classList.toggle('rotate');
}

async function initializeTheme() {
    const savedTheme = await Storage.getTheme();
    const theme = savedTheme || 'dark';
    
    // Apply theme
    domCache.htmlRoot.setAttribute('data-theme', theme);
    updateLinks(theme);
    
    // Update UI if light theme
    if (theme === 'light' && domCache.switchThemeButton) {
        domCache.switchThemeButton.classList.add('light-theme');
    }
}

// Sidebar Management
function setupSidebarHandlers() {
    const { sidebar, rightSidebar, mainContent, sidebarToggle, rightSidebarToggle } = domCache;

    // Left sidebar toggle handler
    sidebarToggle?.addEventListener('click', () => {
        const isClosing = sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        mainContent.classList.toggle('sidebar-open');
        sidebarToggle.textContent = isClosing ? 'menu' : 'arrow_back';
    });

    // Right sidebar toggle handler
    rightSidebarToggle?.addEventListener('click', () => {
        const isClosing = rightSidebar.classList.contains('open');
        rightSidebar.classList.toggle('open');
        mainContent.classList.toggle('right-sidebar-open');
        rightSidebarToggle.textContent = isClosing ? 'tune' : 'arrow_forward';
    });

    // Mobile toggle handlers
    const mobileLeftToggle = document.getElementById('mobile-left-toggle');
    const mobileRightToggle = document.getElementById('mobile-right-toggle');

    mobileLeftToggle?.addEventListener('click', () => sidebarToggle.click());
    mobileRightToggle?.addEventListener('click', () => rightSidebarToggle.click());

    // Footer item handlers
    const { footerItems } = domCache;
    footerItems?.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all footer items
            footerItems.forEach(fi => fi.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');
        });
    });
}

function updateChatSelection(chatId) {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedChat = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
}

function createChatItem(chat) {
    const chatItem = createElement('div', 'chat-item');
    if (chat.isNew) {
        chatItem.classList.add('active');
    }
    
    chatItem.setAttribute('data-chat-id', chat.id);
    
    chatItem.innerHTML = `
        <div class="chat-item-content">
            <span class="chat-icon material-symbols-rounded">chat</span>
            <span class="chat-title text-content">${chat.title}</span>
        </div>
        <span class="delete-chat-icon material-symbols-rounded">cancel</span>
    `;
    
    return chatItem;
}

function attachChatItemListeners(chatItem, chat) {
    const chatId = chat.id;
    const titleSpan = chatItem.querySelector('.chat-title');
    
    // Main chat item click handler
    chatItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-chat-icon') && 
            !e.target.classList.contains('chat-title') && 
            !e.target.classList.contains('chat-title-input')) {
            Storage.loadChat(chatId);
        }
    });
    
    // Delete button handler
    const deleteButton = chatItem.querySelector('.delete-chat-icon');
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        Storage.deleteSpecificChat(chatId);
    });

    // Title click handler
    titleSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // If chat is not selected, select it first
        if (!chatItem.classList.contains('active')) {
            Storage.loadChat(chatId);
            return;
        }
        
        const currentTitle = titleSpan.textContent;
        const input = createTitleInput(currentTitle);
        titleSpan.replaceWith(input);
        input.focus();
        input.select();
        
        let isEditing = true;
        
        const saveEdit = () => {
            if (!isEditing) return;
            isEditing = false;
            
            const newTitle = input.value.trim() || currentTitle;
            titleSpan.textContent = newTitle;
            input.replaceWith(titleSpan);
            
            Storage.updateChatTitle(chatId, newTitle);
        };
        
        const cancelEdit = () => {
            isEditing = false;
            input.replaceWith(titleSpan);
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });
    });
}

function createTitleInput(value) {
    const input = createElement('input', 'chat-title-input', {
        type: 'text',
        value: value
    });
    return input;
}

// Exports
export {
    // UI Core
    createElement,
    createIconButton,
    createMessageContainer,
    
    // Input Management
    handleInputChange,
    clearUserInput,
    
    // Event Setup
    setupSidebarHandlers,
    
    // Scroll Management
    scrollToBottom,
    setupScrollHandler,
    
    // View Management
    getCurrentView,
    setCurrentView,
    
    // Chat UI Management
    updateChatSelection,
    createChatItem,
    attachChatItemListeners,
    createTitleInput,
    
    // Theme Management
    switchTheme,
    initializeTheme,
    updateLinks,
    
    // DOM Cache
    domCache,
    initializeDOMCache
}; 