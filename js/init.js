import * as Storage from './storage.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

// UI Initialization
function initializeSendButton() {
    const { sendButton, userInput } = UI.domCache;
    
    if (!sendButton || !userInput) return;
    
    sendButton.disabled = true;
    sendButton.classList.add('disabled');
    
    const text = userInput.textContent ? userInput.textContent.trim() : '';
    if (text) {
        sendButton.disabled = false;
        sendButton.classList.remove('disabled');
    }
}

function setupModelInfoListeners() {
    UI.setupSidebarHandlers();
}

// Event Setup
async function setupEventListeners() {
    const { newChatButton, hostAddress, systemPrompt, clearStorageBtn } = UI.domCache;

    if (newChatButton) newChatButton.addEventListener("click", Storage.createNewChat);
    if (hostAddress) hostAddress.addEventListener("change", Storage.setHostAddress);
    if (systemPrompt) {
        systemPrompt.addEventListener("input", Storage.setSystemPrompt);
        const initialSystemPrompt = await Storage.getSystemPrompt();
        if (initialSystemPrompt) {
            systemPrompt.value = initialSystemPrompt;
        }
    }
    if (clearStorageBtn) clearStorageBtn.addEventListener("click", Storage.clearStorage);
}

// Application Initialization
async function initializeApp() {
    try {
        // Initialize DOM cache first and ensure it's ready
        const cacheInitialized = UI.initializeDOMCache();
        if (!cacheInitialized) {
            console.error('Failed to initialize DOM cache');
            return;
        }
        
        // Initialize theme
        await UI.initializeTheme();

        // Load current chat
        const chats = await Storage.parseChats();
        
        if (chats.length === 0) {
            await Storage.createNewChat();
        } else {
            const currentChat = chats.find(chat => chat.isNew) || chats[0];
            await Storage.loadChat(currentChat.id);
            UI.updateChatSelection(currentChat.id);
        }

        await Storage.updateChatHistory();
        await Utils.populateModels();
        await Storage.updateStorageUsage();
        
        const { userInput, chatContainer, modelSelect } = UI.domCache;
        if (userInput) userInput.focus();
        initializeSendButton();
        await Storage.initializeSettings();
        setupModelInfoListeners();
        UI.setupScrollHandler();

        if (chatContainer) {
            await setupEventListeners();
        }

        Utils.setupInputHandlers();

        // Scroll to bottom after all messages are displayed
        UI.scrollToBottom({ smooth: false, force: true, enableAutoScroll: true });

        // Handle model selection changes
        if (modelSelect) {
            modelSelect.addEventListener('change', () => Utils.updateModelMessage(modelSelect.value));
            Utils.updateModelMessage(modelSelect.value); // Initial check
        }
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Exports
export {
    initializeSendButton,
    setupModelInfoListeners,
    setupEventListeners
}; 