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
  isAdmin,
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


router.get("/api/users",
// isAdmin, 
async (req, res) => {
  // Ensure limit is a valid integer, default to 100 if not provided or invalid
  const limit = parseInt(req.query.limit, 10) || 100;
  const page = parseInt(req.query.page, 10) || 1;
  const offset = (page - 1) * limit;

  const { filter, value } = req.query;

  // Valid filters and corresponding database columns
  const validFilters = {
    id: 'id',
    username: 'username',
    email: 'email',
    status: 'status'
  };

  // Validate the filter
  if (filter && !(filter.toLowerCase() in validFilters)) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }

  let queryCondition = '';
  let formattedValue = value; // Initialize with value to ensure it is always defined

  if (filter && value) {
    const column = validFilters[filter];
    // Use '=' for 'id' and 'status', 'LIKE' for 'username' and 'email'
    const operator = (filter === 'id' || filter === 'status') ? '=' : 'LIKE';
    formattedValue = (operator === 'LIKE') ? `%${value}%` : value;
    queryCondition = ` AND ${column} ${operator} ?`;
  }

  const getUsersQuery = `
    SELECT * FROM users
    WHERE 1=1 ${queryCondition}
    LIMIT ? OFFSET ?`;

  // Include the formattedValue only if there is a valid filter and value
  const queryParams = filter && value ? [formattedValue, limit, offset] : [limit, offset];

  const countUsersQuery = `
    SELECT COUNT(*) AS count FROM users
    WHERE 1=1 ${queryCondition}`;

  const countParams = filter && value ? [formattedValue] : [];

  try {
    const [users, totalCount] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(getUsersQuery, queryParams, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(countUsersQuery, countParams, (err, results) => {
          if (err) return reject(err);
          resolve(results[0].count);  // resolve the count directly
        });
      }),
    ]);
    

    const pageCount = Math.ceil(totalCount / limit);

    return res.status(200).send({
      object: "list",
      page: page,
      pageCount: pageCount,
      itemsPerPage: limit,
      totalItems: totalCount,
      data: users
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).send("Error fetching users");
  }
});


router.get("/api/users/:id",isAdmin, (req, res) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);
  connection.query(
    querySchema.table.users.select.id,
    [parsedId],
    (err, insertResults) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).send("Error inserting user");
      }
      return res.status(201).send(insertResults);
    }
  );
});

router.post("/api/users",isAdmin, upload.single("avatar"), (req, res) => {
  const { username, email, password, status ,phone, address} = req.body;

  let avatar = req.file
    ? `http://localhost:3000/${req.file.path}`
    : "http://localhost:3000/assets/images/svg/no-avatar.svg";

  connection.query(
    querySchema.table.users.select.email,
    [email],
    (err, results) => {
      if (err) {
        console.error("Error querying the database:", err);
        return res.status(500).send("Internal server error");
      }
      if (results.length > 0) {
        return res.status(409).send({ error: "Email already exists" });
      }
      connection.query(
        querySchema.table.users.add,
        [username, email, phone,address,password, status, avatar],
        (err, insertResults) => {
          if (err) {
            console.error("Error inserting user:", err);
            return res.status(500).send("Error inserting user");
          }
          return res.status(201).send(insertResults);
        }
      );
    }
  );
});

router.patch("/api/users/:id",isAdmin, upload.single("avatar"), (req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);
  let fieldsToUpdate = {};
  const { username, email, password, status,phone,address } = req.body;
  if (username) fieldsToUpdate.username = username;
  if (email) fieldsToUpdate.email = email;
  if (phone) fieldsToUpdate.phone = phone;
  if (address) fieldsToUpdate.address = address;
  if (password) fieldsToUpdate.password = password;
  if (status) fieldsToUpdate.status = status;
  if (req.file)
    fieldsToUpdate.avatar = `http://localhost:3000/${req.file.path}`;
  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).send("No fields provided for update");
  }
  const setClause = Object.keys(fieldsToUpdate)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = [...Object.values(fieldsToUpdate), parsedId];

  const updateQuery = `UPDATE users SET ${setClause} WHERE id = ?`;

  try {
    connection.query(updateQuery, values);
    res.status(200).send("User updated successfully");
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).send("Error updating user");
  }
});

router.delete("/api/users/:id",isAdmin, (req, res) => {
  const {
    body: { name, email, password },
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);

  // const uploadsDir = path.join(__dirname, "..", "uploads");
  // listFiles(uploadsDir)
  //   .then((files) => {
  //     if (files.length > 0) {
  //       deleteFile(files[0]);
  //     } else {
  //       console.log("No files to delete.");
  //     }
  //   })
  //   .catch((err) => {
  //     console.error("Error listing files:", err);
  //   });

  connection.query(
    querySchema.table.users.delete,
    [parsedId],
    (err, results) => {
      if (err) {
        console.error("Error deleting user:", err);
        return res.status(500).send("Error deleting user");
      }
      if (results.affectedRows === 0) {
        return res.status(404).send("User not found");
      }
      return res.status(200).send("User deleted successfully");
    }
  );
});

export default router;
