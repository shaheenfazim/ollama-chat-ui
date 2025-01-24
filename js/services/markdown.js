import { createElement } from '../ui.js';

// Configure marked settings
marked.use({
    mangle: false,
    headerIds: false,
    breaks: true,
    gfm: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    xhtml: false,
    langPrefix: 'hljs language-',
    highlight: function (code, language) {
        if (language) {
            try {
                return hljs.highlight(code, { language }).value;
            } catch (err) {
                return hljs.highlightAuto(code).value;
            }
        }
        return hljs.highlightAuto(code).value;
    }
});

// Sanitization configuration
const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'span'
    ],
    ALLOWED_ATTR: ['class'],
    FORBID_TAGS: ['style', 'script'],
    FORBID_ATTR: ['style', 'onerror', 'onclick'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
};

function sanitizeAndParseMarkdown(content) {
    // Parse markdown
    const htmlContent = marked.parse(content);

    // Final sanitization with DOMPurify
    return DOMPurify.sanitize(htmlContent, PURIFY_CONFIG);
}

function highlightCodeBlocks(element) {
    // Helper function to preview HTML content
    function previewHtmlContent(htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    }

    element.querySelectorAll('pre code').forEach((block) => {
        const wrapper = createElement('div', 'code-block-wrapper');

        // Create header with language and buttons
        const header = createElement('div', 'code-block-header');

        // Language detection
        let language = 'CODE';
        
        // Check if the block has a language class from markdown
        const languageClass = Array.from(block.classList).find(cls => cls.startsWith('language-'));
        if (languageClass) {
            language = languageClass.replace('language-', '').toUpperCase();
        }

        header.innerHTML = `
            <span class="code-language">${language}</span>
            <button class="copy-button" title="Copy code">
                <span class="material-symbols-rounded">content_copy</span>
            </button>
        `;

        // Add copy functionality
        const copyButton = header.querySelector('.copy-button');
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(block.textContent).then(() => {
                copyButton.innerHTML = '<span class="material-symbols-rounded">check</span>';
                setTimeout(() => {
                    copyButton.innerHTML = '<span class="material-symbols-rounded">content_copy</span>';
                }, 2000);
            });
        });

        // Add click functionality for HTML language label
        if (language === 'HTML') {
            const languageLabel = header.querySelector('.code-language');
            languageLabel.title = 'Click to preview HTML';
            languageLabel.style.cursor = 'pointer';
            languageLabel.innerHTML = 'HTML - <span style="color: #7ee787;">▶</span> CLICK TO PREVIEW';
            languageLabel.addEventListener('click', () => {
                previewHtmlContent(block.textContent);
            });
        }

        // Wrap the code block
        const pre = block.parentElement;
        pre.parentElement.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        // Apply highlight.js to the code block
        try {
            hljs.highlightElement(block);
        } catch (error) {
            console.warn('Failed to highlight code block:', error);
        }
    });
}

function renderMarkdownAndHighlight(content, messageContent) {
    // Sanitize and parse markdown
    const sanitizedHtml = sanitizeAndParseMarkdown(content);

    // Set the sanitized content
    messageContent.innerHTML = sanitizedHtml;
    messageContent.classList.add('markdown-content');

    // Highlight code blocks
    highlightCodeBlocks(messageContent);
}

function isCompleteBlock(text) {
    // Escape HTML before checking
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const codeBlocksComplete = (text.match(/```/g) || []).length % 2 === 0;
    const hasCompleteSentence = text.match(/[.!?]\s*$/) !== null;

    return codeBlocksComplete && hasCompleteSentence;
}

export {
    renderMarkdownAndHighlight,
    isCompleteBlock,
    sanitizeAndParseMarkdown
}; 