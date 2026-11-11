
const { google } = require("googleapis");

// Gmail OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ||
        "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

// Gmail API
const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
});

// Common Email Sender
const sendEmail = async (email, subject, html) => {
    const requiredVars = [
        "EMAIL_USER",
        "GMAIL_CLIENT_ID",
        "GMAIL_CLIENT_SECRET",
        "GMAIL_REFRESH_TOKEN"
    ];

    const missing = requiredVars.filter(
        (key) => !process.env[key]
    );

    if (missing.length) {
        throw new Error(
            `Missing email environment variables: ${missing.join(", ")}`
        );
    }

    const message = [
        `From: "Chat App" <${process.env.EMAIL_USER}>`,
        `To: ${email}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "",
        html
    ].join("\r\n");

    const encodedMessage = Buffer
        .from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    return gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encodedMessage
        }
    });
};

// 1. Email Verification
const sendVerificationEmail = async (email, otp) => {
    return sendEmail(
        email,
        "Verify Your Chat App Email",
        `
        <div style="font-family: Arial; padding: 20px;">
            <h2>Welcome to Chat App!</h2>
            <p>Your email verification OTP is:</p>
            <h1 style="letter-spacing: 8px;">${otp}</h1>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you did not create this account, ignore this email.</p>
        </div>
        `
    );
};

// 2. Forgot Password
const sendPasswordResetEmail = async (email, otp) => {
    return sendEmail(
        email,
        "Reset Your Chat App Password",
        `
        <div style="font-family: Arial; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your Chat App password.</p>
            <p>Your password reset OTP is:</p>
            <h1 style="letter-spacing: 8px;">${otp}</h1>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you did not request a password reset, ignore this email.
            Your existing password will remain unchanged.</p>
        </div>
        `
    );
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
