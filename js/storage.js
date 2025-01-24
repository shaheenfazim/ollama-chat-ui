import * as UI from './ui.js';
import * as Utils from './utils.js';
import * as Messages from './messages.js';
import * as DB from './services/db.js';
import * as API from './api.js';

// Module state
let currentChatId = null;

// Core Storage Operations (Universal Functions)
async function parseChats() {
    try {
        const chats = await DB.dbOperation(DB.STORES.CHATS, 'readonly', store => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                
                request.onsuccess = () => {
                    // Sort by timestamp in descending order (newest first)
                    const results = request.result || [];
                    results.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(results);
                };
                
                request.onerror = () => reject(request.error);
            });
        });
        
        return chats;
    } catch (error) {
        console.error('Error parsing chats:', error);
        return [];
    }
}

async function saveChats(chats) {
    try {
        // Clear existing chats
        await DB.dbOperation(DB.STORES.CHATS, 'readwrite', store => store.clear());
        
        // Add all chats using put instead of add to handle updates
        const promises = chats.map(chat => 
            DB.dbOperation(DB.STORES.CHATS, 'readwrite', store => store.put(chat))
        );
        await Promise.all(promises);
    } catch (error) {
        console.error('Error saving chats:', error);
    }
}

async function clearStorage() {
    // Delete database and reload page
    DB.clearDatabase();
    window.location.reload();
}

// Internal helper function to create initial chat without storage updates
async function createInitialChat() {
    const { chatHistory, modelSelect, chatContainer } = UI.domCache;
    chatHistory.replaceChildren();
    
    const now = new Date();
    const timeStr = now.toLocaleString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const newChat = {
        id: Date.now(),
        title: timeStr,
        messages: [],
        model: modelSelect.value,
        timestamp: Date.now(),
        isNew: true
    };
    
    const existingChats = await parseChats();
    existingChats.forEach(chat => chat.isNew = false);
    existingChats.unshift(newChat);
    await saveChats(existingChats);
    
    await updateChatHistory();
    
    chatContainer.style.display = 'block';
    Utils.switchView('chat', true);
    Utils.updateEmptyMessageVisibility(!!modelSelect.value, false);
}

// Regular chat creation with storage updates
async function createNewChat() {
    await createInitialChat();
    await updateStorageUsage();
}

async function getCurrentChat() {
    const chats = await parseChats();
    return chats.find(chat => chat.isNew);
}

async function getChat(chatId) {
    const chats = await parseChats();
    return chats.find(chat => chat.id === chatId);
}

async function saveMessageToCurrentChat(message) {
    const chats = await parseChats();
    if (chats.length === 0) {
        await createNewChat();
        return saveMessageToCurrentChat(message);
    }
    
    const currentChat = chats.find(chat => chat.isNew);
    if (currentChat) {
        // Initialize messages array if it doesn't exist
        if (!currentChat.messages) {
            currentChat.messages = [];
        }

        // Format the message in chat API format
        const chatMessage = {
            role: message.role,
            content: message.content
        };

        // Include images if present
        if (message.images) {
            chatMessage.images = message.images;
        }

        currentChat.messages.push(chatMessage);
        
        const { modelSelect } = UI.domCache;
        currentChat.model = modelSelect.value;
        await saveChats(chats);
    }
}

async function clearChat() {
    const { chatHistory } = UI.domCache;
    chatHistory.innerHTML = '';
    
    const chats = await parseChats();
    const currentChat = chats.find(chat => chat.isNew);
    if (currentChat) {
        // Clear messages from the current chat
        currentChat.messages = [];
        await saveChats(chats);
        
        // Update storage usage after clearing
        await updateStorageUsage();
        
        // Update empty message visibility
        Utils.updateEmptyMessageVisibility(!!UI.domCache.modelSelect.value, false);
    }
}

async function loadChat(chatId) {
    try {
        const chats = await parseChats();
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            // Update all chats to not be new, then set the selected one as new
            chats.forEach(c => c.isNew = false);
            chat.isNew = true;
            await saveChats(chats);

            currentChatId = chatId;
            UI.updateChatSelection(chatId);
            Messages.displayMessages(chat.messages);

            // Restore the chat's model if it exists
            if (chat.model) {
                const { modelSelect } = UI.domCache;
                modelSelect.value = chat.model;
                Utils.updateModelMessage(chat.model);
                await API.updateModelInQueryString(chat.model);
            }

            Utils.switchView('chat', true);
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

async function updateChatHistory() {
    const { recentHistory } = UI.domCache;
    const chats = await parseChats();
    
    recentHistory.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = UI.createChatItem(chat);
        UI.attachChatItemListeners(chatItem, chat);
        recentHistory.appendChild(chatItem);
    });
}

