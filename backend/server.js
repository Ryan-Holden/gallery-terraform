const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static("public"));

app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "UP"
    });
});

app.post("/login", (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({
            message: "Username required"
        });
    }

    res.json({
        message: "Login successful",
        username: username
    });
});

app.post("/upload", upload.single("photo"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            message: "No file uploaded"
        });
    }

    const imagePath = req.file.filename;

    const sql = "INSERT INTO photos (filename) VALUES (?)";

    db.query(sql, [imagePath], (err, result) => {

        if (err) {
            console.log(err);

            return res.status(500).json({
                message: "Database insert failed"
            });
        }

        res.json({
            message: "Photo uploaded",
            filename: imagePath
        });
    });
});

app.get("/photos", (req, res) => {

    db.query("SELECT * FROM photos", (err, results) => {

        if (err) {
            return res.status(500).json({
                message: "Database query failed"
            });
        }

        res.json(results);
    });
});

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});