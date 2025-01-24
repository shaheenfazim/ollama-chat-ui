// Database configuration
const DB_NAME = 'Ollama-X';
const DB_VERSION = 1;
const STORES = {
    CHATS: 'chats',
    SETTINGS: 'settings'
};

let db = null;

// Initialize database
async function initDB() {
    if (db) return db;
    
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                
                // Handle database connection errors
                db.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                };
                
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains(STORES.CHATS)) {
                    db.createObjectStore(STORES.CHATS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS);
                }
            };
        } catch (error) {
            console.error('Error initializing database:', error);
            reject(error);
        }
    });
}

// Helper function to perform database operations
async function dbOperation(storeName, mode, operation) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);

            transaction.onerror = (event) => {
                console.error('Transaction error:', event.target.error);
                reject(event.target.error);
            };

            try {
                const result = operation(store);
                
                // If the operation returns a Promise (for cursor operations)
                if (result instanceof Promise) {
                    result.then(resolve).catch(reject);
                } else {
                    const request = result;
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                }
            } catch (error) {
                console.error('Operation error:', error);
                reject(error);
            }
        });
    } catch (error) {
        console.error('Database operation error:', error);
        throw error;
    }
}

// Settings Management
async function getSetting(key, defaultValue) {
    try {
        const value = await dbOperation(STORES.SETTINGS, 'readonly', store => store.get(key));
        return value === undefined ? defaultValue : value;
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return defaultValue;
    }
}

async function setSetting(key, value) {
    try {
        await dbOperation(STORES.SETTINGS, 'readwrite', store => store.put(value, key));
    } catch (error) {
        console.error(`Error setting ${key}:`, error);
    }
}

// Core database operations
async function clearDatabase() {
    // Just delete the database and let the page reload handle everything else
    indexedDB.deleteDatabase(DB_NAME);
}

export {
    // Core database operations
    initDB,
    dbOperation,
    STORES,
    
    // Settings Management
    getSetting,
    setSetting,
    
    // Database cleanup
    clearDatabase
};