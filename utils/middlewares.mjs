import {
  query,
  body,
  validationResult,
  matchedData,
  checkSchema,
} from "express-validator";
import { validationSchema } from "../utils/validationSchemas.mjs";
import data from "./fakedb.mjs";

const Midlewar = (res, req, next) => {
  console.log("this is a middleware for all app");
  next();
};

const MidlewarAuth = (req, res, next) => {
  const {
    query: { auth },
  } = req;
  if (auth === "admin") next();
  else res.sendStatus(401);
};

const MidlewarCheck = (req, res, next) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);
  const index = data.findIndex((val) => val.id === parsedId);
  req.index = index;
  req.parsedId = parsedId;
  next();
};

function isAdmin(req, res, next) {
  if (
    req.session.user &&
    (req.session.user.role === "admin" ||
      req.session.user.role === "super-admin") &&
    req.session.user.status === "active"
  ) {
    return next();
  } else {
    return res
      .status(403)
      .send("Access denied. Only admins can access this endpoint.");
  }
}

function isSuperAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "super-admin") {
    return next();
  } else {
    return res
      .status(403)
      .send("Access denied. Only admins can access this endpoint.");
  }
}

export { Midlewar, MidlewarAuth, MidlewarCheck, isAdmin, isSuperAdmin };
