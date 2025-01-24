import * as Messages from './messages.js';
import * as Storage from './storage.js';
import * as Markdown from './services/markdown.js';
import * as UI from './ui.js';
import * as API from './api.js';

const COMMANDS = {
    '/help': {
        description: 'Show available commands',
        usage: '/help'
    },
    '/info': {
        description: 'Show information about the current model',
        usage: '/info'
    },
    '/clear': {
        description: 'Clear the chat history',
        usage: '/clear'
    },
    '/fullscreen': {
        description: 'Toggle fullscreen mode',
        usage: '/fullscreen'
    },
    '/new': {
        description: 'Create a new chat',
        usage: '/new'
    }
};

// Helper function to render content and scroll
function renderResponse(content, messageContent) {
    Markdown.renderMarkdownAndHighlight(content, messageContent);
    // Make sure command outputs are visible
    UI.scrollToBottom(true, true);
}

async function handleSlashCommands(input, existingResponseDiv = null) {
    const [command] = input.trim().split(' ');
    const commandLower = command.toLowerCase();

    if (!COMMANDS[commandLower]) {
        // Show message for unknown command
        Messages.appendUserMessage(input, true, true);
        const responseDiv = existingResponseDiv || Messages.createResponseContainer();
        const messageContent = responseDiv.querySelector('.message-content');
        renderResponse(`Unknown command: \`${command}\`\nType \`/help\` to see available commands.`, messageContent);
        return true;
    }

    try {
        const signal = Messages.startResponseGeneration();

        switch (commandLower) {
            case '/help':
                return await showHelp(signal, existingResponseDiv);
            case '/info':
                return await showModelInfo(signal, existingResponseDiv);
            case '/clear':
                Messages.appendUserMessage(input, true, true);
                Storage.clearChat();
                return true;
            case '/fullscreen':
                return await handleFullscreenCommand(signal, existingResponseDiv);
            case '/new':
                Messages.appendUserMessage(input, true, true);
                Storage.createNewChat();
                return true;
            default:
                return false;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Command failed:', error);
            throw error;
        }
        return true;
    } finally {
        Messages.cleanupResponseGeneration();
    }
}

async function showHelp(signal, existingResponseDiv = null) {
    const helpContent = Object.entries(COMMANDS)
        .map(([cmd, info]) => `**Command:** \`${cmd}\`: \n${info.description}\n**Usage:** \`${info.usage}\``)
        .join('\n\n');

    if (!existingResponseDiv) {
        Messages.appendUserMessage('/help', true, true);
    }
    const responseDiv = existingResponseDiv || Messages.createResponseContainer();
    const messageContent = responseDiv.querySelector('.message-content');
    
    renderResponse('Available Commands:\n\n' + helpContent, messageContent);
    return true;
}

async function showModelInfo(signal, existingResponseDiv = null) {
    const { modelSelect } = UI.domCache;
    const modelName = modelSelect.value;

    if (!existingResponseDiv) {
        Messages.appendUserMessage('/info', true, true);
    }
    const responseDiv = existingResponseDiv || Messages.createResponseContainer();
    const messageContent = responseDiv.querySelector('.message-content');

    if (!modelName) {
        renderResponse('Select a model from the dropdown menu first before using the /info command.', messageContent);
        return true;
    }

    try {
        const models = await API.CONFIG.getModels();
        if (signal.aborted) return;
        
        const modelData = models?.models?.find(m => m.name === modelName);
        if (modelData) {
            let infoContent = `Model Information for ${modelName}\n\n`;
            
            // Add details section
            if (modelData.details && Object.keys(modelData.details).length > 0) {
                infoContent += '#### Details\n';
                for (const [key, value] of Object.entries(modelData.details)) {
                    infoContent += `- **${key}:** ${value}\n`;
                }
                infoContent += '\n';
            }
            
            
            renderResponse(infoContent, messageContent);
        } else {
            renderResponse(`No information available for model: ${modelName}`, messageContent);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            renderResponse('Failed to fetch model information', messageContent);
            throw error;
        }
    }
    return true;
}

async function handleFullscreenCommand(signal, existingResponseDiv = null) {
    if (!existingResponseDiv) {
        Messages.appendUserMessage('/fullscreen', true, true);
    }
    const responseDiv = existingResponseDiv || Messages.createResponseContainer();
    const messageContent = responseDiv.querySelector('.message-content');

    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            renderResponse('Entered fullscreen mode. Press Esc or type `/fullscreen` again to exit.', messageContent);
        } else {
            await document.exitFullscreen();
            renderResponse('Exited fullscreen mode.', messageContent);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            renderResponse('Failed to toggle fullscreen mode. Your browser might not support this feature.', messageContent);
            throw error;
        }
    }
    return true;
}

function getSuggestions(input) {
    if (!input || !input.startsWith('/')) return null;

    const matches = Object.entries(COMMANDS)
        .filter(([cmd]) => cmd.startsWith(input.toLowerCase()))
        .map(([cmd, info]) => info.usage);

    // Return first match if exact, otherwise join with separator
    if (matches.length === 1 && matches[0].startsWith(input)) {
        return matches[0];
    }
    return matches.length > 0 ? matches.join(' , ') : null;
}

export {
    handleSlashCommands,
    getSuggestions
};