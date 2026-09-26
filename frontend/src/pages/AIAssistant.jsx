import { useState } from "react";
import { Sparkles, Send, Mic, Trash2 } from "lucide-react";
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

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    handleSend(action);
  };

  const handleClearConversation = () => {
    setMessages([]);
    setQuestion("");
    setIsThinking(false);
  };

  return (
    <div className="zyra-ai-page">
      {/* Page Header */}
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

      {/* Main Chat */}
      <div className="ai-chat-container">
        {/* Chat Header */}
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
              disabled={isThinking}
            >
              <Trash2 size={15} />
              <span>Clear conversation</span>
            </button>
          )}
        </div>

        {/* Messages */}
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
                </div>
              ))}

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

        {/* Composer */}
        <div className="ai-chat-composer">
          <div className="ai-composer-box">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ZYRA anything..."
              disabled={isThinking}
            />

            <button
              type="button"
              className="ai-composer-button"
              aria-label="Voice input"
              disabled={isThinking}
            >
              <Mic size={18} />
            </button>

            <button
              type="button"
              className="ai-composer-button ai-send-button"
              aria-label="Send message"
              onClick={() => handleSend()}
              disabled={!question.trim() || isThinking}
            >
              <Send size={17} />
            </button>
          </div>

          <div className="ai-composer-footer">
            <span className="ai-composer-hint">Press Enter to send</span>

            <span className="ai-composer-hint">ZYRA AI Assistant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
