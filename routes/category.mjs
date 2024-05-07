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

router.get("/api/category",
 isAdmin,
  async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const filter = req.query.filter;
  const value = req.query.value;
  const offset = (page - 1) * limit;
  const validFilters = ['id', 'name', 'description', 'status']; // Columns in categories table

  // Check if the filter is valid
  if (filter && !validFilters.includes(filter)) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }

  // Build query condition with exact match for id and status, LIKE for others
  let queryCondition = '';
  let isExactMatch;
  if (filter && value) {
     isExactMatch = ['id', 'status'].includes(filter); // Exact match for id and status
    queryCondition = ` WHERE ${filter} ${isExactMatch ? '=' : 'LIKE'} ?`;
  }

  const getCategoriesQuery = `SELECT * FROM categories${queryCondition} LIMIT ? OFFSET ?`;
  const countCategoriesQuery = `SELECT COUNT(*) AS count FROM categories${queryCondition}`;

  try {
    // Prepare query parameters for the SQL statements
    const queryParams = filter && value ? [isExactMatch ? value : `%${value}%`] : [];
    const [categories, [totalCount]] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(
          getCategoriesQuery,
          [...queryParams, limit, offset],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      }),
      new Promise((resolve, reject) => {
        connection.query(
          countCategoriesQuery,
          queryParams,
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
      data: categories,
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return res.status(500).send("Error fetching categories");
  }
});



router.get("/api/category/:id",isAdmin, (req, res) => {

    const {
        params: { id },
      } = req;
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) return res.sendStatus(400);
      connection.query(
        querySchema.table.categories.select.id,
        [parsedId],
        (err, insertResults) => {
          if (err) {
            console.error("Error inserting categories:", err);
            return res.status(500).send("Error inserting categories");
          }
          return res.status(201).send(insertResults);
        }
      );
});

router.post("/api/category",isAdmin, upload.single("image", 10), (req, res) => {
  const { name, status, description } = req.body;
  let imagesString = req.file
    ? `http://localhost:3000/${req.file.path}`
    : "http://localhost:3000/assets/images/svg/no-category.svg";

  connection.query(
    querySchema.table.categories.add,
    [name, description, status, imagesString],
    (err, insertResults) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).send("Error inserting user");
      }
      return res.status(201).send(insertResults);
    }
  );
});

router.patch("/api/category/:id",isAdmin, upload.single("image"), (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) return res.sendStatus(400);
    let fieldsToUpdate = {};
    const { name, description, status } = req.body;
    if (name) fieldsToUpdate.name = name;
    if (description) fieldsToUpdate.description = description;
    if (status) fieldsToUpdate.status = status;
    if (req.file)
      fieldsToUpdate.image = `http://localhost:3000/${req.file.path}`;
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).send("No fields provided for update");
    }
    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(fieldsToUpdate), parsedId];
  
    const updateQuery = `UPDATE categories SET ${setClause} WHERE id = ?`;
  
    try {
      connection.query(updateQuery, values);
      res.status(200).send("categories updated successfully");
    } catch (err) {
      console.error("Error updating categories:", err);
      res.status(500).send("Error updating categories");
    }
});
 
router.delete("/api/category/:id",isAdmin, (req, res) => {
    const {
        body: { name, email, password },
        params: { id },
      } = req;
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) return res.status(400).send({msg:""});
      if (parsedId===1) return res.status(401).send({msg:""});
    
     
    
      connection.query(
        querySchema.table.categories.delete,
        [parsedId],
        (err, results) => {
          if (err) {
            console.error("Error deleting categories:", err);
            return res.status(500).send("Error deleting categories");
          }
          if (results.affectedRows === 0) {
            return res.status(404).send("categories not found");
          }
          return res.status(200).send("categories deleted successfully");
        }
      );
});

export default router;
