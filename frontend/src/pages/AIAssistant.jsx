import {
  Sparkles,
  Send,
  FolderKanban,
  CheckSquare,
  BarChart3,
} from "lucide-react";

function AIAssistant() {
  return (
    <div className="zyra-ai-page">
      <div className="ai-page-header">
        <div className="ai-page-title">
          <div className="ai-page-icon">
            <Sparkles size={21} />
          </div>

          <div>
            <p className="ai-page-eyebrow">INTELLIGENT WORKSPACE</p>
            <h2>ZYRA AI Assistant</h2>
            <p>Ask questions and get intelligent help with your projects.</p>
          </div>
        </div>

        <div className="ai-status">
          <span className="ai-status-dot"></span>
          AI Assistant
        </div>
      </div>

      <section className="ai-chat-panel">
        <div className="ai-chat-content">
          <div className="ai-welcome">
            <div className="ai-welcome-icon">
              <Sparkles size={25} />
            </div>

            <h3>How can I help with your project?</h3>

            <p>
              ZYRA AI will eventually understand your project context and help
              you track progress, understand tasks, summarize information, and
              make intelligent recommendations.
            </p>
          </div>

          <div className="ai-suggestions">
            <button className="ai-suggestion">
              <FolderKanban size={17} />
              <div>
                <strong>Summarize my project</strong>
                <span>Get a quick overview of project progress.</span>
              </div>
            </button>

            <button className="ai-suggestion">
              <CheckSquare size={17} />
              <div>
                <strong>What tasks need attention?</strong>
                <span>Identify pending or delayed work.</span>
              </div>
            </button>

            <button className="ai-suggestion">
              <BarChart3 size={17} />
              <div>
                <strong>Analyze project progress</strong>
                <span>Understand how your project is progressing.</span>
              </div>
            </button>
          </div>
        </div>

        <div className="ai-input-area">
          <div className="ai-input-wrapper">
            <input type="text" placeholder="Ask ZYRA about your project..." />

            <button className="ai-send-btn">
              <Send size={17} />
            </button>
          </div>

          <p className="ai-input-note">
            ZYRA AI will use your authorized project information to provide
            relevant assistance.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AIAssistant;
