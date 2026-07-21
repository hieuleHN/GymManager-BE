import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getBalance, getTransactions } from "../controllers/staffWalletController.js";

const router = express.Router();

router.get("/balance", authenticateToken, getBalance);
router.get("/transactions", authenticateToken, getTransactions);

export default router;
