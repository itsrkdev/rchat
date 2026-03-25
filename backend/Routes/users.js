const express = require("express");
const User = require("../Models/UserModel");
const authMiddleware = require("../Middleware/authmiddleware");
const mongoose = require("mongoose");
const router = express.Router();
const multer = require("multer");
const path = require('path');


// Configure storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../uploads/avatars")); // make sure it matches server.js
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, req.userId + '-' + Date.now() + ext);
    }
});
const upload = multer({ storage });

// Upload avatar
router.post("/upload-avatar", authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            { avatar: `/uploads/avatars/${req.file.filename}` },
            { new: true }
        );

        res.json({ message: "Avatar updated successfully", avatar: updatedUser.avatar });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});




router.get("/", authMiddleware, async (req, res) => {
    try {
        // Ensure req.userId is ObjectId
        const currentUserId = new mongoose.Types.ObjectId(req.userId);

        // Fetch all other users
        const users = await User.find({
            _id: { $ne: currentUserId }
        }).select("_id name avatar status");

        res.json(users);

    } catch (err) {
        console.error("Error fetching chat list:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.post("/archive-chat", authMiddleware, async (req, res) => {
    try {

        const { chatId } = req.body;
        const userId = req.userId; // ✅ consistent

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isArchived = user.archivedChats.some(
            id => id.toString() === chatId
        );

        if (isArchived) {
            user.archivedChats = user.archivedChats.filter(
                id => id.toString() !== chatId
            );
        } else {
            user.archivedChats.push(chatId);
        }

        await user.save();

        res.json({
            archivedChats: user.archivedChats
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


router.post("/loguser", authMiddleware, async (req, res) => {
    try {

        const currentUser = await User.findById(req.userId)
            .select("_id name avatar status archivedChats");

        res.json({
            ...currentUser._doc,
            archivedChats: currentUser.archivedChats
        });

    } catch (err) {
        console.error("Error fetching logged-in user:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// router.post("/loguser", authMiddleware, async (req, res) => {
//     try {
//         const currentUser = await User.findById(req.userId)
//             .select("_id name avatar  status");

//         res.json(currentUser);
//     } catch (err) {
//         console.error("Error fetching logged-in user:", err);
//         res.status(500).json({ message: "Server error" });
//     }
// });




module.exports = router;