import { Router } from "express";
import { validateBody } from "../../middleware/validation.middleware";
import {
  changePasswordSchema,
  createUserSchema,
  loginSchema,
  updateUserSchema,
} from "./user.validation";
import { UserController } from "./user.controller";

const router = Router();

// Public routes
router.post(
  "/register",
  validateBody(createUserSchema),
  UserController.register
);
router.post("/login", validateBody(loginSchema), UserController.login);

// Protected routes (require authentication)
router.use(authenticateToken);

// User profile routes
router.get("/profile", UserController.getProfile);
router.put(
  "/profile",
  validateBody(updateUserSchema),
  UserController.updateProfile
);
router.post(
  "/change-password",
  validateBody(changePasswordSchema),
  UserController.changePassword
);

// Admin only routes
router.get(
  "/",
  requireAdmin,
  validateQuery(paginationSchema),
  UserController.getAllUsers
);
router.get(
  "/:id",
  requireAdmin,
  validateParams(idParamSchema),
  UserController.getUserById
);
router.put(
  "/:id",
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  UserController.updateUser
);
router.delete(
  "/:id",
  requireAdmin,
  validateParams(idParamSchema),
  UserController.deleteUser
);

export default router;
