const mongoose = require('mongoose')

const chatSchema = new mongoose.Schema({

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        // required: true,
    },
    file: {
        type: String
    },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
},
    { timestamps: true }
)


module.exports = mongoose.model("Chat", chatSchema);