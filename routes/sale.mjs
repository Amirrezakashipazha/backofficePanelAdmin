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
import axios from "axios";

const router = Router();
router.get("/api/sale",isAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit || 100);
  const page = parseInt(req.query.page || 1);
  const offset = (page - 1) * limit;

  // Adjusted to select from the `sales` table instead of the `orders` table
  const getSalesQuery = `
            SELECT s.id AS sale_id, s.status, s.created_at, 
                   u.id AS user_id, u.username AS user_name,
                   u.email AS user_email, 
                   u.status AS user_status, 
                   u.avatar AS user_avatar, 
                   p.id AS product_id, p.name AS product_name,
                   p.category AS product_category,
                   p.description AS product_description,
                   p.price AS product_price,
                   p.discount AS product_discount,
                   p.total_price AS product_total_price,
                   p.status AS product_status,
                   p.image AS product_image
            FROM sale s
            JOIN users u ON s.user_id = u.id
            JOIN products p ON s.product_id = p.id
            LIMIT ? OFFSET ?`;

  // Adjusted to count from the `sales` table instead of the `orders` table
  const countSalesQuery = `SELECT COUNT(*) AS count FROM sale`;

  try {
    const sales = await new Promise((resolve, reject) => {
      connection.query(getSalesQuery, [limit, offset], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const totalCount = await new Promise((resolve, reject) => {
      connection.query(countSalesQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results[0].count);
      });
    });

    const pageCount = Math.ceil(totalCount / limit);

    // Transform sales into the desired structure
    const data = sales.map((sale) => ({
      id: sale.sale_id,
      status: sale.status,
      created_at: sale.created_at,
      user: {
        id: sale.user_id,
        name: sale.user_name,
        email: sale.user_email,
        status: sale.user_status,
        avatar: sale.user_avatar,
      },
      product: {
        id: sale.product_id,
        name: sale.product_name,
        category: sale.product_category,
        description: sale.product_description,
        price: sale.product_price,
        discount: sale.product_discount,
        total_price: sale.product_total_price,
        status: sale.product_status,
        image: sale.product_image,
      },
    }));
    const totalSale = sales.reduce((acc, sale) => acc + sale.product_total_price, 0);
    return res.status(200).send({
      object: "list",
      page: page,
      pageCount: pageCount,
      itemsPerPage: limit,
      totalItems: totalCount,
      totalSale: totalSale,
      data: data,
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    return res.status(500).send("Error fetching sales");
  }
});

router.get("/api/sale/:id",isAdmin, (req, res) => {});

router.post("/api/sale",isAdmin, (req, res) => {});
router.patch("/api/sale/:id",isAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // The new status to be set
  const parsedId = parseInt(id);

  if (isNaN(parsedId) || !status) {
    return res.sendStatus(400); // Bad request if the ID is not a number or status is not provided
  }

  // Only proceed if the new status is "in progress" or "canceled"
  if (status === "in progress" || status === "canceled") {
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Transaction Begin Error:", err);
        return res.status(500).send("Error processing sale");
      }

      // Insert back into the orders table from the sale table with the new status
      const insertOrderQuery = `INSERT INTO orders (user_id, product_id, status, created_at) SELECT user_id, product_id, ?, created_at FROM sale WHERE id = ?`;

      connection.query(insertOrderQuery, [status, parsedId], (insertError) => {
        if (insertError) {
          connection.rollback(() => {
            console.error("Error moving sale back to orders:", insertError);
            return res.status(500).send("Error processing sale");
          });
        } else {
          // Delete the entry from the sale table
          const deleteSaleQuery = "DELETE FROM sale WHERE id = ?";
          connection.query(deleteSaleQuery, [parsedId], (deleteError) => {
            if (deleteError) {
              connection.rollback(() => {
                console.error("Error deleting sale:", deleteError);
                return res.status(500).send("Error processing sale");
              });
            } else {
              connection.commit((commitError) => {
                if (commitError) {
                  connection.rollback(() => {
                    console.error("Transaction Commit Error:", commitError);
                    return res.status(500).send("Error processing sale");
                  });
                }
                return res
                  .status(200)
                  .send("Sale moved back to orders successfully");
              });
            }
          });
        }
      });
    });
  } else {
    return res.status(400).send("Invalid status update");
  }
});

router.delete("/api/sale/:id",isAdmin, (req, res) => {});

export default router;
