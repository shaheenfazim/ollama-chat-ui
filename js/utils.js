import * as Upload from './services/upload.js';
import * as Commands from './commands.js';
import * as Messages from './messages.js';
import * as UI from './ui.js';
import * as API from './api.js';
import * as Storage from './storage.js';

// Input handling
function setupInputHandlers() {
    const { userInput, stopButton, inputWrapper, sendButton, settingsButton, switchThemeButton } = UI.domCache;
    
    if (!userInput || !inputWrapper) {
        console.error('Required UI elements not found');
        return;
    }

    // Initialize prompt model selector
    initializeModelSelector();

    // Setup settings button click handler
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            switchView('settings');
        });
    }

    // Setup theme toggle button click handler
    if (switchThemeButton) {
        switchThemeButton.addEventListener('click', () => {
            UI.switchTheme();
        });
    }

    // Setup plus icon click handler
    const searchPlusIcon = document.querySelector('.search-plus-icon');
    if (searchPlusIcon) {
        searchPlusIcon.addEventListener('click', async () => {
            await Storage.createNewChat();
            UI.clearUserInput();
            switchView('chat');
        });
    }

    // Setup file button and drag-and-drop
    Upload.setupFileButton(inputWrapper, userInput, UI.handleInputChange);
    Upload.setupDragAndDrop(inputWrapper, userInput, UI.handleInputChange);

    // Add click handler for input-top area
    const inputTop = inputWrapper.querySelector('.input-top');
    if (inputTop) {
        inputTop.addEventListener('click', (e) => {
            // Only focus if the input is enabled
            if (!userInput.classList.contains('disabled')) {
                userInput.focus();
            }
        });
    }

    userInput.addEventListener('input', function() {
        UI.handleInputChange(this);
        
        // Handle command suggestions
        const text = this.textContent || '';
        this.setAttribute('placeholder', 
            text.startsWith('/') ? Commands.getSuggestions(text) : 'Enter a prompt'
        );
    });
    
    // Debounce submit to prevent double submissions
    const submitRequest = debounce(() => {
        Messages.submitRequest();
    }, 100);

    userInput.addEventListener('keydown', function(e) {
        // Handle tab completion
        if (e.key === 'Tab' && this.getAttribute('placeholder') !== 'Enter a prompt') {
            e.preventDefault();
            this.textContent = this.getAttribute('placeholder');
            this.setAttribute('placeholder', 'Enter a prompt');
            UI.handleInputChange(this);
            window.getSelection().setBaseAndExtent(this, this.textContent.length, this, this.textContent.length);
            return;
        }

        // Handle enter key for submission
        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Handle multiline input with shift+enter
            if (e.shiftKey) {
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                const br = UI.createElement('br');
                
                range.deleteContents();
                range.insertNode(br);
                range.setStartAfter(br);
                range.setEndAfter(br);
                
                selection.removeAllRanges();
                selection.addRange(range);
                br.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }

            // Submit if there's text or files
            const text = this.textContent.trim();
            if (text || (Upload.uploadFiles?.length > 0)) {
                submitRequest();
            }
        }
    });

    // Add click handler for send button
    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            const text = userInput.textContent.trim();
            if (text || (Upload.uploadFiles && Upload.uploadFiles.length > 0)) {
                submitRequest();
            }
        });
    }
}

// Model handling
function showApiError(show = true) {
    const apiErrorMessage = document.getElementById('api-error-message');
    if (apiErrorMessage) {
        apiErrorMessage.style.display = show ? 'flex' : 'none';
    }
}

async function populateModels() {
    const { modelSelect } = UI.domCache;
    if (!modelSelect) return;

    const defaultOption = '<option value="" disabled selected>Select model</option>';
    const requestedModel = new URLSearchParams(window.location.search).get('model');

    try {
        const data = await API.CONFIG.getModels();
        
        if (!data?.models) {
            modelSelect.innerHTML = defaultOption;
            return;
        }
        
        // Set model options
        const currentValue = modelSelect.value || requestedModel;
        const options = data.models
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(model => `<option value="${model.name}"${model.name === currentValue ? ' selected' : ''}>${model.name}</option>`);

        modelSelect.innerHTML = defaultOption.replace('selected', currentValue ? '' : 'selected') + options.join('');

        // Handle URL model validation
        if (requestedModel) {
            if (data.models.some(m => m.name === requestedModel)) {
                switchView('chat');
            } else {
                resetModelSelection(modelSelect);
            }
        }
    } catch (error) {
        console.error('Error populating models:', error);
        modelSelect.innerHTML = defaultOption;
        if (requestedModel) {
            resetModelSelection(modelSelect);
        }
    }
}

