import * as UI from './ui.js';
import * as Storage from './storage.js';
import * as API from './api.js';
import * as Commands from './commands.js';
import * as Upload from './services/upload.js';
import * as Markdown from './services/markdown.js';
import * as Utils from './utils.js';

// Shared UI state management
let currentController = null;

// Utility functions for creating common UI elements
function updateButtonState(showStop = false) {
    const { sendButton, stopButton } = UI.domCache;
    
    [sendButton, stopButton].forEach(button => {
        if (button) {
            button.style.display = button === (showStop ? stopButton : sendButton) ? 'flex' : 'none';
            button.disabled = button === sendButton && showStop;
        }
    });
    
    if (showStop && stopButton) {
        stopButton.onclick = e => {
            e.preventDefault();
            if (currentController) {
                currentController.abort();
                cleanupResponseGeneration();
            }
        };
    }
}

function startResponseGeneration() {
    if (currentController) {
        currentController.abort();
        currentController = null;
    }

    currentController = new AbortController();
    updateButtonState(true);
    UI.scrollToBottom({ smooth: true, force: true, enableAutoScroll: true });
    
    return currentController.signal;
}

function cleanupResponseGeneration() {
    updateButtonState(false);
    if (currentController) {
        currentController = null;
    }
}

function appendUserMessage(message, scrollAfter = true, isCommand = false, saveToStorage = false, skipSave = false, images = []) {
    const { chatHistory } = UI.domCache;
    const userDiv = UI.createMessageContainer('user', message);
    const messageContent = userDiv.querySelector('.message-content');
    
    // Process images if present
    if (images && images.length > 0) {
        const attachContainer = messageContent.querySelector('.message-attach');
        // Display each image in sequence
        for (const imageData of images) {
            Upload.MessageImage.displayImage(attachContainer, imageData, true);
        }
    }

    // Process message content for file previews - only process once
    if (!isCommand) {
        Upload.MessageImage.processMessageContent(messageContent);
    }
    chatHistory.appendChild(userDiv);

    // Only save to storage if explicitly requested, not a command, and not skipped
    if (saveToStorage && !isCommand && !skipSave) {
        Storage.saveMessageToCurrentChat({
            role: 'user',
            content: message,
            ...(images?.length > 0 && { images })
        });
    }

    return userDiv;
}

function createResponseContainer() {
    const { chatHistory } = UI.domCache;
    const responseDiv = UI.createMessageContainer('system');
    chatHistory.appendChild(responseDiv);
    return responseDiv;
}

function appendMessage(role, content) {
    const { chatHistory } = UI.domCache;
    const messageDiv = UI.createMessageContainer(role, content);
    
    // Hide empty chat message when adding messages
    const emptyMessage = document.getElementById('empty-chat-message');
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // Process message content for file previews if user message and not already processed
    if (role === 'user' && !messageDiv.querySelector('.message-attach').hasChildNodes()) {
        Upload.MessageImage.processMessageContent(messageDiv.querySelector('.message-content'));
    }
    
    chatHistory.appendChild(messageDiv);
}

async function handleMessageResponse(data, existingResponseDiv = null) {
    const responseDiv = existingResponseDiv || createResponseContainer();
    const signal = startResponseGeneration();

    try {
        const response = await API.CONFIG.generateResponse(data, signal);
        if (!signal.aborted && currentController) {
            await API.handleResponse(response, responseDiv);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Response generation aborted');
            if (existingResponseDiv) {
                existingResponseDiv.remove();
            }
        } else {
            console.error('Error in response generation:', error);
            const messageContent = responseDiv.querySelector('.message-content');
            messageContent.innerHTML = '<div class="error">Failed to get response. Please try again.</div>';
            Storage.saveMessageToCurrentChat({
                role: 'assistant',
                content: 'Failed to get response. Please try again.',
                error: true
            });
        }
    } finally {
        cleanupResponseGeneration();
    }

    return responseDiv;
}

