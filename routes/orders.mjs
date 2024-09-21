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
// import { HandleNotification } from "../utils/notification.mjs";
// import { getIo } from "../utils/socket.mjs";
// import { io } from "../index.js";

// const io = getIo();
// Now you can use io to emit events, etc.

const router = Router();
router.get("/api/order",isAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit) || 1000;
  const page = parseInt(req.query.page) || 1;
  const { filter, value } = req.query;
  const offset = (page - 1) * limit;

  // List of valid filters based on your requirements
  const validFilters = {
    id: 'orders.id',
    productname: 'product_name',
    price: 'product_total_price',
    username: 'user_username',
    date: 'orders.created_at',
    status: 'orders.status'
  };

  // Validate the filter
  if (filter && !(filter in validFilters)) {
    return res.status(400).send({ error: "Invalid filter parameter" });
  }

  // Build the base query
  let queryCondition = '';
  let queryParams = [];
  if (filter && value) {
    const column = validFilters[filter];
    queryCondition = ` AND ${column} ${filter === 'id' || filter === 'price' || filter === 'status' ? '=' : 'LIKE'} ?`;
    queryParams = [`${filter === 'id' || filter === 'price' || filter === 'status' ? value : `%${value}%`}`];
  }

  const getOrdersQuery = `
    SELECT orders.*, user_username, user_email, user_avatar, user_phone, user_address,
    product_name, product_category, product_description, product_total_price, product_discount, product_total_price, product_image
    FROM orders
    JOIN users ON orders.user_id = users.id
    JOIN products ON orders.product_id = products.id
    WHERE 1=1 ${queryCondition}
    LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);  // Append limit and offset to the parameters list

  const countOrdersQuery = `
    SELECT COUNT(*) AS count 
    FROM orders
    JOIN users ON orders.user_id = users.id
    JOIN products ON orders.product_id = products.id
    WHERE 1=1 ${queryCondition}`;
  // For counting, no need to include limit and offset, hence reusing initial queryParams
  const countParams = [...queryParams].slice(0, queryParams.length - 2);

  try {
    const orders = await new Promise((resolve, reject) => {
      connection.query(getOrdersQuery, queryParams, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const totalCount = await new Promise((resolve, reject) => {
      connection.query(countOrdersQuery, countParams, (err, results) => {
        if (err) return reject(err);
        resolve(results[0].count);
      });
    });

    const pageCount = Math.ceil(totalCount / limit);

    const data = orders.map(order => ({
      id: order.id,
      status: order.status,
      created_at: order.created_at,
      user: {
        id: order.user_id,
        name: order.user_username,
        email: order.user_email,
        avatar: order.user_avatar,
        phone: order.user_phone,
        address: order.user_address,
      },
      product: {
        id: order.product_id,
        name: order.product_name,
        category: order.product_category,
        description: order.product_description,
        price: order.product_total_price,
        discount: order.product_discount,
        total_price: order.product_total_price,
        image: order.product_image,
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
    console.error("Error fetching orders:", err);
    return res.status(500).send("Error fetching orders");
  }
});


router.get("/api/order/:id", isAdmin, (req, res) => {});

router.post("/api/order", (req, res) => {
  const { user_id, products, totalPrice } = req.body;

  // Step 1: Aggregate product counts
  const productCounts = products.reduce((acc, productId) => {
    acc[productId] = (acc[productId] || 0) + 1;
    return acc;
  }, {});

  // Step 2: Prepare to query the database
  const productIds = Object.keys(productCounts);
  const placeholders = productIds.map(() => '?').join(',');
  const query = `SELECT id, number FROM products WHERE id IN (${placeholders})`;

  // Step 3: Execute the query
  connection.query(query, productIds, (err, results) => {
    if (err) {
      console.error("Error fetching product stock:", err);
      return res.status(500).send("Error fetching product stock");
    }

    // Step 4: Check if any product has insufficient stock
    const insufficientStock = results.some(product => {
      return product.number < productCounts[product.id];
    });

    if (insufficientStock) {
      return res.status(400).send("Insufficient stock for one or more products");
    }

    // Fetch user details
    connection.query(
      "SELECT username, email, avatar, phone, address FROM users WHERE id = ?",
      [user_id],
      (userErr, userResults) => {
        if (userErr) {
          console.error("Error fetching user:", userErr);
          return res.status(500).send("Error fetching user details");
        }

        // Fetch product details
        const productDetailsPromises = products.map(
          (productId) =>
            new Promise((resolve, reject) => {
              connection.query(
                "SELECT name, category, description, discount, price, total_price, image, number FROM products WHERE id = ?",
                [productId],
                (productErr, productResults) => {
                  if (productErr) {
                    reject(productErr);
                  } else {
                    resolve({ productId, ...productResults[0] }); // Assuming productResults returns one product
                  }
                }
              );
            })
        );

        Promise.all(productDetailsPromises)
          .then((productDetails) => {
            const orderInsertPromises = productDetails.map((product) => {
              return new Promise((resolve, reject) => {
                const orderQuery = `INSERT INTO orders (user_id, user_username, user_email, user_avatar, user_phone, user_address, product_id, product_name, product_category, product_description, product_discount, product_total_price, product_image, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in progress')`;
                connection.query(
                  orderQuery,
                  [
                    user_id,
                    userResults[0].username,
                    userResults[0].email,
                    userResults[0].avatar,
                    userResults[0].phone,
                    userResults[0].address,
                    product.productId,
                    product.name,
                    product.category,
                    product.description,
                    product.discount,
                    product.total_price,
                    product.image,
                  ],
                  (err, result) => {
                    if (err) {
                      reject(err);
                    } else {
                      connection.query(
                        "UPDATE products SET number = number - 1 WHERE id = ?",
                        [product.productId],
                        (updateErr, updateResult) => {
                          if (updateErr) {
                            reject(updateErr);
                          } else {
                            resolve(result); // Resolve only after both insert and update succeed
                          }
                        }
                      );
                    }
                  }
                );
              });
            });

            Promise.all(orderInsertPromises)
              .then(() => {
                const paymentData = {
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
                  .post("https://gateway.zibal.ir/v1/request", paymentData)
                  .then((response) => {
                    res.send(response.data);
                  })
                  .catch((paymentError) => {
                    console.error("Payment Error:", paymentError);
                    res.status(500).send("Error making payment request");
                  });
              })
              .catch((orderInsertError) => {
                console.error("Order Insert Error:", orderInsertError);
                res.status(500).send("Error inserting orders");
              });
          })
          .catch((productError) => {
            console.error("Product Fetch Error:", productError);
            res.status(500).send("Error fetching product details");
          });
      }
    );
  });
});


