import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Fingerprint,
  ImagePlus,
  LockKeyhole,
  Pencil,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";

import { getCurrentUser } from "../services/authService";
import { apiRequest } from "../services/api";
import "../styles/profile.css";

const EMPTY_PROFILE = {
  name: "",
  username: "",
  email: "",
  mobile_number: "",
  date_of_birth: "",
};

const PROFILE_SECTIONS = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Manage your name, username, email and personal details.",
    icon: UserRound,
    number: "01",
  },
  {
    id: "photo",
    title: "Profile Photo",
    description: "Upload an image or take a photo using your camera.",
    icon: ImagePlus,
    number: "02",
  },
  {
    id: "workspace",
    title: "Workspace Identity",
    description: "View your account role, status and membership details.",
    icon: Fingerprint,
    number: "03",
  },
  {
    id: "security",
    title: "Privacy & Password",
    description: "Manage your password and account security.",
    icon: LockKeyhole,
    number: "04",
  },
];

function getProfileForm(user) {
  return {
    name: user?.name || "",
    username: user?.username || "",
    email: user?.email || "",
    mobile_number: user?.mobile_number || "",
    date_of_birth: user?.date_of_birth
      ? String(user.date_of_birth).slice(0, 10)
      : "",
  };
}

function getLocalDateString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMemberSince(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getRoleLabel(role) {
  const roles = {
    ADMIN: "Administrator",
    HR: "Human Resources",
    TEAM_LEADER: "Team Leader",
    USER: "Team Member",
  };

  return roles[role] || role || "Workspace Member";
}

function getAccountStatus(user) {
  return user?.status || user?.account_status || "Active";
}

function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const profileObjectUrlRef = useRef(null);

  const [user, setUser] = useState(null);

  const [form, setForm] = useState(EMPTY_PROFILE);
  const [draftForm, setDraftForm] = useState(EMPTY_PROFILE);

  /*
   * PASSWORD URL SUPPORT
   *
   * Login.jsx navigates to:
   * /profile?section=password
   *
   * The existing Privacy & Password section opens automatically.
   */
  const [activeSection, setActiveSection] = useState(() =>
    searchParams.get("section") === "password" ? "security" : null,
  );

  // One global Edit Profile mode, only for Personal Information.
  const [isEditing, setIsEditing] = useState(false);

  const [profileImage, setProfileImage] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [cameraPreviewMode, setCameraPreviewMode] = useState("live");

  // Password values.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /*
   * Each password field has its own visibility state.
   */
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * STRICT PASSWORD REQUIREMENT CHECK
   *
   * Only the actual boolean value true triggers the
   * mandatory initial-password workflow.
   */
  const mustChangePassword =
    user?.must_change_password === true || user?.mustChangePassword === true;

  const activeSectionInfo = PROFILE_SECTIONS.find(
    (section) => section.id === activeSection,
  );

  /*
   * LOAD PROFILE
   */
  useEffect(() => {
    loadProfile();

    return () => {
      stopCamera();

      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
        profileObjectUrlRef.current = null;
      }
    };
  }, []);

  /*
   * HANDLE DIRECT PASSWORD-SECTION NAVIGATION
   *
   * Also supports entering the password URL while Profile
   * is already mounted.
   */
  useEffect(() => {
    if (searchParams.get("section") === "password") {
      setActiveSection("security");
      setIsEditing(false);
    }
  }, [searchParams]);

  /*
   * CONNECT THE CAMERA PREVIEW
   */
  useEffect(() => {
    if (
      cameraOpen &&
      cameraPreviewMode === "live" &&
      videoRef.current &&
      cameraStreamRef.current
    ) {
      videoRef.current.srcObject = cameraStreamRef.current;

      videoRef.current.play().catch((err) => {
        console.warn("Camera preview could not start:", err);
      });
    }
  }, [cameraOpen, cameraPreviewMode]);

  /*
   * LOAD ACCOUNT DETAILS
   */
  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const result = await getCurrentUser();

      const currentUser = result?.user || result?.data?.user || result;

      if (!currentUser?.id) {
        throw new Error("Unable to identify the signed-in user.");
      }

      const currentForm = getProfileForm(currentUser);

      setUser(currentUser);
      setForm(currentForm);
      setDraftForm(currentForm);
      setProfileImage(currentUser.profile_image_url || null);

      /*
       * If an account still requires its initial password
       * change, open the security page even if the user
       * reached Profile without the query parameter.
       */
      if (
        currentUser.must_change_password === true ||
        currentUser.mustChangePassword === true
      ) {
        setActiveSection("security");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError(err.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // PAGE NAVIGATION
  // =========================================================

  function handleBack() {
    /*
     * Mandatory password change cannot be bypassed by
     * leaving the Password section.
     */
    if (mustChangePassword) {
      setActiveSection("security");
      setError(
        "Change your initial password before leaving this security page.",
      );
      return;
    }

    navigate(-1);
  }

  function handleOpenSection(sectionId) {
    if (mustChangePassword && sectionId !== "security") {
      setError(
        "You must change your initial password before accessing other settings.",
      );
      return;
    }

    if (isEditing) {
      setError("Save or cancel your profile changes before leaving this page.");
      return;
    }

    setError("");
    setSuccess("");
    setActiveSection(sectionId);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBackToSettings() {
    if (mustChangePassword) {
      setError(
        "Change your initial password before leaving this security page.",
      );
      return;
    }

    if (isEditing) {
      setError("Save or cancel your profile changes before leaving this page.");
      return;
    }

    setError("");
    setSuccess("");
    setActiveSection(null);

    /*
     * Clear the query parameter so that returning to
     * /profile does not keep reopening the Password section.
     */
    navigate("/profile", { replace: true });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // =========================================================
  // PERSONAL INFORMATION
  // =========================================================

  function handleEditProfile() {
    setDraftForm({ ...form });
    setIsEditing(true);
    setError("");
    setSuccess("");
  }

  function handleCancelProfileEdit() {
    setDraftForm({ ...form });
    setIsEditing(false);
    setError("");
    setSuccess("");
  }

  function handleProfileFieldChange(field, value) {
    setDraftForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSaveProfile() {
    if (!user?.id) {
      setError("User information is unavailable.");
      return;
    }

    if (!draftForm.name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftForm.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    const username = draftForm.username.trim();

    if (username && !/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
      setError(
        "Username must be 3–30 characters and contain only letters, numbers, dots, underscores or hyphens.",
      );
      return;
    }

    if (draftForm.date_of_birth) {
      if (draftForm.date_of_birth > getLocalDateString()) {
        setError("Date of birth cannot be in the future.");
        return;
      }
    }

    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      // Mobile is deliberately excluded until OTP verification exists.
      const payload = {
        name: draftForm.name.trim(),
        username: username || null,
        email: draftForm.email.trim(),
        date_of_birth: draftForm.date_of_birth || null,
      };

      const response = await apiRequest(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const updatedUser = response?.user
        ? { ...user, ...response.user }
        : { ...user, ...payload };

      const updatedForm = getProfileForm(updatedUser);

      setUser(updatedUser);
      setForm(updatedForm);
      setDraftForm(updatedForm);
      setIsEditing(false);

      setSuccess("Personal information updated successfully.");
    } catch (err) {
      console.error("Profile update error:", err);
      setError(err.message || "Unable to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  // =========================================================
  // PROFILE PHOTO
  // =========================================================

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
    }

    profileObjectUrlRef.current = imageUrl;

    setProfileImage(imageUrl);
    setError("");
    setSuccess(
      "Photo preview updated. Permanent photo storage is not connected yet.",
    );

    event.target.value = "";
  }

  function replacePreviewImage(imageUrl) {
    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
      profileObjectUrlRef.current = null;
    }

    setProfileImage(imageUrl);
  }

  function handleRemovePhoto() {
    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
      profileObjectUrlRef.current = null;
    }

    setProfileImage(null);
    setError("");
    setSuccess(
      "Photo removed from this preview. The saved server photo has not been changed.",
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // =========================================================
  // CAMERA
  // =========================================================

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  }

  async function getDeviceCamera() {
    if (isMobileDevice()) {
      return {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
    }

    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    permissionStream.getTracks().forEach((track) => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();

    const cameras = devices.filter((device) => device.kind === "videoinput");

    if (!cameras.length) {
      throw new Error("No camera was found on this device.");
    }

    const preferredCamera = cameras.find((camera) => {
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

    if (preferredCamera) {
      return {
        video: {
          deviceId: { exact: preferredCamera.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
    }

    return {
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };
  }

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

      const constraints = await getDeviceCamera();

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      console.error("Camera error:", err);

      if (err.name === "NotAllowedError") {
        setError(
          "Camera permission was denied. Allow camera access and try again.",
        );
      } else if (err.name === "NotFoundError") {
        setError("No camera was found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("The camera is being used by another application.");
      } else {
        setError(err.message || "Unable to access the camera.");
      }
    } finally {
      setLoadingCamera(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError("The camera is preparing the image. Please wait and try again.");
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture the camera image.");
      return;
    }

    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.95));

    stopCamera();
    setCameraPreviewMode("captured");
    setError("");
  }

  async function handleRetake() {
    setCapturedImage(null);
    setCameraPreviewMode("live");

    await handleUseCamera();
  }

  function handleUseCapturedPhoto() {
    if (!capturedImage) {
      return;
    }

    replacePreviewImage(capturedImage);

    setCapturedImage(null);
    setCameraPreviewMode("live");
    setCameraOpen(false);

    setError("");
    setSuccess(
      "Photo preview updated. Permanent photo storage is not connected yet.",
    );
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());

      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function closeCamera() {
    stopCamera();

    setCapturedImage(null);
    setCameraPreviewMode("live");
    setCameraOpen(false);
  }

  // =========================================================
  // PASSWORD / SECURITY
  // =========================================================

  function clearPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    // Reset password visibility after a successful update.
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!user?.id) {
      setError("User information is unavailable.");
      return;
    }

    /*
     * Save this value before the request because the initial
     * password flag is cleared after a successful change.
     */
    const isInitialPasswordChange = mustChangePassword;

    if (!isInitialPasswordChange && !currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (!newPassword) {
      setError("Enter your new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Your password must not exceed 72 bytes.");
      return;
    }

    if (!confirmPassword) {
      setError("Confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    if (!isInitialPasswordChange && currentPassword === newPassword) {
      setError(
        "Your new password must be different from your current password.",
      );
      return;
    }

    try {
      setSavingPassword(true);
      setError("");
      setSuccess("");

      let response;

      if (isInitialPasswordChange) {
        /*
         * FIRST PASSWORD CHANGE
         *
         * Preserve the existing backend endpoint and request body.
         */
        response = await apiRequest("/auth/change-initial-password", {
          method: "POST",
          body: JSON.stringify({
            newPassword,
            confirmPassword,
          }),
        });
      } else {
        /*
         * NORMAL PASSWORD CHANGE
         *
         * Preserve the existing endpoint and request body.
         */
        response = await apiRequest(`/users/${user.id}/password`, {
          method: "PUT",
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        });
      }

      /*
       * UPDATE LOCAL USER STATE
       *
       * If this was the initial password change, the backend
       * has successfully cleared must_change_password.
       *
       * Reflect that change locally too.
       */
      setUser((previous) => ({
        ...previous,
        ...(response?.user || {}),
        ...(isInitialPasswordChange
          ? {
              must_change_password: false,
              mustChangePassword: false,
            }
          : {}),
      }));

      clearPasswordFields();

      /*
       * INITIAL PASSWORD WORKFLOW
       *
       * 1. Password change succeeds.
       * 2. Do not automatically open any invitation.
       * 3. Send the user to the normal Individual User Dashboard.
       * 4. The user can manually review invitations there.
       *
       * Invitation acceptance or declining is handled separately.
       */
      if (isInitialPasswordChange) {
        navigate("/dashboard", { replace: true });
        return;
      }

      /*
       * NORMAL PASSWORD CHANGE
       *
       * Stay on the existing Password section.
       */
      setSuccess(response?.message || "Password updated successfully.");
    } catch (err) {
      console.error("Password update error:", err);

      setError(err.message || "Unable to change your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  // =========================================================
  // DISPLAY VALUES
  // =========================================================

  const displayName =
    (isEditing ? draftForm.name : form.name) || user?.name || "ZYRA User";

  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || "Z";

  const roleLabel = getRoleLabel(user?.role);
  const accountStatus = getAccountStatus(user);

  if (loading) {
    return (
      <div className="profile-page profile-page-loading">
        <div className="profile-loading-spinner" />
        <span>Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="profile-page-header">
        <div className="profile-header-left">
          <button
            type="button"
            className="profile-back-button"
            onClick={activeSection ? handleBackToSettings : handleBack}
          >
            <ArrowLeft size={17} />
            {activeSection ? "Back to Settings" : "Back"}
          </button>

          <span className="profile-page-eyebrow">ZYRA ACCOUNT CENTER</span>

          <h1>
            {activeSection ? activeSectionInfo?.title : "Profile Settings"}
          </h1>

          <p>
            {activeSection
              ? activeSectionInfo?.description
              : "Manage your account, personal details and security preferences."}
          </p>
        </div>

        {activeSection === "personal" && (
          <div className="profile-header-actions">
            {!isEditing ? (
              <button
                type="button"
                className="profile-primary-button"
                onClick={handleEditProfile}
              >
                <Pencil size={17} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={handleCancelProfileEdit}
                  disabled={savingProfile}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="profile-primary-button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <span className="profile-button-spinner" />
                  ) : (
                    <Save size={17} />
                  )}

                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* =====================================================
          ALERTS
          ===================================================== */}

      {error && (
        <div className="profile-message profile-message-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="profile-message profile-message-success" role="status">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* =====================================================
          SETTINGS HOME PAGE
          ===================================================== */}

      {!activeSection && (
        <>
          <section className="profile-account-summary">
            <div className="profile-summary-avatar">
              {profileImage ? (
                <img src={profileImage} alt="" />
              ) : (
                <span>{avatarLetter}</span>
              )}

              <span className="profile-summary-status" />
            </div>

            <div className="profile-summary-copy">
              <span>YOUR ACCOUNT</span>
              <h2>{displayName}</h2>
              <p>{form.email || "No email address added"}</p>
            </div>

            <div className="profile-summary-role">
              <ShieldCheck size={16} />
              {roleLabel}
            </div>
          </section>

          <section className="profile-home-section">
            <div className="profile-home-heading">
              <div>
                <span className="profile-section-eyebrow">SETTINGS MENU</span>
                <h2>Manage Your Account</h2>
                <p>Choose a section to open its dedicated settings page.</p>
              </div>

              <Settings2 size={24} />
            </div>

            <div className="profile-section-menu">
              {PROFILE_SECTIONS.map((section) => {
                const Icon = section.icon;

                return (
                  <button
                    key={section.id}
                    type="button"
                    className="profile-section-tile"
                    onClick={() => handleOpenSection(section.id)}
                  >
                    <span className="profile-tile-icon">
                      <Icon size={22} />
                    </span>

                    <span className="profile-tile-copy">
                      <span className="profile-tile-number">
                        SECTION {section.number}
                      </span>

                      <strong>{section.title}</strong>

                      <span className="profile-tile-description">
                        {section.description}
                      </span>
                    </span>

                    <ChevronRight className="profile-tile-arrow" size={19} />
                  </button>
                );
              })}
            </div>

            <div className="profile-home-note">
              <ShieldCheck size={17} />

              <p>
                Your account settings are organised into separate sections. Open
                a section to view or manage its details.
              </p>
            </div>
          </section>
        </>
      )}

      {/* =====================================================
          PERSONAL INFORMATION PAGE
          ===================================================== */}

      {activeSection === "personal" && (
        <section className="profile-detail-page">
          <div className="profile-detail-card">
            <div className="profile-detail-card-heading">
              <div className="profile-detail-heading-icon">
                <UserRound size={20} />
              </div>

              <div>
                <h2>Personal Information</h2>
                <p>Your profile details and how your account is identified.</p>
              </div>
            </div>

            <div className="profile-section-intro">
              <ShieldCheck size={17} />

              <p>
                {isEditing
                  ? "Edit your fields below. Use Save Changes or Cancel at the top of the page."
                  : "Your information is read-only. Select Edit Profile at the top to make changes."}
              </p>
            </div>

            <div className="profile-form-grid">
              <div className="profile-field">
                <label htmlFor="profile-name">Full Name</label>

                {isEditing ? (
                  <input
                    id="profile-name"
                    type="text"
                    value={draftForm.name}
                    onChange={(event) =>
                      handleProfileFieldChange("name", event.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                ) : (
                  <div className="profile-static-value">
                    {form.name || "Not set"}
                  </div>
                )}
              </div>

              <div className="profile-field">
                <label htmlFor="profile-username">Username</label>

                {isEditing ? (
                  <input
                    id="profile-username"
                    type="text"
                    value={draftForm.username}
                    onChange={(event) =>
                      handleProfileFieldChange("username", event.target.value)
                    }
                    placeholder="Choose a username"
                    autoComplete="username"
                    maxLength={30}
                  />
                ) : (
                  <div className="profile-static-value">
                    {form.username
                      ? `@${form.username.replace(/^@/, "")}`
                      : "Not set"}
                  </div>
                )}

                {isEditing && (
                  <small className="profile-field-help">
                    Use 3–30 letters, numbers, dots, underscores or hyphens.
                  </small>
                )}
              </div>

              <div className="profile-field profile-field-full">
                <label htmlFor="profile-email">Email Address</label>

                {isEditing ? (
                  <input
                    id="profile-email"
                    type="email"
                    value={draftForm.email}
                    onChange={(event) =>
                      handleProfileFieldChange("email", event.target.value)
                    }
                    placeholder="Enter your email address"
                    autoComplete="email"
                  />
                ) : (
                  <div className="profile-static-value">
                    {form.email || "Not set"}
                  </div>
                )}

                {isEditing && (
                  <small className="profile-field-help">
                    A changed email address is not automatically verified.
                  </small>
                )}
              </div>

              <div className="profile-field">
                <label htmlFor="profile-date-of-birth">Date of Birth</label>

                {isEditing ? (
                  <input
                    id="profile-date-of-birth"
                    type="date"
                    value={draftForm.date_of_birth}
                    max={getLocalDateString()}
                    onChange={(event) =>
                      handleProfileFieldChange(
                        "date_of_birth",
                        event.target.value,
                      )
                    }
                  />
                ) : (
                  <div className="profile-static-value">
                    <CalendarDays size={16} />
                    {formatDate(form.date_of_birth)}
                  </div>
                )}
              </div>

              <div className="profile-field">
                <label>Mobile Number</label>

                <div className="profile-static-value profile-mobile-value">
                  <Smartphone size={16} />
                  <span>{form.mobile_number || "Not added"}</span>
                  <LockKeyhole className="profile-mobile-lock" size={15} />
                </div>

                <small className="profile-field-help">
                  {user?.mobile_verified
                    ? "This number is marked as verified."
                    : "Changes are locked until mobile OTP verification is implemented."}
                </small>
              </div>
            </div>

            {isEditing && (
              <div className="profile-edit-notice">
                <ShieldCheck size={17} />

                <span>
                  Mobile number changes are disabled. Save or cancel your other
                  edits using the controls at the top.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          PROFILE PHOTO PAGE
          ===================================================== */}

      {activeSection === "photo" && (
        <section className="profile-detail-page">
          <div className="profile-detail-card">
            <div className="profile-detail-card-heading">
              <div className="profile-detail-heading-icon">
                <ImagePlus size={20} />
              </div>

              <div>
                <h2>Profile Photo</h2>
                <p>Personalise your account with an image or camera photo.</p>
              </div>
            </div>

            <div className="profile-photo-page-content">
              <div className="profile-photo-preview-wrap">
                <div className="profile-photo-large">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile preview" />
                  ) : (
                    <span>{avatarLetter}</span>
                  )}
                </div>

                <h3>{displayName}</h3>
                <p>{form.email || "No email address added"}</p>
              </div>

              <div className="profile-photo-controls">
                <button
                  type="button"
                  className="profile-upload-button"
                  onClick={handleUploadClick}
                >
                  <Upload size={17} />
                  Upload Photo
                </button>

                <button
                  type="button"
                  className="profile-camera-button"
                  onClick={handleUseCamera}
                  disabled={loadingCamera}
                >
                  <Video size={17} />
                  {loadingCamera ? "Opening Camera..." : "Use Camera"}
                </button>

                {profileImage && (
                  <button
                    type="button"
                    className="profile-remove-button"
                    onClick={handleRemovePhoto}
                  >
                    <X size={17} />
                    Remove Preview
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

              <div className="profile-photo-note">
                <ImagePlus size={16} />

                <span>
                  JPG, PNG or WEBP · Maximum 5 MB. Photo changes currently
                  update only the page preview; permanent profile-photo storage
                  is not connected yet.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          WORKSPACE IDENTITY PAGE
          ===================================================== */}

      {activeSection === "workspace" && (
        <section className="profile-detail-page">
          <div className="profile-detail-card">
            <div className="profile-detail-card-heading">
              <div className="profile-detail-heading-icon">
                <Fingerprint size={20} />
              </div>

              <div>
                <h2>Workspace Identity</h2>

                <p>
                  Review the identity and membership details associated with
                  your account.
                </p>
              </div>
            </div>

            <div className="profile-workspace-banner">
              <div className="profile-workspace-banner-icon">
                <Fingerprint size={26} />
              </div>

              <div>
                <span>ZYRA ACCOUNT</span>
                <h3>{displayName}</h3>
                <p>{roleLabel}</p>
              </div>
            </div>

            <div className="profile-workspace-details">
              <div className="profile-workspace-detail">
                <span>Account ID</span>
                <strong>{user?.id ?? "Not available"}</strong>
              </div>

              <div className="profile-workspace-detail">
                <span>Account Role</span>
                <strong>{roleLabel}</strong>
              </div>

              <div className="profile-workspace-detail">
                <span>Account Status</span>

                <strong
                  className={
                    String(accountStatus).toUpperCase() === "ACTIVE"
                      ? "profile-status-active"
                      : ""
                  }
                >
                  {accountStatus}
                </strong>
              </div>

              <div className="profile-workspace-detail">
                <span>Member Since</span>
                <strong>{formatMemberSince(user?.created_at)}</strong>
              </div>

              <div className="profile-workspace-detail">
                <span>Email Address</span>
                <strong>{form.email || "Not set"}</strong>
              </div>

              <div className="profile-workspace-detail">
                <span>Mobile Verification</span>

                <strong
                  className={
                    user?.mobile_verified
                      ? "profile-status-active"
                      : "profile-status-pending"
                  }
                >
                  {user?.mobile_verified ? "Verified" : "Not verified"}
                </strong>
              </div>
            </div>

            <div className="profile-edit-notice">
              <ShieldCheck size={17} />

              <span>
                This page displays account information. It does not directly
                change workspace roles or permissions.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          PRIVACY & PASSWORD PAGE
          ===================================================== */}

      {activeSection === "security" && (
        <section className="profile-detail-page">
          <div className="profile-detail-card">
            <div className="profile-detail-card-heading">
              <div className="profile-detail-heading-icon">
                <LockKeyhole size={20} />
              </div>

              <div>
                <h2>Privacy &amp; Password</h2>
                <p>Change your password and keep your account secure.</p>
              </div>
            </div>

            <div className="profile-security-banner">
              <div className="profile-security-icon">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h3>Protect Your Account</h3>

                <p>
                  Choose a strong, unique password that you do not use on other
                  websites.
                </p>
              </div>
            </div>

            {mustChangePassword && (
              <div className="profile-edit-notice profile-password-notice">
                <ShieldCheck size={17} />

                <span>
                  You must set a new password before continuing to use your
                  account.
                </span>
              </div>
            )}

            <form
              className="profile-password-form"
              onSubmit={handleChangePassword}
            >
              {!mustChangePassword && (
                <div className="profile-field">
                  <label htmlFor="profile-current-password">
                    Current Password
                  </label>

                  <div className="profile-password-input-wrap">
                    <input
                      id="profile-current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      required
                      disabled={savingPassword}
                    />

                    <button
                      type="button"
                      className="profile-password-toggle"
                      onClick={() =>
                        setShowCurrentPassword((previous) => !previous)
                      }
                      aria-label={
                        showCurrentPassword
                          ? "Hide current password"
                          : "Show current password"
                      }
                      aria-pressed={showCurrentPassword}
                      disabled={savingPassword}
                    >
                      {showCurrentPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="profile-field">
                <label htmlFor="profile-new-password">New Password</label>

                <div className="profile-password-input-wrap">
                  <input
                    id="profile-new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={savingPassword}
                  />

                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => setShowNewPassword((previous) => !previous)}
                    aria-label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    aria-pressed={showNewPassword}
                    disabled={savingPassword}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="profile-field">
                <label htmlFor="profile-confirm-password">
                  Confirm New Password
                </label>

                <div className="profile-password-input-wrap">
                  <input
                    id="profile-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter the new password again"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={savingPassword}
                  />

                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() =>
                      setShowConfirmPassword((previous) => !previous)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    aria-pressed={showConfirmPassword}
                    disabled={savingPassword}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div className="profile-password-actions">
                <button
                  type="submit"
                  className="profile-primary-button"
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <span className="profile-button-spinner" />
                  ) : (
                    <LockKeyhole size={17} />
                  )}

                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>

            <div className="profile-security-footnote">
              <ShieldCheck size={16} />

              <span>
                Password updates use your existing backend routes. After your
                initial password change, you will be redirected to your
                dashboard, where you can review your invitations.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          CAMERA MODAL
          ===================================================== */}

      {cameraOpen && (
        <div className="profile-camera-modal">
          <button
            type="button"
            className="profile-camera-backdrop"
            onClick={closeCamera}
            aria-label="Close camera"
          />

          <div
            className="profile-camera-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-camera-title"
          >
            <div className="profile-camera-dialog-header">
              <div>
                <span>ZYRA CAMERA</span>

                <h2 id="profile-camera-title">
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

            <canvas ref={canvasRef} hidden />

            {cameraPreviewMode === "captured" ? (
              <div className="profile-camera-dialog-actions">
                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={handleRetake}
                  disabled={loadingCamera}
                >
                  <RotateCcw size={17} />
                  Retake
                </button>

                <button
                  type="button"
                  className="profile-primary-button"
                  onClick={handleUseCapturedPhoto}
                >
                  <Check size={17} />
                  Use Photo
                </button>
              </div>
            ) : (
              <div className="profile-camera-dialog-actions">
                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={closeCamera}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="profile-primary-button"
                  onClick={capturePhoto}
                >
                  <Camera size={17} />
                  Capture Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
