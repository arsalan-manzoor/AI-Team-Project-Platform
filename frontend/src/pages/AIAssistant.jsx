import { useState } from "react";
import { Sparkles, Send, Mic, Trash2, Pencil, X } from "lucide-react";
import "../styles/ai-assistant.css";

const quickActions = [
  "Show my active projects",
  "What tasks are overdue?",
  "Summarize my workspace",
  "Show my team activity",
];

function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);

  // Stores the ID of the user message currently being edited
  const [editingMessageId, setEditingMessageId] = useState(null);

  const generateLocalResponse = (input) => {
    const text = input.toLowerCase();

    if (text.includes("project") || text.includes("projects")) {
      return "I can help you work with your projects. You can use the Projects section to view your current projects, their progress, and related tasks.";
    }

    if (
      text.includes("task") ||
      text.includes("tasks") ||
      text.includes("overdue")
    ) {
      return "I can help you understand your tasks, including active, completed, and overdue work. Open the Tasks section to view the latest task information.";
    }

    if (text.includes("team") || text.includes("teams")) {
      return "I can help you understand your teams and collaboration workspace. You can view team members, projects, and team-related activity from the Teams section.";
    }

    if (text.includes("activity") || text.includes("recent")) {
      return "Your workspace activity can be reviewed through the relevant projects, tasks, teams, and notifications sections.";
    }

    if (text.includes("summary") || text.includes("summarize")) {
      return "Your ZYRA workspace brings together projects, tasks, teams, and activity in one place. I can help you navigate and understand each part of your workspace.";
    }

    if (text.includes("hello") || text.includes("hi") || text.includes("hey")) {
      return "Hey! 👋 I'm your ZYRA AI Assistant. Ask me anything about your workspace.";
    }

    return "I'm your ZYRA AI Assistant. I can help you understand your projects, tasks, teams, and workspace activity. Try asking me something specific.";
  };

  // =========================================================
  // NORMAL MESSAGE SEND
  // =========================================================

  const handleSend = (message = question) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isThinking) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: trimmedMessage,
    };

    setMessages((previous) => [...previous, userMessage]);

    setQuestion("");
    setIsThinking(true);

    setTimeout(() => {
      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: generateLocalResponse(trimmedMessage),
      };

      setMessages((previous) => [...previous, assistantMessage]);

      setIsThinking(false);
    }, 900);
  };

  // =========================================================
  // KEYBOARD HANDLING
  // =========================================================

  const handleKeyDown = (event) => {
    // Escape cancels editing
    if (event.key === "Escape" && editingMessageId !== null) {
      event.preventDefault();
      handleCancelEdit();
      return;
    }

    // Enter sends / saves
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (editingMessageId !== null) {
        handleSaveEdit(editingMessageId);
      } else {
        handleSend();
      }
    }
  };

  // =========================================================
  // QUICK ACTIONS
  // =========================================================

  const handleQuickAction = (action) => {
    handleSend(action);
  };

  // =========================================================
  // CLEAR CONVERSATION
  // =========================================================

  const handleClearConversation = () => {
    setMessages([]);
    setQuestion("");
    setIsThinking(false);
    setEditingMessageId(null);
  };

  // =========================================================
  // START EDITING
  // =========================================================

  const handleStartEdit = (message) => {
    if (isThinking) {
      return;
    }

    setEditingMessageId(message.id);
    setQuestion(message.content);
  };

  // =========================================================
  // CANCEL EDITING
  // =========================================================

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setQuestion("");
  };

  // =========================================================
  // SAVE EDITED MESSAGE
  // =========================================================

  const handleSaveEdit = (messageId) => {
    const trimmedText = question.trim();

    if (!trimmedText || isThinking) {
      return;
    }

    const messageIndex = messages.findIndex(
      (message) => message.id === messageId,
    );

    if (messageIndex === -1) {
      return;
    }

    /*
     * Keep everything before the edited user message.
     * The edited message becomes the last user message.
     *
     * This also removes the old assistant response that
     * belonged to the previous version of the message.
     */
    const updatedMessages = messages.slice(0, messageIndex);

    const editedUserMessage = {
      ...messages[messageIndex],
      content: trimmedText,
    };

    updatedMessages.push(editedUserMessage);

    setMessages(updatedMessages);

    setEditingMessageId(null);
    setQuestion("");
    setIsThinking(true);

    // Generate a fresh response for the edited message
    setTimeout(() => {
      const assistantMessage = {
        id: Date.now(),
        role: "assistant",
        content: generateLocalResponse(trimmedText),
      };

      setMessages((previous) => [...previous, assistantMessage]);

      setIsThinking(false);
    }, 900);
  };

  return (
    <div className="zyra-ai-page">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <div className="ai-page-header">
        <div className="ai-page-title">
          <div className="ai-page-title-icon">
            <Sparkles size={21} />
          </div>

          <div>
            <h1>AI Assistant</h1>
            <p>Ask ZYRA about your workspace</p>
          </div>
        </div>

        <div className="ai-status">
          <span className="ai-status-dot"></span>
          AI Online
        </div>
      </div>

      {/* =====================================================
          MAIN CHAT
          ===================================================== */}

      <div className="ai-chat-container">
        {/* ===================================================
            CHAT HEADER
            =================================================== */}

        <div className="ai-chat-header">
          <div className="ai-chat-header-left">
            <div className="ai-chat-avatar">
              <Sparkles size={18} />
            </div>

            <div>
              <h2>ZYRA AI Assistant</h2>
              <span>Workspace intelligence</span>
            </div>
          </div>

          {/* Clear Conversation */}
          {messages.length > 0 && (
            <button
              type="button"
              className="ai-clear-button"
              onClick={handleClearConversation}
              disabled={isThinking || editingMessageId !== null}
            >
              <Trash2 size={15} />
              <span>Clear conversation</span>
            </button>
          )}
        </div>

        {/* ===================================================
            MESSAGES
            =================================================== */}

        <div className="ai-chat-messages">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">
                <Sparkles size={28} />
              </div>

              <h2>How can I help you?</h2>

              <p>
                Ask me about your projects, tasks, teams, or anything related to
                your ZYRA workspace.
              </p>

              <div className="ai-quick-actions">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="ai-quick-action"
                    onClick={() => handleQuickAction(action)}
                    disabled={isThinking}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`ai-message ${message.role}`}>
                  <div className="ai-message-bubble">{message.content}</div>

                  {/* Edit button only for user messages */}
                  {message.role === "user" && (
                    <button
                      type="button"
                      className={`ai-message-edit-button ${
                        editingMessageId === message.id ? "active" : ""
                      }`}
                      onClick={() => handleStartEdit(message)}
                      disabled={isThinking}
                      aria-label="Edit message"
                      title="Edit message"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className="ai-message assistant">
                  <div className="ai-thinking">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ===================================================
            MAIN COMPOSER
            =================================================== */}

        <div className="ai-chat-composer">
          <div
            className={`ai-composer-box ${
              editingMessageId !== null ? "editing" : ""
            }`}
          >
            {/* Cancel edit button */}
            {editingMessageId !== null && (
              <button
                type="button"
                className="ai-composer-cancel-edit"
                onClick={handleCancelEdit}
                disabled={isThinking}
                aria-label="Cancel editing"
                title="Cancel editing"
              >
                <X size={17} />
              </button>
            )}

            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessageId !== null
                  ? "Edit your message..."
                  : "Ask ZYRA anything..."
              }
              disabled={isThinking}
            />

            <button
              type="button"
              className="ai-composer-button"
              aria-label="Voice input"
              disabled={isThinking || editingMessageId !== null}
            >
              <Mic size={18} />
            </button>

            <button
              type="button"
              className="ai-composer-button ai-send-button"
              aria-label={
                editingMessageId !== null
                  ? "Save edited message"
                  : "Send message"
              }
              onClick={() => {
                if (editingMessageId !== null) {
                  handleSaveEdit(editingMessageId);
                } else {
                  handleSend();
                }
              }}
              disabled={!question.trim() || isThinking}
            >
              <Send size={17} />
            </button>
          </div>

          <div className="ai-composer-footer">
            <span className="ai-composer-hint">
              {editingMessageId !== null
                ? "Press Enter to save • Esc to cancel"
                : "Press Enter to send"}
            </span>

            <span className="ai-composer-hint">ZYRA AI Assistant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
