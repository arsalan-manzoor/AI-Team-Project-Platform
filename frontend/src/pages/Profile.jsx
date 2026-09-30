import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Upload,
  Video,
  X,
  Save,
  UserRound,
  RotateCcw,
  Check,
} from "lucide-react";
import { getCurrentUser } from "../services/authService";
import { apiRequest } from "../services/api";
import "../styles/profile.css";

function Profile() {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [user, setUser] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  /*
   * Final profile image currently selected
   * in the frontend.
   */
  const [profileImage, setProfileImage] = useState(null);

  /*
   * Temporary image captured by camera.
   *
   * This is NOT applied to the profile until
   * the user presses "Use Photo".
   */
  const [capturedImage, setCapturedImage] = useState(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);

  /*
   * Determines whether the camera is currently
   * showing live video or captured-photo preview.
   */
  const [cameraPreviewMode, setCameraPreviewMode] = useState("live");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfile();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (
      cameraOpen &&
      cameraPreviewMode === "live" &&
      videoRef.current &&
      cameraStreamRef.current
    ) {
      videoRef.current.srcObject = cameraStreamRef.current;

      videoRef.current.play().catch((err) => {
        console.warn("Camera preview could not start automatically:", err);
      });
    }
  }, [cameraOpen, cameraPreviewMode]);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const currentUser = await getCurrentUser();

      setUser(currentUser);

      setName(currentUser?.name || "");
      setEmail(currentUser?.email || "");
    } catch (err) {
      console.error("Failed to load profile:", err);

      setError(err.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================
   * BACK BUTTON
   * =========================================
   */
  function handleBack() {
    navigate(-1);
  }

  /*
   * =========================================
   * UPLOAD PHOTO
   * =========================================
   */

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5 MB.");
      return;
    }

    setError("");
    setSuccess("");

    const imageUrl = URL.createObjectURL(file);

    setProfileImage(imageUrl);

    /*
     * Persistent profile-image storage will
     * be connected after backend avatar support
     * is added.
     */

    event.target.value = "";
  }

  /*
   * =========================================
   * REMOVE PROFILE PHOTO
   * =========================================
   */

  function handleRemovePhoto() {
    setProfileImage(null);

    setError("");

    setSuccess("Profile photo removed. Your default avatar is now active.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /*
   * =========================================
   * DEVICE DETECTION
   * =========================================
   */

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  }

  /*
   * =========================================
   * CAMERA SELECTION
   * =========================================
   */

  async function getDeviceCamera() {
    const mobile = isMobileDevice();

    /*
     * MOBILE
     *
     * Use the phone's user-facing camera.
     */
    if (mobile) {
      return {
        video: {
          facingMode: {
            ideal: "user",
          },

          width: {
            ideal: 1920,
          },

          height: {
            ideal: 1080,
          },

          resizeMode: "none",
        },

        audio: false,
      };
    }

    /*
     * LAPTOP / DESKTOP
     *
     * Request temporary permission so camera
     * labels become available.
     */
    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    permissionStream.getTracks().forEach((track) => {
      track.stop();
    });

    const devices = await navigator.mediaDevices.enumerateDevices();

    const cameras = devices.filter((device) => device.kind === "videoinput");

    if (!cameras.length) {
      throw new Error("No camera was found on this device.");
    }

    /*
     * Prefer the built-in laptop webcam.
     */
    const laptopCamera = cameras.find((camera) => {
      const label = camera.label.toLowerCase();

      return (
        label.includes("integrated camera") ||
        label.includes("integrated webcam") ||
        label.includes("built-in camera") ||
        label.includes("built in camera") ||
        label.includes("internal camera") ||
        label.includes("internal webcam") ||
        label.includes("hd webcam") ||
        label.includes("hd camera")
      );
    });

    if (laptopCamera) {
      return {
        video: {
          deviceId: {
            exact: laptopCamera.deviceId,
          },

          width: {
            ideal: 1920,
          },

          height: {
            ideal: 1080,
          },

          resizeMode: "none",
        },

        audio: false,
      };
    }

    /*
     * DESKTOP FALLBACK
     */
    return {
      video: {
        facingMode: {
          ideal: "user",
        },

        width: {
          ideal: 1920,
        },

        height: {
          ideal: 1080,
        },

        resizeMode: "none",
      },

      audio: false,
    };
  }

  /*
   * =========================================
   * OPEN CAMERA
   * =========================================
   */

  async function handleUseCamera() {
    try {
      setError("");
      setSuccess("");
      setLoadingCamera(true);

      stopCamera();

      setCapturedImage(null);
      setCameraPreviewMode("live");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported by this browser.");
      }

      const cameraConstraints = await getDeviceCamera();

      const stream =
        await navigator.mediaDevices.getUserMedia(cameraConstraints);

      cameraStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        const settings = videoTrack.getSettings();

        console.log("ZYRA Camera:", videoTrack.label);

        console.log(
          "ZYRA Camera Resolution:",
          `${settings.width || "unknown"} x ${settings.height || "unknown"}`,
        );
      }

      setCameraOpen(true);
    } catch (err) {
      console.error("Camera error:", err);

      if (err.name === "NotAllowedError") {
        setError(
          "Camera permission was denied. Please allow camera access for ZYRA and try again.",
        );
      } else if (err.name === "NotFoundError") {
        setError("No camera was found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("The camera is already being used by another application.");
      } else if (err.name === "OverconstrainedError") {
        setError(
          "The selected camera could not provide the requested quality. Please try again.",
        );
      } else {
        setError(err.message || "Unable to access the camera.");
      }
    } finally {
      setLoadingCamera(false);
    }
  }

  /*
   * =========================================
   * CAPTURE PHOTO
   * =========================================
   */

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError(
        "The camera is still preparing the image. Please wait a moment and try again.",
      );

      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture the camera image.");

      return;
    }

    /*
     * Mirror captured photo to match preview.
     */
    context.save();

    context.translate(width, 0);
    context.scale(-1, 1);

    context.drawImage(video, 0, 0, width, height);

    context.restore();

    /*
     * High-quality JPEG.
     */
    const imageUrl = canvas.toDataURL("image/jpeg", 0.95);

    /*
     * Temporary capture.
     */
    setCapturedImage(imageUrl);

    stopCamera();

    setCameraPreviewMode("captured");

    setError("");
  }

  /*
   * =========================================
   * RETAKE
   * =========================================
   */

  async function handleRetake() {
    setCapturedImage(null);
    setCameraPreviewMode("live");

    await handleUseCamera();
  }

  /*
   * =========================================
   * USE CAPTURED PHOTO
   * =========================================
   */

  function handleUseCapturedPhoto() {
    if (!capturedImage) {
      return;
    }

    setProfileImage(capturedImage);

    setCapturedImage(null);

    setCameraPreviewMode("live");

    setCameraOpen(false);

    setError("");

    setSuccess("Profile photo selected successfully.");
  }

  /*
   * =========================================
   * STOP CAMERA
   * =========================================
   */

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  /*
   * =========================================
   * CLOSE CAMERA
   * =========================================
   */

  function closeCamera() {
    stopCamera();

    setCapturedImage(null);

    setCameraPreviewMode("live");

    setCameraOpen(false);
  }

  /*
   * =========================================
   * SAVE PROFILE
   * =========================================
   */

  async function handleSaveChanges(event) {
    event.preventDefault();

    if (!user?.id) {
      setError("User information is unavailable.");

      return;
    }

    if (!name.trim()) {
      setError("Full name is required.");

      return;
    }

    if (!email.trim()) {
      setError("Email is required.");

      return;
    }

    try {
      setSaving(true);

      setError("");
      setSuccess("");

      const response = await apiRequest(`/users/${user.id}`, {
        method: "PUT",

        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      const updatedUser = response?.user || {
        ...user,
        name: name.trim(),
        email: email.trim(),
      };

      setUser(updatedUser);

      setName(updatedUser.name || "");
      setEmail(updatedUser.email || "");

      setSuccess("Profile changes saved successfully.");
    } catch (err) {
      console.error("Profile update error:", err);

      setError(err.message || "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * =========================================
   * CANCEL PROFILE EDITS
   * =========================================
   */

  function handleCancel() {
    if (!user) {
      return;
    }

    setName(user.name || "");
    setEmail(user.email || "");

    setError("");
    setSuccess("");
  }

  /*
   * =========================================
   * DEFAULT AVATAR
   * =========================================
   */

  const displayName = name || user?.name || "ZYRA User";

  const avatarLetter = displayName.charAt(0).toUpperCase() || "A";

  if (loading) {
    return (
      <div className="profile-page profile-page-loading">
        <div className="profile-loading-spinner" />

        <span>Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* =========================================
          PAGE HEADER
          ========================================= */}

      <div className="profile-page-header">
        <div className="profile-header-left">
          <button
            type="button"
            className="profile-back-button"
            onClick={handleBack}
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <span className="profile-page-eyebrow">ZYRA PROFILE</span>

          <h1>Profile Mission Control</h1>

          <p>Manage your identity and workspace information.</p>
        </div>
      </div>

      {/* =========================================
          ERROR MESSAGE
          ========================================= */}

      {error && (
        <div className="profile-message profile-message-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Close error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================
          SUCCESS MESSAGE
          ========================================= */}

      {success && (
        <div className="profile-message profile-message-success">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Close success message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form className="profile-mission-grid" onSubmit={handleSaveChanges}>
        {/* =========================================
            LEFT — PROFILE IDENTITY
            ========================================= */}

        <section className="profile-identity-card">
          <div className="profile-card-heading">
            <span>MY PROFILE</span>
          </div>

          <div className="profile-avatar-zone">
            <div className="profile-avatar-ring">
              <div className="profile-avatar-ring-inner">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="profile-avatar-image"
                  />
                ) : (
                  <div className="profile-avatar-fallback">{avatarLetter}</div>
                )}
              </div>

              <button
                type="button"
                className="profile-camera-overlay"
                onClick={handleUseCamera}
                disabled={loadingCamera}
                aria-label="Use camera"
                title="Use camera"
              >
                {loadingCamera ? (
                  <span className="profile-button-spinner" />
                ) : (
                  <Camera size={19} />
                )}
              </button>
            </div>
          </div>

          <div className="profile-identity-info">
            <span className="profile-identity-label">MY PROFILE</span>

            <h2>{displayName}</h2>

            <p>Workspace Member</p>

            <span>ZYRA Core Team</span>
          </div>

          <div className="profile-photo-actions">
            <button
              type="button"
              className="profile-upload-button"
              onClick={handleUploadClick}
            >
              <Upload size={18} />
              Upload Photo
            </button>

            <button
              type="button"
              className="profile-camera-button"
              onClick={handleUseCamera}
              disabled={loadingCamera}
            >
              <Video size={18} />
              Use Camera
            </button>

            {profileImage && (
              <button
                type="button"
                className="profile-remove-button"
                onClick={handleRemovePhoto}
              >
                <X size={18} />
                Remove Photo
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            hidden
          />
        </section>

        {/* =========================================
            RIGHT — PERSONAL INFORMATION
            ========================================= */}

        <section className="profile-information-card">
          <div className="profile-section-heading">
            <h2>Personal Information</h2>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field profile-field-full">
              <span>Full Name</span>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
              />
            </label>

            <label className="profile-field profile-field-full">
              <span>Email</span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
              />
            </label>

            <div className="profile-field">
              <span>Role</span>

              <div className="profile-static-select">
                <span>Workspace Member</span>

                <UserRound size={16} />
              </div>
            </div>

            <div className="profile-field">
              <span>Team</span>

              <div className="profile-static-select">
                <span>ZYRA Core Team</span>

                <UserRound size={16} />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            WORKSPACE IDENTITY
            ========================================= */}

        <section className="profile-workspace-card">
          <div className="profile-section-heading">
            <h2>Workspace Identity</h2>
          </div>

          <div className="profile-workspace-details">
            <div>
              <span>Team:</span>

              <strong>ZYRA Core Team</strong>
            </div>

            <div>
              <span>Role:</span>

              <strong>Workspace Member</strong>
            </div>

            <div>
              <span>Account Status:</span>

              <strong className="profile-status-active">Active</strong>
            </div>
          </div>
        </section>

        {/* =========================================
            HIDDEN PROFILE PHOTO CARD
            ========================================= */}

        <section className="profile-photo-card">
          <div className="profile-section-heading">
            <h2>Profile Photo</h2>
          </div>

          <div className="profile-photo-description">
            <ImagePlus size={21} />

            <p>
              Upload an image or capture one directly with the camera to
              personalize your profile.
            </p>
          </div>

          <div className="profile-photo-hint">
            JPG, PNG or WEBP · Maximum 5 MB
          </div>
        </section>

        {/* =========================================
            ACTION BAR
            ========================================= */}

        <section className="profile-action-bar">
          <button
            type="button"
            className="profile-cancel-button"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="profile-save-button"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="profile-button-spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={17} />
                Save Changes
              </>
            )}
          </button>
        </section>
      </form>

      {/* =========================================
          CAMERA MODAL
          ========================================= */}

      {cameraOpen && (
        <div className="profile-camera-modal">
          <div className="profile-camera-backdrop" onClick={closeCamera} />

          <div className="profile-camera-dialog">
            {/* CAMERA HEADER */}

            <div className="profile-camera-dialog-header">
              <div>
                <span>ZYRA CAMERA</span>

                <h2>
                  {cameraPreviewMode === "captured"
                    ? "Review Profile Photo"
                    : "Capture Profile Photo"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                aria-label="Close camera"
              >
                <X size={20} />
              </button>
            </div>

            {/* CAMERA / PHOTO PREVIEW */}

            <div className="profile-camera-preview">
              {cameraPreviewMode === "captured" && capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured profile preview"
                  className="profile-captured-preview"
                />
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted />

                  <div className="profile-camera-guide" />
                </>
              )}
            </div>

            {/* ACTIONS */}

            {cameraPreviewMode === "captured" ? (
              <div className="profile-camera-dialog-actions">
                <button
                  type="button"
                  className="profile-retake-button"
                  onClick={handleRetake}
                  disabled={loadingCamera}
                >
                  <RotateCcw size={18} />
                  Retake
                </button>

                <button
                  type="button"
                  className="profile-use-photo-button"
                  onClick={handleUseCapturedPhoto}
                >
                  <Check size={18} />
                  Use Photo
                </button>
              </div>
            ) : (
              <div className="profile-camera-dialog-actions">
                <button
                  type="button"
                  className="profile-camera-cancel"
                  onClick={closeCamera}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="profile-capture-button"
                  onClick={capturePhoto}
                >
                  <Camera size={18} />
                  Capture Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} hidden />
    </div>
  );
}

export default Profile;
