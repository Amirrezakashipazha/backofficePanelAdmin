import { Router } from "express";
import { isAdmin } from "../utils/middlewares.mjs";
import { pool } from "../db/index.mjs";

const router = Router();


router.get("/api/all",  async (req, res) => {
    try {
        const tables = ['admins', 'users', 'products', 'categories', 'orders', 'sale', 'setting'];
        const results = await Promise.all(
            tables.map(table => 
                pool.query(`SELECT * FROM ${table}`)
            )
        );

        const responseData = {};
        tables.forEach((table, index) => {
            responseData[table] = results[index][0]; // results[index][0] contains rows for each table
        });

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Failed to fetch data');
    }
});

export default router;