function resetModelSelection(select) {
    select.innerHTML = '<option value="" disabled selected>Select model</option>';
    select.value = '';
    updateEmptyMessageVisibility(false, false);
    history.replaceState(null, '', window.location.pathname);
}

function initializeModelSelector() {
    const { modelSelect } = UI.domCache;
    if (!modelSelect) return;

    modelSelect.addEventListener('change', async () => {
        const selectedModel = modelSelect.value;
        if (selectedModel) {
            try {
                showApiError(false);
                await API.updateModelInQueryString(selectedModel);
                
                // Update current chat's model
                const currentChat = await Storage.getCurrentChat();
                if (currentChat) {
                    currentChat.model = selectedModel;
                    const chats = await Storage.parseChats();
                    const updatedChats = chats.map(chat => 
                        chat.id === currentChat.id ? currentChat : chat
                    );
                    await Storage.saveChats(updatedChats);
                }
                
                updateModelMessage(selectedModel);
            } catch (error) {
                console.error('Error updating model:', error);
                showApiError(true);
                resetModelSelection(modelSelect);
            }
        } else {
            updateEmptyMessageVisibility(false, false);
        }
    });
}

// Helper function to handle empty chat message visibility
function updateEmptyMessageVisibility(hasModel = false, hasMessages = false) {
    const { noModelMessage } = UI.domCache;
    const emptyMessage = document.getElementById('empty-chat-message');
    if (!noModelMessage || !emptyMessage) return;

    // Only one message should be visible at a time
    noModelMessage.style.display = !hasModel ? 'flex' : 'none';
    emptyMessage.style.display = (hasModel && !hasMessages) ? 'flex' : 'none';
}

function updateModelMessage(selectedModel) {
    const { userInput, attachmentButton, chatHistory } = UI.domCache;
    if (!userInput) return;
    
    // Enable/disable input based on model selection
    const isEnabled = !!selectedModel;
    userInput.contentEditable = isEnabled;
    userInput.classList.toggle('disabled', !isEnabled);
    
    if (attachmentButton) {
        attachmentButton.disabled = !isEnabled;
        attachmentButton.classList.toggle('disabled', !isEnabled);
    }

    // Update messages visibility
    updateEmptyMessageVisibility(isEnabled, chatHistory?.children.length > 0);

    // Update URL if model is selected
    if (isEnabled) {
        API.updateModelInQueryString(selectedModel);
    }
}

// View Management
function switchView(viewName, keepChatSelection = false, event = null) {
    const { chatContainer, settingsContainer } = UI.domCache;
    const views = {
        'chat': { container: chatContainer, button: null },
        'settings': { container: settingsContainer, button: UI.domCache.settingsButton }
    };

    const targetView = views[viewName];
    if (!targetView || !targetView.container) return;

    // Hide all views first
    Object.values(views).forEach(view => {
        if (view.container) {
            view.container.classList.remove('active');
            view.container.style.display = 'none';
        }
    });

    // Show target view
    targetView.container.style.display = 'flex';
    targetView.container.classList.add('active');

    // Show/hide typing area based on view
    const typingArea = document.querySelector('.typing-area');
    if (typingArea) {
        typingArea.style.display = viewName === 'chat' ? 'block' : 'none';
    }

    // If switching to chat view, handle placeholder messages
    if (viewName === 'chat') {
        const { noModelMessage, emptyMessage, modelSelect, chatHistory } = UI.domCache;
        
        // Hide placeholder messages first
        if (noModelMessage) noModelMessage.style.display = 'none';
        if (emptyMessage) emptyMessage.style.display = 'none';

        // Show appropriate message based on state
        if (!chatHistory || chatHistory.children.length === 0) {
            if (modelSelect && !modelSelect.value) {
                if (noModelMessage) noModelMessage.style.display = 'flex';
            } else {
                if (emptyMessage) emptyMessage.style.display = 'flex';
            }
        }
    }

    // Update selection states
    UI.domCache.footerItems.forEach(item => item.classList.remove('active'));
    targetView.button?.classList.add('active');

    if (!keepChatSelection && viewName !== 'chat') {
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    }

    // Update and log view change
    console.debug(`Switched from ${UI.getCurrentView()} to ${viewName}`);
    UI.setCurrentView(viewName);
}

// Helper function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export {
    setupInputHandlers,
    initializeModelSelector,
    updateModelMessage,
    populateModels,
    switchView,
    updateEmptyMessageVisibility,
    showApiError
}; 