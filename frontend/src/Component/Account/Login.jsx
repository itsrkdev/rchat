import React, { useEffect, useState } from 'react';
import { Dialog } from "@mui/material";
import './Login.css';
import rchat from '../../assets/rchat1.png';
import { useNavigate } from 'react-router-dom';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function Login() {
    const navigate = useNavigate();

    // Screens: login, signup, emailOtp, forgotEmail, resetOtp, resetPassword
    const [screen, setScreen] = useState("login");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });

    const [emailOtp, setEmailOtp] = useState("");
    const [resetOtp, setResetOtp] = useState("");

    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);

    const [feedback, setFeedback] = useState({
        type: "",
        text: ""
    });

    // Redirect if already logged in
    useEffect(() => {
        if (localStorage.getItem("token")) {
            navigate("/chats", { replace: true });
        }
    }, [navigate]);

    // Resend OTP countdown
    useEffect(() => {
        if (resendCountdown <= 0) return;

        const timer = setTimeout(() => {
            setResendCountdown(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearTimeout(timer);
    }, [resendCountdown]);

    const normalizedEmail = formData.email.trim().toLowerCase();

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
    };

    const clearFeedback = () => {
        setFeedback({ type: "", text: "" });
    };

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // ==========================================
    // LOGIN / REGISTER
    // ==========================================

    const handleSubmit = async () => {
        const email = normalizedEmail;

        if (
            !email ||
            !formData.password ||
            (screen === "signup" && !formData.name.trim())
        ) {
            return alert("Please fill all required fields!");
        }

        if (!isValidEmail(email)) {
            return alert("Please enter a valid email address!");
        }

        if (
            screen === "signup" &&
            (formData.password.length < 8 || formData.password.length > 128)
        ) {
            return alert("Password must be 8 to 128 characters!");
        }

        const isLogin = screen === "login";

        const url = isLogin
            ? `${backendUrl}/api/auth/login`
            : `${backendUrl}/api/auth/register`;

        try {
            setLoading(true);
            clearFeedback();

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...formData,
                    email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // Unverified user login attempt
                if (data.requiresVerification) {
                    setFormData(prev => ({
                        ...prev,
                        email: data.email || email
                    }));

                    setEmailOtp("");
                    setResendCountdown(0);
                    setScreen("emailOtp");

                    showFeedback("error", data.message);
                    return;
                }

                return alert(data.message || "Something went wrong.");
            }

            if (isLogin) {
                localStorage.setItem("token", data.token);

                if (data.user) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                }

                alert(data.message);
                navigate("/chats", { replace: true });

            } else {
                setFormData(prev => ({
                    ...prev,
                    email
                }));

                setEmailOtp("");
                setResendCountdown(60);
                setScreen("emailOtp");

                showFeedback(
                    "success",
                    data.message || "OTP sent successfully. Please check your email."
                );
            }

        } catch (error) {
            console.error("Login/Register Error:", error);
            alert("Server not responding");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // VERIFY EMAIL OTP
    // ==========================================

    const handleVerifyEmailOtp = async () => {
        if (!/^\d{6}$/.test(emailOtp)) {
            return showFeedback("error", "Please enter a valid 6-digit OTP!");
        }

        try {
            setLoading(true);
            clearFeedback();

            const response = await fetch(
                `${backendUrl}/api/auth/verify-email`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        otp: emailOtp
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return showFeedback(
                    "error",
                    data.message || "OTP verification failed."
                );
            }

            alert(data.message);

            setScreen("login");
            setEmailOtp("");
            setResendCountdown(0);

            setFormData(prev => ({
                ...prev,
                password: ""
            }));

            clearFeedback();

        } catch (error) {
            console.error("Email OTP Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // RESEND EMAIL VERIFICATION OTP
    // ==========================================

    const handleResendEmailOtp = async () => {
        if (resendCountdown > 0 || resendLoading || loading) return;

        try {
            setResendLoading(true);
            clearFeedback();

            const response = await fetch(
                `${backendUrl}/api/auth/resend-otp`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: normalizedEmail
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (data.remainingSeconds) {
                    setResendCountdown(data.remainingSeconds);
                }

                return showFeedback(
                    "error",
                    data.message || "Unable to resend OTP."
                );
            }

            setEmailOtp("");
            setResendCountdown(60);

            showFeedback(
                "success",
                data.message || "New OTP sent successfully."
            );

        } catch (error) {
            console.error("Resend Email OTP Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    // ==========================================
    // FORGOT PASSWORD - SEND OTP
    // ==========================================

    const handleForgotPassword = async () => {
        const email = normalizedEmail;

        if (!email) {
            return showFeedback("error", "Please enter your email address.");
        }

        if (!isValidEmail(email)) {
            return showFeedback("error", "Please enter a valid email address.");
        }

        try {
            setLoading(true);
            clearFeedback();

            const response = await fetch(
                `${backendUrl}/api/auth/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return showFeedback(
                    "error",
                    data.message || "Unable to send password reset OTP."
                );
            }

            setResetOtp("");
            setResendCountdown(60);
            setScreen("resetOtp");

            showFeedback(
                "success",
                data.message || "If your account exists, an OTP has been sent."
            );

        } catch (error) {
            console.error("Forgot Password Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // RESEND PASSWORD RESET OTP
    // ==========================================

    const handleResendResetOtp = async () => {
        if (resendCountdown > 0 || resendLoading || loading) return;

        try {
            setResendLoading(true);
            clearFeedback();

            // Reuse forgot-password API for sending a fresh OTP
            const response = await fetch(
                `${backendUrl}/api/auth/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: normalizedEmail
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                showFeedback(
                    "error",
                    data.message || "Unable to resend OTP."
                );
                return;
            }

            setResetOtp("");
            setResendCountdown(60);

            showFeedback(
                "success",
                data.message || "If your account exists, a new OTP has been sent."
            );

        } catch (error) {
            console.error("Resend Reset OTP Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    // ==========================================
    // VERIFY PASSWORD RESET OTP
    // ==========================================

    const handleVerifyResetOtp = async () => {
        if (!/^\d{6}$/.test(resetOtp)) {
            return showFeedback("error", "Please enter a valid 6-digit OTP!");
        }

        try {
            setLoading(true);
            clearFeedback();

            const response = await fetch(
                `${backendUrl}/api/auth/verify-reset-otp`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        otp: resetOtp
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return showFeedback(
                    "error",
                    data.message || "OTP verification failed."
                );
            }

            if (!data.resetToken) {
                return showFeedback(
                    "error",
                    "Reset token was not received. Please try again."
                );
            }

            // Keep token in component state, not localStorage
            setResetToken(data.resetToken);
            setResetOtp("");
            setResendCountdown(0);
            setScreen("resetPassword");

            showFeedback(
                "success",
                data.message || "OTP verified successfully."
            );

        } catch (error) {
            console.error("Verify Reset OTP Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // RESET PASSWORD
    // ==========================================

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            return showFeedback("error", "Please fill both password fields.");
        }

        if (newPassword.length < 8 || newPassword.length > 128) {
            return showFeedback(
                "error",
                "Password must be between 8 and 128 characters."
            );
        }

        if (newPassword !== confirmPassword) {
            return showFeedback("error", "Passwords do not match.");
        }

        if (!resetToken) {
            return showFeedback(
                "error",
                "Reset session is missing. Please start again."
            );
        }

        try {
            setLoading(true);
            clearFeedback();

            const response = await fetch(
                `${backendUrl}/api/auth/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        resetToken,
                        newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return showFeedback(
                    "error",
                    data.message || "Password reset failed."
                );
            }

            alert(data.message || "Password reset successfully.");

            // Clear sensitive temporary data
            setResetToken("");
            setNewPassword("");
            setConfirmPassword("");
            setResetOtp("");
            setResendCountdown(0);

            setFormData(prev => ({
                ...prev,
                password: ""
            }));

            setScreen("login");
            clearFeedback();

        } catch (error) {
            console.error("Reset Password Error:", error);
            showFeedback("error", "Server not responding. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // COMMON HELPERS
    // ==========================================

    const handleOtpChange = (value, setter) => {
        setter(value.replace(/\D/g, "").slice(0, 6));

        if (feedback.type === "error") {
            clearFeedback();
        }
    };

    const goToLogin = () => {
        setScreen("login");
        setEmailOtp("");
        setResetOtp("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setResendCountdown(0);
        clearFeedback();
    };

    const goToSignup = () => {
        setScreen("signup");
        setFormData({
            name: "",
            email: "",
            password: ""
        });
        setEmailOtp("");
        setResendCountdown(0);
        clearFeedback();
    };

    const renderFeedback = () => {
        if (!feedback.text) return null;

        return (
            <p
                role="status"
                className={`auth-feedback ${feedback.type}`}
            >
                {feedback.text}
            </p>
        );
    };

    const renderResendButton = (handler) => (
        <div className="auth-resend-area">
            <p>Didn't receive the OTP?</p>

            <button
                type="button"
                onClick={handler}
                disabled={
                    resendCountdown > 0 ||
                    resendLoading ||
                    loading
                }
                className="auth-text-button"
            >
                {resendLoading
                    ? "Sending OTP..."
                    : resendCountdown > 0
                        ? `Resend OTP in ${resendCountdown}s`
                        : "Resend OTP"}
            </button>
        </div>
    );

    // ==========================================
    // UI
    // ==========================================

    return (
        <Dialog
            open={true}
            className="custom-dialog"
            hideBackdrop
        >
            <div className="login-container">

                {/* LEFT BRANDING PANEL */}
                <div className="login-left-panel">

                    <div className="wp-logo-container">
                        <img
                            src={rchat}
                            alt="R-Chat Logo"
                            className="whatsapp-logo"
                        />
                    </div>

                    <h2>Welcome to R-Chat</h2>

                    <p className="left-subtitle">
                        Your conversations, all in one place
                    </p>

                    <ul className="modern-feature-list">
                        <li><span className="bullet-star">✦</span> Log in to access your messages securely</li>
                        <li><span className="bullet-star">✦</span> Stay connected on all your devices</li>
                        <li><span className="bullet-star">✦</span> Chat with friends instantly</li>
                        <li><span className="bullet-star">✦</span> Connect anytime, anywhere</li>
                    </ul>

                    <p className="left-footer">
                        <a href="#">Need help? Get support</a>
                    </p>

                </div>

                {/* RIGHT FORM PANEL */}
                <div className="login-right-panel">

                    <div className="mobile-brand-header">
                        <img
                            src={rchat}
                            alt="R-Chat Logo"
                            className="mobile-logo"
                        />
                        <h3>R-Chat</h3>
                    </div>

                    <div className="form-box">

                        {/* LOGIN SCREEN */}
                        {(screen === "login" || screen === "signup") && (
                            <>
                                <h2>
                                    {screen === "login" ? "Sign In" : "Sign Up"}
                                </h2>

                                <p className="form-subtitle">
                                    Welcome! Please enter your details.
                                </p>

                                {screen === "signup" && (
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Full Name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="modern-input"
                                    />
                                )}

                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="modern-input"
                                    autoComplete="email"
                                />

                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="modern-input"
                                    autoComplete={
                                        screen === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                />

                                {screen === "login" && (
                                    <p className="forgot-password-link">
                                        <span onClick={() => {
                                            setScreen("forgotEmail");
                                            setResendCountdown(0);
                                            clearFeedback();
                                        }}>
                                            Forgot Password?
                                        </span>
                                    </p>
                                )}

                                <button
                                    className="modern-submit-btn"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Please wait..."
                                        : screen === "login"
                                            ? "Sign In"
                                            : "Create Account"}
                                </button>

                                <p className="toggle-auth-text">
                                    {screen === "login"
                                        ? "Don't have an account? "
                                        : "Already have an account? "}

                                    <span onClick={() => {
                                        if (screen === "login") {
                                            goToSignup();
                                        } else {
                                            goToLogin();
                                        }
                                    }}>
                                        {screen === "login" ? "Sign Up" : "Sign In"}
                                    </span>
                                </p>
                            </>
                        )}

                        {/* EMAIL VERIFICATION OTP SCREEN */}
                        {screen === "emailOtp" && (
                            <>
                                <h2>Verify Your Email</h2>

                                <p className="form-subtitle">
                                    We have sent a 6-digit OTP to
                                    <br />
                                    <strong>{normalizedEmail}</strong>
                                </p>

                                <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    value={emailOtp}
                                    onChange={(e) =>
                                        handleOtpChange(e.target.value, setEmailOtp)
                                    }
                                    className="modern-input"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                />

                                {renderFeedback()}

                                <button
                                    className="modern-submit-btn"
                                    onClick={handleVerifyEmailOtp}
                                    disabled={loading || resendLoading}
                                >
                                    {loading ? "Verifying..." : "Verify Email"}
                                </button>

                                {renderResendButton(handleResendEmailOtp)}

                                <p className="toggle-auth-text">
                                    Wrong email?{" "}
                                    <span onClick={goToSignup}>Go Back</span>
                                </p>
                            </>
                        )}

                        {/* FORGOT PASSWORD EMAIL SCREEN */}
                        {screen === "forgotEmail" && (
                            <>
                                <h2>Forgot Password?</h2>

                                <p className="form-subtitle">
                                    Enter your registered email address.
                                    We'll send you a password reset OTP.
                                </p>

                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="modern-input"
                                    autoComplete="email"
                                />

                                {renderFeedback()}

                                <button
                                    className="modern-submit-btn"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                >
                                    {loading ? "Sending OTP..." : "Send Reset OTP"}
                                </button>

                                <p className="toggle-auth-text">
                                    Remember your password?{" "}
                                    <span onClick={goToLogin}>Sign In</span>
                                </p>
                            </>
                        )}

                        {/* PASSWORD RESET OTP SCREEN */}
                        {screen === "resetOtp" && (
                            <>
                                <h2>Verify Reset OTP</h2>

                                <p className="form-subtitle">
                                    Enter the 6-digit OTP sent to
                                    <br />
                                    <strong>{normalizedEmail}</strong>
                                </p>

                                <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    value={resetOtp}
                                    onChange={(e) =>
                                        handleOtpChange(e.target.value, setResetOtp)
                                    }
                                    className="modern-input"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                />

                                {renderFeedback()}

                                <button
                                    className="modern-submit-btn"
                                    onClick={handleVerifyResetOtp}
                                    disabled={loading || resendLoading}
                                >
                                    {loading ? "Verifying..." : "Verify OTP"}
                                </button>

                                {renderResendButton(handleResendResetOtp)}

                                <p className="toggle-auth-text">
                                    <span onClick={() => {
                                        setScreen("forgotEmail");
                                        setResetOtp("");
                                        setResendCountdown(0);
                                        clearFeedback();
                                    }}>
                                        Change Email
                                    </span>
                                    {" | "}
                                    <span onClick={goToLogin}>Sign In</span>
                                </p>
                            </>
                        )}

                        {/* NEW PASSWORD SCREEN */}
                        {screen === "resetPassword" && (
                            <>
                                <h2>Set New Password</h2>

                                <p className="form-subtitle">
                                    Create a new password for your R-Chat account.
                                </p>

                                <input
                                    type="password"
                                    placeholder="New Password"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        if (feedback.type === "error") clearFeedback();
                                    }}
                                    className="modern-input"
                                    autoComplete="new-password"
                                />

                                <input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        if (feedback.type === "error") clearFeedback();
                                    }}
                                    className="modern-input"
                                    autoComplete="new-password"
                                />

                                {renderFeedback()}

                                <button
                                    className="modern-submit-btn"
                                    onClick={handleResetPassword}
                                    disabled={loading}
                                >
                                    {loading ? "Updating Password..." : "Reset Password"}
                                </button>

                                <p className="toggle-auth-text">
                                    <span onClick={goToLogin}>Back to Sign In</span>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
        );}