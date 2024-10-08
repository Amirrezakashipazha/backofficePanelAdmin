
import { Router } from "express";
import {
  isSuperAdmin
} from "../utils/middlewares.mjs";
import { query as querySchema } from "../db/schemas.mjs";
import { connection } from "../db/index.mjs";
import { upload } from "../utils/multer.mjs";


const router = Router();
router.get("/api/admins", 
isSuperAdmin, 
async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const { filter, value } = req.query;

  // Validate filter parameter against allowed fields
  const validFilters = ['id', 'username', 'role', 'status'];
  if (filter && !validFilters.includes(filter.toLowerCase())) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }

  const offset = (page - 1) * limit;

  // Construct the base query
  const baseQuery = `FROM admins WHERE role != 'super-admin'`;

  // Adjust query to use exact matching for status, and LIKE for other filters
  const filterQuery = filter && value ? 
    (filter.toLowerCase() === 'status' ? ` AND ${filter} = ?` : ` AND ${filter} LIKE ?`) : 
    '';

  const getUsersQuery = `SELECT * ${baseQuery}${filterQuery} LIMIT ? OFFSET ?`;
  const countUsersQuery = `SELECT COUNT(*) AS count ${baseQuery}${filterQuery}`;

  try {
    const queryArgs = filter && value ? (filter.toLowerCase() === 'status' ? [value] : [`%${value}%`]) : [];

    const [users, [totalCount]] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(
          getUsersQuery,
          [...queryArgs, limit, offset],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      }),
      new Promise((resolve, reject) => {
        connection.query(
          countUsersQuery,
          queryArgs,
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      }),
    ]);

    const pageCount = Math.ceil(totalCount.count / limit);

    return res.status(200).send({
      object: "list",
      page: page,
      pageCount: pageCount,
      itemsPerPage: limit,
      totalItems: totalCount.count,
      data: users,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).send("Error fetching users");
  }
});



router.get("/api/admins/:id", isSuperAdmin, (req, res) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);
  connection.query(
    querySchema.table.admins.select.id,
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

router.post(
  "/api/admins",
  isSuperAdmin,
  upload.single("avatar"),
  (req, res) => {
    const { username, password, status } = req.body;
    let avatar = req.file
      ? `http://localhost:3000/${req.file.path}`
      : "http://localhost:3000/assets/images/svg/no-avatar.svg";

    connection.query(
      querySchema.table.admins.select.username,
      [username],
      (err, results) => {
        if (err) {
          console.error("Error querying the database:", err);
          return res.status(500).send("Internal server error");
        }
        if (results.length > 0) {
          return res.status(409).send({ error: "username already exists" });
        }
        connection.query(
          querySchema.table.admins.add,
          [username, password, status, avatar],
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
  }
);

router.patch(
  "/api/admins/:id",
  isSuperAdmin,
  upload.single("avatar"),
  (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return res.sendStatus(400);
    let fieldsToUpdate = {};
    const { username, password, status } = req.body;
    if (username) fieldsToUpdate.username = username;
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
  
    const updateQuery = `UPDATE admins SET ${setClause} WHERE id = ?`;
  
    try {
      connection.query(updateQuery, values);
      res.status(200).send("User updated successfully");
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).send("Error updating user");
    }
  }
);

router.delete("/api/admins/:id", isSuperAdmin, (req, res) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);

  // First, check if the user has a 'super-admin' role
  const checkRoleQuery = `SELECT role FROM admins WHERE id = ?`;
  connection.query(checkRoleQuery, [parsedId], (err, results) => {
    if (err) {
      console.error("Error checking admin role:", err);
      return res.status(500).send("Error processing request");
    }
    if (results.length === 0) {
      return res.status(404).send("Admin not found");
    }
    if (results[0].role === "super-admin") {
      return res.status(403).send("Cannot delete super-admin");
    }

    // Proceed with deletion if the user is not a super-admin
    connection.query(
      querySchema.table.admins.delete,
      [parsedId],
      (err, results) => {
        if (err) {
          console.error("Error deleting admin:", err);
          return res.status(500).send("Error deleting admin");
        }
        if (results.affectedRows === 0) {
          // This check might be redundant since we already checked if the admin exists
          return res.status(404).send("Admin not found");
        }
        return res.status(200).send("Admin deleted successfully");
      }
    );
  });
});

export default router;
