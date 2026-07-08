/**
 * User Roles
 */
export type UserRole = "STUDENT" | "ADMIN";

/**
 * User Account
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  password?: string;
}

/**
 * Student Profile Details
 */
export interface StudentProfile {
  userId: string;
  hostelBlock: string; // e.g. "H-1 Boys", "G-3 Girls", "International Block"
  roomNumber: string;
  messType: "VEG" | "NON_VEG" | "SPECIAL";
  joinedAt: string;
}

/**
 * Meal Category (provided by administration)
 */
export type MealCategory = 
  | "North Indian"
  | "South Indian"
  | "Jain"
  | "High Protein"
  | "Regular"
  | "Vegetarian"
  | "Special Menu";

/**
 * Meal Types
 */
export type MealType = "BREAKFAST" | "LUNCH" | "DINNER";

/**
 * Meal Choice for a single slot
 */
export interface MealPreference {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  category: MealCategory;
  isSkipped: boolean; // true = Not Going, false = Going
  updatedAt: string;
}

/**
 * Daily Menu Set by Admin
 */
export interface DailyMenu {
  id: string;
  date: string; // YYYY-MM-DD
  breakfastOptions: MealCategory[];
  lunchOptions: MealCategory[];
  dinnerOptions: MealCategory[];
  breakfastDescription?: string;
  lunchDescription?: string;
  dinnerDescription?: string;
}

/**
 * Payment Transaction Record
 */
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | "REFUNDED";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  date: string;
  receiptUrl?: string;
}

/**
 * System Notification
 */
export interface Notification {
  id: string;
  userId: string; // "ALL" or specific user ID
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "URGENT";
  createdAt: string;
  isRead: boolean;
  readByUsers?: string[];
}
