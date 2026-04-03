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




const getNetworkIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // Filter for IPv4 and skip 'internal' (127.0.0.1)
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};


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
app.get("/",(req,res)=>{
    res.send("server is running")
})



// Global Socket.io references
global.users = {}; // { userId: socketId }
global.io = null;

// Socket.io
const io = socketIo(server, {
    pingTimeout: 5000,    // 5 sec mein detect karega agar connection lost hai
    pingInterval: 2000,   // Har 2 sec mein check karega
   cors: { origin: ["https://r-chat1.netlify.app", "https://rchat-gcv1.onrender.com"] }
    // cors: { origin: "*", methods: ["GET", "POST"] }
});
global.io = io; // assign io to global so routes can access it

io.on("connection", (socket) => {

    console.log("User connected: ", socket.id);


    // 1. Join event mein room join karwao
    socket.on("join", (userId) => {
        if (!userId) return;
        socket.join(userId); // ⭐ User ki ID ko hi room bana diya
        socket.userId = userId; // ⭐ Ye line add karein/////////
        global.users[userId] = socket.id;
        console.log(`User ${userId} joined their personal room`);
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


    // 2. Call User logic (Clean & Simple)
    socket.on("callUser", (data) => {
        const { to, from, name, offer } = data;

        console.log(`📞 Sending call to: ${to}`);

        // Frontend ko 'to' property wapas bhejna ZAROORI hai 
        // taaki wo match kar sake: if (data.to === currentUser._id)
        io.to(to).emit("incomingCall", {
            to: to,      // <--- YE LINE MISSING HAI SHAYAD
            from: from,
            name: name,
            offer: offer
        });

        
    });




    // socket.on("callUser", ({ to, from, name, offer }) => {
    //     console.log("📞 CALL REQUEST TO ROOM:", to);

    //     // ⭐ socket.id ki zaroorat nahi, directly 'to' (userId) wale room mein bhejo
    //     io.to(to).emit("incomingCall", { from, name, offer });

    //     console.log("FROM:", from);
    //     console.log("TO (Target):", to);
    //     console.log("Global Users List:", global.users);
    // });

    socket.on("acceptCall", ({ to, answer }) => {
         io.to(to).emit("callAccepted", { answer });
        // const callerSocketId = global.users[to];
        // if (callerSocketId) {
        //     io.to(callerSocketId).emit("callAccepted", { answer });
        // }
    });

    socket.on("callRejected", ({ to }) => {
        const callerSocketId = global.users[to];

        if (callerSocketId) {
            console.log(`🚫 Call Rejected by ${socket.id} for ${to}`);
            io.to(callerSocketId).emit("callRejected");
        } else {
            // Safe check: Agar direct socketId nahi mili, toh Room try karo (Recommended)
            io.to(to).emit("callRejected");
        }
    });

    socket.on("endCall", ({ to }) => {
        const receiverSocketId = global.users[to];
        console.log(`📴 Call Ended for: ${to}`);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callEnded");
        } else {
            io.to(to).emit("callEnded");
        }
    });


    socket.on("iceCandidate", ({ to, candidate }) => {
        io.to(to).emit("iceCandidate", { candidate });
        // const receiverSocketId = global.users[to];
        // if (receiverSocketId) {
        //     io.to(receiverSocketId).emit("iceCandidate", { candidate });
        // }
    });


});

const networkIp = getNetworkIp();
// Connect to MongoDB then start server
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log("MongoDB connected");
        // server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Local Access: http://localhost:${PORT}`);
            console.log(`  Network Access: http://${networkIp}:${PORT}`); // Aapka Hotspot IP
        });
    })
    .catch(err => console.log("MongoDB connection error:", err));
