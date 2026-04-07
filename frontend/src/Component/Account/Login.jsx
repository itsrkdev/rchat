import React, { useEffect, useState } from 'react'
import { Dialog } from "@mui/material"
import './Login.css'
// import scnr from '../../assets/scnr.png'
import wplogo from '../../assets/wplogo.png'
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


            // If login → store token & go to chats
            if (isLogin) {
                localStorage.setItem("token", data.token); // store token
                navigate("/chats", { replace: true }); // redirect to chat page
            } else {
                setIsLogin(true); // after register, switch to login
            }

        } catch (error) {
            console.error("Error:", error);
            alert("Server not responding");
        }
    };


    return (
        <>

            <Dialog open={true} className='custom-dialog' hideBackdrop>
                <div className="login-container">
                    <div className="login-left-panel">
                        <div className="wp-logo-container">
                            <img src={rchat} alt="WhatsApp Logo" className="whatsapp-logo" />
                            <div className="whatsapp-text"></div>
                        </div>
                        <h2>Welcome to R-Chat</h2>
                        <p> Your conversations, all in one place</p>
                        <ul>
                            <li>Log in to access your messages securely</li>
                            <li>Stay connected on all your devices</li>
                            <li>Chat with friends and colleagues instantly</li>
                            <li>Chat instantly with your contacts anytime, anywhere</li>
                        </ul>
                        <p><a href="#"> Need help? Get support or Sign up for a new account.</a></p>
                    </div>


                    <div className="login-right-panel">
                        <div className="form-box">
                            <h2>{isLogin ? "Sign In" : "Sign Up"}</h2>

                            {!isLogin && (
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Full Name"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            )}

                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange} />

                            <button onClick={handleSubmit}>
                                {isLogin ? "Sign In" : "Create Account"}
                            </button>

                            <p>
                                {isLogin ? "Don't have an account?" : "Already have an account?"}
                                <span onClick={() => setIsLogin(!isLogin)}>
                                    {isLogin ? " Sign Up" : " Sign In"}
                                </span>
                            </p>
                        </div>
                    </div>

                </div>
            </Dialog>


        </>



    )
}
