import type { Request, Response } from "express";
import { eq, and, count } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/auth.utils";
import jwt from "jsonwebtoken";
import type {
  CreateUserInput,
  UpdateUserInput,
  LoginInput,
  ChangePasswordInput,
} from "./user.validation";
import { db } from "../../db";
import { users } from "../../db/schema";
import { setCookies } from "../../utils/setCookies";
import config from "../../config/config";

// ✅ Register new user
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, address }: CreateUserInput = req.body;
    console.log(req.body);

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({ error: "This email already exists" });
    }

    const existingPhone = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existingPhone.length > 0) {
      return res
        .status(409)
        .json({ error: "This phone number already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        address: users.address,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return res.status(201).json({
      user: newUser[0],
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
};

// ✅ Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginInput = req.body;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        phone: users.phone,
        address: users.address,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Account is deactivated" });
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens (consistent payload with isAuthenticated)
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store tokens in cookies
    setCookies(res, "refreshToken", refreshToken);
    setCookies(res, "accessToken", accessToken);

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      user: userWithoutPassword,
      // Optionally return tokens if frontend needs them directly:
      // accessToken,
      // refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed! Please try again" });
  }
};

// refresh token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refresh_secret!) as {
      id: number;
      email: string;
      role: "admin" | "vendor" | "customer";
    };

    if (!decoded) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check if user still exists and is active
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie again
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return res.status(200).json({ message: "Token refreshed" });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

// ✅ Get profile
export const getProfile = async (req: Request, res: Response) => {
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
};

// ✅ Update profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const updateData: UpdateUserInput = req.body;

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
};

// ✅ Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword }: ChangePasswordInput = req.body;

    const user = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValidPassword = await comparePassword(
      currentPassword,
      user[0].password
    );
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await hashPassword(newPassword);

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
};

// get logged in user
export const getLoggedInUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ error: "User not found" }); 
    }
    return res.status(200).json({ user: user[0] }); 
  } catch (error) {
    console.error("Get logged in user error:", error);
    return res.status(500).json({ error: "Failed to retrieve logged in user" }); 
  }
};



// ✅ Get all users (admin)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const totalResult = await db.select({ count: count() }).from(users);
    const total = totalResult[0].count;

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
};

// ✅ Get user by ID (admin)
export const getUserById = async (req: Request, res: Response) => {
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

    return res.status(200).json({
      user: user[0],
      message: "User retrieved successfully",
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(500).json({ error: "Failed to retrieve user" });
  }
};

// ✅ Update user (admin)
export const updateUser = async (req: Request, res: Response) => {
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
};

// ✅ Delete user (admin)
export const deleteUser = async (req: Request, res: Response) => {
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
};
