// LocalStorage utilities for chat persistence

const STORAGE_KEY = 'chat_threads';

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getThreads() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading threads from localStorage:', error);
        return [];
    }
}

export function saveThreads(threads) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch (error) {
        console.error('Error saving threads to localStorage:', error);
    }
}

export function createThread(title = 'New Chat') {
    const threads = getThreads();
    const newThread = {
        id: generateId(),
        title,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    threads.unshift(newThread);
    saveThreads(threads);
    return newThread;
}

export function updateThread(threadId, updates) {
    const threads = getThreads();
    const index = threads.findIndex(t => t.id === threadId);
    if (index !== -1) {
        threads[index] = {
            ...threads[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveThreads(threads);
        return threads[index];
    }
    return null;
}

export function deleteThread(threadId) {
    const threads = getThreads();
    const filtered = threads.filter(t => t.id !== threadId);
    saveThreads(filtered);
    return filtered;
}

export function addMessageToThread(threadId, message) {
    const threads = getThreads();
    const index = threads.findIndex(t => t.id === threadId);
    if (index !== -1) {
        threads[index].messages.push({
            id: generateId(),
            ...message,
            timestamp: new Date().toISOString()
        });
        threads[index].updatedAt = new Date().toISOString();

        // Update title based on first user message
        if (threads[index].messages.length === 1 && message.role === 'user') {
            threads[index].title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        }

        saveThreads(threads);
        return threads[index];
    }
    return null;
}

export function getThread(threadId) {
    const threads = getThreads();
    return threads.find(t => t.id === threadId) || null;
}
