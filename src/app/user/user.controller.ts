import type { Request, Response } from "express";
import { eq, and, count } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../../utils/auth.utils";

import type {
  CreateUserInput,
  UpdateUserInput,
  LoginInput,
  ChangePasswordInput,
} from "./user.validation";
import { db } from "../../db";
import { users } from "../../db/schema";

export class UserController {
  // Register new user
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password }: CreateUserInput = req.body;

      // Check if user already exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res
          .status(409)
          .json({ error: "User with this email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const newUser = await db
        .insert(users)
        .values({
          name,
          email,
          password: hashedPassword,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });

      // Generate token
      //   const token = generateToken({
      //     userId: newUser[0].id,
      //     email: newUser[0].email,
      //     role: newUser[0].role,
      //   });

      //   return sendSuccess(
      //     res,
      //     {
      //       user: newUser[0],
      //       token,
      //     },
      //     "User registered successfully",
      //     201
      //   );
      return res.status(201).json({
        user: newUser[0],
        // token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      //   return sendError(res, "Registration failed", 500);
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  // Login user
  static async login(req: Request, res: Response) {
    try {
      const { email, password }: LoginInput = req.body;

      // Find user
      const user = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          password: users.password,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user.length) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user[0].isActive) {
        return res.status(401).json({ error: "Account is deactivated" });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user[0].password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate token
      const token = generateToken({
        userId: user[0].id,
        email: user[0].email,
        role: user[0].role,
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user[0];

      return res.status(200).json({
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const user = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({ user: user[0] });
    } catch (error) {
      console.error("Get profile error:", error);
      return res.status(500).json({ error: "Failed to retrieve profile" });
    }
  }

  // Update user profile
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const updateData: UpdateUserInput = req.body;

      // Check if email is being updated and if it already exists
      if (updateData.email) {
        const existingUser = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, updateData.email), eq(users.id, userId)))
          .limit(1);

        if (existingUser.length > 0) {
          return res.status(409).json({ error: "Email already in use" });
        }
      }

      const updatedUser = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser.length) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        user: updatedUser[0],
        message: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  }

  // Change password
  static async changePassword(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword }: ChangePasswordInput = req.body;

      // Get current user
      const user = await db
        .select({ password: users.password })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await comparePassword(
        currentPassword,
        user[0].password
      );
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await db
        .update(users)
        .set({
          password: hashedNewPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return res.status(200).json({
        success: true,
        data: null,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ error: "Failed to change password" });
    }
  }

  // Get all users (admin only)
  static async getAllUsers(req: Request, res: Response) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Get total count
      const totalResult = await db.select({ count: count() }).from(users);
      const total = totalResult[0].count;

      // Get users
      const usersList = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt);

      //   return sendPaginatedResponse(
      //     res,
      //     usersList,
      //     page,
      //     limit,
      //     total,
      //     "Users retrieved successfully"
      //   );
      return res.status(200).json({
        users: usersList,
        page,
        limit,
        total,
        message: "Users retrieved successfully",
      });
    } catch (error) {
      console.error("Get all users error:", error);
      return res.status(500).json({ error: "Failed to retrieve users" });
    }
  }

  // Get user by ID (admin only)
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, Number(id)))
        .limit(1);

      if (!user.length) {
        return res.status(404).json({ error: "User not found" });
      }

      //   return sendSuccess(res, user[0], "User retrieved successfully");
      return res.status(200).json({
        user: user[0],
        message: "User retrieved successfully",
      });
    } catch (error) {
      console.error("Get user by ID error:", error);
      return res.status(500).json({ error: "Failed to retrieve user" });
    }
  }

  // Update user (admin only)
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdateUserInput = req.body;

      const updatedUser = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, Number(id)))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser.length) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        user: updatedUser[0],
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  // Delete user (admin only)
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const deletedUser = await db
        .delete(users)
        .where(eq(users.id, Number(id)))
        .returning({ id: users.id });

      if (!deletedUser.length) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  }
}
