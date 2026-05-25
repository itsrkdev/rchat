const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// =========================
// NETWORK IP
// =========================

const getNetworkIp = () => {

    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {

        for (const iface of interfaces[name]) {

            if (
                iface.family === "IPv4" &&
                !iface.internal
            ) {
                return iface.address;
            }
        }
    }

    return "localhost";
};

// =========================
// FOLDERS
// =========================

const uploadPath = path.join(
    __dirname,
    "uploads/avatars"
);

if (!fs.existsSync(uploadPath)) {

    fs.mkdirSync(uploadPath, {
        recursive: true
    });
}

const uploadFiles = path.join(
    __dirname,
    "uploads/files"
);

if (!fs.existsSync(uploadFiles)) {

    fs.mkdirSync(uploadFiles, {
        recursive: true
    });
}

// =========================
// MIDDLEWARE
// =========================

app.use(cors({
    origin: [
        "https://r-chat1.netlify.app",
        "https://rchat-gcv1.onrender.com"
    ],
    credentials: true
}));

app.use(express.json());

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);

// =========================
// ROUTES
// =========================

app.use(
    "/api/auth",
    require("./Routes/authRoute")
);

app.use(
    "/api/chats",
    require("./Routes/chatRoute")
);

app.use(
    "/api/users",
    require("./Routes/users")
);

app.get("/", (req, res) => {
    res.send("Server Running");
});

// =========================
// SOCKET.IO
// =========================

const io = socketIo(server, {

    cors: {
        origin: [
            "https://r-chat1.netlify.app",
            "https://rchat-gcv1.onrender.com"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },

    transports: ["websocket"],

    pingTimeout: 60000,

    pingInterval: 25000
});

// =========================
// GLOBAL USERS
// =========================

global.users = {};
global.io = io;

// =========================
// SOCKET CONNECTION
// =========================

io.on("connection", (socket) => {

    console.log(
        "✅ Socket Connected:",
        socket.id
    );

    // =========================
    // JOIN
    // =========================

    socket.on("join", (userId) => {

        try {

            if (!userId) return;

            // old socket remove
            if (
                global.users[userId] &&
                global.users[userId] !== socket.id
            ) {

                delete global.users[userId];
            }

            socket.userId = userId;

            socket.join(userId);

            global.users[userId] = socket.id;

            console.log(
                `🟢 User Joined: ${userId}`
            );

            io.emit(
                "onlineusers",
                Object.keys(global.users)
            );

        } catch (err) {
            console.log("Join Error:", err);
        }
    });

    // =========================
    // PRIVATE MESSAGE
    // =========================

    socket.on(
        "privateMessage",
        (data) => {

            try {

                const {
                    sender,
                    receiver,
                    message,
                    file,
                    _id
                } = data;

                if (!receiver) return;

                io.to(receiver).emit(
                    "receiveMessage",
                    {
                        sender,
                        receiver,
                        message,
                        file,
                        _id,
                        createdAt: new Date()
                    }
                );

            } catch (err) {
                console.log(
                    "Private Msg Error:",
                    err
                );
            }
        }
    );

    // =========================
    // DELETE MESSAGE
    // =========================

    socket.on(
        "deleteMessage",
        ({
            messageId,
            senderId,
            receiverId
        }) => {

            try {

                if (!receiverId) return;

                io.to(receiverId).emit(
                    "messageDeleted",
                    {
                        messageId,
                        senderId
                    }
                );

            } catch (err) {
                console.log(
                    "Delete Msg Error:",
                    err
                );
            }
        }
    );

    // =========================
    // CALL USER
    // =========================

    socket.on(
        "callUser",
        ({
            to,
            from,
            name,
            offer
        }) => {

            try {

                if (!to || !offer) return;

                console.log(
                    `📞 Call From ${from} -> ${to}`
                );

                io.to(to).emit(
                    "incomingCall",
                    {
                        to,
                        from,
                        name,
                        offer
                    }
                );

            } catch (err) {
                console.log(
                    "Call User Error:",
                    err
                );
            }
        }
    );

    // =========================
    // ACCEPT CALL
    // =========================

    socket.on(
        "acceptCall",
        ({ to, answer }) => {

            try {

                if (!to || !answer) return;

                console.log(
                    `✅ Call Accepted -> ${to}`
                );

                io.to(to).emit(
                    "callAccepted",
                    {
                        answer
                    }
                );

            } catch (err) {
                console.log(
                    "Accept Call Error:",
                    err
                );
            }
        }
    );

    // =========================
    // REJECT CALL
    // =========================

    socket.on(
        "callRejected",
        ({ to }) => {

            try {

                if (!to) return;

                console.log(
                    `🚫 Call Rejected -> ${to}`
                );

                io.to(to).emit(
                    "callRejected"
                );

            } catch (err) {
                console.log(
                    "Reject Call Error:",
                    err
                );
            }
        }
    );

    // =========================
    // END CALL
    // =========================

    socket.on(
        "endCall",
        ({ to }) => {

            try {

                if (!to) return;

                console.log(
                    `📴 Call Ended -> ${to}`
                );

                io.to(to).emit(
                    "callEnded"
                );

            } catch (err) {
                console.log(
                    "End Call Error:",
                    err
                );
            }
        }
    );

    // =========================
    // ICE CANDIDATE
    // =========================

    socket.on(
        "iceCandidate",
        ({ to, candidate }) => {

            try {

                if (!to || !candidate)
                    return;

                io.to(to).emit(
                    "iceCandidate",
                    {
                        candidate,
                        from: socket.userId
                    }
                );

            } catch (err) {
                console.log(
                    "ICE Error:",
                    err
                );
            }
        }
    );

    // =========================
    // DISCONNECT
    // =========================

    socket.on(
        "disconnect",
        (reason) => {

            try {

                console.log(
                    "❌ Socket Disconnected:",
                    socket.id,
                    reason
                );

                if (socket.userId) {

                    // only remove if same socket
                    if (
                        global.users[socket.userId] === socket.id
                    ) {

                        delete global.users[
                            socket.userId
                        ];

                        io.emit(
                            "onlineusers",
                            Object.keys(global.users)
                        );

                        console.log(
                            `🔴 User Offline: ${socket.userId}`
                        );
                    }
                }

            } catch (err) {
                console.log(
                    "Disconnect Error:",
                    err
                );
            }
        }
    );
});

// =========================
// DATABASE
// =========================

mongoose.connect(process.env.MONGO_URL)

    .then(() => {

        console.log("✅ MongoDB Connected");

        const networkIp =
            getNetworkIp();

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `🚀 Server Running On ${PORT}`
                );

                console.log(
                    `🌐 Local: http://localhost:${PORT}`
                );

                console.log(
                    `📱 Network: http://${networkIp}:${PORT}`
                );
            }
        );
    })

    .catch((err) => {

        console.log(
            "MongoDB Error:",
            err
        );
    });






