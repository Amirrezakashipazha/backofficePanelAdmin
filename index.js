import express from "express";
import "./db/index.mjs";
import AllRoutes from "./routes/index.mjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import "./utils/multer.mjs";

dotenv.config();

const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.use("/uploads", express.static("uploads"));

// app.use(cors()); // بزند request ها origin برای اینکه بتواند از تمامی
// app.use(cors({
//   origin: ['http://localhost:5599'], // Replace with the actual origin of your client app
//   credentials: true, // To allow sending of cookies and authentication information
// }));


app.use(cors({
  origin: 'http://localhost:5173', // Adjust as necessary
  credentials: true, // Crucial for cookies to be sent
}));


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

app.use(session({
  secret: 'PanelAdminSession',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'Lax', // Try 'None' if 'Lax' does not work, and your environment is secure
    secure: false, // Set to true in production with HTTPS
    maxAge: 60000 *60,
  }
}));








let requestsPerHour = Array.from({ length: 24 }, () => 0);

app.use((req, res, next) => {
  const currentHour =
    new Date().getHours() !== 23 ? new Date().getHours() : 0;
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
