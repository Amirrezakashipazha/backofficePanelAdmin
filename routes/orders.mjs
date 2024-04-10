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

router.get("/api/order",isAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit || 100);
  const page = parseInt(req.query.page || 1);
  const offset = (page - 1) * limit;

  const getOrdersQuery = `
        SELECT o.id AS order_id, o.status, o.created_at, 
               u.id AS user_id, u.username AS user_name,
               u.id AS user_id, u.email AS user_email, 
               u.id AS user_id, u.status AS user_status, 
               u.id AS user_id, u.avatar AS user_avatar, 
               p.id AS product_id, p.name AS product_name ,
               p.id AS product_id, p.category AS product_category ,
               p.id AS product_id, p.description AS product_description ,
               p.id AS product_id, p.price AS product_price,
               p.id AS product_id, p.discount AS product_discount ,
               p.id AS product_id, p.total_price AS product_total_price ,
               p.id AS product_id, p.status AS product_status ,
               p.id AS product_id, p.image AS product_image
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN products p ON o.product_id = p.id
        LIMIT ? OFFSET ?`;

  const countOrdersQuery = `SELECT COUNT(*) AS count FROM orders`;

  try {
    const orders = await new Promise((resolve, reject) => {
      connection.query(getOrdersQuery, [limit, offset], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const totalCount = await new Promise((resolve, reject) => {
      connection.query(countOrdersQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results[0].count);
      });
    });

    const pageCount = Math.ceil(totalCount / limit);

    // Transform orders into the desired structure
    const data = orders.map((order) => ({
      id: order.order_id,
      status: order.status,
      created_at: order.created_at,
      user: {
        id: order.user_id,
        name: order.user_name,
        email: order.user_email,
        status: order.user_status,
        avatar: order.user_avatar,
      },
      product: {
        id: order.product_id,
        name: order.product_name,
        category: order.product_category,
        description: order.product_description,
        price: order.product_price,
        discount: order.product_discount,
        total_price: order.product_total_price,
        status: order.product_status,
        image: order.product_image,
      },
    }));

    return res.status(200).send({
      object: "list",
      page: page,
      pageCount: pageCount,
      itemsPerPage: limit,
      totalItems: totalCount,
      data: data, // Modified to send the structured array
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).send("Error fetching orders");
  }
});

router.get("/api/order/:id",isAdmin, (req, res) => {});

router.post("/api/order",isAdmin, (req, res) => {
  const { user_id, products, totalPrice } = req.body;

  // Function to insert an order
  const insertOrder = (userId, productId, status, done) => {
    const query =
      "INSERT INTO orders (user_id, product_id ,status) VALUES (?, ?,?)";
    connection.query(query, [userId, productId, status], (err, result) => {
      if (err) return done(err);
      done(null, result);
    });
  };

  // Loop through products and insert each as an order
  const orderPromises = products.map((productId) => {
    return new Promise((resolve, reject) => {
      insertOrder(user_id, productId, "in progress", (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  });

  Promise.all(orderPromises)
    .then((results) => {
      // Once all orders are inserted, proceed with the payment request
      const Data = {
        merchant: "zibal",
        amount: totalPrice,
        callbackUrl: "http://localhost:5173/",
        description: "Hello World!",
        orderId: {
          user: user_id,
          product: products,
        },
        mobile: "09901898100",
        sms: true,
        linkToPay: true,
      };

      axios
        .post("https://gateway.zibal.ir/v1/request", Data)
        .then((response) => {
          // console.log("Payment Response:", response.data);
          res.send(response.data);
        })
        .catch((error) => {
          console.error("Payment Error:", error);
          res.status(500).send("Error making payment request");
        });
    })
    .catch((error) => {
      console.error("Database Error:", error);
      res.status(500).send("Error inserting orders");
    });
});
router.patch("/api/order/:id",isAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // The new status to be set
  const parsedId = parseInt(id);

  if (isNaN(parsedId) || !status) {
    return res.sendStatus(400); // Bad request if the ID is not a number or status is not provided
  }

  if (status === "delivered") {
    // Process for moving the order to the 'sales' table for 'delivered' status
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Transaction Begin Error:", err);
        return res.status(500).send("Error processing order");
      }

      const insertSaleQuery = `INSERT INTO sale (user_id, product_id, status, created_at) SELECT user_id, product_id, 'delivered', NOW() FROM orders WHERE id = ?`;

      connection.query(insertSaleQuery, [parsedId], (insertError) => {
        if (insertError) {
          connection.rollback(() => {
            console.error("Error moving order to sales:", insertError);
            return res.status(500).send("Error processing order");
          });
        } else {
          const deleteOrderQuery = "DELETE FROM orders WHERE id = ?";
          connection.query(deleteOrderQuery, [parsedId], (deleteError) => {
            if (deleteError) {
              connection.rollback(() => {
                console.error("Error deleting order:", deleteError);
                return res.status(500).send("Error processing order");
              });
            } else {
              connection.commit((commitError) => {
                if (commitError) {
                  connection.rollback(() => {
                    console.error("Transaction Commit Error:", commitError);
                    return res.status(500).send("Error processing order");
                  });
                }
                return res
                  .status(200)
                  .send("Order moved to sales as delivered successfully");
              });
            }
          });
        }
      });
    });
  } else {
    // Update the order's status directly in the 'orders' table for statuses other than 'delivered'
    const updateQuery = "UPDATE orders SET status = ? WHERE id = ?";
    connection.query(updateQuery, [status, parsedId], (error, results) => {
      if (error) {
        console.error("Error updating order status:", error);
        return res.status(500).send("Error updating order status");
      }
      if (results.affectedRows === 0) {
        // No rows were updated, indicating the order ID might not exist
        return res.status(404).send("Order not found");
      }
      return res.status(200).send("Order status updated successfully");
    });
  }
});

router.delete("/api/order/:id",isAdmin, (req, res) => {});

export default router;
