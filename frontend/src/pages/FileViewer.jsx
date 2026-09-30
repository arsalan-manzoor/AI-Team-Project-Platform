import { ArrowLeft, FileText, Download } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/file-viewer.css";

function FileViewer() {
  const navigate = useNavigate();
  const location = useLocation();

  const { fileUrl, fileName, projectId } = location.state || {};

  if (!fileUrl) {
    return (
      <div className="zyra-file-viewer">
        <div className="file-viewer-empty">
          <FileText size={42} />

          <h2>File Not Available</h2>

          <p>The file information could not be loaded.</p>

          <button
            type="button"
            className="file-viewer-back-button"
            onClick={() => navigate(`/projects/${projectId || ""}`)}
          >
            <ArrowLeft size={18} />
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  const extension = fileName?.split(".").pop()?.toLowerCase();

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];

  const isImage = imageExtensions.includes(extension);

  return (
    <div className="zyra-file-viewer">
      {/* =====================================================
          TOPBAR
      ===================================================== */}

      <div className="file-viewer-topbar">
        <button
          type="button"
          className="file-viewer-back-button"
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          <ArrowLeft size={18} />
          Back to Project
        </button>

        <div className="file-viewer-file-name">
          <FileText size={18} />
          <span>{fileName || "Project File"}</span>
        </div>

        <a
          href={fileUrl}
          download={fileName || true}
          className="file-viewer-download-button"
        >
          <Download size={17} />
          Download
        </a>
      </div>

      {/* =====================================================
          FILE CONTENT
      ===================================================== */}

      <main className="file-viewer-content">
        {isImage ? (
          <div className="file-viewer-image-container">
            <img
              src={fileUrl}
              alt={fileName || "Project File"}
              className="file-viewer-image"
            />
          </div>
        ) : (
          <iframe
            src={fileUrl}
            title={fileName || "Project File"}
            className="file-viewer-frame"
          />
        )}
      </main>
    </div>
  );
}

export default FileViewer;
