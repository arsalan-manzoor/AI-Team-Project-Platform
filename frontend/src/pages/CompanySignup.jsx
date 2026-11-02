import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { apiRequest, setAuthToken } from "../services/api";

import "../styles/companySignup.css";

/* =========================================================
   INDUSTRY OPTIONS
   ========================================================= */

const INDUSTRY_GROUPS = [
  {
    label: "Technology & Digital",
    options: [
      "Information Technology",
      "Software Development",
      "Artificial Intelligence & Machine Learning",
      "Data Science & Analytics",
      "Cybersecurity",
      "Cloud Computing",
      "Telecommunications",
      "Electronics & Semiconductors",
      "Internet & Digital Services",
      "IT Consulting",
      "Computer Hardware",
    ],
  },
  {
    label: "Business & Professional Services",
    options: [
      "Management Consulting",
      "Business Consulting",
      "Human Resources & Recruitment",
      "Legal Services",
      "Accounting & Auditing",
      "Marketing & Advertising",
      "Public Relations",
      "Professional Services",
      "Business Process Outsourcing",
      "Customer Support Services",
    ],
  },
  {
    label: "Finance & Real Estate",
    options: [
      "Banking",
      "Financial Services",
      "Insurance",
      "Investment & Asset Management",
      "Fintech",
      "Cryptocurrency & Blockchain",
      "Real Estate",
      "Property Management",
    ],
  },
  {
    label: "Healthcare & Life Sciences",
    options: [
      "Healthcare & Hospitals",
      "Pharmaceuticals",
      "Biotechnology",
      "Medical Devices",
      "Medical Research",
      "Mental Health Services",
      "Dental Services",
      "Fitness & Wellness",
    ],
  },
  {
    label: "Manufacturing & Industrial",
    options: [
      "Manufacturing",
      "Automotive",
      "Aerospace & Aviation",
      "Defence & Security",
      "Industrial Machinery",
      "Chemical Manufacturing",
      "Textiles & Apparel Manufacturing",
      "Electrical Equipment",
      "Construction Materials",
    ],
  },
  {
    label: "Energy & Environment",
    options: [
      "Oil & Gas",
      "Renewable Energy",
      "Solar Energy",
      "Wind Energy",
      "Electricity & Utilities",
      "Environmental Services",
      "Waste Management & Recycling",
      "Water Management",
      "Mining & Metals",
    ],
  },
  {
    label: "Trade & Consumer",
    options: [
      "Retail",
      "Wholesale & Distribution",
      "E-commerce",
      "Consumer Goods",
      "Fashion & Apparel",
      "Beauty & Cosmetics",
      "Luxury Goods",
      "Food & Beverage",
      "Electronics Retail",
    ],
  },
  {
    label: "Education & Research",
    options: [
      "Education",
      "Higher Education & Universities",
      "Schools & Educational Institutions",
      "E-learning & Online Education",
      "Educational Technology",
      "Research & Development",
      "Scientific Research",
      "Training & Development",
    ],
  },
  {
    label: "Media & Entertainment",
    options: [
      "Media & Broadcasting",
      "Film & Television",
      "Music & Audio",
      "Gaming & Esports",
      "Publishing",
      "Digital Content Creation",
      "Photography",
      "Entertainment",
      "Animation & Visual Effects",
    ],
  },
  {
    label: "Transport & Hospitality",
    options: [
      "Transportation",
      "Logistics & Supply Chain",
      "Shipping & Maritime",
      "Aviation",
      "Automotive Services",
      "Hospitality",
      "Hotels & Resorts",
      "Travel & Tourism",
      "Restaurants & Food Services",
    ],
  },
  {
    label: "Agriculture & Natural Resources",
    options: [
      "Agriculture",
      "Farming",
      "Animal Husbandry",
      "Forestry",
      "Fishing & Aquaculture",
      "Agricultural Technology",
      "Food Processing",
    ],
  },
  {
    label: "Government & Social Services",
    options: [
      "Government & Public Administration",
      "Nonprofit & NGO",
      "Social Services",
      "International Organisations",
      "Public Safety",
      "Defence Services",
    ],
  },
  {
    label: "Other Industries",
    options: [
      "Sports & Recreation",
      "Sports Management",
      "Event Management",
      "Architecture & Planning",
      "Interior Design",
      "Engineering Services",
      "Fashion Design",
      "Personal Services",
      "Other",
    ],
  },
];

