const express = require('express')
const router = express.Router()
const User = require("../Models/UserModel")
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

// register
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Basic Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // 2. Sirf Email check karenge (Naam same ho sakta hai)
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: "An account with this email already exists" });
        }

        // 3. Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create and Save User
        const user = new User({
            name, // Do alag users ka name "Rahul" ho sakta hai, koi dikkat nahi aayegi
            email,
            password: hashedPassword
        });

        await user.save();
        
        return res.status(201).json({ message: "User Registered Successfully" });

    } catch (error) {
        console.error("Registration Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            // 400 ki jagah 404 (Not Found) bhejenge
            return res.status(404).json({ message: "Account not found. Please sign up to create an account." });
        }

        // 2. Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // 400 ki jagah 401 (Unauthorized) bhejenge
            return res.status(401).json({ message: "Invalid credentials. Wrong password." });
        }

        // 3. Generate Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });

        // 4. Success Response
        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            } // Security ke liye pura user object (with hashed password) bhejne ki jagah sirf zaroori data bhein
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});


module.exports = router;
