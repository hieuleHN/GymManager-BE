import express from "express";
import * as departmentController from "../controllers/departmentController.js";

const router = express.Router();

router.get("/", departmentController.getAllDepartments);
router.post("/", departmentController.createDepartment);
router.get("/:id", departmentController.getDepartmentById);
router.put("/:id", departmentController.updateDepartment);
router.delete("/:id", departmentController.deleteDepartment);

export default router;
