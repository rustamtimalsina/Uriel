import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  listChatSessions,
  createChatSession,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
} from "../../services/api";
import "./AskAI.css";

function formatMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gim, '<h4 style="margin: 0.9rem 0 0.5rem 0; font-size: 1.05rem; color: #f8fafc; font-weight: 700;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>')
    .replace(/^[-*] (.*$)/gim, '<div style="margin: 0.45rem 0; padding: 0.45rem 0.85rem; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #818cf8; border-radius: 4px; color: #e2e8f0;">$1</div>')
    .replace(/\*(.*?)\*/g, '<em style="color: #94a3b8;">$1</em>')
    .replace(/\n\n/g, '<br/>');
}

const SAMPLE_PROMPTS = [
  "Summarize Rustam's technical skills and stack",
  "What are the benefits of crop diversity?",
  "What are active learning strategies in education?",
  "Extract key agricultural conclusions across documents",
];

export default function AskAI() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const tempIdCounter = useRef(1);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNewChat = useCallback(() => {
    return createChatSession("New Conversation").then((res) => {
      const newSession = res.data;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setActiveSession(newSession);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, []);

  const loadSessionDetail = useCallback((sessionId) => {
    return getChatSession(sessionId)
      .then((res) => {
        setActiveSession(res.data);
        setTimeout(scrollToBottom, 60);
      })
      .catch(() => {});
  }, []);

  const loadSessions = useCallback((selectLatest = true) => {
    return listChatSessions()
      .then((res) => {
        const list = res.data || [];
        setSessions(list);
        if (list.length > 0) {
          const targetId = selectLatest ? list[0].id : activeSessionId;
          setActiveSessionId(targetId);
          return loadSessionDetail(targetId);
        } else {
          return handleNewChat();
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [activeSessionId, handleNewChat, loadSessionDetail]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    loadSessionDetail(sessionId);
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    deleteChatSession(sessionId).then(() => {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    });
  };

  const handleSend = (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || !activeSessionId || loading) return;

    tempIdCounter.current += 1;
    const tempId = -tempIdCounter.current;
    const userMsg = {
      id: tempId,
      session_id: activeSessionId,
      role: "user",
      content: text,
      sources: [],
      created_at: new Date().toISOString(),
    };

    // Optimistically update UI
    setActiveSession((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), userMsg],
    }));
    setInputMessage("");
    setLoading(true);
    setTimeout(scrollToBottom, 50);

    sendChatMessage(activeSessionId, { content: text, top_k: 3 })
      .then((res) => {
        const assistantMsg = res.data;
        setActiveSession((prev) => ({
          ...prev,
          messages: [...(prev?.messages || []).filter((m) => m.id !== tempId), userMsg, assistantMsg],
        }));
        listChatSessions().then((sRes) => setSessions(sRes.data || []));
      })
      .catch((err) => {
        tempIdCounter.current += 1;
        const errorMsg = {
          id: -tempIdCounter.current,
          session_id: activeSessionId,
          role: "assistant",
          content: `⚠️ Error querying local AI: ${err.response?.data?.detail || err.message}`,
          sources: [],
          created_at: new Date().toISOString(),
        };
        setActiveSession((prev) => ({
          ...prev,
          messages: [...(prev?.messages || []), errorMsg],
        }));
      })
      .finally(() => {
        setLoading(false);
        setTimeout(scrollToBottom, 60);
      });
  };

  const handleCopyMessage = (msgId, content) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportMarkdown = () => {
    if (!activeSession?.messages?.length) return;
    const lines = [`# ${activeSession.title}\n`];
    activeSession.messages.forEach((m) => {
      const role = m.role === "user" ? "### User" : "### Uriel AI";
      lines.push(`${role}\n${m.content}\n`);
      if (m.sources && m.sources.length > 0) {
        lines.push("**Sources:**");
        m.sources.forEach((s, idx) => lines.push(`- [${idx + 1}] ${s.title} (${s.path})`));
        lines.push("");
      }
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (initialLoading) {
    return <p className="status-message">Loading conversation threads...</p>;
  }

  const messages = activeSession?.messages || [];

  return (
    <div className="chat-layout-wrapper">
      {/* Left Sidebar: Threads */}
      <aside className="chat-sidebar">
        <button
          type="button"
          className="chat-new-btn"
          onClick={handleNewChat}
        >
          + New Chat
        </button>

        <div className="chat-threads-list">
          <span className="threads-heading">Previous Conversations</span>
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-thread-item ${s.id === activeSessionId ? "is-active" : ""}`}
              onClick={() => handleSelectSession(s.id)}
            >
              <div className="thread-meta">
                <span className="thread-title">{s.title}</span>
                <span className="thread-date">
                  {new Date(s.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </div>
              <button
                type="button"
                className="thread-delete-btn"
                title="Delete thread"
                onClick={(e) => handleDeleteSession(s.id, e)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Conversation Canvas */}
      <main className="chat-canvas">
        <div className="chat-canvas-header">
          <div className="canvas-header-info">
            <h2 className="canvas-header-title">{activeSession?.title || "Conversation"}</h2>
            <span className="canvas-header-badge">Llama 3.2 • Local Zero-Cloud</span>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              className="chat-export-btn"
              onClick={handleExportMarkdown}
              title="Download conversation as Markdown"
            >
              📥 Export Markdown
            </button>
          )}
        </div>

        {/* Message Stream */}
        <div className="chat-messages-stream">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="empty-sparkle">✦</div>
              <h3>What would you like to explore in your documents?</h3>
              <p>Ask questions, request summaries, or compare concepts across your indexed knowledge vault.</p>

              <div className="empty-prompts-grid">
                {SAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="empty-prompt-card"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt} ↗
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`chat-message-row ${m.role === "user" ? "is-user" : "is-assistant"}`}
              >
                <div className="message-avatar">
                  {m.role === "user" ? "👤" : "✦"}
                </div>

                <div className="message-bubble">
                  <div className="message-bubble-header">
                    <span className="message-role">
                      {m.role === "user" ? "You" : "Uriel AI"}
                    </span>
                    <button
                      type="button"
                      className="msg-copy-btn"
                      onClick={() => handleCopyMessage(m.id, m.content)}
                      title="Copy content"
                    >
                      {copiedId === m.id ? "✓ Copied" : "📋"}
                    </button>
                  </div>

                  <div
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }}
                  />

                  {m.sources && m.sources.length > 0 && (
                    <div className="message-sources-box">
                      <span className="sources-label">Referenced Sources:</span>
                      <div className="sources-pills-row">
                        {m.sources.map((src, idx) => (
                          <Link
                            key={src.doc_id || idx}
                            to={`/document/${src.doc_id}`}
                            className="source-pill-link"
                            title={src.path}
                          >
                            [{idx + 1}] {src.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="chat-message-row is-assistant">
              <div className="message-avatar">✦</div>
              <div className="message-bubble thinking-bubble">
                <span className="thinking-dots">Synthesizing answer with Llama 3.2</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="chat-input-field"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message or follow-up question..."
            disabled={loading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={loading || !inputMessage.trim()}
          >
            Send ↵
          </button>
        </form>
      </main>
    </div>
  );
}
