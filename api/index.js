// api/index.js
import express from "express";
import AllRoutes from "../routes/index.mjs"; // Adjust the path
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(
    cors({
      origin: "https://web-backoffice-panel-amin.vercel.app/", // No trailing slash
      credentials: true,
    })
  );
  

app.use(
  session({
    secret: "PanelAdminSession",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      maxAge: 60000 * 60,
    },
  })
);

app.use(cookieParser("secret"));
app.use(AllRoutes);

// Export the app so Vercel can handle the serverless function
export default app;