// const express = require("express");
// const mongoose = require('mongoose');
// const http = require('http');
// const cors = require("cors");
// const socketIo = require('socket.io');
// require('dotenv').config();
// const fs = require('fs');
// const path = require('path');
// const app = express();
// const PORT = process.env.PORT || 3000;
// const server = http.createServer(app);
// const os = require('os');




// const getNetworkIp = () => {
//     const interfaces = os.networkInterfaces();
//     for (const name in interfaces) {
//         for (const iface of interfaces[name]) {
//             // Filter for IPv4 and skip 'internal' (127.0.0.1)
//             if (iface.family === 'IPv4' && !iface.internal) {
//                 return iface.address;
//             }
//         }
//     }
//     return 'localhost';
// };


// // Ensure the full uploads folder exists
// const uploadPath = path.join(__dirname, "uploads/avatars");
// if (!fs.existsSync(uploadPath)) {
//     fs.mkdirSync(uploadPath, { recursive: true });
// }

// const uploadFiles = path.join(__dirname, "uploads/files");
// if (!fs.existsSync(uploadFiles)) {
//     fs.mkdirSync(uploadFiles, { recursive: true });
// }

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use('/uploads', express.static(path.join(__dirname, "uploads")));

// // Routes
// app.use("/api/auth", require("./Routes/authRoute"));
// app.use("/api/chats", require("./Routes/chatRoute"));
// app.use("/api/users", require("./Routes/users"));
// app.get("/",(req,res)=>{
//     res.send("server is running")
// })



// // Global Socket.io references
// global.users = {}; // { userId: socketId }
// global.io = null;

// // Socket.io
// const io = socketIo(server, {
//     pingTimeout: 5000,    // 5 sec mein detect karega agar connection lost hai
//     pingInterval: 2000,   // Har 2 sec mein check karega
//    cors: { origin: ["https://r-chat1.netlify.app", "https://rchat-gcv1.onrender.com"] }
//     // cors: { origin: "*", methods: ["GET", "POST"] }
// });
// global.io = io; // assign io to global so routes can access it

// io.on("connection", (socket) => {

//     console.log("User connected: ", socket.id);


//     // 1. Join event mein room join karwao
// socket.on("join", (userId) => {
//     if (!userId) return;

//     // 🔴 BRAHMASTRA CHECK: Agar ye user pehle se isi socket ID se joined hai,
//     // toh use dubara save mat karo aur na hi sabko 'onlineusers' emit karo!
//     if (global.users[userId] === socket.id) {
//         console.log(`User ${userId} already active on this socket. Skipping loop.`);
//         return; 
//     }

