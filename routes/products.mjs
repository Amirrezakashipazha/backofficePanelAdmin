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

router.get("/api/products",isAdmin, async (req, res) => {
  const limit = req.query.limit;
  const page = req.query.page || 1;
  const offset = (page - 1) * limit;

  const getUsersQuery = `${querySchema.table.products.get} LIMIT ? OFFSET ?`;
  const countUsersQuery = `SELECT COUNT(*) AS count FROM products`;

  try {
    const [users, [totalCount]] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(
          getUsersQuery,
          [parseInt(limit), offset],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      }),
      new Promise((resolve, reject) => {
        connection.query(countUsersQuery, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
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

router.get("/api/products/:id",isAdmin, (req, res) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);
  connection.query(
    querySchema.table.products.select.id,
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

router.post("/api/products",isAdmin, upload.array("images", 10), (req, res) => {
  const { name, price, discount, category, status, description, totalPrice } =
    req.body;
  let images = [];
  if (req.files) {
    req.files.forEach((element) => {
      images.push(`http://localhost:3000/${element.path}`);
    });
  }
  const imagesString = JSON.stringify(images);

  connection.query(
    querySchema.table.products.add,

    [
      name,
      category,
      description,
      price,
      discount,
      totalPrice,
      status,
      imagesString,
    ],
    (err, insertResults) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).send("Error inserting user");
      }
      return res.status(201).send(insertResults);
    }
  );
});
function getProductById(productId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM products WHERE id = ?";
    connection.query(query, [productId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        // Assuming the ID is unique, there should be at most one product with this ID
        resolve(results[0]);
      }
    });
  });
}

router.patch(
  "/api/products/:id",isAdmin,
  upload.array("images", 10),
  async (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id);
    // Correctly parsing the JSON string into an array
    let prevImages;
    try {
      prevImages = JSON.parse(req.body.prevImages);
    } catch (e) {
      // Handle the error (e.g., send a response indicating the incorrect format)
      return res.status(400).send("Invalid format for prevImages.");
    }

    // Now you can safely use .map() on prevImages

    let newprevImages = [];
    let dbprevImages = [];

    prevImages.map((value) => {
      // let item=value.src.split("uploads")[1]?.split("\\")[2]
      let item = value.src;
      if (item) {
        newprevImages.push(item);
      }
    });

    // console.log("new", newprevImages);

    connection.query(
      "SELECT image FROM products WHERE id = ?",
      [parsedId],
      (error, results) => {
        if (error) {
          console.error("Error updating product:", error);
          return res.status(500).send("Error updating product");
        }
        // res.status(200).send(results);
        dbprevImages.push(JSON.parse(results[0].image));
        // console.log("db", dbprevImages);
      }
    );

    if (isNaN(parsedId)) {
      return res.sendStatus(400);
    }

    try {
      let images = req.files.map(
        (file) => `http://localhost:3000/${file.path}`
      );

      let allImages = [...newprevImages, ...images];
      let imagesString = JSON.stringify(allImages);

      let fieldsToUpdate = {};
      const {
        name,
        price,
        discount,
        category,
        status,
        description,
        totalPrice,
      } = req.body;

      if (name) fieldsToUpdate.name = name;
      if (price) fieldsToUpdate.price = price;
      if (discount) fieldsToUpdate.discount = discount;
      if (category) fieldsToUpdate.category = category;
      if (status) fieldsToUpdate.status = status;
      if (totalPrice) fieldsToUpdate.total_price = totalPrice;
      if (description) fieldsToUpdate.description = description;
      fieldsToUpdate.image = imagesString;

      const setClause = Object.keys(fieldsToUpdate)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = [...Object.values(fieldsToUpdate), parsedId];

      const updateQuery = `UPDATE products SET ${setClause} WHERE id = ?`;

      connection.query(updateQuery, values, (error, results) => {
        if (error) {
          console.error("Error updating product:", error);
          return res.status(500).send("Error updating product");
        }
        res.status(200).send("Product updated successfully");
      });
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).send("Error updating product");
    }
  }
);

router.delete("/api/products/:id",isAdmin, (req, res) => {
  const {
    params: { id },
  } = req;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return res.sendStatus(400);

  connection.query(
    querySchema.table.products.delete,
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
