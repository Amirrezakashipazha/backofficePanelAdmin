import mysql from "mysql2";
import { query } from "./schemas.mjs";


const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "my_database",
}).promise();

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "my_database",
});

connection.connect((err) => {
  if (err) {
    console.error("Database connection failed: " + err.stack);
    return;
  }
  // console.log("Connected to the database");

  connection.query(query.table.users.create, (err, results) => {
    if (err) throw err;
    // console.log("Users table created or already exists.");
  });
  connection.query(query.table.products.create, (err, results) => {
    if (err) throw err;
    // console.log("products table created or already exists.");
  });
  connection.query(query.table.categories.create, (err, results) => {
    if (err) throw err;
    // console.log("categories table created or already exists.");
  });
  connection.query(query.table.categories.select.id, [1], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      connection.query(
        query.table.categories.add,
        [
          "no category",
          "no category des",
          "active",
          "http://localhost:3000/assets/images/svg/no-category.svg",
        ],
        (err, results) => {
          if (err) throw err;
          // console.log("categories table created or already exists.");
        }
      );
    }
  });

  connection.query(query.table.sale.create, (err, results) => {
    if (err) throw err;
    // console.log("sale table created or already exists.");
  });
  connection.query(query.table.orders.create, (err, results) => {
    if (err) throw err;
    // console.log("orders table created or already exists.");
  });
  connection.query(query.table.admins.create, (err, results) => {
    if (err) throw err;
    // console.log("orders table created or already exists.");
  });
  connection.query(query.table.admins.select.id, [1], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      connection.query(
        "INSERT INTO admins (username, password,role) VALUES (?, ?,?)",
        ["amirreza kashipazha", "95366359", "super-admin"],
        (err, results) => {
          if (err) throw err;
          // console.log("categories table created or already exists.");
        }
      );
    }
  });
  connection.query(query.table.setting.create, (err, results) => {
    if (err) throw err;
    // console.log("orders table created or already exists.");
  });
  connection.query(query.table.setting.select.id, [1], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      connection.query(
        query.table.setting.add,
        [
          "http://localhost:3000/assets/images/logo.svg",
          "description",
          "09901898106",
          "amirrezakashipazha@gmail.com", 
          "iran , qazvin",
          "http://localhost:3000/assets/images/favicon.ico",
        ],
        (err, results) => { 
          if (err) throw err;
          // console.log("categories table created or already exists.");
        }
      );
    }
  });
});

export { connection,pool };