/* =========================================================
   COUNTRY OPTIONS
   ========================================================= */

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

/* =========================================================
   COMPANY SIGNUP COMPONENT
   ========================================================= */

function CompanySignup() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    companyName: "",
    companyEmail: "",
    industry: "",
    companySize: "",
    country: "",
    adminName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* =========================================================
     FORM HELPERS
     ========================================================= */

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setNotice("");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  /*
   * Automatically extract the Company domain from
   * the official Company email.
   *
   * Example:
   * hello@zyra.com -> zyra.com
   */

  function getCompanyEmailDomain() {
    const email = form.companyEmail.trim().toLowerCase();
    const separatorIndex = email.lastIndexOf("@");

    if (separatorIndex === -1) {
      return "";
    }

    return email.slice(separatorIndex + 1);
  }

  /* =========================================================
     STEP VALIDATION
     ========================================================= */

  function validateCurrentStep() {
    setError("");
    setNotice("");

    if (step === 1) {
      if (!form.companyName.trim()) {
        setError("Please enter your company or organization name.");
        return false;
      }

      if (!isValidEmail(form.companyEmail)) {
        setError("Please enter a valid official company email.");
        return false;
      }

      return true;
    }

    if (step === 2) {
      if (!form.industry) {
        setError("Please select your company's industry.");
        return false;
      }

      if (!form.companySize) {
        setError("Please select your company size.");
        return false;
      }

      if (!form.country) {
        setError("Please select your country.");
        return false;
      }

      return true;
    }

    if (step === 3) {
      if (form.adminName.trim().length < 2) {
        setError("Please enter the administrator's full name.");
        return false;
      }

      if (!isValidEmail(form.adminEmail)) {
        setError("Please enter a valid administrator work email.");
        return false;
      }

      if (form.password.length < 8) {
        setError("Your password must contain at least 8 characters.");
        return false;
      }

      if (new TextEncoder().encode(form.password).length > 72) {
        setError("Your password must not exceed 72 bytes.");
        return false;
      }

      if (form.password !== form.confirmPassword) {
        setError("Your passwords do not match.");
        return false;
      }

      return true;
    }

    return true;
  }

  function validateStepData(targetStep) {
    if (targetStep === 1) {
      return (
        form.companyName.trim().length > 0 && isValidEmail(form.companyEmail)
      );
    }

    if (targetStep === 2) {
      return Boolean(form.industry && form.companySize && form.country);
    }

    if (targetStep === 3) {
      return (
        form.adminName.trim().length >= 2 &&
        isValidEmail(form.adminEmail) &&
        form.password.length >= 8 &&
        new TextEncoder().encode(form.password).length <= 72 &&
        form.password === form.confirmPassword
      );
    }

    return true;
  }

  function getStepValidationMessage(targetStep) {
    if (targetStep === 1) {
      if (!form.companyName.trim()) {
        return "Please enter your company or organization name.";
      }

      if (!isValidEmail(form.companyEmail)) {
        return "Please enter a valid official company email.";
      }

      return "Please review your company name and official company email.";
    }

    if (targetStep === 2) {
      if (!form.industry) {
        return "Please select your company's industry.";
      }

      if (!form.companySize) {
        return "Please select your company size.";
      }

      return "Please select your country.";
    }

    if (targetStep === 3) {
      if (form.adminName.trim().length < 2) {
        return "Please enter the administrator's full name.";
      }

      if (!isValidEmail(form.adminEmail)) {
        return "Please enter a valid administrator work email.";
      }

      if (form.password.length < 8) {
        return "Your password must contain at least 8 characters.";
      }

      if (new TextEncoder().encode(form.password).length > 72) {
        return "Your password must not exceed 72 bytes.";
      }

      return "Please make sure both passwords match.";
    }

    return "Please review your Company information.";
  }

  function validateCompleteForm() {
    const savedStep = step;

    for (let currentStep = 1; currentStep <= 3; currentStep += 1) {
      if (!validateStepData(currentStep)) {
        setStep(currentStep);
        setError(getStepValidationMessage(currentStep));
        return false;
      }
    }

    setStep(savedStep);
    return true;
  }

  function previousStep() {
    if (loading || step <= 1) {
      return;
    }

    setStep((previous) => previous - 1);
    setError("");
    setNotice("");
  }

  /* =========================================================
     START COMPANY VERIFICATION
     ========================================================= */

  async function startCompanyVerification() {
    if (!validateCompleteForm()) {
      return;
    }

    const companyDomain = getCompanyEmailDomain();

    if (!companyDomain) {
      setStep(1);
      setError(
        "Unable to identify the domain from your official company email.",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");

      const result = await apiRequest("/users/company-signup/start", {
        method: "POST",
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          companyEmail: form.companyEmail.trim().toLowerCase(),
          industry: form.industry,
          companySize: form.companySize,
          country: form.country,
          domain: companyDomain,
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          password: form.password,
        }),
      });

      setVerificationSent(true);
      setVerificationCode("");

      setNotice(
        result?.message ||
          `A verification code has been requested for ${form.companyEmail.trim()}.`,
      );
    } catch (requestError) {
      console.error("Company verification start error:", requestError);

      setError(
        requestError.message ||
          "Unable to start Company verification. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     COMPLETE COMPANY VERIFICATION + WORKSPACE ACTIVATION
     ========================================================= */

  async function completeCompanyVerification() {
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError("Please enter the six-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");

      /*
       * STEP 1:
       * Verify the Company email.
       *
       * The backend creates:
       * - Administrator account
       * - Organization
       * - Company workspace
       * - ADMIN workspace membership
       */

      const result = await apiRequest("/users/company-signup/verify", {
        method: "POST",
        body: JSON.stringify({
          companyEmail: form.companyEmail.trim().toLowerCase(),
          verificationCode: verificationCode.trim(),
        }),
      });

      /*
       * STEP 2:
       * Validate the authentication token.
       */

      if (!result || typeof result.token !== "string" || !result.token) {
        console.error(
          "Company verification response is missing the token.",
          result,
        );

        throw new Error(
          "Company verification succeeded, but the authentication token was not returned. Check the backend verification response.",
        );
      }

      /*
       * STEP 3:
       * Validate the workspace returned by the backend.
       */

      if (!result.workspace || !result.workspace.id) {
        console.error(
          "Company verification response is missing the workspace.",
          result,
        );

        throw new Error(
          "Company was created, but its workspace ID was not returned.",
        );
      }

      const workspaceId = String(result.workspace.id);

      /*
       * STEP 4:
       * Store the active Company workspace.
       *
       * api.js uses:
       * zyra_active_workspace_id
       *
       * WorkspaceContext can use this value to identify
       * the currently selected Company workspace.
       */

      localStorage.setItem("zyra_active_workspace_id", workspaceId);

      /*
       * STEP 5:
       * Store the active role for this workspace.
       *
       * ADMIN is the role assigned during Company creation.
       */

      localStorage.setItem(
        `zyra_active_workspace_role_${workspaceId}`,
        "ADMIN",
      );

      /*
       * STEP 6:
       * Save the JWT using the existing authentication service.
       *
       * setAuthToken also dispatches the
       * zyra-auth-changed event.
       */

      setAuthToken(result.token);

      /*
       * STEP 7:
       * Navigate to the Company Admin Dashboard.
       */

      navigate("/dashboard/company/admin", {
        replace: true,
        state: {
          companySignupSuccess: true,
          workspaceId: result.workspace.id,
        },
      });
    } catch (requestError) {
      console.error("Company verification error:", requestError);

      setError(
        requestError.message ||
          "Unable to verify your Company email. Please check the code and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     FORM SUBMISSION
     ========================================================= */

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setNotice("");

    if (step < 4) {
      if (!validateCurrentStep()) {
        return;
      }

      setStep((previous) => previous + 1);
      return;
    }

    if (!verificationSent) {
      await startCompanyVerification();
      return;
    }

    await completeCompanyVerification();
  }

  /* =========================================================
     PASSWORD FIELD STYLES
     ========================================================= */

  const passwordWrapperStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const passwordInputStyle = {
    flex: "1 1 auto",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    paddingRight: "52px",
  };

  const passwordToggleStyle = {
    position: "absolute",
    top: "50%",
    right: "9px",
    left: "auto",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    minWidth: "36px",
    margin: 0,
    padding: 0,
    zIndex: 5,
    flexShrink: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="company-signup-page">
      <div className="signup-background-grid" />
      <div className="signup-glow signup-glow-one" />
      <div className="signup-glow signup-glow-two" />

      {/* HEADER */}

      <header className="company-signup-header">
        <button
          type="button"
          className="signup-brand"
          onClick={() => navigate("/company")}
        >
          <span className="signup-brand-mark">Z</span>

          <span>
            <strong>ZYRA</strong>
            <small>COMPANY WORKSPACE</small>
          </span>
        </button>

        <button
          type="button"
          className="signup-login-link"
          onClick={() => navigate("/company/login")}
        >
          Already have a company workspace?
          <strong> Sign In</strong>
        </button>
      </header>

      <section className="company-signup-content">
        {/* LEFT INFORMATION */}

        <aside className="company-signup-info">
          <div className="signup-info-label">
            <span />
            COMPANY ESTABLISHMENT
          </div>

          <h1>
            Establish your
            <strong>company.</strong>
          </h1>

          <p>
            Build the foundation for an intelligent workspace where your
            organization, people, projects and work stay connected.
          </p>

          <div className="signup-flow">
            <div className={`signup-flow-item ${step >= 1 ? "active" : ""}`}>
              <div className="flow-number">
                {step > 1 ? <Check size={14} /> : "01"}
              </div>

              <div>
                <strong>COMPANY</strong>
                <span>Establish your organization</span>
              </div>
            </div>

            <div className="flow-connector" />

            <div className={`signup-flow-item ${step >= 2 ? "active" : ""}`}>
              <div className="flow-number">
                {step > 2 ? <Check size={14} /> : "02"}
              </div>

              <div>
                <strong>PROFILE</strong>
                <span>Define your organization</span>
              </div>
            </div>

            <div className="flow-connector" />

            <div className={`signup-flow-item ${step >= 3 ? "active" : ""}`}>
              <div className="flow-number">
                {step > 3 ? <Check size={14} /> : "03"}
              </div>

              <div>
                <strong>ADMIN</strong>
                <span>Create the initial administrator</span>
              </div>
            </div>

            <div className="flow-connector" />

            <div className={`signup-flow-item ${step >= 4 ? "active" : ""}`}>
              <div className="flow-number">
                {verificationSent ? <Check size={14} /> : "04"}
              </div>

              <div>
                <strong>VERIFY</strong>
                <span>Verify your company email</span>
              </div>
            </div>
          </div>

          <div className="signup-security">
            <ShieldCheck size={16} />

            <div>
              <strong>SECURE BY DESIGN</strong>
              <span>
                Your company workspace is protected by role-based access and
                secure authentication.
              </span>
            </div>
          </div>
        </aside>

        {/* SIGNUP FORM */}

        <div className="company-signup-card">
          <div className="signup-card-top">
            <div>
              <span>STEP {String(step).padStart(2, "0")} / 04</span>

              <h2>
                {step === 1 && "Tell us about your company."}
                {step === 2 && "Define your company profile."}
                {step === 3 && "Create your administrator."}

                {step === 4 &&
                  (verificationSent
                    ? "Check your company email."
                    : "Ready to verify your workspace.")}
              </h2>
            </div>

            <div className="signup-progress">
              <span style={{ width: `${step * 25}%` }} />
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* STEP 1 — COMPANY INFORMATION */}

            {step === 1 && (
              <div className="signup-form-grid">
                <div className="signup-field full">
                  <label htmlFor="company-name">
                    COMPANY / ORGANIZATION NAME
                  </label>

                  <div className="signup-input">
                    <Building2 size={17} aria-hidden="true" />

                    <input
                      id="company-name"
                      name="companyName"
                      type="text"
                      autoComplete="organization"
                      placeholder="ZYRA Technologies"
                      value={form.companyName}
                      onChange={(event) =>
                        updateField("companyName", event.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="signup-field full">
                  <label htmlFor="company-email">OFFICIAL COMPANY EMAIL</label>

                  <div className="signup-input">
                    <Mail size={17} aria-hidden="true" />

                    <input
                      id="company-email"
                      name="companyEmail"
                      type="email"
                      autoComplete="email"
                      placeholder="hello@company.com"
                      value={form.companyEmail}
                      onChange={(event) =>
                        updateField("companyEmail", event.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — COMPANY PROFILE */}

            {step === 2 && (
              <div className="signup-form-grid">
                <div className="signup-field">
                  <label htmlFor="company-industry">INDUSTRY</label>

                  <select
                    id="company-industry"
                    name="industry"
                    value={form.industry}
                    onChange={(event) =>
                      updateField("industry", event.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="">Select your industry</option>

                    {INDUSTRY_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((industry) => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="signup-field">
                  <label htmlFor="company-size">COMPANY SIZE</label>

                  <select
                    id="company-size"
                    name="companySize"
                    value={form.companySize}
                    onChange={(event) =>
                      updateField("companySize", event.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="11-50">11–50 employees</option>
                    <option value="51-200">51–200 employees</option>
                    <option value="201-500">201–500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>

                <div className="signup-field">
                  <label htmlFor="company-country">COUNTRY</label>

                  <select
                    id="company-country"
                    name="country"
                    value={form.country}
                    onChange={(event) =>
                      updateField("country", event.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="">Select your country</option>

                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3 — ADMINISTRATOR */}

            {step === 3 && (
              <div className="signup-form-grid">
                <div className="signup-field full">
                  <label htmlFor="admin-name">ADMINISTRATOR FULL NAME</label>

                  <div className="signup-input">
                    <UserRound size={17} aria-hidden="true" />

                    <input
                      id="admin-name"
                      name="adminName"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={form.adminName}
                      onChange={(event) =>
                        updateField("adminName", event.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="signup-field full">
                  <label htmlFor="admin-email">ADMIN WORK EMAIL</label>

                  <div className="signup-input">
                    <Mail size={17} aria-hidden="true" />

                    <input
                      id="admin-email"
                      name="adminEmail"
                      type="email"
                      autoComplete="username"
                      placeholder="admin@company.com"
                      value={form.adminEmail}
                      onChange={(event) =>
                        updateField("adminEmail", event.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* PASSWORD */}

                <div className="signup-field">
                  <label htmlFor="admin-password">PASSWORD</label>

                  <div
                    className="signup-input signup-password-input"
                    style={passwordWrapperStyle}
                  >
                    <LockKeyhole size={17} aria-hidden="true" />

                    <input
                      id="admin-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create password"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      disabled={loading}
                      style={passwordInputStyle}
                    />

                    <button
                      type="button"
                      className="signup-password-toggle"
                      style={passwordToggleStyle}
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}

                <div className="signup-field">
                  <label htmlFor="confirm-admin-password">
                    CONFIRM PASSWORD
                  </label>

                  <div
                    className="signup-input signup-password-input"
                    style={passwordWrapperStyle}
                  >
                    <LockKeyhole size={17} aria-hidden="true" />

                    <input
                      id="confirm-admin-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField("confirmPassword", event.target.value)
                      }
                      disabled={loading}
                      style={passwordInputStyle}
                    />

                    <button
                      type="button"
                      className="signup-password-toggle"
                      style={passwordToggleStyle}
                      onClick={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      aria-pressed={showConfirmPassword}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="admin-notice">
                  <ShieldCheck size={16} />

                  <span>
                    You will become the <strong>initial administrator</strong>{" "}
                    of this company workspace.
                  </span>
                </div>
              </div>
            )}

            {/* STEP 4 — EMAIL VERIFICATION */}

            {step === 4 && (
              <div className="signup-verification">
                <div className="verification-icon">
                  {verificationSent ? (
                    <Mail size={36} />
                  ) : (
                    <ShieldCheck size={36} />
                  )}
                </div>

                {!verificationSent ? (
                  <>
                    <h3>Ready to verify your workspace.</h3>

                    <p>
                      We'll send a verification code to your official company
                      email. After verification, the initial administrator and
                      Company workspace will be created.
                    </p>

                    <div className="verification-summary">
                      <div>
                        <span>ORGANIZATION</span>
                        <strong>{form.companyName || "Your Company"}</strong>
                      </div>

                      <div>
                        <span>ADMINISTRATOR</span>
                        <strong>{form.adminName || "Administrator"}</strong>
                      </div>

                      <div>
                        <span>OFFICIAL EMAIL</span>
                        <strong>{form.companyEmail}</strong>
                      </div>

                      <div>
                        <span>DOMAIN</span>
                        <strong>
                          {getCompanyEmailDomain() || "Not specified"}
                        </strong>
                      </div>
                    </div>

                    <div className="verification-note">
                      <Mail size={15} />A six-digit verification code will be
                      sent to your official company email.
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Check your company email.</h3>

                    <p>
                      Enter the six-digit code sent to{" "}
                      <strong>{form.companyEmail}</strong> to finish setting up
                      your Company workspace.
                    </p>

                    <div className="signup-field verification-code-field">
                      <label htmlFor="company-verification-code">
                        VERIFICATION CODE
                      </label>

                      <div className="signup-input verification-code-input">
                        <Mail size={17} aria-hidden="true" />

                        <input
                          id="company-verification-code"
                          name="verificationCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Enter 6-digit code"
                          value={verificationCode}
                          onChange={(event) => {
                            setVerificationCode(
                              event.target.value.replace(/\D/g, "").slice(0, 6),
                            );
                          }}
                          maxLength={6}
                          disabled={loading}
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="verification-note">
                      <ShieldCheck size={15} />
                      For your security, the verification code expires.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ERROR FEEDBACK */}

            {error && (
              <div className="company-signup-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* SUCCESS FEEDBACK */}

            {notice && (
              <div
                className="company-signup-notice"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 size={16} />
                <span>{notice}</span>
              </div>
            )}

            {/* ACTION BUTTONS */}

            <div className="signup-actions">
              {step > 1 ? (
                <button
                  type="button"
                  className="signup-back-button"
                  onClick={previousStep}
                  disabled={loading}
                >
                  <ArrowLeft size={15} />
                  BACK
                </button>
              ) : (
                <button
                  type="button"
                  className="signup-back-button"
                  onClick={() => navigate("/company")}
                  disabled={loading}
                >
                  <ArrowLeft size={15} />
                  CANCEL
                </button>
              )}

              <button
                type="submit"
                className="signup-next-button"
                disabled={loading}
              >
                <span>
                  {loading
                    ? verificationSent
                      ? "VERIFYING..."
                      : step === 4
                        ? "SENDING CODE..."
                        : "PLEASE WAIT..."
                    : step < 4
                      ? "CONTINUE"
                      : verificationSent
                        ? "VERIFY & CREATE WORKSPACE"
                        : "START VERIFICATION"}
                </span>

                {loading ? (
                  <span
                    className="company-signup-button-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="company-signup-footer">
        <span>ZYRA COMPANY ESTABLISHMENT</span>
        <span>PLAN. COLLABORATE. BUILD. EVOLVE.</span>
        <span>SECURE WORKSPACE</span>
      </footer>
    </main>
  );
}

export default CompanySignup;
