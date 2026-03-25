import React, { useEffect, useRef } from "react";

export default function VideoCall({ socket, selectedUser, currentUser, onEnd }) {
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const peerRef = useRef();

    useEffect(() => {
        startCall();

        return () => {
            if (peerRef.current) peerRef.current.close();
        };
    }, []);

    const startCall = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideoRef.current.srcObject = stream;

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peerRef.current = peer;

        // send stream
        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        // receive stream
        peer.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        // ICE
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    to: selectedUser._id,
                    candidate: event.candidate
                });
            }
        };

        // CREATE OFFER
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("offer", {
            to: selectedUser._id,
            offer,
            from: currentUser._id
        });
    };

    // RECEIVE ANSWER
    useEffect(() => {
        socket.on("answer", async ({ answer }) => {
            await peerRef.current.setRemoteDescription(answer);
        });

        socket.on("offer", async ({ offer, from }) => {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localVideoRef.current.srcObject = stream;

            const peer = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });

            peerRef.current = peer;

            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            peer.ontrack = (event) => {
                remoteVideoRef.current.srcObject = event.streams[0];
            };

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("ice-candidate", {
                        to: from,
                        candidate: event.candidate
                    });
                }
            };

            await peer.setRemoteDescription(offer);

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit("answer", {
                to: from,
                answer
            });
        });

        socket.on("ice-candidate", async ({ candidate }) => {
            if (peerRef.current) {
                await peerRef.current.addIceCandidate(candidate);
            }
        });

        return () => {
            socket.off("answer");
            socket.off("offer");
            socket.off("ice-candidate");
        };
    }, []);

    return (
        <div className="video-call">
            <video ref={localVideoRef} autoPlay muted width="200" />
            <video ref={remoteVideoRef} autoPlay width="300" />

            <button onClick={onEnd}>End Call</button>
        </div>
    );
}