import { Router } from "express";
import user from "./users.mjs"
import auth from "./auth.mjs"
import products from "./products.mjs"
import category from "./category.mjs"
import orders from "./orders.mjs"
import sale from "./sale.mjs"
import authAdmin from "./auth.mjs"
import admins from "./admins.mjs"
import setting from "./setting.mjs"


const router = Router();

router.use(user)
router.use(auth)
router.use(products)
router.use(category)
router.use(orders)
router.use(sale)
router.use(authAdmin)
router.use(admins)
router.use(setting)

export default router;
