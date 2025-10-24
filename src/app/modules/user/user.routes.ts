import { Router } from "express";
import { validateBody } from "../../middleware/validation.middleware";
import {
  changePasswordSchema,
  createUserSchema,
  loginSchema,
  updateUserSchema,
} from "./user.validation";
import {
  changePassword,
  getAllUsers,
  getLoggedInUser,
  getProfile,
  login,
  refreshToken,
  registerUser,
  updateProfile,
} from "./user.controller";
import isAuthenticated from "../../middleware/isAuthenticated";

const router = Router();

// Public routes
router.get("/logged-in-user", isAuthenticated, getLoggedInUser)
router.get("/profile", isAuthenticated, getProfile);
router.post("/register", validateBody(createUserSchema), registerUser);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh-token", refreshToken);

// Protected routes (require authentication)
// router.use(authenticateToken);

// User profile routes

router.put("/profile", validateBody(updateUserSchema), updateProfile);
router.post(
  "/change-password",
  validateBody(changePasswordSchema),
  changePassword
);

// Admin only routes
router.get(
  "/",
  // requireAdmin,
  // validateQuery(paginationSchema),
  getAllUsers
);
// router.get(
//   "/:id",
//   requireAdmin,
//   validateParams(idParamSchema),
//   .getUserById
// );
// router.put(
//   "/:id",
//   requireAdmin,
//   validateParams(idParamSchema),
//   validateBody(updateUserSchema),
//   .updateUser
// );
// router.delete(
//   "/:id",
//   requireAdmin,
//   validateParams(idParamSchema),
//   .deleteUser
// );

export default router;
