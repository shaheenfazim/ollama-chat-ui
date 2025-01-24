import * as UI from './ui.js';
import * as Utils from './utils.js';
import * as Storage from './storage.js';
import * as Markdown from './services/markdown.js';

// API Configuration
const CONFIG = {
    host: null,
    
    async init() {
        this.host = await Storage.getHostAddress();
    },

    async getModels() {
        if (!this.host) {
            this.host = await Storage.getHostAddress();
        }
        
        try {
            const response = await fetch(`${this.host}/api/tags`);
            if (!response.ok) {
                Utils.showApiError(true);
                throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching models:', error);
            Utils.showApiError(true);
            return null;
        }
    },

    async generateResponse(data, signal) {
        const requestData = {
            model: data.model,
            messages: data.messages,
            stream: true,
            options: {
                temperature: parseFloat(data.temperature)
            }
        };

        // Add system messages if available
        if (data.system_prompts) {
            const systemMessages = [];
            
            // Add base system prompt if exists
            if (data.system_prompts.base) {
                systemMessages.push({
                    role: "system",
                    content: data.system_prompts.base
                });
            }

            // Add system messages at the start
            requestData.messages = [...systemMessages, ...requestData.messages];
        }

        console.log("Sending chat request with", requestData.messages.length, "messages");

        try {
            // Log request data in a collapsible format
            console.groupCollapsed("Request Data");
            console.log("Using model:", requestData.model);
            console.log("Base System Prompt:", data.system_prompts?.base || "None");
            console.log("Temperature:", requestData.options.temperature);
            console.log("Messages:", requestData.messages);
            console.groupEnd();

            const response = await fetch(`${CONFIG.host}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                signal: signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.groupCollapsed("Error Response");
                console.log("Status:", response.status);
                console.log("Status Text:", response.statusText);
                console.log("Error Details:", errorText);
                console.groupEnd();
                Utils.showApiError(true);
                throw new Error(`Failed to send chat request: ${response.status} ${response.statusText}\n${errorText}`);
            }
            Utils.showApiError(false);
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request aborted');
                throw error;
            }
            console.error("Error in generateResponse:", error);
            throw error;
        }
    }
};

// Initialize API when the module loads
await CONFIG.init();

// Response Handling
async function handleResponse(response, responseDiv) {
    let accumulatedText = '';
    
    try {
        await getResponse(response, parsedResponse => {
            if (parsedResponse.message) {
                accumulatedText += parsedResponse.message.content;
                const messageContent = responseDiv.querySelector('.message-content');
                responseDiv.hidden_text = accumulatedText;
                
                Markdown.renderMarkdownAndHighlight(accumulatedText, messageContent);
                // Respect auto-scroll state during streaming
                UI.scrollToBottom(true);
            }
            
            if (parsedResponse.done) {
                Storage.saveMessageToCurrentChat({
                    role: 'assistant',
                    content: accumulatedText
                });
            }
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Response generation stopped.');
            Storage.saveMessageToCurrentChat({
                role: 'assistant',
                content: accumulatedText
            });
        } else {
            console.error("Error in handleResponse:", error);
            throw error;
        }
    }
}

async function getResponse(response, callback) {
    const reader = response.body.getReader();
    let partialLine = '';
    const textDecoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const textChunk = textDecoder.decode(value, { stream: true });
            const lines = (partialLine + textChunk).split('\n');
            partialLine = lines.pop();

            for (const line of lines) {
                if (line.trim() === '') continue;
                try {
                    const parsedResponse = JSON.parse(line);
                    callback(parsedResponse);
                } catch (e) {
                    console.warn('Failed to parse response line:', e);
                }
            }
        }

        // Handle last partial line
        if (partialLine.trim() !== '') {
            try {
                const parsedResponse = JSON.parse(partialLine);
                callback(parsedResponse);
            } catch (e) {
                console.warn('Failed to parse final response line:', e);
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// Update model in URL query string
async function updateModelInQueryString(model) {
    if (window.history.replaceState && 'URLSearchParams' in window) {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set("model", model);
        const newPathWithQuery = `${window.location.pathname}?${searchParams.toString()}`
        window.history.replaceState(null, '', newPathWithQuery);
    }
}

// Exports
export {
    CONFIG,
    handleResponse,
    getResponse,
    updateModelInQueryString
}; 