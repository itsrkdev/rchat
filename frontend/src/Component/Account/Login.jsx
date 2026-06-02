import React, { useEffect, useState } from 'react'
import { Dialog } from "@mui/material"
import './Login.css'
import rchat from '../../assets/rchat1.png'
import { useNavigate } from 'react-router-dom'
const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function Login() {
    const navigate = useNavigate()
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });

    useEffect(() => {
        if (localStorage.getItem("token")) {
            navigate("/chats")
        }
    }, [])

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        if (!formData.email || !formData.password || (!isLogin && !formData.name)) {
            return alert("Please fill all required fields!");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            return alert("Please enter a valid email address!");
        }

        const url = isLogin ? `${backendUrl}/api/auth/login` : `${backendUrl}/api/auth/register`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                return alert(data.message);
            }

            alert(data.message);

            if (isLogin) {
                localStorage.setItem("token", data.token);
                navigate("/chats", { replace: true });
            } else {
                setIsLogin(true);
            }

        } catch (error) {
            console.error("Error:", error);
            alert("Server not responding");
        }
    };

    return (
        <Dialog open={true} className='custom-dialog' hideBackdrop>
            <div className="login-container">
                
                {/* Left Panel - Desktop par dikhega, mobile par clean hide ho jayega */}
                <div className="login-left-panel">
                    <div className="wp-logo-container">
                        <img src={rchat} alt="R-Chat Logo" className="whatsapp-logo" />
                    </div>
                    <h2>Welcome to R-Chat</h2>
                    <p className="left-subtitle">Your conversations, all in one place</p>
                    
                    <ul className="modern-feature-list">
                        <li><span className="bullet-star">✦</span> Log in to access your messages securely</li>
                        <li><span className="bullet-star">✦</span> Stay connected on all your devices</li>
                        <li><span className="bullet-star">✦</span> Chat with friends instantly</li>
                        <li><span className="bullet-star">✦</span> Connect anytime, anywhere</li>
                    </ul>
                    <p className="left-footer"><a href="#">Need help? Get support</a></p>
                </div>

                {/* Right Panel - Dono screens par fit hoga */}
                <div className="login-right-panel">
                    {/* Mobile Branding (Sirf phone par logo aur naam dikhane ke liye) */}
                    <div className="mobile-brand-header">
                        <img src={rchat} alt="R-Chat Logo" className="mobile-logo" />
                        <h3>R-Chat</h3>
                    </div>

                    <div className="form-box">
                        <h2>{isLogin ? "Sign In" : "Sign Up"}</h2>
                        <p className="form-subtitle">Welcome! Please enter your details.</p>

                        {!isLogin && (
                            <input
                                type="text"
                                name="name"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={handleChange}
                                className="modern-input"
                            />
                        )}

                        <input
                            type="email"
                            name="email"
                            placeholder="Email address"
                            value={formData.email}
                            onChange={handleChange}
                            className="modern-input"
                            required
                        />
                        
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange} 
                            className="modern-input"
                            required
                        />

                        <button className="modern-submit-btn" onClick={handleSubmit}>
                            {isLogin ? "Sign In" : "Create Account"}
                        </button>

                        <p className="toggle-auth-text">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <span onClick={() => setIsLogin(!isLogin)}>
                                {isLogin ? "Sign Up" : "Sign In"}
                            </span>
                        </p>
                    </div>
                </div>

            </div>
        </Dialog>
    )
}
