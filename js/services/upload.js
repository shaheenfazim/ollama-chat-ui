// Configuration Constants
const MAX_WIDTH = 800; // Maximum width for processing images
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILENAME_LENGTH = 255;
const MAX_FILES = 5; // Maximum number of files allowed
const MAX_IMAGES = 1; // Maximum number of images allowed

// File Categories and Extensions
const FILE_CATEGORIES = {
    PROGRAMMING: {
        extensions: new Set([
            'js', 'ts', 'jsx', 'tsx',  // JavaScript/TypeScript
            'py', 'java', 'cpp', 'c', 'h', 'cs', 'cc',   // Core languages
            'php', 'rb', 'pl', 'swift', 'kt',  // Other languages
            'go', 'rs', 'dart', 'lua', 'r',  // Modern languages
            'm', 'scala', 'groovy', 'perl',  // Additional languages
            'haskell', 'f90', 'ada', 'pas',  // Academic/Specialized
            'tcl', 'vb', 'asm', 'sol',  // Other programming
            'ex', 'elm', 'clj', 'fs'  // Functional languages
        ]),
        icon: 'contract'
    },
    WEB: {
        extensions: new Set([
            'html', 'css', 'scss', 'sass', 'less', 'vue'
        ]),
        icon: 'code'
    },
    DATA_CONFIG: {
        extensions: new Set([
            'json', 'yaml', 'yml', 'xml', 'toml', 
            'ini', 'conf', 'env'
        ]),
        icon: 'receipt_long'
    },
    DOCUMENTATION: {
        extensions: new Set([
            'txt', 'md', 'log', 'csv'
        ]),
        icon: 'description'
    },
    SCRIPTS: {
        extensions: new Set([
            'sh', 'bat', 'ps1', 'bash', 'coffee'
        ]),
        icon: 'terminal'
    }
};

// Combine all extensions for file input accept attribute
const TEXT_EXTENSIONS = new Set(
    Object.values(FILE_CATEGORIES)
        .flatMap(category => Array.from(category.extensions))
);

// File input accept attribute string
const TEXT_FILE_EXTENSIONS = Array.from(TEXT_EXTENSIONS).map(ext => `.${ext}`).join(',');

// Get icon for file type
const getFileIcon = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return 'draft';

    // Check each category for the extension
    for (const [category, info] of Object.entries(FILE_CATEGORIES)) {
        if (info.extensions.has(extension)) {
            return info.icon;
        }
    }

    return 'draft'; // Default icon
};

// Core UI Element Creation
function createElement(tag, className, attributes = {}) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    Object.entries(attributes).forEach(([key, value]) => {
        element[key] = value;
    });
    return element;
}

