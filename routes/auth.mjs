import express from "express";
import {
  query,
  body,
  validationResult,
  matchedData,
  checkSchema,
} from "express-validator";
import { validationSchema } from "../utils/validationSchemas.mjs";

import { Router } from "express";
import {
  Midlewar,
  MidlewarAuth,
  MidlewarCheck,
} from "../utils/middlewares.mjs";
import data from "../utils/fakedb.mjs";
import { query as querySchema } from "../db/schemas.mjs";
import { connection } from "../db/index.mjs";
import { upload } from "../utils/multer.mjs";

import {
  __dirname,
  deleteFile,
  listFiles,
  path,
} from "../utils/deleteFile.mjs";

const router = Router();

router.get("/api/auth/admin/isLoggedin", async (req, res) => {
  // Check if session exists and if the role is set to 'admin'
  if (
    req.session.user &&
    (req.session.user.role === "admin" ||
      req.session.user.role === "super-admin")&&
      req.session.user.status === "active"
  ) {
    // If an admin is logged in, return a positive response
    res.status(200).send({
      status: "success",
      message: "Admin is logged in.",
      user: { 
        id: req.session.user.id,
        username: req.session.user.username,
        role: req.session.user.role,
        status: req.session.user.status,
        avatar: req.session.user.avatar,
      },
    });
  } else {
    // If no admin is logged in, return a negative response
    res.status(200).send({
      status: "error",
      message: "No admin is currently logged in.",
    });
  }
});

// router.get("/api/auth/admin/:id", (req, res) => {

// });
router.get("/api/auth/admin/logout", (req, res) => {
  console.log("Attempting to log out");
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error while destroying the session:", err);
        return res.status(500).send("An error occurred while logging out.");
      }

      res.clearCookie("connect.sid"); // Adjust the cookie name if necessary
      console.log("Logged out successfully");
      return res.send("Logged out successfully.");
    });
  } else {
    console.log("No active session. User already logged out.");
    res.status(200).send("No active session. User already logged out.");
  }
});

router.post("/api/auth/admin/login", (req, res) => {
  const { username, password } = req.body;
  const query = "SELECT * FROM admins WHERE username = ?";
  console.log(username, password);
  connection.query(query, [username], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("An error occurred.");
    }

    if (results.length === 0) {
      return res.status(401).send("Username not found.");
    }

    const user = results[0];

    // Compare plaintext passwords directly since hashing is not implemented
    if (password !== user.password) {
      return res.status(401).send("Password is incorrect.");
    }
    
    if ("active" !== user.status) {
      return res.status(401).send("admin is not active");
    }

    // Assuming login is successful, set up the session
    // console.log(req.session);
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
    };
    // console.log(req.session);
    req.session.visited = true;
    return res.send({ status: 200, msg: "Login successful." });
  });
});

// router.patch("/api/auth/admin/:id",(req, res) => {

// });

// router.delete("/api/auth/admin/:id", (req, res) => {

// });

export default router;