//     // Agar naya connection hai ya socket ID change hui hai, tabhi aage badho
//     socket.join(userId); // User ki ID ko room bana diya
//     socket.userId = userId; 
//     global.users[userId] = socket.id;
    
//     console.log(`User ${userId} joined their personal room`);
    
//     // Saare clients ko fresh online users list bhejo (Sirf tabhi chalega jab real change ho)
//     io.emit("onlineusers", Object.keys(global.users));
// });

//     // Receive private messages
//     socket.on("privateMessage", ({ sender, receiver, message, file, _id }) => {

//         const receiverSocketId = global.users[receiver];

//         if (receiverSocketId) {
//             io.to(receiverSocketId).emit("receiveMessage", {
//                 sender,
//                 message,
//                 file,
//                 _id,
//                 createdAt: new Date()
//             });
//         }

//     });

//     // Handle message deletion

//     socket.on("deleteMessage", ({ messageId, senderId, receiverId }) => {
//         const receiverSocketId = global.users[receiverId];
//         if (receiverSocketId) {
//             global.io.to(receiverSocketId).emit("messageDeleted", { messageId, senderId });
//         }
//     });

//     // Disconnect handling
//     // ⭐ Disconnect logic ko optimize karein
//     socket.on("disconnect", () => {
//         if (socket.userId) {
//             // Bina loop chalaye turant delete karein
//             delete global.users[socket.userId];

//             // Sabko turant update bhejein
//             io.emit("onlineusers", Object.keys(global.users));
//             console.log(`User ${socket.userId} is now offline.`);
//         }
//         console.log("Socket disconnected:", socket.id);
//     });


//     // 2. Call User logic (Clean & Simple)
//     socket.on("callUser", (data) => {
//         const { to, from, name, offer } = data;

//         console.log(`📞 Sending call to: ${to}`);

//         // Frontend ko 'to' property wapas bhejna ZAROORI hai 
//         // taaki wo match kar sake: if (data.to === currentUser._id)
//         io.to(to).emit("incomingCall", {
//             to: to,      // <--- YE LINE MISSING HAI SHAYAD
//             from: from,
//             name: name,
//             offer: offer
//         });

        
//     });


//      socket.on("acceptCall", ({ to, answer }) => {
//         console.log(`✅ Call accepted, sending to: ${to}`);

//         // Method 1: Room-based (primary)
//         io.to(to).emit("callAccepted", { answer });

//         // Method 2: Direct socketId fallback (backup)
//         const callerSocketId = global.users[to];
//         if (callerSocketId && callerSocketId !== socket.id) {
//             io.to(callerSocketId).emit("callAccepted", { answer });
//         }
//     });


//     socket.on("callRejected", ({ to }) => {
//         const callerSocketId = global.users[to];

//         if (callerSocketId) {
//             console.log(`🚫 Call Rejected by ${socket.id} for ${to}`);
//             io.to(callerSocketId).emit("callRejected");
//         } else {
//             // Safe check: Agar direct socketId nahi mili, toh Room try karo (Recommended)
//             io.to(to).emit("callRejected");
//         }
//     });


//     socket.on("endCall", ({ to }) => {
//     // 1. Pehle global object se target user ki socket ID nikaalo
//     const receiverSocketId = global.users[to];
//     console.log(`📴 Call Ended event received. Target User ID: ${to}`);

//     if (receiverSocketId) {
//         console.log(`Sending callEnded to Socket ID: ${receiverSocketId}`);
//         io.to(receiverSocketId).emit("callEnded");
//     } else {
//         console.log(`⚠️ User ${to} is offline or socket not found in global.users`);
        
//         // Agar aapne har user ko uski Mongo ID ke naam se room me join karwaya hua hai (socket.join(userId)), 
//         // tabhi ye line kaam karegi, varna iski zaroorat nahi hai:
//         io.to(to).emit("callEnded"); 
//     }
// });
   

//     // Backend: iceCandidate logic
//    socket.on("iceCandidate", ({ to, candidate }) => {
//     // 'to' yahan target user ki ID hai.
//     // Hamesha room (UserId) ka use karein kyunki aapne socket.join(userId) kiya hua hai.
//     io.to(to).emit("iceCandidate", { 
//         candidate, 
//         from: socket.userId // Kisne bheja ye batana bhi behtar hai
//     });
// });



// });

// const networkIp = getNetworkIp();
// // Connect to MongoDB then start server
// mongoose.connect(process.env.MONGO_URL)
//     .then(() => {
//         console.log("MongoDB connected");
//         // server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//         server.listen(PORT, "0.0.0.0", () => {
//             console.log(`Server running on port ${PORT}`);
//             console.log(`Local Access: http://localhost:${PORT}`);
//             console.log(`  Network Access: http://${networkIp}:${PORT}`); // Aapka Hotspot IP
//         });
//     })
//     .catch(err => console.log("MongoDB connection error:", err));
