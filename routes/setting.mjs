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
  isSuperAdmin,
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

router.get("/api/setting", isSuperAdmin, async (req, res) => {
  connection.query(querySchema.table.setting.get, (err, result) => {
    if (err) {
      return res.send(err);
    } else {
      res.status(200).send(result);
    }
  });
});

router.patch("/api/setting",isSuperAdmin,
//   upload.single("logo"),
//   upload.single("icon"),
  (req, res) => {
   console.log(req.body,'bodyyyyyyyyyyyyyyyyyyyyyyyyyyy');
   console.log(req.file,'fileeeeeeeeeeeeeeeeeeeeeeeeeee');
   console.log(req.files,'filesssssssssssssssssssssssss');
    // let fieldsToUpdate = {};
    // const { meta_description, phone, email,address,icon } = req.body;
    // if (meta_description) fieldsToUpdate.meta_description = meta_description;
    // if (phone) fieldsToUpdate.phone = phone;
    // if (email) fieldsToUpdate.email = email;
    // if (address) fieldsToUpdate.address = address;
    // if (icon) fieldsToUpdate.icon = icon;

    // if (req.file)
    //   fieldsToUpdate.logo = `http://localhost:3000/${req.file.path}`;

    // if (Object.keys(fieldsToUpdate).length === 0) {
    //   return res.status(400).send("No fields provided for update");
    // }
    // const setClause = Object.keys(fieldsToUpdate)
    //   .map((key) => `${key} = ?`)
    //   .join(", ");
    // const values = [...Object.values(fieldsToUpdate)];

    // const updateQuery = `UPDATE setting SET ${setClause} WHERE id = 1`;

    // try {
    //   connection.query(updateQuery, values);
    //   res.status(200).send("User updated successfully");
    // } catch (err) {
    //   console.error("Error updating user:", err);
    //   res.status(500).send("Error updating user");
    // }
    res.status(200).send("User updated successfully");
  }
);

export default router;