// router.post("/api/order",
// // isAdmin,
//  (req, res) => {
//   const { user_id, products, totalPrice } = req.body;

//   // const { io } = req;
//   let user_info=null
//   let product_info=null

//   connection.query(
//     querySchema.table.users.select.id,
//     [user_id],
//     (err, insertResults) => {
//       if (err) {
//         console.error("Error inserting user:", err);
//         return res.status(500).send("Error inserting user");
//       }
//       user_info=insertResults;
//     }
//   );
//   connection.query(
//     querySchema.table.products.select.id,
//     [parsedId],
//     (err, insertResults) => {
//       if (err) {
//         console.error("Error inserting product:", err);
//         return res.status(500).send("Error inserting product");
//       }
//       return res.status(201).send(insertResults);
//     }
//   );

//   const insertOrder = (userId, productId, status, done) => {
//     const query =
//       `INSERT INTO orders (
//         user_id,
//         user_username,
//         user_email,
//         user_avatar,
//         product_id,
//         product_name,
//         product_category,
//         product_description,
//         product_discount,
//         product_total_price,
//         product_image,
//         status
//         ) VALUES (?, ?,?,?, ?,?,?, ?,?,?, ?,?)`;
//     connection.query(query, [userId, productId, status], (err, result) => {
//       if (err) return done(err);
//       done(null, result);
//     });
//   };

//   // Loop through products and insert each as an order
//   const orderPromises = products.map((productId) => {
//     return new Promise((resolve, reject) => {
//       insertOrder(user_id, productId, "in progress", (err, result) => {
//         if (err) reject(err);
//         else resolve(result);
//       });
//     });
//   });

