const express = require('express');
const router = express.Router();
const Chat = require("../Models/ChatModel");
const authMiddleware = require('../Middleware/authmiddleware');
const { uploadChat, cloudinary } = require('../Middleware/cloudinaryConfig');

// 💡 Purana local multer diskStorage aur upload ka logic yahan se hata diya hai...

// 🟢 POST ROUTE: Naye uploadChat middleware ke sath update kiya
router.post("/", authMiddleware, uploadChat.array("file", 10), async (req, res) => {
  try {
    const { receiver, message } = req.body;

    // 🟢 Multer-storage-cloudinary path ke andar direct url deta hai
    const fileUrl = req.files && req.files.length > 0
      ? req.files[0].path // Ab isme direct https://res.cloudinary.com/... ka link aayega
      : null;

    const newMessage = await Chat.create({
      sender: req.userId,
      receiver: receiver,
      message: message,
      file: fileUrl
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET ROUTE: Waisa hi rahega jaise pehle tha

// GET ROUTE: Messages fetch karne ke sath dynamic identity aur Block Status check karega
router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const User = require("../Models/UserModel");

    // 1. Messages find karne ka aapka purana logic
    const messages = await Chat.find({
      $or: [
        { sender: req.userId, receiver: id },
        { sender: id, receiver: req.userId }
      ],
      deletedBy: { $ne: req.userId }
    }).sort({ createdAt: 1 });

    // 2. 🟢 IDENTITY SOLVER: 
    // Agar id direct user ki hai toh thik, warna pehle message se saamne wale user ki asli ID pakdo
    let targetUserId = id;
    if (messages.length > 0) {
      const firstMsg = messages[0];
      targetUserId = firstMsg.sender.toString() === req.userId.toString() 
        ? firstMsg.receiver.toString() 
        : firstMsg.sender.toString();
    }

    // 3. Dono users ka data database se nikalenge
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(targetUserId);

    let isBlocked = false;
    let blockedBy = null;

    // 4. Check karo ki kya dono me se kisi ne bhi block kiya hai
    if (currentUser && targetUser) {
      const iHaveBlocked = currentUser.blockedUsers.includes(targetUserId);
      const theyHaveBlocked = targetUser.blockedUsers.includes(req.userId);

      isBlocked = iHaveBlocked || theyHaveBlocked;
      blockedBy = iHaveBlocked ? req.userId : (theyHaveBlocked ? targetUserId : null);
    }

    // 5. Frontend ko perfect object response bhejo
    res.json({
      messages: messages,
      isBlocked: isBlocked,
      blockedBy: blockedBy
    });

  } catch (err) {
    console.error("Backend GET error:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// 🟢 DELETE ROUTE: Isme Cloudinary se media permanently destroy karne ka code jod diya hai
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

    // 🟢 CLOUDINARY FILE DELETE LOGIC
    // Agar chat me koi file saved thi aur dono users ne ya sender ne delete trigger kiya hai:
    if (message.file && message.file.startsWith("http")) {
      try {
        // Cloudinary URL se public_id nikalna (e.g., chat_app_files/abc12345)
        const urlParts = message.file.split('/');
        const fileWithExtension = urlParts.pop(); // e.g. "audio_123.webm" ya "img.png"
        const folderName = urlParts.pop();        // e.g. "chat_app_files"
        const publicId = `${folderName}/${fileWithExtension.split('.')[0]}`;

        // Agar file voice note (.webm) hai toh resource_type 'video' hota hai
        let resourceType = "image";
        if (message.file.endsWith(".webm") || message.file.includes("/video/")) {
          resourceType = "video";
        }

        // Cloudinary server se file permanently uda dega
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        console.log("Deleted from Cloudinary successfully:", publicId);
      } catch (cloudinaryErr) {
        console.error("Cloudinary Destroy Failed:", cloudinaryErr);
      }
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







// const express = require('express')
// const router = express.Router()
// const Chat = require("../Models/ChatModel");
// const authMiddleware = require('../Middleware/authmiddleware')
// const { uploadChat, cloudinary } = require('../Middleware/cloudinaryConfig');
// const multer = require("multer");
// const path = require("path");


// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/files");
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   }
// });

// const upload = multer({ storage });

// // router.post line ko change karein
// router.post("/", authMiddleware, upload.array("file", 10), async (req, res) => {
//   try {
//     const { receiver, message } = req.body;

//     // Agar frontend se loop mein single single file aa rahi hai (req.files array hoga)
//     const fileUrl = req.files && req.files.length > 0
//       ? `/uploads/files/${req.files[0].filename}`
//       : null;

//     const newMessage = await Chat.create({
//       sender: req.userId,
//       receiver: receiver,
//       message: message,
//       file: fileUrl
//     });

//     res.status(201).json(newMessage);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });


// // Get chat messages between two users (exclude deleted messages)
// router.get("/:userId", authMiddleware, async (req, res) => {
//   const { userId } = req.params;

//   try {
//     const messages = await Chat.find({
//       $or: [
//         { sender: req.userId, receiver: userId },
//         { sender: userId, receiver: req.userId }
//       ],
//       deletedBy: { $ne: req.userId } // hide messages deleted by this user
//     }).sort({ createdAt: 1 });

//     res.json(messages);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// router.delete("/:id", authMiddleware, async (req, res) => {
//   const { id } = req.params;

//   try {
//     const message = await Chat.findById(id);
//     if (!message) return res.status(404).json({ message: "Message not found" });

//     // Mark message as deleted for the sender
//     if (!message.deletedBy.includes(req.userId)) {
//       message.deletedBy.push(req.userId);
//     }

//     // Also mark deleted for the receiver
//     const otherUserId =
//       message.sender.toString() === req.userId
//         ? message.receiver.toString()
//         : message.sender.toString();

//     if (!message.deletedBy.includes(otherUserId)) {
//       message.deletedBy.push(otherUserId);
//     }

//     await message.save();


//     // Notify both sender and receiver (if online)
//     const involvedUsers = [message.sender.toString(), message.receiver.toString()];
//     involvedUsers.forEach(userId => {
//       const socketId = global.users[userId];
//       if (socketId) {
//         global.io.to(socketId).emit("messageDeleted", { messageId: id });
//       }
//     });


//     res.json({ message: "Message deleted successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });




// module.exports = router;

