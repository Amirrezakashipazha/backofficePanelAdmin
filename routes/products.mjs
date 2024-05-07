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
router.get("/api/products",
// isAdmin, 
async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;  // Set default limit
  const page = parseInt(req.query.page) || 1;
  const { filter, value } = req.query;
  const offset = (page - 1) * limit;

  const validFilters = {
    id: 'id',
    name: 'name',
    category: 'category',
    discount: 'discount',
    totalPrice: 'total_price',
    number: 'number',
    status: 'status' // status should use '=' for exact match
  };

  if (filter && !(filter in validFilters)) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }
let isExactMatchFilter;
  let queryCondition = '';
  if (filter && value) {
    const column = validFilters[filter];
    isExactMatchFilter = ['id', 'discount', 'totalPrice', 'number', 'status'].includes(filter); // Include 'status' here
    queryCondition = ` AND ${column} ${isExactMatchFilter ? '=' : 'LIKE'} ?`;
  }

  const queryParams = filter && value
    ? [isExactMatchFilter ? value : `%${value}%`, limit, offset]
    : [limit, offset];

  const getProductsQuery = `
    SELECT * FROM products
    WHERE 1=1${queryCondition}
    LIMIT ? OFFSET ?`;

  const countProductsQuery = `
    SELECT COUNT(*) AS count FROM products
    WHERE 1=1${queryCondition}`;
  
  const countParams = filter && value ? [isExactMatchFilter ? value : `%${value}%`] : [];

  try {
    const [products, [totalCount]] = await Promise.all([
      new Promise((resolve, reject) => {
        connection.query(getProductsQuery, queryParams, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        connection.query(countProductsQuery, countParams, (err, results) => {
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
      data: products
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    return res.status(500).send("Error fetching products");
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
        console.error("Error inserting product:", err);
        return res.status(500).send("Error inserting product");
      }
      return res.status(201).send(insertResults);
    }
  );
});

router.post("/api/products",isAdmin, upload.array("images", 10), (req, res) => {
  const { name, price, discount, category, status, description, totalPrice,number } =
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
      number
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
        number
      } = req.body;

      if (name) fieldsToUpdate.name = name;
      if (price) fieldsToUpdate.price = price;
      if (discount) fieldsToUpdate.discount = discount;
      if (category) fieldsToUpdate.category = category;
      if (status) fieldsToUpdate.status = status;
      if (totalPrice) fieldsToUpdate.total_price = totalPrice;
      if (description) fieldsToUpdate.description = description;
      if (number) fieldsToUpdate.number = number;
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