//   Promise.all(orderPromises)
//     .then((results) => {
//       // Once all orders are inserted, proceed with the payment request
//       const Data = {
//         merchant: "zibal",
//         amount: totalPrice,
//         callbackUrl: "http://localhost:5173/",
//         description: "Hello World!",
//         orderId: {
//           user: user_id,
//           product: products,
//         },
//         mobile: "09901898100",
//         sms: true,
//         linkToPay: true,
//       };

//       axios
//         .post("https://gateway.zibal.ir/v1/request", Data)
//         .then((response) => {
//           // console.log("Payment Response:", response.data);

//           // const notificationData = {
//           //   type: 'New Order',
//           //   message: `A new order has been placed.`,
//           //   // Assuming you have some orderId or other details you wish to include
//           //   // orderId: /* your logic to obtain orderId */,
//           //   paymentStatus: response.data.status, // Example field
//           //   paymentDetails: response.data.result // Assuming 'result' contains relevant info
//           // };

//           // // Emit the notification with the extracted data
//           // io.emit('notification', notificationData);

//              res.send(response.data);
//         })
//         .catch((error) => {
//           console.error("Payment Error:", error);
//           res.status(500).send("Error making payment request");
//         });
//     })
//     .catch((error) => {
//       console.error("Database Error:", error);
//       res.status(500).send("Error inserting orders");
//     });
// });

router.patch("/api/order/:id", isAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // The new status to be set
  const parsedId = parseInt(id);

  if (isNaN(parsedId) || !status) {
    return res.sendStatus(400); // Bad request if the ID is not a number or status is not provided
  }

 connection.query("SELECT * from orders WHERE id = ?", [parsedId], (error,response) => {
      if (error) {
        console.log(error);
      }else{
        if(response[0].status==="canceled")
    connection.query("UPDATE products SET number = number - 1 WHERE id = ?", [response[0].product_id], (error,response) => {
            if (error) {
              console.log(error);
            }else{
              console.log('ok');
            }
          });
      }
    });
 

  
  if (status === "delivered") {
    // Process for moving the order to the 'sales' table for 'delivered' status
    // connection.query("SELECT * from orders WHERE id = ?", [parsedId], (error,response) => {
    //   if (error) {
    //     console.log(error);
    //   }else{
    // connection.query("UPDATE products SET number = number - 1 WHERE id = ?", [response[0].product_id], (error,response) => {
    //         if (error) {
    //           console.log(error);
    //         }else{
    //           console.log('ok');
    //         }
    //       });
    //   }
    // });
    connection.beginTransaction((err) => {
      if (err) {
        console.error("Transaction Begin Error:", err);
        return res.status(500).send("Error processing order");
      }

      const insertSaleQuery = `INSERT INTO sale (user_id,user_username,user_email,user_avatar,user_phone,user_address,product_id,product_name,product_category,product_description,product_discount,product_total_price,product_image,status,created_at) SELECT user_id,user_username,user_email,user_avatar,user_phone,user_address,product_id,product_name,product_category,product_description,product_discount,product_total_price,product_image,'delivered',NOW() FROM orders WHERE id = ?`;

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
    // if (status==="in progress") {  
    //   connection.query("SELECT * from orders WHERE id = ?", [parsedId], (error,response) => {
    //   if (error) {
    //     console.log(error);
    //   }else{
    //     // if(status==="canceled"){
    //       connection.query("UPDATE products SET number = number - 1 WHERE id = ?", [response[0].product_id], (error,response) => {
    //         if (error) {
    //           console.log(error);
    //         }else{
    //           // return res.status(201).send('status changed to calceled successfully')
  
    //         }
    //       });
    //     // }
    //   }
    // });

      
    // }else 
    if(status==="canceled"){
      connection.query("SELECT * from orders WHERE id = ?", [parsedId], (error,response) => {
        if (error) {
          console.log(error);
        }else{
          // if(status==="canceled"){
            connection.query("UPDATE products SET number = number + 1 WHERE id = ?", [response[0].product_id], (error,response) => {
              if (error) {
                console.log(error);
              }else{
                // return res.status(201).send('status changed to calceled successfully')
    
              }
            });
          // }
        }
      });
    }
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

router.delete("/api/order/:id", isAdmin, (req, res) => {});

export default router;
