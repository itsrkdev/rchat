
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});


// ==========================================
// 1. EMAIL VERIFICATION EMAIL
// ==========================================

const sendVerificationEmail = async (email, otp) => {
    return transporter.sendMail({
        from: `"Chat App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Chat App Email",
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Welcome to Chat App!</h2>
                <p>Your email verification OTP is:</p>
                <h1 style="letter-spacing: 8px;">${otp}</h1>
                <p>This OTP will expire in 10 minutes.</p>
                <p>If you did not create this account, ignore this email.</p>
            </div>
        `
    });
};


// ==========================================
// 2. FORGOT PASSWORD EMAIL
// ==========================================

const sendPasswordResetEmail = async (email, otp) => {
    return transporter.sendMail({
        from: `"Chat App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Your Chat App Password",
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h2>Password Reset Request</h2>

                <p>We received a request to reset your Chat App password.</p>

                <p>Your password reset OTP is:</p>

                <h1 style="letter-spacing: 8px;">${otp}</h1>

                <p>This OTP will expire in 10 minutes.</p>

                <p>If you did not request a password reset, please ignore this email.
                Your existing password will remain unchanged.</p>
            </div>
        `
    });
};


module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
