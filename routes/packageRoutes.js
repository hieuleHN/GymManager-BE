import express from "express";
import {
  authenticateToken,
  requireAdmin,
} from "../middleware/authMiddleware.js";
import * as PackageController from "../controllers/packageController.js";

const router = express.Router();

// Public routes
router.get("/", PackageController.listPackages);
router.get(
  "/by-discipline/:disciplineId",
  PackageController.getPackagesByDisciplineId,
);
router.get("/:id/related", PackageController.listRelatedPackages);
router.get("/:id", PackageController.getPackageDetail);

// Admin routes (require authentication + staff role)
router.post("/", authenticateToken, PackageController.addPackage);
router.put("/:id", authenticateToken, PackageController.updatePackage);
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  PackageController.deletePackage,
);

export default router;


