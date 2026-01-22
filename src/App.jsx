import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { sendMessage } from './api'
import {
  getThreads,
  createThread,
  deleteThread,
  addMessageToThread,
  getThread
} from './storage'
import './index.css'

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini-3-flash' },
  { id: 'gpt-5', name: 'GPT-5' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' }
]

// Markdown code block renderer
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    return !inline && match ? (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{
          margin: '8px 0',
          borderRadius: '8px',
          fontSize: '0.85rem'
        }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
}

function App() {
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [inputMessage, setInputMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-4.1')
  const [loadingThreads, setLoadingThreads] = useState({})
  const [pendingRequests, setPendingRequests] = useState({})
  const [error, setError] = useState(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const isLoading = activeThreadId ? loadingThreads[activeThreadId] : false
  const pendingRequest = activeThreadId ? pendingRequests[activeThreadId] : null

  // Filter threads by title
  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Load threads on mount
  useEffect(() => {
    const savedThreads = getThreads()
    setThreads(savedThreads)
    if (savedThreads.length > 0) {
      setActiveThreadId(savedThreads[0].id)
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threads, activeThreadId])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [inputMessage])

  // Update elapsed time
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const hasAnyPending = Object.keys(pendingRequests).length > 0
    if (hasAnyPending) {
      const interval = setInterval(() => forceUpdate(n => n + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [pendingRequests])

  const activeThread = threads.find(t => t.id === activeThreadId)

  // Global message search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    const query = searchQuery.toLowerCase()
    const results = []

    threads.forEach(thread => {
      thread.messages.forEach(message => {
        if (message.content.toLowerCase().includes(query)) {
          results.push({
            threadId: thread.id,
            threadTitle: thread.title,
            messageId: message.id,
            role: message.role,
            content: message.content,
            preview: getMatchPreview(message.content, query)
          })
        }
      })
    })

    setSearchResults(results)
    setIsSearching(false)
  }

  // Get preview with highlighted match
  const getMatchPreview = (content, query) => {
    const index = content.toLowerCase().indexOf(query)
    const start = Math.max(0, index - 30)
    const end = Math.min(content.length, index + query.length + 50)
    let preview = content.slice(start, end)
    if (start > 0) preview = '...' + preview
    if (end < content.length) preview = preview + '...'
    return preview
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    } else if (e.key === 'Escape') {
      setSearchResults(null)
      setSearchQuery('')
    }
  }

  const handleSearchResultClick = (threadId) => {
    setActiveThreadId(threadId)
    setSearchResults(null)
    setError(null)
  }

  const handleNewChat = () => {
    const newThread = createThread()
    setThreads([newThread, ...threads])
    setActiveThreadId(newThread.id)
    setError(null)
    setSearchResults(null)
  }

  const handleSelectThread = (threadId) => {
    setActiveThreadId(threadId)
    setError(null)
    setSearchResults(null)
  }

  const handleDeleteThread = (e, threadId) => {
    e.stopPropagation()
    const remaining = deleteThread(threadId)
    setThreads(remaining)
    if (activeThreadId === threadId) {
      setActiveThreadId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const messageContent = inputMessage.trim()
    const modelToUse = selectedModel
    setInputMessage('')
    setError(null)

    let currentThreadId = activeThreadId

    if (!currentThreadId) {
      const newThread = createThread()
      setThreads(prev => [newThread, ...prev])
      currentThreadId = newThread.id
      setActiveThreadId(currentThreadId)
    }

    const userMessage = { role: 'user', content: messageContent, model: modelToUse }
    const updatedThread = addMessageToThread(currentThreadId, userMessage)
    setThreads(prev => prev.map(t => t.id === currentThreadId ? updatedThread : t))

    setLoadingThreads(prev => ({ ...prev, [currentThreadId]: true }))

    const currentThread = getThread(currentThreadId)
    const messagesForApi = currentThread.messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    const requestPayload = {
      messages: [
        {
          role: "system",
          content: "You must use codebase_tool and pass our chat to get the answer. Always use the codebase_tool when answering questions about code, technical issues, or when you need to search through codebases."
        },
        ...messagesForApi
      ],
      model: modelToUse,
      thinking: { type: "enabled", budget_tokens: 10000 },
      organisation_id: 13,
      metadata: { source: "copilotkit codebase agent" }
    }

    setPendingRequests(prev => ({
      ...prev,
      [currentThreadId]: {
        model: modelToUse,
        messageCount: messagesForApi.length,
        payload: requestPayload,
        startTime: Date.now()
      }
    }))

    console.group(`🚀 Lambda Request - Thread: ${currentThreadId.slice(0, 8)}...`)
    console.log('Model:', modelToUse)
    console.log('Messages in context:', messagesForApi.length)
    console.log('Full Payload:', JSON.stringify(requestPayload, null, 2))
    console.groupEnd()

    try {
      const response = await sendMessage(messagesForApi, modelToUse)

      console.group(`✅ Lambda Response - Thread: ${currentThreadId.slice(0, 8)}...`)
      console.log('Output:', response.output?.slice(0, 200) + '...')
      console.log('Time taken:', response.time_taken_seconds, 'seconds')
      console.log('Token usage:', response.usage)
      console.log('Full response:', response)
      console.groupEnd()

      const assistantMessage = {
        role: 'assistant',
        content: response.output || 'No response received',
        model: modelToUse,
        usage: response.usage,
        timeTaken: response.time_taken_seconds
      }
      const finalThread = addMessageToThread(currentThreadId, assistantMessage)
      setThreads(prev => prev.map(t => t.id === currentThreadId ? finalThread : t))

    } catch (err) {
      console.group(`❌ Lambda Error - Thread: ${currentThreadId.slice(0, 8)}...`)
      console.error('Error:', err)
      console.groupEnd()
      setError(err.message || 'Failed to get response from Lambda')
    } finally {
      setLoadingThreads(prev => ({ ...prev, [currentThreadId]: false }))
      setPendingRequests(prev => {
        const newState = { ...prev }
        delete newState[currentThreadId]
        return newState
      })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatElapsedTime = (startTime) => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    return `${elapsed}s`
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">Support Chat</h1>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
        </div>

        {/* Search Box */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search threads & messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && (
            <button className="search-btn" onClick={handleSearch}>
              Search All
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchResults && (
          <div className="search-results">
            <div className="search-results-header">
              <span>{searchResults.length} result(s) found</span>
              <button onClick={() => setSearchResults(null)}>✕</button>
            </div>
            <div className="search-results-list">
              {searchResults.length === 0 ? (
                <p className="no-results">No messages match your search</p>
              ) : (
                searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="search-result-item"
                    onClick={() => handleSearchResultClick(result.threadId)}
                  >
                    <div className="search-result-thread">{result.threadTitle}</div>
                    <div className="search-result-role">{result.role}</div>
                    <div className="search-result-preview">{result.preview}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="thread-list">
          {filteredThreads.map(thread => (
            <div
              key={thread.id}
              className={`thread-item ${thread.id === activeThreadId ? 'active' : ''}`}
              onClick={() => handleSelectThread(thread.id)}
            >
              <span className="thread-title">
                {loadingThreads[thread.id] && '⏳ '}
                {thread.title}
              </span>
              <button
                className="thread-delete-btn"
                onClick={(e) => handleDeleteThread(e, thread.id)}
                title="Delete thread"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                </svg>
              </button>
            </div>
          ))}

          {filteredThreads.length === 0 && searchQuery && (
            <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No threads match "{searchQuery}"
              </p>
            </div>
          )}

          {threads.length === 0 && (
            <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No conversations yet
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeThread ? (
          <>
            <header className="chat-header">
              <h2>
                {activeThread.title}
                {isLoading && <span className="loading-badge">Fetching...</span>}
              </h2>
            </header>

            <div className="messages-container">
              {activeThread.messages.map(message => (
                <div key={message.id} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={MarkdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {message.role === 'assistant' && message.timeTaken && (
                      <p className="message-meta">
                        ⏱️ {message.timeTaken.toFixed(1)}s | Model: {message.model}
                      </p>
                    )}
                    {message.role === 'user' && message.model && (
                      <p className="message-meta-user">
                        Model: {message.model}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && pendingRequest && (
                <div className="message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content pending-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="pending-info">
                      <p><strong>⏳ Waiting for Lambda response...</strong></p>
                      <p>Elapsed: {formatElapsedTime(pendingRequest.startTime)}</p>
                      <p>Model: {pendingRequest.model}</p>
                      <p>Messages in context: {pendingRequest.messageCount}</p>
                      <details className="payload-details">
                        <summary>View Request Payload</summary>
                        <pre>{JSON.stringify(pendingRequest.payload, null, 2)}</pre>
                      </details>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="input-area">
              <div className="input-wrapper">
                <div className="input-container">
                  <div className="model-selector">
                    <label>Model:</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {MODELS.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="message-input"
                    placeholder="Type your message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isLoading}
                  />
                </div>
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  title="Send message"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h3>Welcome to Support Chat</h3>
            <p>Start a new conversation to ask questions. Your chats will be saved locally.</p>
            <button className="new-chat-btn" onClick={handleNewChat} style={{ marginTop: '20px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Start New Chat
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
