import express from "express";
import "./db/index.mjs";
import AllRoutes from "./routes/index.mjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import "./utils/multer.mjs";
import { initSocket } from "./utils/socket.mjs";
import { v4 as uuidv4 } from "uuid";

// import http from 'http'; // Import http
// import { Server } from 'socket.io'; // Import socket.io

// import http from 'http';
// import { Server } from 'socket.io';

import http from "http";
import { Server as SocketIO } from "socket.io";

dotenv.config();

const port = process.env.PORT || 3000;

const app = express();

// Rest of your server setup...

// const server = http.createServer(app);
// const io = new SocketIO(server, {
//   cors: true,
//   origins: ['http://localhost:5173'],
// });

// io.on('connection', (socket) => {
//   console.log('A user connected');
//   socket.on('disconnect', () => {
//     console.log('User disconnected');
//   });
// });

// // Make io available throughout your app
// app.use((req, res, next) => {
//   req.io = io;
//   next();
// });

app.use(express.json());
app.use(express.static("public"));

app.use("/uploads", express.static("uploads"));

app.use(
  cors({
    origin: "http://localhost:4173", // Specify the exact origin you want to allow
    credentials: true, // Enable credentials to allow cookies, session, etc.
  })
);


// app.use(cors()); // بزند request ها origin برای اینکه بتواند از تمامی
// app.use(cors({
//   origin: ['http://localhost:5599'], // Replace with the actual origin of your client app
//   credentials: true, // To allow sending of cookies and authentication information
// }));

// app.use(
//   cors({
//     origin: "http://localhost:5173", // Adjust as necessary
//     credentials: false, // Crucial for cookies to be sent
//   })
// );

// const seenIPs = new Set();
// let uniqueVisits = 0;
// app.use((req, res, next) => {
//   const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
//   if (!seenIPs.has(ip)) {
//     uniqueVisits++;
//     seenIPs.add(ip);
//   }
//   next();
// });

app.use(
  session({
    secret: "PanelAdminSession",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "Lax", // Try 'None' if 'Lax' does not work, and your environment is secure
      secure: false, // Set to true in production with HTTPS
      maxAge: 60000 * 60,
    },
  })
);

let requestsPerHour = Array.from({ length: 24 }, () => 0);

app.use((req, res, next) => {
  const currentHour = new Date().getHours() !== 23 ? new Date().getHours() : 0;
  requestsPerHour[currentHour]++;
  next();
});

app.get("/api/request-count", (req, res) => {
  res.json({
    message: "Requests per hour",
    data: requestsPerHour.map((count, hour) => ({ hour, count })),
  });
});
const resetRequestCounts = () => {
  requestsPerHour = Array.from({ length: 24 }, () => 0);
};

// Schedule the reset at midnight every day
const scheduleReset = () => {
  const now = new Date();
  const millisTillMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 24, 0, 0, 0) -
    now;
  setTimeout(() => {
    resetRequestCounts();
    scheduleReset(); // Schedule next reset
  }, millisTillMidnight);
};

scheduleReset();

app.use(cookieParser("secret"));

const uniqueVisitorIDs = new Set(); // Initialize a Set to store unique visitor IDs
app.use((req, res, next) => {
  // Check if the visitorId cookie is set and is already tracked
  const visitorId = req.cookies.visitorId;
  if (visitorId && uniqueVisitorIDs.has(visitorId)) {
    // Visitor ID is already known and counted, just proceed
    return next();
  }

  if (!visitorId) {
    // Set a new visitor ID if it doesn't exist
    const newVisitorId = uuidv4();
    res.cookie("visitorId", newVisitorId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
      secure: false, // Set to true if your site is served over HTTPS
      sameSite: "strict", // Adjust according to your needs
    });
    uniqueVisitorIDs.add(newVisitorId); // Add the new visitor ID to the Set
    console.log(
      "New visitor added, total unique visitors: " + uniqueVisitorIDs.size
    );
  } else {
    // Add the existing visitor ID to the Set
    uniqueVisitorIDs.add(visitorId);
  }
  next();
});


app.get("/api/view-count", (req, res) => {
  res.json(uniqueVisitorIDs.size);
});

// app.use(
//   session({
//     secret: "amirreza",
//     saveUninitialized: false,
//     resave: false,
//     cookie: {
//       maxAge: 60000 * 60,
//     },
//   })
// );

// app.use((req,res,next)=>{
//   console.log(req.ip);
//   next()
// })

app.use(AllRoutes);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
