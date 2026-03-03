// API service for backend communication
// In production this should hit a same-origin serverless route (`/api/chat`)
// to avoid browser CORS preflight issues with direct Lambda calls.
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api/chat';

export async function sendMessage(messages, model) {
    const requestBody = {
        messages: [
            {
                role: "system",
                content: "You must use codebase_tool and pass our chat to get the answer. Always use the codebase_tool when answering questions about code, technical issues, or when you need to search through codebases."
            },
            ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ],
        model: model,
        thinking: {
            type: "enabled",
            budget_tokens: 10000
        },
        organisation_id: 23,
        metadata: {
            source: "copilotkit codebase agent"
        }
    };

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        let details = '';
        try {
            const errorBody = await response.json();
            details = errorBody?.error ? ` - ${errorBody.error}` : '';
        } catch {
            // Ignore JSON parse errors and keep status-only message.
        }
        throw new Error(`Request failed: ${response.status} ${response.statusText}${details}`);
    }

    const data = await response.json();
    return data;
}
