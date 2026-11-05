const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String, unique: true, required: true, lowercase: true, trim: true
    },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    emailOtpHash: { type: String, default: undefined },
    emailOtpExpires: { type: Date, default: undefined },
    emailOtpAttempts: { type: Number, default: 0 },
    emailOtpBlockedUntil: { type: Date, default: undefined },
    emailOtpLastSentAt: { type: Date, default: undefined },
    emailOtpResendCount: { type: Number, default: 0 },
    emailOtpResendWindowStart: { type: Date, default: undefined },
    resetPasswordOtpHash: { type: String, default: undefined },
    resetPasswordOtpExpires: { type: Date, default: undefined },
    resetPasswordOtpAttempts: { type: Number, default: 0 },
    resetPasswordOtpBlockedUntil: { type: Date, default: undefined },
    resetPasswordOtpLastSentAt: { type: Date, default: undefined },
    resetPasswordOtpResendCount: { type: Number, default: 0 },
    resetPasswordOtpResendWindowStart: { type: Date, default: undefined },
    resetPasswordTokenHash: { type: String, default: undefined },
    resetPasswordTokenExpires: { type: Date, default: undefined },

    avatar: { type: String, default: "" },
    status: { type: String, default: "offline" },
    archivedChats: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    blockedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ]

},
    { timestamps: true }
);


module.exports = mongoose.model("User", userSchema)




// const mongoose = require('mongoose')

// const userSchema = new mongoose.Schema({
//     name: { type: String, unique: true },
//     email: { type: String, unique: true, required: true },
//     password: { type: String, required: true },
//     avatar: { type: String, default: "" },
//     status: { type: String, default: "offline" },
//     archivedChats: [
//         {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User"
//         }
//     ]

// },
//     { timestamps: true }
// );


// module.exports = mongoose.model("User", userSchema)
