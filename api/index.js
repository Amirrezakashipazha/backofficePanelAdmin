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

// app.use(
//   cors({
//     origin: [
//       "https://web-backoffice-panel-amin.vercel.app",
//       "https://web-backoffice-panel-a-git-37b288-amirreza-kashipazhas-projects.vercel.app",
//       "https://web-backoffice-panel-amin-59r9w7c50.vercel.app",
//     ],
//     credentials: true,
//   })
// );

// app.use(cors());
app.options('*', cors()); // Allow all preflight requests

// app.use(
//   session({
//     secret: "PanelAdminSession",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       httpOnly: true,
//       sameSite: "Lax",
//       secure: false,
//       maxAge: 60000 * 60,
//     },
//   })
// );

// app.use(cookieParser("secret"));
app.use(AllRoutes);

// Export the app so Vercel can handle the serverless function
export default app;
