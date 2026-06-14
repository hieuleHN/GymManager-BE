import express from "express";
import * as PackageController from "../controllers/packageController.js";

const router = express.Router();

router.get("/", PackageController.listPackages);
// router.get('/by-discipline/:disciplineId', PackageController.getPackagesByDisciplineId);
router.get("/:id", PackageController.getPackageDetail);
router.post("/", PackageController.addPackage);
router.put("/:id", PackageController.updatePackage);
router.delete("/:id", PackageController.deletePackage);

export default router;
