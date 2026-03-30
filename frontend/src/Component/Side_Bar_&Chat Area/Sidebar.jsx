import React, { useState, useEffect, useRef } from 'react';
import { Phone, MessageSquareText, CircleFadingPlus, Users, MessageCircleCode, Settings, MessageSquarePlus, EllipsisVertical, PhoneOff, X } from "lucide-react";
import "./Sidebar.css";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Archive } from "lucide-react";
const backendUrl = import.meta.env.VITE_BACKEND_URL;

const socket = io(backendUrl);
// const socket = io("http://192.168.137.1:3000");

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

    const [lastMessages, setLastMessages] = useState({});
    const [unreadMessages, setUnreadMessages] = useState({});
    const [file, setFile] = useState(null);

    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

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
        setSelectedImage(`${backendUrl}${fileUrl}`);
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
            console.log("Online users from server:", users);
            setOnlineUsers(users);
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
            console.log("Sending join for:", currentUser._id);
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
            const res = await fetch(`${backendUrl}/api/chats/${selectedChat._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();

            // Filter out messages deleted by the current user
            const filteredMessages = data.filter(
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
        }

        loadMessages();
    }, [selectedChat, currentUser, token]);



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

            console.log("Call received for ID:", targetId);
            console.log("My current ID is:", myId);

            // 2. AGAR ID MATCH NAHI HOTI, TOH TURANT RETURN KARO
            if (!myId || targetId !== myId) {
                console.log("🚫 Not my call. Ignoring...");
                return; // Ye line baaki sabka modal rok degi
            }

            // 3. Agar match ho gaya, tabhi state update karo
            console.log("✅ My call! Showing modal...");
            setIncomingCall(data);
        });


        socket.on("callAccepted", async ({ answer }) => {
            console.log("Call Accepted by remote");
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
        // Jab dusra banda call kaatega
        socket.on("callEnded", () => {
            console.log("Remote user ended the call");
            // Yahan function ko call karo lekin socket.emit mat karna (varna loop ban jayega)
            // Isliye cleanup logic ko ek alag function mein rakhna best hai
            cleanupCallUI();
        });


        // socket.on("callEnded", () => {
        //     console.log("Remote user cut the call");
        //     resetCallStates(); // local cleanup function
        // });

        socket.on("iceCandidate", async ({ candidate }) => {
            try {
                if (peerRef.current && peerRef.current.remoteDescription) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) { console.error("ICE Error", err); }
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
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        setIsCalling(false);
        setIncomingCall(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };



    // 3. WebRTC Functions
    const createPeer = (targetUserId) => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("iceCandidate", { to: targetUserId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            console.log("Adding remote stream...");
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        // Voice aur Video tracks ensure karein
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log("Sending track:", track.kind); // console mein check karein 'audio' aur 'video' dono hai ya nahi
                peer.addTrack(track, localStream);
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
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream; // Stream return karna zaroori hai tracks add karne ke liye
        } catch (err) {
            console.error("Media Error:", err);
            return null;
        }
    };




    // useEffect(() => {
    //     let stream = null;

    //     const getMedia = async () => {
    //         try {
    //             // Agar purana stream exist karta hai, toh usey pehle stop karo
    //             if (localStream) {
    //                 localStream.getTracks().forEach(track => track.stop());
    //             }

    //             stream = await navigator.mediaDevices.getUserMedia({
    //                 video: true,
    //                 audio: true
    //             });

    //             setLocalStream(stream);
    //             if (localVideoRef.current) {
    //                 localVideoRef.current.srcObject = stream;
    //             }
    //         } catch (err) {
    //             console.error("Media Error:", err);
    //             if (err.name === "NotReadableError") {
    //                 alert("Camera/Mic busy hai. Dusre apps band karein.");
    //             }
    //         }
    //     };

    //     getMedia();

    //     // Cleanup: Jab user logout kare ya component unmount ho, tab camera band ho jaye
    //     return () => {
    //         if (stream) {
    //             stream.getTracks().forEach(track => track.stop());
    //         }
    //     };
    // }, []); // Dependency array empty rakha hai taaki theme change par ye na chal



    // --- 1. CALL START ---
    const startCall = async () => {

        const stream = await initializeMedia(); // Yahan camera on hoga
        if (!stream) return alert("Camera access denied");

        const peer = createPeer(selectedChat._id);
        peerRef.current = peer;
        // Tracks add karna mat bhulna!
        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        if (!selectedChat?._id || !currentUser?._id) return;
        setIsCalling(true);


        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        console.log("Calling user:", selectedChat._id); // Debug ke liye check karein

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
        setIsCalling(true);
        const peer = createPeer(incomingCall.from);
        peerRef.current = peer;

        await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("acceptCall", { to: incomingCall.from, answer });
        setIncomingCall(null);
    };

    // --- 3. CALL REJECT (Jab incoming call aaye aur aap 'Cut' karein) ---
    const rejectCall = () => {
        if (!incomingCall) return;
        socket.emit("callRejected", { to: incomingCall.from }); // Samne wale ko batao
        setIncomingCall(null); // Local UI reset
    };

    // --- 4. END CALL (Active call ke beech mein cut karna) ---
    const endCall = () => {
        const targetId = selectedChat?._id || incomingCall?.from;

        if (targetId && socket) {
            socket.emit("endCall", { to: targetId });
        }

        // --- CRITICAL: Tracks stop karna zaroori hai ---
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => {
                track.stop(); // Camera/Mic physical hardware ko off karta hai
                console.log(track.kind + " stopped");
            });
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

        setIsCalling(false);
        setIncomingCall(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        console.log("Call ended and hardware released");
    };



    // const endCall = () => {
    //     // Determine kisse call end karni hai (Caller or Receiver)
    //     const targetId = selectedChat?._id || incomingCall?.from;

    //     if (targetId && socket) {
    //         socket.emit("endCall", { to: targetId });
    //     }

    //     // Local Cleanup
    //     if (peerRef.current) {
    //         peerRef.current.close();
    //         peerRef.current = null;
    //     }
    //     setIsCalling(false);
    //     setIncomingCall(null);
    //     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    //     console.log("Call ended locally");
    // };

    return (
        <div className="container">


            {/* Incoming Call UI */}
            {incomingCall && String(incomingCall.to) === String(currentUser?._id) && (
                <div className="call-incoming-overlay"
                >
                    <div className="call-card">
                        <h4>{incomingCall.name} is calling...</h4>
                        <div className="call-btns">
                            <button className="accept" onClick={acceptCall}>Accept</button>
                            <button className="reject" onClick={rejectCall}>Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Video Call UI - Sirf unhe dikhega jo actually call par hain */}
            {isCalling && (
                <div className="video-call-window">
                    {/* Remote Video (Dusre bande ki) */}
                    <video ref={remoteVideoRef} autoPlay playsInline className="remote-vid" />

                    {/* Local Video (Aapki apni) */}
                    <video ref={localVideoRef} autoPlay playsInline muted className="local-vid" />

                    <button className="end-call-circle" onClick={endCall}>
                        <PhoneOff size={24} />
                    </button>
                </div>
            )}



            {/* --- IMAGE MODAL --- */}
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
                    {/* <p><MessageSquareText /><span>Chats</span></p> */}
                    <p style={{ position: "relative" }}>
                        <MessageSquareText />
                        {/* <span>Chats</span> */}
                        {unreadCount > 0 && (
                            <span className="chat-badge">
                                {unreadCount}
                            </span>
                        )}
                    </p>
                </div>

                {/* Bottom - Profile + Logout */}
                {currentUser && (
                    <div className="bottom-icons">
                        <div className="profile-section">
                            <input
                                type="file"
                                id="avatarUpload"          // add this
                                accept="image/*"
                                style={{ display: "none" }} // hide the actual file input
                                onChange={handleAvatarChange}  // handle file selection
                            />
                            <label htmlFor="avatarUpload" className="avatar-label">
                                <img
                                    src={currentUser.avatar
                                        ? `${backendUrl}${currentUser.avatar}`
                                        : "./user.png"}  // fallback avatar
                                    alt="avatar"
                                    className="sidebar-avatar"
                                />
                            </label>
                            <span>Dp</span>
                        </div>
                        <button className="chat-logout-btn" onClick={handleLogout}>
                            Logout
                        </button>
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

                    {/* newwwwwwwwwwww */}

                    <div className={`chat-panel ${theme}`}>
                        {/* Search Box */}
                        <div className="search">
                            <input
                                type="text"
                                placeholder="Search or start new chat"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Archived Chats Button (Top of Chat List) */}
                        <div className="archived-toggle">
                            <button onClick={() => setShowArchived(prev => !prev)}>
                                📦 Archived Chats {archivedChats.length > 0 ? `(${archivedChats.length})` : ""}
                                {showArchived ? " ⬆️" : " ⬇️"}
                            </button>
                        </div>

                        {/* Archived Chats (Collapsible, Top Section) */}
                        {showArchived && (
                            <div className="archived-chats">
                                {users
                                    .filter(u => archivedChats.includes(u._id))
                                    .map((chat, k) => (

                                        <div className="chat-item archived" onClick={() => setSelectedChat(chat)}>
                                            <img
                                                src={chat.avatar ? `${backendUrl}${chat.avatar}` : "./user.png"}
                                                alt="avatar"
                                                className="chat-avatar"
                                            />
                                            <div className="chat-info">
                                                <span className="chat-name">{chat.name}</span>
                                                <span className="chat-message">{lastMessages[chat._id] || "Start chatting..."}</span>
                                            </div>
                                            <button
                                                className="archive-btn"
                                                onClick={(e) => { e.stopPropagation(); handleArchive(chat._id); }}
                                            >
                                                <Archive size={18} />{archivedChats.includes(chat._id) ? "Unarchive" : "Archive"}
                                            </button>
                                        </div>


                                    ))}
                            </div>
                        )}

                        {/* Normal Chats */}
                        <div className="chat-list">
                            {users
                                .filter(u => !archivedChats.includes(u._id) && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((chat, k) => (
                                    <div
                                        key={k}
                                        className="chat-item"
                                        onClick={() => {
                                            setSelectedChat(chat);
                                            setIsChatOpen(true); // <--- Ye line add karein (Mobile toggle ke liye)
                                            setUnreadMessages(prev => {
                                                const updated = { ...prev };
                                                delete updated[chat._id];
                                                return updated;
                                            });
                                        }}
                                    >
                                        <img
                                            src={chat?.avatar ? `${backendUrl}${chat.avatar}` : "./user.png"}
                                            alt="avatar"
                                            className="chat-avatar"
                                        />
                                         {onlineUsers.includes(chat._id) ? (
                                                    <span className="online-dot"></span>
                                                ) : (
                                                    <span className="offline-dot"></span>
                                                )}
                                        <div className="chat-info">
                                            <div className="chat-name-time">
                                                <span className="chat-name">{chat.name}</span>
                                               
                                            </div>
                                            <div className={`chat-message ${unreadMessages[chat._id] ? "unread" : ""}`}>
                                                {lastMessages[chat._id] || <span style={{ color: "gray" }}>Start chatting..</span>}
                                            </div>
                                        </div>
                                        <button
                                            className="archive-btn"
                                            onClick={(e) => { e.stopPropagation(); handleArchive(chat._id); }}
                                        >
                                            <Archive size={18} />
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>



                </div>

                {/* Right panel */}
                <div className={`right-panel ${isChatOpen ? "show-mobile" : "hidden-mobile"}`}>
                    {selectedChat ? (
                        <>

                            <div className="chat-header">
                                {/* MOBILE BACK BUTTON */}
                                <button className="back-btn" onClick={handleBackToList}>
                                    <X size={24} /> {/* Ya arrow icon use karein */}
                                </button>

                                <img
                                    src={selectedChat.avatar ? `${backendUrl}${selectedChat.avatar}` : "./user.png"}
                                    alt="avatar"
                                    className="header-avatar"
                                />
                                <div className="header-info">
                                    <span className="header-name">{selectedChat.name}</span>
                                </div>

                                <button onClick={startCall}>📞</button>
                            </div>
                            <div className="messages">

                                {messages.map((msg, index) => (
                                    <div key={index} className={`message ${msg.type}`}>

                                        {/* 🎤 Voice message (only for .webm files) */}
                                        {msg.file && msg.file.endsWith(".webm") && (
                                            <audio controls style={{ marginBottom: "10px" }}>
                                                <source src={`${backendUrl}${msg.file}`} type="audio/webm" />
                                            </audio>
                                        )}

                                        {/* Show images or documents, but exclude .webm */}
                                        {msg.file && !msg.file.endsWith(".webm") && (
                                            <div className="file-msg-wrapper" style={{ marginBottom: "10px" }}>
                                                {msg.file.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                    <div className="image-container modern-img-card">
                                                        <img
                                                            src={`${backendUrl}${msg.file}`}
                                                            alt="chat-img"
                                                            className="chat-main-img"
                                                        />
                                                        <div className="file-actions-overlay">
                                                            <button
                                                                className="action-btn view-btn"
                                                                onClick={() => openModal(msg.file)}
                                                            >
                                                                <span className="icon">👁️</span> View
                                                            </button>
                                                            <button
                                                                className="action-btn download-btn"
                                                                onClick={() => handleDownload(`${backendUrl}${msg.file}`, msg.file.split('/').pop())}
                                                            >
                                                                <span className="icon">⬇️</span> Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="document-container modern-doc-card"
                                                        onClick={() => handleDownload(`${backendUrl}${msg.file}`, msg.file.split('/').pop())}
                                                    >
                                                        <div className="doc-icon-wrapper">
                                                            <span style={{ fontSize: "22px" }}>📄</span>
                                                        </div>
                                                        <div className="doc-info">
                                                            <p className="doc-name">{msg.file.split('/').pop()}</p>
                                                            <small className="doc-status">Click to Download</small>
                                                        </div>
                                                        <div className="doc-download-icon">
                                                            <svg
                                                                width="20"
                                                                height="20"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                            >
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4M7 10l5 5 5-5M12 15V3" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.message && <p className="text-content">{msg.message}</p>}

                                        <div className="message-footer">
                                            <span className="message-time">
                                                {msg.createdAt
                                                    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                    : ""}
                                            </span>

                                            {msg.type === "sent" && (
                                                <button
                                                    className="delete-msg-btn"
                                                    onClick={() => deleteMessage(msg._id, selectedChat._id)}
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="message-input" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                                {/* Hidden File Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    multiple
                                    style={{ display: "none" }}
                                    id="chat-file"
                                    onChange={(e) => setFile(e.target.files[0])} // Sirf UI mein dikhane ke liye ki file select hui hai
                                />

                                {/* Paperclip Icon/Button for File */}
                                <label htmlFor="chat-file" style={{ cursor: 'pointer', fontSize: '20px' }}>
                                    {file ? "✅" : "📎"} {/* File select hone par icon badal jayega */}
                                </label>

                                {/* Text Input */}
                                <input
                                    type="text"
                                    value={inp}
                                    placeholder={file ? `File: ${file.name}` : "Type a message"}
                                    onChange={(e) => setInp(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") sendMsg();
                                    }}
                                    style={{ flex: 1 }}
                                />

                                <button onClick={recording ? stopRecording : startRecording}>
                                    {recording ? "⏹ Stop" : "🎤"}
                                </button>

                                {audioBlob && (
                                    <button onClick={sendVoice}>Send Voice</button>
                                )}

                                <button onClick={sendMsg}>Send</button>
                            </div>

                        </>
                    ) : (
                        <div className="no-chat-selected">
                            <img
                                src={currentUser?.avatar
                                    ? `${backendUrl}${currentUser.avatar}`
                                    : "./user.png"}  // fallback avatar
                                alt="avatar"
                                className="no-chat-image"
                            // className="sidebar-avatar"
                            />
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
