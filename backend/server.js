const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const cors = require("cors");
const socketIo = require('socket.io');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const os = require('os');

// get ip 
function getLocalIP() {
    const interfaces = os.networkInterfaces();

    for (let interfaceName in interfaces) {
        for (let iface of interfaces[interfaceName]) {
            // Skip internal (127.0.0.1) and non-IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}


// Ensure the full uploads folder exists
const uploadPath = path.join(__dirname, "uploads/avatars");
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const uploadFiles = path.join(__dirname, "uploads/files");
if (!fs.existsSync(uploadFiles)) {
    fs.mkdirSync(uploadFiles, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", require("./Routes/authRoute"));
app.use("/api/chats", require("./Routes/chatRoute"));
app.use("/api/users", require("./Routes/users"));




// Global Socket.io references
global.users = {}; // { userId: socketId }
global.io = null;

// Socket.io
const io = socketIo(server, {
    pingTimeout: 5000,    // 5 sec mein detect karega agar connection lost hai
    pingInterval: 2000,   // Har 2 sec mein check karega
    // cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
    // cors: { origin: "https://untextually-arthritical-ferdinand.ngrok-free.dev", methods: ["GET", "POST"] }
    cors: { origin:[ "http://192.168.100.227:5173", "http://localhost:5173"], methods: ["GET", "POST"] }
});
global.io = io; // assign io to global so routes can access it

io.on("connection", (socket) => {

    console.log("User connected: ", socket.id);

    socket.on("join", (userId) => {
        if (!userId) return;

        // ⭐ Sabse important: socket instance ke saath userId attach karein
        socket.userId = userId;

        global.users[userId] = socket.id;

        io.emit("onlineusers", Object.keys(global.users));
    });


    // Receive private messages
    socket.on("privateMessage", ({ sender, receiver, message, file, _id }) => {

        const receiverSocketId = global.users[receiver];

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receiveMessage", {
                sender,
                message,
                file,
                _id,
                createdAt: new Date()
            });
        }

    });

    // Handle message deletion

    socket.on("deleteMessage", ({ messageId, senderId, receiverId }) => {
        const receiverSocketId = global.users[receiverId];
        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit("messageDeleted", { messageId, senderId });
        }
    });

    // Disconnect handling
    // ⭐ Disconnect logic ko optimize karein
    socket.on("disconnect", () => {
        if (socket.userId) {
            // Bina loop chalaye turant delete karein
            delete global.users[socket.userId];

            // Sabko turant update bhejein
            io.emit("onlineusers", Object.keys(global.users));
            console.log(`User ${socket.userId} is now offline.`);
        }
        console.log("Socket disconnected:", socket.id);
    });

    // call wala socket 

    // Video call signaling
    socket.on("callUser", ({ to, from, name, offer }) => {
        const receiverSocketId = global.users[to];
        if (receiverSocketId) {
            console.log("📞 CALL REQUEST:", { to, from, name });
            io.to(receiverSocketId).emit("incomingCall", { from, name, offer });
        }
    });

    socket.on("acceptCall", ({ to, answer }) => {
        const callerSocketId = global.users[to];
        if (callerSocketId) {
            io.to(callerSocketId).emit("callAccepted", { answer });
        }
    });

    socket.on("rejectCall", ({ to }) => {
        const callerSocketId = global.users[to];
        if (callerSocketId) {
            io.to(callerSocketId).emit("callRejected");
        }
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
        const receiverSocketId = global.users[to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("iceCandidate", { candidate });
        }
    });


});

// Connect to MongoDB then start server
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log("MongoDB connected");
        // server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Local Access: http://localhost:${PORT}`);
            console.log(`Network Access: ${getLocalIP()}:${PORT}`); // Aapka Hotspot IP
        });
    })
    .catch(err => console.log("MongoDB connection error:", err));