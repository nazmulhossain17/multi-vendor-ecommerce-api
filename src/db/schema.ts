import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
  numeric,
  uuid,
  foreignKey,
  varchar,
} from "drizzle-orm/pg-core";

/*************************
 * ENUMS
 *************************/
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "vendor",
  "customer",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash_on_delivery",
  "stripe",
  "paypal",
]);

/*************************
 * ROLES
 *************************/
export const rolesTable = pgTable("roles", {
  roleId: uuid("role_id").primaryKey().defaultRandom(),
  name: userRoleEnum("name").notNull(),
  level: integer("level").$type<0 | 1 | 2>().default(2).unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

/*************************
 * USERS
 *************************/
export const users = pgTable(
  "users",
  {
    userId: varchar('user_id', { length: 50 }).notNull().primaryKey().default(sql`uuid_generate_v4()`),
    firstName: varchar('first_name', { length: 40 }).notNull(),
    lastName: varchar('last_name', { length: 40 }).notNull(),
    email: varchar('email', { length: 50 }).notNull().unique(),
    profilePic: varchar('profile_pic', { length: 255 }),
    password: varchar('password', { length: 255 }).notNull(),
    phone: text("phone").unique(),
    address: text("address").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.roleId, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    roleUserIdx: index("role_user_idx").on(t.roleId),
  })
);

/*************************
 * VENDORS
 *************************/
export const vendors = pgTable(
  "vendors",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    shopName: text("shop_name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    vendorUserIdx: index("vendor_user_idx").on(t.userId),
  })
);

/*************************
 * BRANDS
 *************************/
export const brands = pgTable(
  "brands",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    brandSlugUq: uniqueIndex("brands_slug_uq").on(t.slug),
  })
);

/*************************
 * CATEGORIES
 *************************/
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    categorySlugUq: uniqueIndex("categories_slug_uq").on(t.slug),
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "categories_parent_fk",
    }),
  })
);


/*************************
 * PRODUCTS
 *************************/
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description"),
    description: text("description"),
    originalPrice: numeric("original_price", { precision: 10, scale: 2 }).notNull(),
    discount: integer("discount").default(0),
    images: text("images").array(),
    tags: text("tags").array(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    productsSlugUq: uniqueIndex("products_slug_uq").on(t.slug),
    productByVendor: index("product_vendor_idx").on(t.vendorId),
    productByBrand: index("product_brand_idx").on(t.brandId),
    productBySlug: index("product_slug_idx").on(t.slug),
  })
);

/*************************
 * ORDERS
 *************************/
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    orderNo: text("order_no").notNull().unique(),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("cash_on_delivery"),
    shippingAddress: text("shipping_address").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orderNoUq: uniqueIndex("order_no_uq").on(t.orderNo),
    orderByUser: index("order_user_idx").on(t.userId),
  })
);

/*************************
 * ORDER ITEMS
 *************************/
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => ({
    orderItemIdx: index("order_item_order_idx").on(t.orderId),
  })
);

/*************************
 * PAYMENTS
 *************************/
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: paymentStatusEnum("status").default("pending"),
    transactionId: text("transaction_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    paymentOrderIdx: index("payment_order_idx").on(t.orderId),
  })
);

/*************************
 * REVIEWS
 *************************/
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    reviewProductIdx: index("review_product_idx").on(t.productId),
    reviewUserIdx: index("review_user_idx").on(t.userId),
  })
);

/*************************
 * PRODUCT QUESTIONS
 *************************/
export const productQuestions = pgTable(
  "product_questions",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    question: text("question").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

/*************************
 * PRODUCT ANSWERS
 *************************/
export const productAnswers = pgTable(
  "product_answers",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => productQuestions.id, { onDelete: "cascade" }),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

/*************************
 * PRODUCT SPECIFICATIONS
 *************************/
export const productSpecifications = pgTable(
  "product_specifications",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

/*************************
 * PRODUCT WARRANTY
 *************************/
export const productWarranty = pgTable(
  "product_warranty",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warrantyPeriod: text("warranty_period").notNull(),
    warrantyType: text("warranty_type"),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);
