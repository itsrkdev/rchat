const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "" },
    status: { type: String, default: "offline" },
    archivedChats: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ]

},
    { timestamps: true }
);


module.exports = mongoose.model("User", userSchema)