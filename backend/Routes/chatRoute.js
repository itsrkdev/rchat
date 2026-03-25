const express = require('express')
const router = express.Router()
const Chat = require("../Models/ChatModel");
const authMiddleware = require('../Middleware/authmiddleware')
const multer = require("multer");
const path = require("path");


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/files");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// router.post line ko change karein
router.post("/", authMiddleware, upload.array("file", 10), async (req, res) => {
  try {
    const { receiver, message } = req.body;

    // Agar frontend se loop mein single single file aa rahi hai (req.files array hoga)
    const fileUrl = req.files && req.files.length > 0
      ? `/uploads/files/${req.files[0].filename}`
      : null;

    const newMessage = await Chat.create({
      sender: req.userId,
      receiver: receiver,
      message: message,
      file: fileUrl
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get chat messages between two users (exclude deleted messages)
router.get("/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const messages = await Chat.find({
      $or: [
        { sender: req.userId, receiver: userId },
        { sender: userId, receiver: req.userId }
      ],
      deletedBy: { $ne: req.userId } // hide messages deleted by this user
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const message = await Chat.findById(id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Mark message as deleted for the sender
    if (!message.deletedBy.includes(req.userId)) {
      message.deletedBy.push(req.userId);
    }

    // Also mark deleted for the receiver
    const otherUserId =
      message.sender.toString() === req.userId
        ? message.receiver.toString()
        : message.sender.toString();

    if (!message.deletedBy.includes(otherUserId)) {
      message.deletedBy.push(otherUserId);
    }

    await message.save();


    // Notify both sender and receiver (if online)
    const involvedUsers = [message.sender.toString(), message.receiver.toString()];
    involvedUsers.forEach(userId => {
      const socketId = global.users[userId];
      if (socketId) {
        global.io.to(socketId).emit("messageDeleted", { messageId: id });
      }
    });


    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;