async function handleMessageEdit(messageDiv, messageContent) {
    const textContainer = messageContent.querySelector('.message-text');
    if (messageDiv.classList.contains('editing')) return;
    
    // Store original text for cancel/revert
    const originalText = textContainer.textContent;
    messageDiv.classList.add('editing');
    textContainer.contentEditable = true;
    textContainer.focus();
    
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(textContainer);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    const finishEdit = async (save) => {
        if (!messageDiv.classList.contains('editing')) return;
        
        const newText = save ? textContainer.textContent.trim() : originalText;
        textContainer.contentEditable = false;
        messageDiv.classList.remove('editing');
        
        if (save && newText && newText !== originalText) {
            // Abort any ongoing response generation
            if (currentController) {
                currentController.abort();
                currentController = null;
            }
            
            // Update database
            const chats = await Storage.parseChats();
            const currentChat = chats.find(chat => chat.isNew);
            if (currentChat) {
                const messageIndex = currentChat.messages.findIndex(msg => 
                    msg.role === 'user' && msg.content === originalText
                );
                
                if (messageIndex !== -1) {
                    currentChat.messages[messageIndex].content = newText;
                    currentChat.messages.length = messageIndex + 1;
                    await Storage.saveChats(chats);
                    
                    // Update UI
                    messageDiv.hidden_text = newText;
                    textContainer.textContent = newText;
                    
                    // Remove subsequent messages
                    while (messageDiv.nextElementSibling) {
                        messageDiv.nextElementSibling.remove();
                    }
                    
                    // Get new response
                    const data = await getChatRequestData(currentChat.messages);
                    await handleMessageResponse(data);
                }
            }
        } else {
            textContainer.textContent = originalText;
        }
    };
    
    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            cleanup();
            await finishEdit(true);
        } else if (e.key === 'Escape') {
            cleanup();
            await finishEdit(false);
        }
    };
    
    const handleBlur = async () => {
        cleanup();
        await finishEdit(true);
    };
    
    const cleanup = () => {
        textContainer.removeEventListener('keydown', handleKeyDown);
        textContainer.removeEventListener('blur', handleBlur);
    };
    
    textContainer.addEventListener('keydown', handleKeyDown);
    textContainer.addEventListener('blur', handleBlur, { once: true });
}

// Helper function to get chat request data
async function getChatRequestData(messages) {
    const { modelSelect } = UI.domCache;
    const temperature = await Storage.getTemperature();
    const systemPrompt = await Storage.getSystemPrompt();
    
    const data = {
        model: modelSelect.value,
        messages,
        temperature: temperature,
        system_prompts: {
            base: systemPrompt?.trim() || ""
        }
    };

    return data;
}

function displayMessages(messages) {
    if (!messages || !Array.isArray(messages)) return;

    const { chatHistory } = UI.domCache;
    chatHistory.replaceChildren();

    messages.forEach(message => {
        if (message.role === 'user') {
            appendUserMessage(message.content, false, false, false, true, message.images || []);
        } else if (message.role === 'assistant') {
            const responseDiv = createResponseContainer();
            const messageContent = responseDiv.querySelector('.message-content');
            responseDiv.hidden_text = message.content;
            Markdown.renderMarkdownAndHighlight(message.content, messageContent);
        }
    });


}

// Request Handling
async function submitRequest() {
    const { userInput } = UI.domCache;
    // Get input content preserving whitespace
    const input = userInput ? userInput.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<div>/gi, '\n').replace(/<\/div>/gi, '').trim() : '';
    
    // Don't proceed if there's no input and no files
    if (!input && !Upload.uploadFiles?.length) return;
    
    try {
        // Hide empty chat message when sending a message
        Utils.updateEmptyMessageVisibility(true, true);

        // Check for commands first
        if (input.startsWith('/')) {
            if (await Commands.handleSlashCommands(input)) {
                UI.clearUserInput();
                return;
            }
        }
        
        let processedContent = input;
        let processedImages = [];
        
        // Process files first if present
        if (Upload.uploadFiles?.length) {
            const processedFiles = await Promise.all(Upload.uploadFiles.map(async file => {
                const { processFile } = await import('./services/upload.js');
                return processFile(file);
            }));
            
            // Process all files and collect images and text
            for (const processed of processedFiles) {
                if (processed.type === 'image') {
                    processedImages.push(processed.base64Data);
                } else if (processed.type === 'text') {
                    // Append text file content to the message
                    processedContent += processedContent ? '\n\n' + processed.content : processed.content;
                }
            }
        }
        
        // Create message containers with processed content and images
        const userDiv = appendUserMessage(processedContent, true, false, true, false, processedImages);
        const responseDiv = createResponseContainer();
        
        // Wait a moment for storage to be updated
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Get updated chat state and prepare request
        const updatedChats = await Storage.parseChats();
        const updatedChat = updatedChats.find(chat => chat.isNew);
        const messages = updatedChat ? updatedChat.messages : [];
        
        UI.clearUserInput();
        
        // Get and handle response
        const data = await getChatRequestData(messages);
        await handleMessageResponse(data, responseDiv);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Request was aborted');
        } else {
            console.error('Failed to submit request:', error);
            const responseDiv = createResponseContainer();
            const messageContent = responseDiv.querySelector('.message-content');
            messageContent.innerHTML = '<div class="error">Failed to get response. Please try again.</div>';
            Storage.saveMessageToCurrentChat({
                role: 'assistant',
                content: 'Failed to get response. Please try again.',
                error: true
            });
        }
    } finally {
        cleanupResponseGeneration();
    }
}

export {
    appendUserMessage,
    createResponseContainer,
    appendMessage,
    startResponseGeneration,
    cleanupResponseGeneration,
    handleMessageResponse,
    handleMessageEdit,
    getChatRequestData,
    displayMessages,
    submitRequest
}; 