// Code Block Parsing
const parseCodeBlocks = (text) => {
    // Match code blocks that start with ```filename:
    const fileMatches = text.match(/```filename:([^\n]+)\n([\s\S]*?)```/g) || [];
    return fileMatches.map(match => {
        // Extract the actual filename after 'filename:'
        const [_, filename] = match.match(/```filename:([^\n]+)/);
        const content = match.match(/```filename:[^\n]+\n([\s\S]*?)```/)[1];
        return { filename, content, fullMatch: match };
    });
};

const processContentWithCodeBlocks = (text, existingContent) => {
    const blocks = parseCodeBlocks(existingContent);
    if (blocks.length > 0) {
        blocks.forEach(({ filename, content }) => {
            text += text ? '\n\n' + '```' + 'filename:' + filename + '\n' + content + '```' : '```' + 'filename:' + filename + '\n' + content + '```';
        });
    }
    return text;
};

// State Management
let uploadFiles = [];
let fileInput = null;

// Error Handling
class FileValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FileValidationError';
    }
}

const showError = (message, element) => {
    if (!element) return;
    
    // Store original placeholder
    const originalPlaceholder = element.getAttribute('placeholder');
    
    // Show error in placeholder
    element.setAttribute('placeholder', message);
    element.classList.add('error');
    
    // Clear any existing text
    const originalText = element.textContent;
    element.textContent = '';
    
    setTimeout(() => {
        // Restore original state
        element.setAttribute('placeholder', originalPlaceholder);
        element.classList.remove('error');
        if (originalText) {
            element.textContent = originalText;
        }
    }, 3000);
};

// File Validation
const isTextFile = (file) => {
    // Check if file type starts with text/
    if (file.type.startsWith('text/')) return true;
    
    // Check for common programming and config file types
    if (file.type === 'application/json' || 
        file.type === 'application/javascript' ||
        file.type === 'application/xml' ||
        file.type === 'application/x-yaml' ||
        file.type === 'application/x-httpd-php' ||
        file.type === 'application/x-python' ||
        file.type === 'application/x-ruby' ||
        file.type === 'application/x-sh') {
        return true;
    }

    // If no mime type, check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) return false;

    return TEXT_EXTENSIONS.has(extension);
};

const validateFile = (file) => {
    if (!file) {
        throw new FileValidationError('No file selected');
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        throw new FileValidationError('File is too large (max 5MB)');
    }

    // Check filename length
    if (file.name.length > MAX_FILENAME_LENGTH) {
        throw new FileValidationError('File name is too long');
    }

    // Allow image files
    if (file.type.startsWith('image/')) {
        return true;
    }

    // Allow text files
    if (isTextFile(file)) {
        return true;
    }

    throw new FileValidationError('Binary files not supported. Please select an image or text file.');
};

// UI Elements Management
const setupFileInput = () => {
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = `image/*,${TEXT_FILE_EXTENSIONS}`;
        fileInput.multiple = true;
        fileInput.id = 'file-input';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }
    return fileInput;
};

const updateFileButtonState = (fileButton, hasFiles) => {
    if (!fileButton) return;
    fileButton.classList.toggle('active', hasFiles);
    fileButton.querySelector('.material-symbols-rounded').textContent = hasFiles ? 'attach_file_add' : 'attach_file';
};

const createPreviewElement = (file, index) => {
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content';
    previewContent.dataset.index = index;

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-preview';
    removeButton.innerHTML = '<span class="material-symbols-rounded">close</span>';

    removeButton.onclick = () => {
        uploadFiles = uploadFiles.filter((_, i) => i !== index);
        updatePreviews();
        const event = new Event('input', { bubbles: true });
        const userInput = document.getElementById('user-input');
        if (userInput) userInput.dispatchEvent(event);
    };

    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.alt = 'Preview';
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(file);
        previewContent.appendChild(img);
    } else {
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview';
        const icon = getFileIcon(file.name);
        filePreview.innerHTML = `
            <div class="file-icon">
                <span class="material-symbols-rounded">${icon}</span>
            </div>
            <div class="file-name">${file.name}</div>
        `;
        previewContent.appendChild(filePreview);
    }

    previewContent.appendChild(removeButton);
    return previewContent;
};

const updatePreviews = () => {
    const previewContainer = document.getElementById('image-preview-container');
    const previewList = previewContainer?.querySelector('.preview-list');
    const fileButton = document.getElementById('attachment-button');

    if (!previewContainer || !previewList) return;

    previewList.replaceChildren();

    if (uploadFiles.length > 0) {
        previewContainer.style.display = 'block';
        uploadFiles.forEach((file, index) => {
            previewList.appendChild(createPreviewElement(file, index));
        });
        updateFileButtonState(fileButton, true);
    } else {
        previewContainer.style.display = 'none';
        updateFileButtonState(fileButton, false);
    }
};

// File Processing
const processFile = (file) => {
    return new Promise((resolve, reject) => {
        try {
            validateFile(file);

            if (file.type.startsWith('image/')) {
                processImageFile(file, resolve, reject);
            } else {
                processTextFile(file, resolve, reject);
            }
        } catch (error) {
            reject(error);
        }
    });
};

const processImageFile = (file, resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
            const ratio = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
        resolve({ type: 'image', base64Data });
    };
    
    img.onerror = () => reject(new FileValidationError('Failed to load image'));
    
    const reader = new FileReader();
    reader.onload = (e) => img.src = e.target.result;
    reader.onerror = () => reject(new FileValidationError('Failed to read image file'));
    reader.readAsDataURL(file);
};

const processTextFile = (file, resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        resolve({
            type: 'text',
            content: `\`\`\`filename:${file.name}\n${content}\n\`\`\``
        });
    };
    reader.onerror = () => reject(new FileValidationError('Failed to read text file'));
    reader.readAsText(file);
};

// File Selection and Upload Handling
const handleFileSelection = async (files, fileButton) => {
    try {
        if (files.length + uploadFiles.length > MAX_FILES) {
            throw new FileValidationError(`Maximum ${MAX_FILES} files allowed`);
        }

        const existingImageCount = uploadFiles.filter(file => file.type.startsWith('image/')).length;
        const newImageCount = files.filter(file => file.type.startsWith('image/')).length;

        if (existingImageCount + newImageCount > MAX_IMAGES) {
            throw new FileValidationError(`Maximum ${MAX_IMAGES} images allowed`);
        }

        for (const file of files) {
            await validateFile(file);
            uploadFiles.push(file);
        }
        
        updatePreviews();
        return { success: true };
    } catch (error) {
        console.error('File validation error:', error);
        return { success: false, error: error.message };
    }
};

const setupFileButton = (inputWrapper, userInput) => {
    const fileButton = document.getElementById('attachment-button');
    if (!fileButton) return;

    fileButton.addEventListener('click', async () => {
        const input = setupFileInput();
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        fileInput = newInput;

        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length) {
                const result = await handleFileSelection(files, fileButton);
                if (!result.success) {
                    showError(result.error || 'Failed to process files', userInput);
                }
            }
            fileInput.value = '';
        };

        fileInput.click();
    });

    return fileButton;
};

// Drag and Drop Handling
const setupDragAndDrop = (inputWrapper, userInput) => {
    if (!inputWrapper) return;

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!userInput.dataset.originalPlaceholder) {
            userInput.dataset.originalPlaceholder = userInput.placeholder;
            userInput.dataset.originalText = userInput.value;
            userInput.value = '';
        }
        
        userInput.placeholder = 'Drop here';
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (userInput.dataset.originalPlaceholder) {
            userInput.placeholder = userInput.dataset.originalPlaceholder;
            userInput.value = userInput.dataset.originalText || '';
            delete userInput.dataset.originalPlaceholder;
            delete userInput.dataset.originalText;
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (userInput.dataset.originalPlaceholder) {
            userInput.placeholder = userInput.dataset.originalPlaceholder;
            userInput.value = userInput.dataset.originalText || '';
            delete userInput.dataset.originalPlaceholder;
            delete userInput.dataset.originalText;
        }
        
        const files = Array.from(e.dataTransfer.files);
        const fileButton = document.getElementById('attachment-button');
        const result = await handleFileSelection(files, fileButton);
        
        if (!result.success) {
            showError(result.error || 'Failed to process files', userInput);
        }
    };

    // Add event listeners to window for drag and drop
    window.addEventListener('dragover', handleDrag);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    
    // Also keep the input wrapper handlers for more specific control
    inputWrapper.addEventListener('dragover', handleDrag);
    inputWrapper.addEventListener('dragleave', handleDragLeave);
    inputWrapper.addEventListener('drop', handleDrop);
};

// Message Image Handling
class MessageImage {
    static addImageContainer(messageContent) {
        const attachContainer = createElement('div', 'message-attach');
        messageContent.appendChild(attachContainer);
        return attachContainer;
    }

    static async displayImage(attachContainer, imageData, isBase64 = true) {
        const imageWrapper = createElement('div', 'image-wrapper');
        
        if (imageData instanceof File && !imageData.type.startsWith('image/')) {
            // Create file preview for non-image files
            const filePreview = this.createFilePreview(imageData.name);
            attachContainer.appendChild(filePreview);
            return filePreview;
        }

        // Handle image files
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        return new Promise((resolve, reject) => {
            img.onload = () => {
                // Calculate dimensions maintaining aspect ratio
                let width = img.width;
                let height = img.height;
                const targetHeight = 140;
                
                if (height > targetHeight) {
                    width = (targetHeight / height) * width;
                    height = targetHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                imageWrapper.appendChild(canvas);
                attachContainer.appendChild(imageWrapper);
                resolve(canvas);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            
            if (isBase64) {
                img.src = 'data:image/jpeg;base64,' + imageData;
            } else {
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(imageData);
            }
        });
    }

    static createFilePreview(filename, filesize = '') {
        const fileInfo = createElement('div', 'file-preview');
        const icon = getFileIcon(filename);
        fileInfo.innerHTML = `
            <div class="file-icon">
                <span class="material-symbols-rounded">${icon}</span>
            </div>
            <div class="file-name">${filename}</div>
        `;
        return fileInfo;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static removeImage(attachContainer) {
        attachContainer.replaceChildren();
    }

    static preserveDuringEdit(messageContent) {
        const attachContainer = messageContent.querySelector('.message-attach');
        const imageElements = Array.from(attachContainer?.querySelectorAll('.image-wrapper, .file-preview') || []);
        imageElements.forEach(el => el.remove());
        
        return {
            imageElements,
            restore: () => {
                if (imageElements.length > 0) {
                    imageElements.forEach(el => attachContainer.appendChild(el));
                }
            }
        };
    }

    static processMessageContent(messageContent) {
        const textContainer = messageContent.querySelector('.message-text');
        const attachContainer = messageContent.querySelector('.message-attach');
        if (!textContainer || !attachContainer) return;

        const text = textContainer.textContent;
        const blocks = parseCodeBlocks(text);

        if (blocks.length) {
            blocks.forEach(({ filename, content, fullMatch }) => {
                // Create file preview element
                const filePreview = this.createFilePreview(filename);
                attachContainer.appendChild(filePreview);

                // Remove the file content from text
                textContainer.textContent = textContainer.textContent.replace(fullMatch, '').trim();
            });
        }
    }
}

// Public API
const clearFileState = () => {
    uploadFiles = [];
    updatePreviews();
};

export {
    processFile,
    validateFile,
    FileValidationError,
    setupFileButton,
    setupDragAndDrop,
    clearFileState,
    uploadFiles,
    parseCodeBlocks,
    processContentWithCodeBlocks,
    MessageImage,
    createElement
}; 