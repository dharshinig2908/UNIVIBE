require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());
app.use(cors());

// ======================================
// STUDENT MODEL
// ======================================

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const Student = mongoose.model("Student", studentSchema);

// ======================================
// POST MODEL
// ======================================

const postSchema = new mongoose.Schema({
    author: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    comments: {
        type: Array,
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Post = mongoose.model("Post", postSchema);

// ======================================
// REGISTER STUDENT
// ======================================

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter your name, email and a password of at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingStudent = await Student.findOne({
            email: normalizedEmail
        });

        if (existingStudent) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const student = await Student.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        res.status(201).json({
            success: true,
            message: "Student registered successfully!",
            student: {
                id: student._id,
                name: student.name,
                email: student.email
            }
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to register student."
        });
    }
});

// ======================================
// STUDENT LOGIN
// ======================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const student = await Student.findOne({
            email: email.trim().toLowerCase()
        });

        if (!student) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            student.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                studentId: student._id.toString()
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            success: true,
            message: "Login successful!",
            token,
            student: {
                id: student._id,
                name: student.name,
                email: student.email
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to login."
        });
    }
});

// ======================================
// HEALTH CHECK
// ======================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "UniVibe backend is running!",
        database: mongoose.connection.readyState === 1
            ? "Connected"
            : "Disconnected"
    });
});

// ======================================
// GET ALL POSTS
// ======================================

app.get("/api/posts", async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            posts
        });

    } catch (error) {
        console.error("Fetch posts error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch posts."
        });
    }
});

// ======================================
// CREATE A NEW POST
// ======================================

app.post("/api/posts", async (req, res) => {
    try {
        const { author, text } = req.body;

        if (
            typeof author !== "string" ||
            typeof text !== "string" ||
            !author.trim() ||
            !text.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Author and post text are required."
            });
        }

        const newPost = await Post.create({
            author: author.trim(),
            text: text.trim()
        });

        res.status(201).json({
            success: true,
            message: "Post created successfully!",
            post: newPost
        });

    } catch (error) {
        console.error("Create post error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to create post."
        });
    }
});

// ======================================
// CONNECT DATABASE AND START SERVER
// ======================================

async function startServer() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing from environment variables");
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from environment variables");
        }

        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "univibe_db"
        });

        console.log("UniVibe MongoDB connected successfully!");

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`UniVibe server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();