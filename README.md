# 💬 R Chat WebApp | Real-Time Messaging

A modern, fast, and responsive one-to-one chat application built using the MERN stack and Socket.io for real-time, bi-directional communication.

🌐 **Live Demo:** [https://itsrchat.netlify.app](https://itsrchat.netlify.app)

---

## ✨ Key Features
- **Real-Time Messaging:** Instant message delivery and reception using WebSockets.
- **Online/Offline Status:** See when your friends are active in real-time.
- **One-to-One Chat:** Secure and private messaging between users.
- **Responsive UI:** Fully optimized for mobile and desktop views using Tailwind CSS.
- **Authentication:** Secure user login and signup functionality.

---

## 🛠️ Tech Stack
- **Frontend:** React.js, CSS
- **Backend:** Node.js, Express.js
- **Real-Time Engine:** Socket.io
- **Database:** MongoDB
- **Hosting:** Netlify (Frontend) & Render (Backend)

---

## ⚙️ How It Works
1. **Connection:** When a user logs in, a persistent WebSocket connection is established via **Socket.io**.
2. **Events:** Messages are sent as 'events' from the client to the server and broadcasted to the specific recipient.
3. **Storage:** Chat history is securely stored in **MongoDB** for persistent access.

---

## 🚀 Installation & Setup
1. Clone the repo:
   ```bash
   git clone [https://github.com/itsrkdev/R-Chat-WebApp.git](https://github.com/itsrkdev/R-Chat-WebApp.git)
