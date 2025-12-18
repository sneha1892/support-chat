// API service for Lambda communication

const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL;
const API_KEY = import.meta.env.VITE_ORCA_API_KEY;

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
        organisation_id: 13,
        metadata: {
            source: "copilotkit codebase agent"
        }
    };

    const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-orca-api-key': API_KEY
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Lambda request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}
