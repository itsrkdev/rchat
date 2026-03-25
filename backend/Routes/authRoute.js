const express = require('express')
const router = express.Router()
const User = require("../Models/UserModel")
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

// register
router.post("/register", async (req, res) => {

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({
        $or: [{ name }, { email }]
    });

    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        name,
        email,
        password: hashedPassword
    });

    await user.save();
    res.json({ message: "User Registered" });



})

// login

// Login
router.post("/login", async (req, res) => {

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials Wrong password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });

    // res.json({ token, user });
      res.status(200).json({
            message: "Login successful",
            token,
            user
        });
});


module.exports = router;