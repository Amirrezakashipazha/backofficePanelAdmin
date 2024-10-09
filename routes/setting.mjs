
import { Router } from "express";
import {
  isSuperAdmin
} from "../utils/middlewares.mjs";
import { query as querySchema } from "../db/schemas.mjs";
import { connection } from "../db/index.mjs";
import { upload } from "../utils/multer.mjs";


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

router.patch(
  "/api/setting",
  isSuperAdmin,

  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),

  (req, res) => {
    let fieldsToUpdate = {};
    const { phone, email, address, logo, icon, meta_description } = req.body;
    if (phone) fieldsToUpdate.phone = phone;
    if (email) fieldsToUpdate.email = email;
    if (address) fieldsToUpdate.address = address;
    if (logo) fieldsToUpdate.logo = logo;
    if (icon) fieldsToUpdate.logo = icon;
    if (meta_description) fieldsToUpdate.meta_description = meta_description;

    if (req.files["logo"])
      fieldsToUpdate.logo = `http://localhost:3000/${req.files["logo"][0].path}`;

    if (req.files["icon"])
      fieldsToUpdate.icon = `http://localhost:3000/${req.files["icon"][0].path}`;

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).send("No fields provided for update");
    }

    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = [...Object.values(fieldsToUpdate)];

    const updateQuery = `UPDATE setting SET ${setClause} WHERE id = 1`;

    try {
      connection.query(updateQuery, values);
      res.status(200).send("User updated successfully");
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).send("Error updating user");
    }
  }
);

export default router;