async function updateChatTitle(chatId, newTitle) {
    const chats = await parseChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.title = newTitle;
        await saveChats(chats);
    }
}

async function deleteSpecificChat(chatId) {
    const chats = await parseChats();
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    await saveChats(updatedChats);
    
    if (updatedChats.length === 0) {
        await createNewChat();
    } else {
        const currentChatItem = document.querySelector('.chat-item.active');
        if (currentChatItem && currentChatItem.getAttribute('data-chat-id') == chatId) {
            await loadChat(updatedChats[0].id);
        }
    }
    
    await updateChatHistory();
}

// Settings Management
async function getTemperature() {
    const temperatureInput = document.getElementById('temperature');
    const savedTemp = await DB.getSetting('temperature', 0.7);
    return temperatureInput ? parseFloat(temperatureInput.value) : savedTemp;
}

async function setTemperature(value) {
    await DB.setSetting('temperature', value);
}

async function getHostAddress() {
    const defaultHost = "http://localhost:11434";
    return await DB.getSetting('host-address', defaultHost);
}

async function setHostAddress() {
    const hostInput = document.getElementById("host-address");
    if (hostInput) {
        await DB.setSetting('host-address', hostInput.value);
        await API.CONFIG.init();
        await Utils.populateModels();
    }
}

async function getSystemPrompt() {
    return await DB.getSetting('system-prompt', '');
}

async function setSystemPrompt() {
    const systemPrompt = document.getElementById("system-prompt").value;
    await DB.setSetting('system-prompt', systemPrompt);
}

async function initializeSettings() {
    const temperatureSlider = document.getElementById('temperature-slider');
    if (!temperatureSlider) return;
    
    const value = await getTemperature();
    temperatureSlider.value = value;
    document.getElementById('temperature-value').textContent = value;
    
    temperatureSlider.addEventListener('input', async (e) => {
        const value = e.target.value;
        document.getElementById('temperature-value').textContent = value;
        await setTemperature(value);
    });
}

// Theme Management
async function getTheme() {
    return await DB.getSetting('theme', 'dark');
}

async function setTheme(theme) {
    await DB.setSetting('theme', theme);
}

// Storage Info/Stats
async function getStorageInfo() {
    try {
        if (!navigator.storage?.estimate) {
            return { usage: 0, quota: 50 * 1024 * 1024 };
        }

        const { usage, quota } = await navigator.storage.estimate();
        return {
            usage: usage || 0,
            quota: quota || 50 * 1024 * 1024
        };
    } catch (error) {
        console.error('Error getting storage info:', error);
        return { usage: 0, quota: 50 * 1024 * 1024 };
    }
}

async function updateStorageUsage() {
    const storageBar = document.getElementById('storage-bar');
    const storageUsed = document.getElementById('storage-used');
    const storageLimit = document.getElementById('storage-limit');
    
    const { usage, quota } = await getStorageInfo();

    function formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    const used = formatSize(usage);
    const limit = formatSize(quota);
    const percentage = (usage / quota) * 100;

    storageBar.style.width = `${percentage}%`;
    storageUsed.textContent = used;
    storageLimit.textContent = limit;

    storageBar.classList.remove('warning', 'danger');
    if (percentage > 90) {
        storageBar.classList.add('danger');
    } else if (percentage > 70) {
        storageBar.classList.add('warning');
    }
}

// Export functions grouped by their purpose
export {
    // Core Storage Operations
    parseChats,
    saveChats,
    clearStorage,
    getCurrentChat,
    getChat,

    // Chat Management
    saveMessageToCurrentChat,
    createNewChat,
    clearChat,
    loadChat,
    updateChatHistory,
    updateChatTitle,
    deleteSpecificChat,

    // Settings Management
    getTemperature,
    setTemperature,
    getHostAddress,
    setHostAddress,
    getSystemPrompt,
    setSystemPrompt,
    initializeSettings,

    // Theme Management
    getTheme,
    setTheme,

    // Storage Info/Stats
    getStorageInfo,
    updateStorageUsage
}; 