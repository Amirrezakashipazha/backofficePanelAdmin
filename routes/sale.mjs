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

router.get("/api/sale",
//  isAdmin, 
 async (req, res) => {
  const limit = parseInt(req.query.limit || 100);
  const page = parseInt(req.query.page || 1);
  const offset = (page - 1) * limit;
  const { filter, value } = req.query;

  // Valid filters and corresponding database columns
  const validFilters = {
    id: 'sale.id',
    productname: 'product_name',
    price: 'product_total_price',
    username: 'user_username',
    date: 'sale.created_at',
    status: 'sale.status' // Ensure the status is coming from the sale table
  };

  // Validate the filter
  if (filter && !(filter in validFilters)) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }

  // Build the query condition based on the filter
  let queryCondition = '';
  if (filter && value) {
    const column = validFilters[filter];
    queryCondition = ` AND ${column} ${filter === 'id' || filter === 'price' ? '=' : 'LIKE'} ?`;
  }

  const getSalesQuery = `
    SELECT sale.*, 
           user_username, user_email, user_avatar, user_phone, user_address,
           product_name, product_category, product_description, product_total_price, product_discount, product_total_price, product_image
    FROM sale
    JOIN users ON sale.user_id = users.id
    JOIN products ON sale.product_id = products.id
    WHERE 1=1 ${queryCondition}
    LIMIT ? OFFSET ?`;

  const queryParams = filter && value ? [`${filter === 'id' || filter === 'price' ? parseInt(value) : `%${value}%`}`, limit, offset] : [limit, offset];

  const countSalesQuery = `
    SELECT COUNT(*) AS count FROM sale
    JOIN users ON sale.user_id = users.id
    JOIN products ON sale.product_id = products.id
    WHERE 1=1 ${queryCondition}`;

  const countParams = filter && value ? [`${filter === 'id' || filter === 'price' ? parseInt(value) : `%${value}%`}`] : [];

  try {
    const sales = await new Promise((resolve, reject) => {
      connection.query(getSalesQuery, queryParams, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const totalCount = await new Promise((resolve, reject) => {
      connection.query(countSalesQuery, countParams, (err, results) => {
        if (err) return reject(err);
        resolve(results[0].count);
      });
    });

    const pageCount = Math.ceil(totalCount / limit);

    const data = sales.map(sale => ({
      id: sale.id,
      status: sale.status, // Now explicitly using sale.status
      created_at: sale.created_at,
      user: {
        id: sale.user_id,
        name: sale.user_username,
        email: sale.user_email,
        avatar: sale.user_avatar,
        phone: sale.user_phone,
        address: sale.user_address,
      },
      product: {
        id: sale.product_id,
        name: sale.product_name,
        category: sale.product_category,
        description: sale.product_description,
        price: sale.product_total_price,
        discount: sale.product_discount,
        total_price: sale.product_total_price,
        image: sale.product_image,
      },
    }));

    return res.status(200).send({
      object: "list",
      page: page,
      pageCount: pageCount,
      itemsPerPage: limit,
      totalItems: totalCount,
      data: data,
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    return res.status(500).send("Error fetching sales");
  }
});

router.get("/api/sale/:id", isAdmin, (req, res) => {});

router.post("/api/sale", isAdmin, (req, res) => {});

router.patch("/api/sale/:id", isAdmin, (req, res) => {
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
      // const insertOrderQuery = `INSERT INTO orders (user_id, product_id, status, created_at) SELECT user_id, product_id, ?, created_at FROM sale WHERE id = ?`;
      const insertOrderQuery = `INSERT INTO orders (user_id,user_username,user_email,user_avatar,user_phone,user_address,product_id,product_name,product_category,product_description,product_discount,product_total_price,product_image,status,created_at) SELECT user_id,user_username,user_email,user_avatar,user_phone,user_address,product_id,product_name,product_category,product_description,product_discount,product_total_price,product_image,?,NOW() FROM sale WHERE id = ?`;

      connection.query(insertOrderQuery, [status, parsedId], (insertError) => {
        if (insertError) {
          connection.rollback(() => {
            console.error("Error moving sale back to orders:", insertError);
            return res.status(500).send("Error processing sale");
          });
        } else {
          if (status === "canceled") {
            connection.query(
              "SELECT * from sale WHERE id = ?",
              [parsedId],
              (error, response) => {
                if (error) {
                  console.log(error);
                } else {
                  // if(status==="canceled"){
                  connection.query(
                    "UPDATE products SET number = number + 1 WHERE id = ?",
                    [response[0].product_id],
                    (error, response) => {
                      if (error) {
                        console.log(error);
                      } else {
                        // return res.status(201).send('status changed to calceled successfully')
                      }
                    }
                  );
                  // }
                }
              }
            );
          }

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

router.delete("/api/sale/:id", isAdmin, (req, res) => {});

export default router;
