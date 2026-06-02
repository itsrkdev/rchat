import React, { useState, useEffect, useRef } from 'react';
import { Phone, MessageSquareText, CircleFadingPlus, Users, MessageCircleCode, Settings, MessageSquarePlus, EllipsisVertical, PhoneOff, X,Video } from "lucide-react";
import "./Sidebar.css";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Archive } from "lucide-react";
const backendUrl = import.meta.env.VITE_BACKEND_URL;

const socket = io(backendUrl);

export default function Sidebar() {
    const fileInputRef = useRef(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const [archivedChats, setArchivedChats] = useState([]);
    const [showArchived, setShowArchived] = useState(false); // archived chat toggle
    const [users, setUsers] = useState([]);// all users
    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inp, setInp] = useState("");
    const [onlineUsers, setOnlineUsers] = useState([]); // track online userIds
    // Check karein kya yeh state pehle se bani hai? Agar nahi bani, toh add karein:
    const [isBlocked, setIsBlocked] = useState(false);

    const [lastMessages, setLastMessages] = useState({});
    const [unreadMessages, setUnreadMessages] = useState({});
    const [file, setFile] = useState(null);

    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const pendingCandidates = useRef([]);

    // 1. Nayi state add karein
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Video call states
    // --- VIDEO CALL STATES ---
    const [incomingCall, setIncomingCall] = useState(null);
    const [isCalling, setIsCalling] = useState(false);
    const [localStream, setLocalStream] = useState(null);

    // --- REFS ---
    const peerRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const activeCallRef = useRef(null);
    const messagesEndRef = useRef(null);

    const token = localStorage.getItem("token");
    const navigate = useNavigate();


    // 3. Back button function
    const handleBackToList = () => {
        setIsChatOpen(false);
    };

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
    };


    useEffect(() => {
        document.body.classList.remove("light", "dark");
        document.body.classList.add(theme);
    }, [theme]);

    // Jab bhi messages array badlega, ye function page ko smoothly niche scroll kar dega
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); // messages array update hote hi chalega


    // archiveeeeeee
    const handleArchive = async (chatId) => {
        try {
            const res = await fetch(`${backendUrl}/api/users/archive-chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ chatId })
            });

            const data = await res.json();
            setArchivedChats(data.archivedChats);

        } catch (err) {
            console.error(err);
        }
    };


    // Logout function
    const handleLogout = () => {
        socket.disconnect(); // ⭐ Ye server ko turant 'disconnect' event bhejega
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };


    const openModal = (fileUrl) => {
        setSelectedImage(fileUrl); // Kyunki URL hum pehle hi sahi karke bhej rahe hain
    };


    // Load current user and all other users
    useEffect(() => {
        async function loadUsers() {
            if (!token) return;

            // Get current user
            const resUser = await fetch(`${backendUrl}/api/users/loguser`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const user = await resUser.json();
            setCurrentUser(user);
            // ⭐ archived chats load
            setArchivedChats(user.archivedChats || []);

            // Join socket room
            socket.emit("join", user._id);

            // Get all users except current
            const resAll = await fetch(`${backendUrl}/api/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allUsers = await resAll.json();
            setUsers(allUsers.filter(u => u._id !== user._id));
        }
        loadUsers();
    }, [token]);

    // Listen for online users
    useEffect(() => {
        const handleOnlineUsers = (users) => {
            // console.log("Online users from server:", users);
            setOnlineUsers(users);
            // setOnlineUsers(users.map(String));
        };

        socket.on("onlineusers", handleOnlineUsers);

        // ⭐ Important: Jab socket connect ho, tab phir se list maangein
        socket.on("connect", () => {
            if (currentUser?._id) {
                socket.emit("join", currentUser._id);
            }
        });

        return () => {
            socket.off("onlineusers", handleOnlineUsers);
            socket.off("connect");
        };
    }, [currentUser]); // currentUser yahan bhi zaroori hai



    useEffect(() => {
        if (currentUser && currentUser._id) {
            // Forcefully ensure socket is connected before emitting
            if (socket.disconnected) {
                socket.connect();
            }
            // console.log("Sending join for:", currentUser._id);
            socket.emit("join", currentUser._id);
        }
    }, [currentUser]); // currentUser change hote hi turant chalega


    // Listen for incoming messages
    useEffect(() => {
        const handleReceive = (data) => {
            // data.message agar khali hai toh previewText ko manually "📎 File" set karein
            const previewText = data.message ? data.message : (data.file ? "📎 File" : "New message");

            // Update last message preview
            setLastMessages(prev => ({
                ...prev,
                [data.sender]: previewText
            }));

            // Chat ko top par move karein
            setUsers(prevUsers => {
                const userIndex = prevUsers.findIndex(u => u._id === data.sender);
                if (userIndex === -1) return prevUsers;

                const updatedUsers = [...prevUsers];
                const [chatUser] = updatedUsers.splice(userIndex, 1);
                updatedUsers.unshift(chatUser);
                return updatedUsers;
            });

            if (selectedChat?._id === data.sender) {
                setMessages(prev => [...prev, { ...data, type: "received", createdAt: new Date() }]);
            } else {
                setUnreadMessages(prev => ({ ...prev, [data.sender]: true }));
            }
        };

        socket.on("receiveMessage", handleReceive);
        return () => socket.off("receiveMessage", handleReceive);
    }, [selectedChat]);



    // Load chat messages when selecting a chat

    useEffect(() => {
    if (!selectedChat || !currentUser) return;

    async function loadMessages() {
        try {
            const res = await fetch(`${backendUrl}/api/chats/${selectedChat._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            console.log("👉 REFRESH PAR BACKEND KA DATA:", data);

            // 🟢 REFRESH PAR BLOCK STATUS SYNC KAREIN (UPDATED CONDITION)
            if (data && typeof data === 'object' && data.isBlocked) {
                setSelectedChat(prev => prev ? { 
                    ...prev, 
                    isBlocked: true, 
                    blockedBy: data.blockedBy,
                    isMeBlocked: data.blockedBy !== currentUser._id 
                } : prev);
            } else {
                setSelectedChat(prev => prev ? { 
                    ...prev, 
                    isBlocked: false, 
                    blockedBy: null,
                    isMeBlocked: false 
                } : prev);
            }

            // Messages array nikalna
            const rawMessages = data.messages ? data.messages : (Array.isArray(data) ? data : []);

            // Filter out messages deleted by the current user
            const filteredMessages = rawMessages.filter(
                m => !m.deletedBy.includes(currentUser._id)
            );

            // Right panel messages
            setMessages(
                filteredMessages.map(m => ({
                    _id: m._id,
                    sender: m.sender,
                    message: m.message,
                    file: m.file,
                    createdAt: m.createdAt,
                    type: m.sender === currentUser._id ? "sent" : "received"
                }))
            );

            // Sidebar last message preview
            const lastMsgMap = {};
            filteredMessages.forEach(msg => {
                const chatId =
                    msg.sender === currentUser._id ? msg.receiver : msg.sender;

                lastMsgMap[chatId] =
                    msg.message || (msg.file ? "📎 File" : "");
            });

            setLastMessages(prev => ({
                ...prev,
                ...lastMsgMap
            }));
            
        } catch (error) {
            console.error("Error loading chat data:", error);
        }
    }

    loadMessages();
}, [selectedChat?._id, currentUser?._id, token]); // 🟢 IDs tracking to protect infinite loop

 


    // Send message
    const sendMsg = async () => {
        // 1. Files fetch karein
        const filesToSend = fileInputRef.current?.files;

        // Validation
        if (!selectedChat || (!inp.trim() && (!filesToSend || filesToSend.length === 0))) return;

        try {
            // --- ✨ CASE 1: MULTIPLE FILES ---
            if (filesToSend && filesToSend.length > 0) {
                const filesArray = Array.from(filesToSend);

                for (const singleFile of filesArray) {
                    const formData = new FormData();
                    formData.append("sender", currentUser._id);
                    formData.append("receiver", selectedChat._id);
                    formData.append("message", inp || ""); // Pehli file ke sath text jayega
                    formData.append("file", singleFile);

                    const res = await fetch(`${backendUrl}/api/chats`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    });

                    if (res.ok) {
                        const savedMsg = await res.json();

                        // ✅ Socket emit loop ke andar (har file ke liye alag)
                        socket.emit("privateMessage", savedMsg);

                        setMessages(prev => [...prev, { ...savedMsg, type: "sent" }]);
                    }
                }
            }
            // --- ✨ CASE 2: ONLY TEXT MESSAGE ---
            else {
                const formData = new FormData();
                formData.append("sender", currentUser._id);
                formData.append("receiver", selectedChat._id);
                formData.append("message", inp);

                const res = await fetch(`${backendUrl}/api/chats`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (!res.ok) throw new Error("Failed to send message");
                const savedMsg = await res.json();

                // ✅ Socket emit yahan (sirf text ke liye)
                socket.emit("privateMessage", savedMsg);

                setMessages(prev => [...prev, { ...savedMsg, type: "sent" }]);
            }

            // --- ✨ AFTER SENDING (RESET UI) ---
            // Sidebar update logic
            setLastMessages(prev => ({
                ...prev,
                [selectedChat._id]: inp || "📎 File",
            }));

            setInp("");
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";

            // Move chat to top logic
            setUsers(prevUsers => {
                const idx = prevUsers.findIndex(u => u._id === selectedChat._id);
                if (idx === -1) return prevUsers;
                const updated = [...prevUsers];
                const [chatUser] = updated.splice(idx, 1);
                updated.unshift(chatUser);
                return updated;
            });

        } catch (err) {
            console.error("Send message error:", err);
            alert("Failed to send message");
        }

    };


    /// MULTIPLE FILE SEND KRNE KE LIYE 
    const sendMultipleFiles = async (files) => {
        if (!selectedChat || files.length === 0) return;

        // Har file ke liye loop chalega
        for (const singleFile of files) {
            try {
                const formData = new FormData();
                formData.append("sender", currentUser._id);
                formData.append("receiver", selectedChat._id);
                formData.append("message", ""); // Files ke saath text blank rakhein ya "📎 File"
                formData.append("file", singleFile);

                const res = await fetch(`${backendUrl}/api/chats`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (res.ok) {
                    const savedMsg = await res.json();

                    // 1. Socket emit
                    socket.emit("privateMessage", savedMsg);

                    // 2. UI Update (Messages list)
                    setMessages(prev => [...prev, {
                        ...savedMsg,
                        type: "sent"
                    }]);

                    // 3. Sidebar update
                    setLastMessages(prev => ({
                        ...prev,
                        [selectedChat._id]: "📎 Photo/File",
                    }));
                }
            } catch (err) {
                console.error("Error sending one of the files:", err);
            }
        }

        // Sab upload hone ke baad input reset
        if (fileInputRef.current) fileInputRef.current.value = "";
    };


    // Add to current messages
    const handleDownload = async (fileUrl, fileName) => {
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("File download failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = fileName || "file"; // Force download with name
            document.body.appendChild(a);
            a.click();

            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download Error:", err);
            alert("Could not download file. Make sure the server is running.");
        }
    };



    // Delete message function
    const deleteMessage = async (id, receiverId = selectedChat?._id) => {
        if (!receiverId) return;
        try {
            await fetch(`${backendUrl}/api/chats/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            // Remove from right panel
            setMessages(prevMessages => {
                const updatedMessages = prevMessages.filter(m => m._id !== id);

                // Update lastMessages for sidebar only for sender
                setLastMessages(prevLast => {
                    const updatedLast = { ...prevLast };
                    const lastMsg = updatedMessages.slice(-1)[0];
                    updatedLast[receiverId] = lastMsg ? lastMsg.message : "Start chatting..";
                    return updatedLast;
                });

                return updatedMessages;
            });

            // Emit to receiver
            socket.emit("deleteMessage", {
                messageId: id,
                senderId: currentUser._id,
                receiverId
            });

            alert("Message deleted successfully!");
        } catch (err) {
            console.error(err);
        }
    };


    // Receiver-side listener for deleted messages
    useEffect(() => {
        const handleDeleted = ({ messageId, senderId }) => {
            setMessages(prevMessages => {
                const updatedMessages = prevMessages.filter(m => m._id !== messageId);

                // Update lastMessages for sidebar preview
                setLastMessages(prevLast => {
                    const updatedLast = { ...prevLast };
                    const lastMsg = updatedMessages.slice(-1)[0];
                    updatedLast[senderId] = lastMsg ? lastMsg.message : "Start chatting No msg...";
                    return updatedLast;
                });

                return updatedMessages;
            });
        };

        socket.on("messageDeleted", handleDeleted);
        return () => socket.off("messageDeleted", handleDeleted);
    }, []);




    useEffect(() => {
        async function fetchCurrentUser() {
            try {
                const res = await fetch(`${backendUrl}/api/users/loguser`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                });
                const user = await res.json();
                setCurrentUser(user);
            } catch (err) {
                console.error("Error fetching logged-in user:", err);
            }
        }
        fetchCurrentUser();
    }, [token]);


    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const res = await fetch(`${backendUrl}/api/users/upload-avatar`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: formData
            });

            if (!res.ok) throw new Error("Failed to update avatar");

            const data = await res.json();
            setCurrentUser(prev => ({ ...prev, avatar: data.avatar }));
            alert("Avatar updated successfully!");
        } catch (err) {
            console.error("Failed to update avatar:", err);
            alert("Failed to update avatar");
        }
    };


    // recordin msgggggggggg
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                setAudioBlob(audioBlob);
            };

            mediaRecorder.start();
            setRecording(true);

        } catch (err) {
            console.error("Mic error:", err);
        }
    };


    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setRecording(false);
    };

    const sendVoice = async () => {

        if (!audioBlob || !selectedChat) return;

        const formData = new FormData();
        formData.append("sender", currentUser._id);
        formData.append("receiver", selectedChat._id);
        formData.append("message", "");
        formData.append("file", audioBlob, "voice-message.webm");

        const res = await fetch(`${backendUrl}/api/chats`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        const savedMsg = await res.json();

        socket.emit("privateMessage", savedMsg);

        setMessages(prev => [...prev, { ...savedMsg, type: "sent" }]);

        setAudioBlob(null);
    };


    const filteredChats = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
    // console.log(filteredChats);

    const unreadCount = Object.keys(unreadMessages).length;

    const visibleChats = users.filter(
        u => !archivedChats.includes(u._id) && u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );



    const resetCallStates = () => {
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        setIsCalling(false);
        setIncomingCall(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
    //call wala function
    //2. Socket Listeners (Call & Messages)
    useEffect(() => {
        if (!socket || !currentUser?._id) return;

        // Puraane listeners hatao pehle
        socket.off("incomingCall");

        // Sidebar.jsx ke useEffect ke andar
        socket.on("incomingCall", (data) => {
            // 1. Apni current ID ko string mein lo
            const myId = String(currentUser?._id);
            const targetId = String(data.to);

            // console.log("Call received for ID:", targetId);
            // console.log("My current ID is:", myId);

            // 2. AGAR ID MATCH NAHI HOTI, TOH TURANT RETURN KARO
            if (!myId || targetId !== myId) {
                // console.log("🚫 Not my call. Ignoring...");
                return; // Ye line baaki sabka modal rok degi
            }

            // 3. Agar match ho gaya, tabhi state update karo
            // console.log("✅ My call! Showing modal...");
            setIncomingCall(data);
        });


        socket.on("callAccepted", async ({ answer }) => {
            // console.log("Call Accepted by remote");
            if (peerRef.current) {
                await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socket.on("callRejected", () => {
            alert("Call was rejected");
            endCall();
            resetCallStates(); // local cleanup function
        });

        // ⭐ IMPORTANT: Jab samne wala call ke beech mein cut kare
        socket.on("callEnded", () => {
            // console.log("Remote user ended the call");
            activeCallRef.current = null; // ⭐ Yeh add karo
            cleanupCallUI();
        });


        socket.on("iceCandidate", async ({ candidate }) => {
            try {
                if (peerRef.current && peerRef.current.remoteDescription) {
                    // Agar remote description set hai, toh turant add karo
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    // Agar nahi hai, toh queue mein daal do
                    pendingCandidates.current.push(candidate);
                }
            } catch (err) {
                console.error("ICE Error", err);
            }
        });

        return () => {
            socket.off("incomingCall");
            socket.off("callAccepted");
            socket.off("callRejected");
            socket.off("iceCandidate");
        };
    }, [socket, currentUser]);



    useEffect(() => {
        if (socket && currentUser?._id) {
            socket.emit("join", currentUser._id);
        }
    }, [socket, currentUser?._id]); // Sirf tab chalega jab socket ya user badle


    // Ek common function dono ke liye
    const cleanupCallUI = () => {
        // ⭐ localStream bhi stop karo
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }

        activeCallRef.current = null; // ⭐ Ref clear karo

        setIsCalling(false);
        setIncomingCall(null);

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }

        // console.log("✅ Cleanup done");
    };


    // 3. WebRTC Functions

    const createPeer = (targetUserId, stream) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.relay.metered.ca:80" },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: "ee21fb16bd2370a52b2d2a0f",
                    credential: "p5CUo5PMGbQzWUzf"
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: "ee21fb16bd2370a52b2d2a0f",
                    credential: "p5CUo5PMGbQzWUzf"
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: "ee21fb16bd2370a52b2d2a0f",
                    credential: "p5CUo5PMGbQzWUzf"
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: "ee21fb16bd2370a52b2d2a0f",
                    credential: "p5CUo5PMGbQzWUzf"
                }
            ]
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("iceCandidate", { to: targetUserId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            // console.log("✅ Remote track received:", event.track.kind);

            // ⭐ Sirf video track par set karo, audio par nahi
            if (event.track.kind === "video" && remoteVideoRef.current) {
                if (remoteVideoRef.current.srcObject !== event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            }
        };

        if (stream) {
            stream.getTracks().forEach(track => {
                // console.log("Adding track:", track.kind);
                peer.addTrack(track, stream);
            });
        }

        return peer;
    };



    // --- 2. SIRF CAMERA/MEDIA KE LIYE (Sirf ek baar chalega) ---

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);

            setTimeout(() => {
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    // console.log("✅ Local video initialized");
                }
            }, 200);

            return stream;
        } catch (err) {
            console.error("Media Error:", err);
            alert("Camera access denied: " + err.message);
            return null;
        }
    };


    useEffect(() => {
        if (isCalling && localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;

        }
    }, [isCalling, localStream]);



    // --- 1. CALL START ---

    const startCall = async () => {
        if (!selectedChat?._id || !currentUser?._id) return;

        const stream = await initializeMedia();
        if (!stream) return alert("Camera/Mic access denied");

        const peer = createPeer(selectedChat._id, stream); // ⭐ stream pass kiya
        peerRef.current = peer;

        setIsCalling(true);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("callUser", {
            to: selectedChat._id,
            from: currentUser._id,
            name: currentUser.name,
            offer: offer
        });
    };


    // --- 2. CALL ACCEPT ---

    const acceptCall = async () => {
        if (!incomingCall) return;
        const stream = await initializeMedia();
        if (!stream) return alert("Camera/Mic access required");
        setIsCalling(true);
        const peer = createPeer(incomingCall.from, stream);
        peerRef.current = peer;
        try {
            await peer.setRemoteDescription(
                new RTCSessionDescription(incomingCall.offer)
            );
            // console.log("Pending candidates:", pendingCandidates.current.length);
            while (pendingCandidates.current.length > 0) {
                const cand = pendingCandidates.current.shift();
                await peer.addIceCandidate(new RTCIceCandidate(cand));
            }
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            activeCallRef.current = incomingCall.from; // ⭐ Yeh line add ki

            socket.emit("acceptCall", { to: incomingCall.from, answer });
            setIncomingCall(null);
        } catch (err) {
            console.error("❌ Error in acceptCall:", err);
        }
    };



    // --- 3. CALL REJECT (Jab incoming call aaye aur aap 'Cut' karein) ---
    const rejectCall = () => {
        if (!incomingCall) return;
        socket.emit("callRejected", { to: incomingCall.from }); // Samne wale ko batao
        setIncomingCall(null); // Local UI reset
    };

    // --- 4. END CALL (Active call ke beech mein cut karna) ---

    const endCall = () => {
        // ⭐ Sabse pehle current values capture karo
        const targetId =
            activeCallRef.current ||      // Pehle ref check karo
            selectedChat?._id ||
            incomingCall?.from;

        // console.log("📴 endCall targetId:", targetId); // Mobile console mein check karo

        if (targetId && socket) {
            socket.emit("endCall", { to: targetId });
        }

        if (localVideoRef.current?.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }

        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        activeCallRef.current = null;
        setIsCalling(false);
        setIncomingCall(null);

        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };


    ///newwwwwwwwwwwwwww

 const handleBlockUser = async (blockUserId) => {
    try {
        const response = await fetch(`${backendUrl}/api/auth/block-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myId: currentUser._id,
                blockUserId: blockUserId
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Something went wrong');

        // Samne wale ko signal bhejo ki mene block kar diya
        if (socket) {
            socket.emit("blockUser", { to: blockUserId, from: currentUser._id });
        }

        // Current logged-in user ki block list local state update karein
        setCurrentUser(prev => ({
            ...prev,
            blockedUsers: [...(prev.blockedUsers || []), blockUserId]
        }));

        alert(data.message || "User blocked successfully");
    } catch (error) {
        console.error("Block User Error:", error);
    }
};

const handleUnblockUser = async (unblockUserId) => {
    try {
        const response = await fetch(`${backendUrl}/api/auth/unblock-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                myId: currentUser._id,
                unblockUserId: unblockUserId
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Something went wrong');

        // Samne wale ko signal bhejo ki mene unblock kar diya
        if (socket) {
            socket.emit("unblockUser", { to: unblockUserId, from: currentUser._id });
        }

        setCurrentUser(prev => ({
            ...prev,
            blockedUsers: (prev.blockedUsers || []).filter(id => id !== unblockUserId)
        }));

        alert(data.message || "User unblocked successfully");
    } catch (error) {
        console.error("Unblock User Error:", error);
    }
};

// 🟢 FIX: Block/Unblock Ke Liye Updated Socket Listener (Bina setIsBlocked Ke)
useEffect(() => {
    if (!socket || !currentUser?._id || !selectedChat?._id) return;

    // Purane listeners ko pehle clean karein
    socket.off("userBlockedMe");
    socket.off("userUnblockedMe");

    // 1. Jab koi aapko REAL-TIME mein block karega
    socket.on("userBlockedMe", ({ blockedBy }) => {
        if (String(selectedChat._id) === String(blockedBy)) {
            setSelectedChat(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    isMeBlocked: true, // 🟢 Input box ko instantly handle karne ka flag
                    blockedUsers: [...(prev.blockedUsers || []), String(currentUser._id)]
                };
            });
        }
    });

    // 2. Jab koi aapko REAL-TIME mein unblock karega
    socket.on("userUnblockedMe", ({ unblockedBy }) => {
        if (String(selectedChat._id) === String(unblockedBy)) {
            setSelectedChat(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    isMeBlocked: false, // 🟢 Input box ko instantly wapas lane ka flag
                    blockedUsers: (prev.blockedUsers || []).filter(id => String(id) !== String(currentUser._id))
                };
            });
        }
    });

    return () => {
        socket.off("userBlockedMe");
        socket.off("userUnblockedMe");
    };
}, [socket, currentUser?._id, selectedChat?._id]); // 🟢 Fixed dependency tracking IDs to prevent looping
    
  

    return (
        <div className="container">

            {/* Incoming Call UI */}
            {incomingCall && String(incomingCall.to) === String(currentUser?._id) && (
                <div className="call-incoming-overlay">
                    <div className="call-card">
                        <h4>{incomingCall.name} is calling...</h4>
                        <div className="call-btns">
                            <button className="accept" onClick={acceptCall}>Accept</button>
                            <button className="reject" onClick={rejectCall}>Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Video Call UI */}
            {isCalling && (
                <div className="video-call-window">
                    <video ref={remoteVideoRef} autoPlay playsInline className="remote-vid" />
                    <video ref={localVideoRef} autoPlay playsInline muted className="local-vid" />
                    <button
                        className="end-call-circle"
                        onClick={endCall}
                        onTouchEnd={(e) => { e.preventDefault(); endCall(); }}
                    >
                        <PhoneOff size={24} />
                    </button>
                </div>
            )}

            {/* IMAGE MODAL */}
            {selectedImage && (
                <div className="image-modal" onClick={() => setSelectedImage(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <img src={selectedImage} alt="Preview" />
                        <button onClick={() => setSelectedImage(null)}>Close</button>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className={`side-bar ${isChatOpen ? "mobile-hide" : ""}`}>
                <div className="top-icons">
                    <p style={{ position: "relative" }}>
                        <MessageSquareText />
                        {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
                    </p>
                </div>

                {currentUser && (
                    <div className="bottom-icons">
                        <div className="profile-section">
                            <input type="file" id="avatarUpload" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
                            <label htmlFor="avatarUpload" className="avatar-label">
                                <img
                                    src={currentUser.avatar ? (currentUser.avatar.startsWith("http") ? currentUser.avatar : `${backendUrl}${currentUser.avatar}`) : "./user.png"}
                                    alt="avatar"
                                    className="sidebar-avatar"
                                />
                            </label>
                            <span>Dp</span>
                        </div>
                        <button className="chat-logout-btn" onClick={handleLogout}>Logout</button>
                    </div>
                )}
            </div>

            {/* Chat section */}
            <div className="chat-conatiner">
                <div className={`left-panel ${isChatOpen ? "hidden-mobile" : ""}`}>
                    <div className="top-text">
                        <h3>Chats</h3>
                        {currentUser && <h4>{currentUser.name}</h4>}
                        <div className="top-icon">
                            <p onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                                <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                            </p>
                        </div>
                    </div>

                    <div className={`chat-panel ${theme}`}>
                        <div className="search">
                            <input type="text" placeholder="Search or start new chat" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        <div className="archived-toggle">
                            <button onClick={() => setShowArchived(prev => !prev)}>
                                📦 Archived Chats {archivedChats.length > 0 ? `(${archivedChats.length})` : ""} {showArchived ? " ⬆️" : " ⬇️"}
                            </button>
                        </div>

                        {showArchived && (
                            <div className="archived-chats">
                                {users.filter(u => archivedChats.includes(u._id)).map((chat, k) => (
                                    <div key={k} className="chat-item archived" onClick={() => setSelectedChat(chat)}>
                                        <img src={chat.avatar ? (chat.avatar.startsWith("http") ? chat.avatar : `${backendUrl}${chat.avatar}`) : "./user.png"} alt="avatar" className="chat-avatar" />
                                        <div className="chat-info">
                                            <span className="chat-name">{chat.name}</span>
                                            <span className="chat-message">{lastMessages[chat._id] || "Start chatting..."}</span>
                                        </div>
                                        <button className="archive-btn" onClick={(e) => { e.stopPropagation(); handleArchive(chat._id); }}><Archive size={18} />Unarchive</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="chat-list">
                            {users.filter(u => !archivedChats.includes(u._id) && u.name.toLowerCase().includes(searchTerm.toLowerCase())).map((chat, k) => (
                                <div
                                    key={k}
                                    className="chat-item"
                                    onClick={() => {
                                        setSelectedChat(chat);
                                        setIsChatOpen(true);
                                        setUnreadMessages(prev => { const updated = { ...prev }; delete updated[chat._id]; return updated; });
                                    }}
                                >
                                    <img src={chat.avatar ? (chat.avatar.startsWith("http") ? chat.avatar : `${backendUrl}${chat.avatar}`) : "./user.png"} alt="avatar" className="chat-avatar" />
                                    {onlineUsers.includes(chat._id) ? <span className="online-dot"></span> : <span className="offline-dot"></span>}
                                    <div className="chat-info">
                                        <div className="chat-name-time"><span className="chat-name">{chat.name}</span></div>
                                        <div className={`chat-message ${unreadMessages[chat._id] ? "unread" : ""}`}>{lastMessages[chat._id] || <span style={{ color: "gray" }}>Start chatting..</span>}</div>
                                    </div>
                                    <button className="archive-btn" onClick={(e) => { e.stopPropagation(); handleArchive(chat._id); }}><Archive size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel */}
                <div className={`right-panel ${isChatOpen ? "show-mobile" : "hidden-mobile"}`}>
                    {selectedChat ? (
                        <>
                            {/* --- CHAT HEADER --- */}
                            <div className="chat-header">
                                <button className="back-btn" onClick={handleBackToList}><X size={24} /></button>
                                <img src={selectedChat.avatar ? (selectedChat.avatar.startsWith("http") ? selectedChat.avatar : `${backendUrl}${selectedChat.avatar}`) : "./user.png"} alt="avatar" className="header-avatar" />
                                
                                <div className="header-info" style={{ flex: 1 }}>
                                    <span className="header-name">{selectedChat.name}</span>
                                </div>

                                {/* Call Button (Sirf tab chalega jab kisi ne block na kiya ho) */}
                                {!(currentUser?.blockedUsers?.includes(selectedChat._id) || selectedChat?.blockedUsers?.includes(currentUser?._id)) && (
                                    <button onClick={startCall} style={{ marginRight: '10px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}><Video size={20} /> </button>
                                )}

                                {/* ⭐ NEW: DYNAMIC BLOCK/UNBLOCK BUTTON ⭐ */}
                                {currentUser?.blockedUsers?.includes(selectedChat._id) ? (
                                    <button 
                                        onClick={() => handleUnblockUser(selectedChat._id)} 
                                        className="unblock-action-btn"
                                        style={{ backgroundColor: '#25D366', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Unblock
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleBlockUser(selectedChat._id)} 
                                        className="block-action-btn"
                                        style={{ backgroundColor: '#E53E3E', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Block
                                    </button>
                                )}
                            </div>

                            <div className="messages">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`message ${msg.type}`}>
                                        {msg.file && msg.file.endsWith(".webm") && (
                                            <audio controls style={{ marginBottom: "10px" }}><source src={msg.file.startsWith("http") ? msg.file : `${backendUrl}${msg.file}`} type="audio/webm" /></audio>
                                        )}
                                        {msg.file && !msg.file.endsWith(".webm") && (
                                            <div className="file-msg-wrapper" style={{ marginBottom: "10px" }}>
                                                {msg.file.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                    <div className="image-container modern-img-card">
                                                        <img src={msg.file.startsWith("http") ? msg.file : `${backendUrl}${msg.file}`} alt="chat-img" className="chat-main-img" />
                                                        <div className="file-actions-overlay">
                                                            <button className="action-btn view-btn" onClick={() => openModal(msg.file.startsWith("http") ? msg.file : `${backendUrl}${msg.file}`)}><span className="icon">👁️</span> View</button>
                                                            <button className="action-btn download-btn" onClick={() => handleDownload(msg.file.startsWith("http") ? msg.file : `${backendUrl}${msg.file}`, msg.file.split('/').pop())}><span className="icon">⬇️</span> Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="document-container modern-doc-card" onClick={() => handleDownload(msg.file.startsWith("http") ? msg.file : `${backendUrl}${msg.file}`, msg.file.split('/').pop())}>
                                                        <div className="doc-icon-wrapper"><span style={{ fontSize: "22px" }}>📄</span></div>
                                                        <div className="doc-info">
                                                            <p className="doc-name">{msg.file.split('/').pop()}</p>
                                                            <small className="doc-status">Click to Download</small>
                                                        </div>
                                                        <div className="doc-download-icon">
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4M7 10l5 5 5-5M12 15V3" /></svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {msg.message && <p className="text-content">{msg.message}</p>}
                                        <div className="message-footer">
                                            <span className="message-time">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                            {msg.type === "sent" && <button className="delete-msg-btn" onClick={() => deleteMessage(msg._id, selectedChat._id)}>🗑</button>}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* --- MESSAGE INPUT (WITH BLOCK CHECK) --- */}

{/* --- MESSAGE INPUT (WITH BLOCK CHECK) --- */}
{(currentUser?.blockedUsers?.includes(selectedChat?._id) || (selectedChat?.isBlocked && selectedChat?.blockedBy === currentUser?._id)) ? (
    /* 🟢 Condition 1: Agar Maine block kiya hai (Local state se ya Refresh par Backend data se) */
    <div className="blocked-bar" style={{ textAlign: 'center', padding: '15px', color: 'gray', fontStyle: 'italic', background: '#f0f0f0', borderRadius: '8px', width: '100%' }}>
        You have blocked this user. Unblock to send messages.
    </div>
) : (selectedChat?.blockedUsers?.includes(currentUser?._id) || (selectedChat?.isBlocked && selectedChat?.blockedBy !== currentUser?._id) || selectedChat?.isMeBlocked) ? (
    /* 🟢 Condition 2: Agar Saamne wale ne block kiya hai (Local state, Refresh data ya Real-time socket se) */
    <div className="blocked-bar" style={{ textAlign: 'center', padding: '15px', color: 'red', fontStyle: 'italic', background: '#ffebeb', borderRadius: '8px', width: '100%' }}>
        You can no longer reply to this conversation.
    </div>
) : (
    /* 🟢 Condition 3: Agar sab normal hai, toh chat input box dikhao */
    <div className="message-input" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        <input type="file" ref={fileInputRef} multiple style={{ display: "none" }} id="chat-file" onChange={(e) => setFile(e.target.files[0])} />
        <label htmlFor="chat-file" style={{ cursor: 'pointer', fontSize: '20px' }}>{file ? "✅" : "📎"}</label>

        <input
            type="text"
            value={inp}
            placeholder={file ? `File: ${file.name}` : "Type a message"}
            onChange={(e) => setInp(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMsg(); }}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
        />

        <button onClick={recording ? stopRecording : startRecording}>{recording ? "⏹ Stop" : "🎤"}</button>
        {audioBlob && <button onClick={sendVoice}>Send Voice</button>}
        <button onClick={sendMsg}>Send</button>
    </div>
)}

                        </>
                    ) : (
                        <div className="no-chat-selected">
                            <img src={currentUser?.avatar ? (currentUser.avatar.startsWith("http") ? currentUser.avatar : `${backendUrl}${currentUser.avatar}`) : "./user.png"} alt="avatar" className="no-chat-image" />
                            <h4>Hello {currentUser?.name}</h4>
                            <h2>Welcome to R-Chat</h2>
                            <p>Select a chat from the list on the left to start messaging your friends instantly.</p>
                            <p>🟢 Online users are ready to chat!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
}
