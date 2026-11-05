
require("dotenv").config();

const express = require("express");
const router = express.Router();

const User = require("../Models/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
    sendVerificationEmail,
    sendPasswordResetEmail
} = require("../config/mailer");

// const sendVerificationEmail = require("../config/mailer");

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Generate SHA-256 hash of OTP
const hashOtp = (otp) => {
    return crypto
        .createHash("sha256")
        .update(String(otp))
        .digest("hex");
};

// Generate 6-digit OTP
const generateOtp = () => {
    return crypto.randomInt(0, 1000000)
        .toString()
        .padStart(6, "0");
};

// Email validation
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};


// ==========================================
// 1. REGISTER API
// ==========================================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Required fields
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        // Name validation
        if (normalizedName.length < 2 || normalizedName.length > 50) {
            return res.status(400).json({
                message: "Name must be between 2 and 50 characters"
            });
        }

        // Email validation
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Please enter a valid email address"
            });
        }

        // Password validation
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                message: "Password must be between 8 and 128 characters"
            });
        }

        // Check existing account
        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: existingUser.isEmailVerified
                    ? "An account with this email already exists. Please login."
                    : "An unverified account already exists. Please request a new OTP.",
                requiresVerification: !existingUser.isEmailVerified
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = generateOtp();
        const now = new Date();

        // Create user
        const user = new User({
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword,

            isEmailVerified: false,

            emailOtpHash: hashOtp(otp),
            emailOtpExpires: new Date(
                now.getTime() + 10 * 60 * 1000
            ),

            emailOtpAttempts: 0,
            emailOtpBlockedUntil: undefined,

            emailOtpLastSentAt: now,
            emailOtpResendCount: 0,
            emailOtpResendWindowStart: now
        });

        await user.save();

        // Send verification email
        try {
            await sendVerificationEmail(normalizedEmail, otp);

        } catch (emailError) {
            console.error("Register Email Error:", emailError);

            // Remove account if initial verification email fails
            await User.deleteOne({ _id: user._id });

            return res.status(503).json({
                message: "Verification email could not be sent. Please try signing up again."
            });
        }

        return res.status(201).json({
            message: "Account created successfully. Please verify your email.",
            email: normalizedEmail,
            requiresVerification: true
        });

    } catch (error) {
        console.error("Register Error:", error);

        // Handle duplicate email index error
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 2. VERIFY EMAIL API
// ==========================================

router.post("/verify-email", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (
            typeof email !== "string" ||
            typeof otp !== "string" ||
            !email.trim() ||
            !otp.trim()
        ) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpString = otp.trim();

        // OTP must be exactly 6 digits
        if (!/^\d{6}$/.test(otpString)) {
            return res.status(400).json({
                message: "Invalid OTP format"
            });
        }

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        if (user.isEmailVerified === true) {
            return res.status(200).json({
                message: "Email already verified"
            });
        }

        const now = Date.now();

        // Check active block
        if (
            user.emailOtpBlockedUntil &&
            user.emailOtpBlockedUntil.getTime() > now
        ) {
            const remainingMinutes = Math.ceil(
                (user.emailOtpBlockedUntil.getTime() - now) / 60000
            );

            return res.status(429).json({
                message: `Too many incorrect attempts. Try again after ${remainingMinutes} minutes.`
            });
        }

        // Reset attempts after block expires
        if (
            user.emailOtpBlockedUntil &&
            user.emailOtpBlockedUntil.getTime() <= now
        ) {
            user.emailOtpAttempts = 0;
            user.emailOtpBlockedUntil = undefined;
        }

        // Check OTP expiry
        if (
            !user.emailOtpHash ||
            !user.emailOtpExpires ||
            user.emailOtpExpires.getTime() <= now
        ) {
            await user.save();

            return res.status(400).json({
                message: "OTP expired. Please request a new OTP."
            });
        }

        // Compare OTP hash
        const enteredOtpHash = hashOtp(otpString);

        if (enteredOtpHash !== user.emailOtpHash) {
            user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;

            // Block after 5 incorrect attempts
            if (user.emailOtpAttempts >= 5) {
                user.emailOtpBlockedUntil = new Date(
                    now + 15 * 60 * 1000
                );
            }

            await user.save();

            if (user.emailOtpAttempts >= 5) {
                return res.status(429).json({
                    message: "Too many incorrect attempts. Try again after 15 minutes."
                });
            }

            return res.status(400).json({
                message: `Invalid OTP. ${5 - user.emailOtpAttempts} attempts remaining.`
            });
        }

        // Correct OTP - verify email
        user.isEmailVerified = true;

        // Clear OTP and security data
        user.emailOtpHash = undefined;
        user.emailOtpExpires = undefined;
        user.emailOtpAttempts = 0;
        user.emailOtpBlockedUntil = undefined;
        user.emailOtpLastSentAt = undefined;
        user.emailOtpResendCount = 0;
        user.emailOtpResendWindowStart = undefined;

        await user.save();

        return res.status(200).json({
            message: "Email verified successfully. You can now login."
        });

    } catch (error) {
        console.error("Email Verification Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 3. RESEND OTP API
// ==========================================

router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (
            typeof email !== "string" ||
            !email.trim()
        ) {
            return res.status(400).json({
                message: "Valid email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({
                message: "Email is already verified"
            });
        }

        const now = new Date();
        const nowTime = now.getTime();

        // Check active block
        if (
            user.emailOtpBlockedUntil &&
            user.emailOtpBlockedUntil.getTime() > nowTime
        ) {
            const remainingMinutes = Math.ceil(
                (user.emailOtpBlockedUntil.getTime() - nowTime) / 60000
            );

            return res.status(429).json({
                message: `Too many incorrect attempts. Please try again after ${remainingMinutes} minutes.`
            });
        }

        // Reset attempts after block expires
        if (
            user.emailOtpBlockedUntil &&
            user.emailOtpBlockedUntil.getTime() <= nowTime
        ) {
            user.emailOtpAttempts = 0;
            user.emailOtpBlockedUntil = undefined;
        }

        // Check 60 seconds cooldown
        if (user.emailOtpLastSentAt) {
            const timeSinceLastSent =
                nowTime - user.emailOtpLastSentAt.getTime();

            if (timeSinceLastSent < 60000) {
                const remainingSeconds = Math.ceil(
                    (60000 - timeSinceLastSent) / 1000
                );

                return res.status(429).json({
                    message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
                    remainingSeconds
                });
            }
        }

        // Maximum 5 resend requests per hour
        const oneHour = 60 * 60 * 1000;

        if (
            !user.emailOtpResendWindowStart ||
            nowTime - user.emailOtpResendWindowStart.getTime() >= oneHour
        ) {
            user.emailOtpResendCount = 0;
            user.emailOtpResendWindowStart = now;
        }

        if ((user.emailOtpResendCount || 0) >= 5) {
            return res.status(429).json({
                message: "Too many OTP requests. Please try again after one hour."
            });
        }

        // Save previous data AFTER expired block/window resets
        const previousOtpHash = user.emailOtpHash;
        const previousOtpExpires = user.emailOtpExpires;
        const previousLastSentAt = user.emailOtpLastSentAt;
        const previousResendCount = user.emailOtpResendCount;
        const previousWindowStart = user.emailOtpResendWindowStart;
        const previousAttempts = user.emailOtpAttempts;
        const previousBlockedUntil = user.emailOtpBlockedUntil;

        // Generate new OTP
        const otp = generateOtp();

        user.emailOtpHash = hashOtp(otp);
        user.emailOtpExpires = new Date(
            nowTime + 10 * 60 * 1000
        );

        user.emailOtpLastSentAt = now;
        user.emailOtpResendCount = (user.emailOtpResendCount || 0) + 1;

        await user.save();

        // Send new OTP
        try {
            await sendVerificationEmail(normalizedEmail, otp);

        } catch (emailError) {
            console.error("Resend OTP Email Error:", emailError);

            // Restore previous OTP and resend details
            user.emailOtpHash = previousOtpHash;
            user.emailOtpExpires = previousOtpExpires;
            user.emailOtpLastSentAt = previousLastSentAt;
            user.emailOtpResendCount = previousResendCount;
            user.emailOtpResendWindowStart = previousWindowStart;
            user.emailOtpAttempts = previousAttempts;
            user.emailOtpBlockedUntil = previousBlockedUntil;

            await user.save();

            return res.status(503).json({
                message: "OTP email could not be sent. Please try again later."
            });
        }

        return res.status(200).json({
            message: "New OTP sent successfully.",
            email: normalizedEmail
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 4. LOGIN API
// ==========================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "Account not found. Please sign up."
            });
        }

        // Only verified users can login
        if (user.isEmailVerified !== true) {
            return res.status(403).json({
                message: "Please verify your email before login.",
                requiresVerification: true,
                email: normalizedEmail
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid credentials."
            });
        }

        if (!process.env.JWT_SECRET_KEY) {
            console.error("JWT_SECRET_KEY is missing in .env");

            return res.status(500).json({
                message: "Server configuration error"
            });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 5. BLOCK USER API
// ==========================================

router.post("/block-user", async (req, res) => {
    try {
        const { myId, blockUserId } = req.body;

        if (!myId || !blockUserId) {
            return res.status(400).json({
                success: false,
                message: "User IDs are required"
            });
        }

        if (myId === blockUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself"
            });
        }

        await User.findByIdAndUpdate(
            myId,
            {
                $addToSet: {
                    blockedUsers: blockUserId
                }
            }
        );

        const receiverSocketId = global.users?.[blockUserId];

        if (receiverSocketId && global.io) {
            global.io.to(receiverSocketId).emit(
                "userBlockedMe",
                { blockedBy: myId }
            );
        }

        return res.status(200).json({
            success: true,
            message: "User blocked successfully"
        });

    } catch (error) {
        console.error("Block User Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});


// ==========================================
// 6. UNBLOCK USER API
// ==========================================

router.post("/unblock-user", async (req, res) => {
    try {
        const { myId, unblockUserId } = req.body;

        if (!myId || !unblockUserId) {
            return res.status(400).json({
                success: false,
                message: "User IDs are required"
            });
        }

        await User.findByIdAndUpdate(
            myId,
            {
                $pull: {
                    blockedUsers: unblockUserId
                }
            }
        );

        const receiverSocketId = global.users?.[unblockUserId];

        if (receiverSocketId && global.io) {
            global.io.to(receiverSocketId).emit(
                "userUnblockedMe",
                { unblockedBy: myId }
            );
        }

        return res.status(200).json({
            success: true,
            message: "User unblocked successfully"
        });

    } catch (error) {
        console.error("Unblock User Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});



// ==========================================
// 5. FORGOT PASSWORD API
// ==========================================

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Valid email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Generic response prevents account discovery
        const genericMessage =
            "If a verified account exists, a password reset OTP will be sent.";

        const user = await User.findOne({
            email: normalizedEmail,
            isEmailVerified: true
        });

        if (!user) {
            return res.status(200).json({
                message: genericMessage
            });
        }

        const now = new Date();
        const nowTime = now.getTime();

        // Check active block
        if (
            user.resetPasswordOtpBlockedUntil &&
            user.resetPasswordOtpBlockedUntil.getTime() > nowTime
        ) {
            const remainingMinutes = Math.ceil(
                (user.resetPasswordOtpBlockedUntil.getTime() - nowTime) / 60000
            );

            return res.status(429).json({
                message: `Too many incorrect attempts. Try again after ${remainingMinutes} minutes.`
            });
        }

        // Reset attempts after block expires
        if (
            user.resetPasswordOtpBlockedUntil &&
            user.resetPasswordOtpBlockedUntil.getTime() <= nowTime
        ) {
            user.resetPasswordOtpAttempts = 0;
            user.resetPasswordOtpBlockedUntil = undefined;
        }

        // 60 seconds cooldown
        if (user.resetPasswordOtpLastSentAt) {
            const timeSinceLastSent =
                nowTime - user.resetPasswordOtpLastSentAt.getTime();

            if (timeSinceLastSent < 60000) {
                const remainingSeconds = Math.ceil(
                    (60000 - timeSinceLastSent) / 1000
                );

                return res.status(429).json({
                    message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
                    remainingSeconds
                });
            }
        }

        // Maximum 5 requests per hour
        const oneHour = 60 * 60 * 1000;

        if (
            !user.resetPasswordOtpResendWindowStart ||
            nowTime - user.resetPasswordOtpResendWindowStart.getTime() >= oneHour
        ) {
            user.resetPasswordOtpResendCount = 0;
            user.resetPasswordOtpResendWindowStart = now;
        }

        if ((user.resetPasswordOtpResendCount || 0) >= 5) {
            return res.status(429).json({
                message: "Too many OTP requests. Please try again after one hour."
            });
        }

        // Generate OTP
        const otp = generateOtp();

        // Save previous data for rollback if email fails
        const previousData = {
            hash: user.resetPasswordOtpHash,
            expires: user.resetPasswordOtpExpires,
            lastSent: user.resetPasswordOtpLastSentAt,
            count: user.resetPasswordOtpResendCount,
            window: user.resetPasswordOtpResendWindowStart,
            attempts: user.resetPasswordOtpAttempts,
            blocked: user.resetPasswordOtpBlockedUntil
        };

        user.resetPasswordOtpHash = hashOtp(otp);
        user.resetPasswordOtpExpires = new Date(nowTime + 10 * 60 * 1000);
        user.resetPasswordOtpLastSentAt = now;
        user.resetPasswordOtpResendCount =
            (user.resetPasswordOtpResendCount || 0) + 1;

        await user.save();

        try {
            // Temporary: uses your existing email function
            // await sendVerificationEmail(normalizedEmail, otp);
            await sendPasswordResetEmail(normalizedEmail, otp);
        } catch (emailError) {
            console.error("Forgot Password Email Error:", emailError);

            user.resetPasswordOtpHash = previousData.hash;
            user.resetPasswordOtpExpires = previousData.expires;
            user.resetPasswordOtpLastSentAt = previousData.lastSent;
            user.resetPasswordOtpResendCount = previousData.count;
            user.resetPasswordOtpResendWindowStart = previousData.window;
            user.resetPasswordOtpAttempts = previousData.attempts;
            user.resetPasswordOtpBlockedUntil = previousData.blocked;

            await user.save();

            return res.status(503).json({
                message: "OTP email could not be sent. Please try again later."
            });
        }

        return res.status(200).json({
            message: genericMessage
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 6. VERIFY RESET OTP API
// ==========================================

router.post("/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (
            typeof email !== "string" ||
            typeof otp !== "string" ||
            !email.trim() ||
            !otp.trim()
        ) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpString = otp.trim();

        if (!/^\d{6}$/.test(otpString)) {
            return res.status(400).json({
                message: "Invalid OTP format"
            });
        }

        const user = await User.findOne({
            email: normalizedEmail,
            isEmailVerified: true
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired OTP"
            });
        }

        const now = Date.now();

        // Check active block
        if (
            user.resetPasswordOtpBlockedUntil &&
            user.resetPasswordOtpBlockedUntil.getTime() > now
        ) {
            const remainingMinutes = Math.ceil(
                (user.resetPasswordOtpBlockedUntil.getTime() - now) / 60000
            );

            return res.status(429).json({
                message: `Too many incorrect attempts. Try again after ${remainingMinutes} minutes.`
            });
        }

        // Reset attempts after block expires
        if (
            user.resetPasswordOtpBlockedUntil &&
            user.resetPasswordOtpBlockedUntil.getTime() <= now
        ) {
            user.resetPasswordOtpAttempts = 0;
            user.resetPasswordOtpBlockedUntil = undefined;
        }

        // Check OTP expiry
        if (
            !user.resetPasswordOtpHash ||
            !user.resetPasswordOtpExpires ||
            user.resetPasswordOtpExpires.getTime() <= now
        ) {
            await user.save();

            return res.status(400).json({
                message: "OTP expired. Please request a new OTP."
            });
        }

        // Compare OTP hash
        const enteredOtpHash = hashOtp(otpString);

        if (enteredOtpHash !== user.resetPasswordOtpHash) {
            user.resetPasswordOtpAttempts =
                (user.resetPasswordOtpAttempts || 0) + 1;

            if (user.resetPasswordOtpAttempts >= 5) {
                user.resetPasswordOtpBlockedUntil =
                    new Date(now + 15 * 60 * 1000);
            }

            await user.save();

            if (user.resetPasswordOtpAttempts >= 5) {
                return res.status(429).json({
                    message: "Too many incorrect attempts. Try again after 15 minutes."
                });
            }

            return res.status(400).json({
                message: `Invalid OTP. ${5 - user.resetPasswordOtpAttempts} attempts remaining.`
            });
        }

        // Correct OTP: generate one-time reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordTokenHash = hashOtp(resetToken);
        user.resetPasswordTokenExpires =
            new Date(now + 10 * 60 * 1000);

        // Clear OTP data
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        user.resetPasswordOtpBlockedUntil = undefined;
        user.resetPasswordOtpLastSentAt = undefined;
        user.resetPasswordOtpResendCount = 0;
        user.resetPasswordOtpResendWindowStart = undefined;

        await user.save();

        return res.status(200).json({
            message: "OTP verified successfully. You can now reset your password.",
            resetToken
        });

    } catch (error) {
        console.error("Verify Reset OTP Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});


// ==========================================
// 7. RESET PASSWORD API
// ==========================================

router.post("/reset-password", async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (
            typeof resetToken !== "string" ||
            typeof newPassword !== "string" ||
            !resetToken.trim() ||
            !newPassword
        ) {
            return res.status(400).json({
                message: "Reset token and new password are required"
            });
        }

        if (newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({
                message: "Password must be between 8 and 128 characters"
            });
        }

        const tokenHash = hashOtp(resetToken.trim());

        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordTokenExpires: { $gt: new Date() },
            isEmailVerified: true
        });

        if (!user) {
            return res.status(400).json({
                message: "Reset session is invalid or expired. Please start again."
            });
        }

        // Hash new password
        user.password = await bcrypt.hash(newPassword, 10);

        // Clear reset token
        user.resetPasswordTokenHash = undefined;
        user.resetPasswordTokenExpires = undefined;

        // Clear any remaining reset OTP data
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        user.resetPasswordOtpBlockedUntil = undefined;
        user.resetPasswordOtpLastSentAt = undefined;
        user.resetPasswordOtpResendCount = 0;
        user.resetPasswordOtpResendWindowStart = undefined;

        await user.save();

        return res.status(200).json({
            message: "Password reset successfully. Please login with your new password."
        });

    } catch (error) {
        console.error("Reset Password Error:", error);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
});



module.exports = router;
