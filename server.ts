import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { readDb, writeDb, initializeDb } from "./server/db";
import { User, StudentProfile, MealPreference, MealType, MealCategory } from "./src/types";
import Razorpay from "razorpay";
import crypto from "crypto";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Initialize Razorpay client lazily when keys are configured
let razorpayInstance: any = null;
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return null;
  }
  if (!razorpayInstance) {
    razorpayInstance = new (Razorpay as any)({
      key_id,
      key_secret
    });
  }
  return razorpayInstance;
};

async function startServer() {
  // Ensure DB is initialized
  await initializeDb();

  const app = express();
  const PORT = 3000;

  // Express JSON parser
  app.use(express.json());

  // API Routes (must be declared BEFORE Vite middleware)
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      system: "Amity Mess Management System"
    });
  });

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(401).json({ error: "Email and password are required" });
    }

    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: "Incorrect credentials" });
    }

    const userPassword = user.password || "password123";
    if (userPassword !== password) {
      return res.status(401).json({ error: "Incorrect credentials" });
    }

    res.json({
      message: "Login successful",
      user
    });
  });

  // Auth: Register
  app.post("/api/auth/register", (req, res) => {
    const { email, name, role, adminSecret, password } = req.body;

    if (!email || !name || !role || !password) {
      return res.status(401).json({ error: "All fields are required including password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    if (role !== "STUDENT" && role !== "ADMIN") {
      return res.status(401).json({ error: "Incorrect credentials" });
    }

    // Secure administrator registration with a passcode
    if (role === "ADMIN") {
      const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET || "AmityAdmin2026";
      if (!adminSecret || adminSecret !== expectedSecret) {
        return res.status(401).json({ 
          error: "Incorrect credentials" 
        });
      }
    }

    const db = readDb();
    const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      return res.status(401).json({ error: "Incorrect credentials" });
    }

    const newUser: User = {
      id: "usr-" + generateId(),
      email: email.toLowerCase(),
      name,
      role,
      createdAt: new Date().toISOString(),
      password
    };

    db.users.push(newUser);

    // If it's a student, initialize an empty student profile
    if (role === "STUDENT") {
      const newProfile: StudentProfile = {
        userId: newUser.id,
        hostelBlock: "",
        roomNumber: "",
        messType: "VEG",
        joinedAt: new Date().toISOString()
      };
      db.profiles.push(newProfile);
    }

    // Push standard system notification
    db.notifications.push({
      id: "notif-" + generateId(),
      userId: newUser.id,
      title: "Welcome to Amity AUR Mess Management",
      message: role === "STUDENT" 
        ? "Please head over to your Profile settings to register your Hostel Block, Room Number, and Mess preferences."
        : "Welcome, Administrator. You can now configure weekly menus, lock deadlines, and audit student skip preferences.",
      type: "SUCCESS",
      createdAt: new Date().toISOString(),
      isRead: false
    });

    writeDb(db);

    res.status(201).json({
      message: "Registration successful",
      user: newUser
    });
  });

  // Profile: Get details (with auth user header)
  app.get("/api/profiles/me", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = db.profiles.find(p => p.userId === userId);
    res.json({
      user,
      profile: profile || null
    });
  });

  // Profile: Update Student profile
  app.put("/api/profiles/me", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { hostelBlock, roomNumber, messType } = req.body;
    if (!hostelBlock || !roomNumber || !messType) {
      return res.status(400).json({ error: "Hostel Block, Room Number and Mess Type are required" });
    }

    const db = readDb();
    let profileIndex = db.profiles.findIndex(p => p.userId === userId);

    const updatedProfile: StudentProfile = {
      userId,
      hostelBlock,
      roomNumber,
      messType,
      joinedAt: profileIndex >= 0 ? db.profiles[profileIndex].joinedAt : new Date().toISOString()
    };

    if (profileIndex >= 0) {
      db.profiles[profileIndex] = updatedProfile;
    } else {
      db.profiles.push(updatedProfile);
    }

    writeDb(db);
    res.json({
      message: "Profile updated successfully",
      profile: updatedProfile
    });
  });

  // ==========================================
  // PHASE 3: MENUS ENDPOINTS
  // ==========================================

  // Get all menus
  app.get("/api/menus", (req, res) => {
    const db = readDb();
    res.json(db.menus);
  });

  // Create or Update daily menu (Admin only)
  app.post("/api/menus", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === userId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { date, breakfastOptions, lunchOptions, dinnerOptions, breakfastDescription, lunchDescription, dinnerDescription } = req.body;
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const menuIndex = db.menus.findIndex(m => m.date === date);
    const updatedMenu = {
      id: menuIndex >= 0 ? db.menus[menuIndex].id : "menu-" + date,
      date,
      breakfastOptions: breakfastOptions || ["Regular"],
      lunchOptions: lunchOptions || ["Regular"],
      dinnerOptions: dinnerOptions || ["Regular"],
      breakfastDescription: breakfastDescription || "",
      lunchDescription: lunchDescription || "",
      dinnerDescription: dinnerDescription || ""
    };

    if (menuIndex >= 0) {
      db.menus[menuIndex] = updatedMenu;
    } else {
      db.menus.push(updatedMenu);
    }

    // Push system notification for all students about updated menu
    db.notifications.push({
      id: "notif-" + generateId(),
      userId: "ALL",
      title: "Mess Menu Updated",
      message: `The administrator has updated the daily menu layout for ${date}. Please review your selections under the interactive calendar.`,
      type: "INFO",
      createdAt: new Date().toISOString(),
      isRead: false
    });

    writeDb(db);
    res.json({
      message: "Menu saved successfully",
      menu: updatedMenu
    });
  });

  // ==========================================
  // PHASE 3: MEAL PREFERENCES (7-DAY LOCK RULES)
  // ==========================================

  // Get all preferences for logged-in user
  app.get("/api/preferences", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const prefs = db.mealPreferences.filter(p => p.userId === userId);
    res.json(prefs);
  });

  // Save meal preference / skip toggle
  app.post("/api/preferences", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { date, mealType, category, isSkipped } = req.body;
    if (!date || !mealType || !category === undefined) {
      return res.status(400).json({ error: "Date, Meal Type, and Category/Skip options are required" });
    }

    // Strict 7-Day decision rule
    const mealDate = new Date(date);
    const today = new Date();
    // Normalize to midnight UTC to compare exact calendar days
    const mealStart = Date.UTC(mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate());
    const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.ceil((mealStart - todayStart) / (1000 * 60 * 60 * 24));

    if (diffDays < 7) {
      return res.status(400).json({
        error: `Decision Locked: Choices for ${date} are finalized. Mess operations require skip decisions to be saved at least 7 days prior to prevent wastage.`
      });
    }

    const db = readDb();
    const prefId = `pref-${userId}-${date}-${mealType}`;
    const existingIndex = db.mealPreferences.findIndex(p => p.id === prefId);

    const updatedPref = {
      id: prefId,
      userId,
      date,
      mealType,
      category,
      isSkipped: !!isSkipped,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      db.mealPreferences[existingIndex] = updatedPref;
    } else {
      db.mealPreferences.push(updatedPref);
    }

    // Track wastage savings in case they skipped
    if (isSkipped) {
      db.notifications.push({
        id: "notif-" + generateId(),
        userId,
        title: "Meal Skipped successfully",
        message: `Your skip notice for ${mealType} on ${date} has been registered. Thank you for helping AUR reduce environmental food wastage!`,
        type: "SUCCESS",
        createdAt: new Date().toISOString(),
        isRead: false
      });
    }

    writeDb(db);
    res.json({
      message: "Preference registered successfully",
      preference: updatedPref
    });
  });

  // Save bulk meal preferences (Mark absences / vacation planning)
  app.post("/api/preferences/bulk", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { startDate, endDate, meals, isSkipped } = req.body;
    if (!startDate || !endDate || !meals || !Array.isArray(meals)) {
      return res.status(400).json({ error: "Start date, End date, and Meals array are required" });
    }

    const db = readDb();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Safety check: max 45 days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 45) {
      return res.status(400).json({ error: "Bulk absence marking is restricted to 45 days maximum." });
    }

    const today = new Date();
    const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    const updatedPrefs = [];
    let lockBypassedCount = 0;

    // Loop through each day in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      
      // Check 7-day lock rule
      const mealStart = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      const daysUntilMeal = Math.ceil((mealStart - todayStart) / (1000 * 60 * 60 * 24));
      
      if (daysUntilMeal < 7) {
        lockBypassedCount++;
        continue; // Skip locked days
      }

      meals.forEach((mealType: string) => {
        const prefId = `pref-${userId}-${dateStr}-${mealType}`;
        const existingIndex = db.mealPreferences.findIndex(p => p.id === prefId);
        
        let category: any = "Regular";
        if (existingIndex >= 0) {
          category = db.mealPreferences[existingIndex].category;
        }

        const updatedPref = {
          id: prefId,
          userId,
          date: dateStr,
          mealType: mealType as any,
          category,
          isSkipped: !!isSkipped,
          updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          db.mealPreferences[existingIndex] = updatedPref;
        } else {
          db.mealPreferences.push(updatedPref);
        }
        updatedPrefs.push(updatedPref);
      });
    }

    if (updatedPrefs.length > 0) {
      db.notifications.push({
        id: "notif-" + generateId(),
        userId,
        title: isSkipped ? "Vacation Absences Registered" : "Absence Canceled Successfully",
        message: isSkipped 
          ? `Your vacation absences from ${startDate} to ${endDate} have been logged for ${meals.join(", ").toLowerCase()}. Locked days within 7 days were automatically skipped for safety.`
          : `Your attendance from ${startDate} to ${endDate} has been restored for ${meals.join(", ").toLowerCase()}.`,
        type: "SUCCESS",
        createdAt: new Date().toISOString(),
        isRead: false
      });
      writeDb(db);
    }

    res.json({
      message: "Bulk preferences processed successfully",
      updatedCount: updatedPrefs.length,
      lockedSkipped: lockBypassedCount
    });
  });

  // ==========================================
  // PHASE 3: PAYMENTS SIMULATION (RAZORPAY)
  // ==========================================

  // Get current student payment ledger
  app.get("/api/payments/history", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const list = db.payments.filter(p => p.userId === userId);
    res.json(list);
  });

  // Real Razorpay Order initiation
  app.post("/api/payments/order", async (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const db = readDb();
    let orderId = "order_" + generateId();
    const razorpay = getRazorpayInstance();

    let isRealGateway = false;
    if (razorpay) {
      try {
        const order = await razorpay.orders.create({
          amount: Math.round(amount * 100), // Razorpay expects amount in paise
          currency: "INR",
          receipt: `receipt_${generateId()}`
        });
        orderId = order.id;
        isRealGateway = true;
      } catch (err: any) {
        console.error("Razorpay order creation failed:", err);
        return res.status(500).json({ error: err.message || "Failed to initiate payment gateway order" });
      }
    }
    
    const newPayment = {
      id: "pay-" + generateId(),
      userId,
      amount,
      status: "PENDING" as const,
      razorpayOrderId: orderId,
      date: new Date().toISOString()
    };

    db.payments.push(newPayment);
    writeDb(db);

    res.json({
      orderId,
      amount,
      currency: "INR",
      paymentId: newPayment.id,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
      isRealGateway
    });
  });

  // Verify Razorpay transaction
  app.post("/api/payments/verify", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { orderId, success, razorpayPaymentId, razorpaySignature } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const db = readDb();
    const payment = db.payments.find(p => p.razorpayOrderId === orderId && p.userId === userId);

    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const razorpay = getRazorpayInstance();
    let verified = false;

    if (razorpay && razorpaySignature && razorpayPaymentId) {
      // Real payment verification
      const text = orderId + "|" + razorpayPaymentId;
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest("hex");
      
      if (generatedSignature === razorpaySignature) {
        verified = true;
      }
    } else {
      // Sandbox fallback mode when keys are not configured
      verified = !!success;
    }

    if (verified) {
      payment.status = "SUCCESSFUL";
      payment.razorpayPaymentId = razorpayPaymentId || "pay_" + generateId();
      
      // Update student profile status / subscription notification
      db.notifications.push({
        id: "notif-" + generateId(),
        userId,
        title: "Semester Mess Fee Paid Successfully",
        message: `INR ${payment.amount.toLocaleString()} received via Razorpay Secure. Your active subscription seat has been finalized and secured.`,
        type: "SUCCESS",
        createdAt: new Date().toISOString(),
        isRead: false
      });
    } else {
      payment.status = "FAILED";
    }

    writeDb(db);
    res.json({
      status: payment.status,
      payment
    });
  });

  // ==========================================
  // PHASE 3: ADMIN & METRICS CONTROLS
  // ==========================================

  // Admin: Get all student records
  app.get("/api/admin/students", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === userId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const list = db.users
      .filter(u => u.role === "STUDENT")
      .map(u => {
        const profile = db.profiles.find(p => p.userId === u.id);
        const payments = db.payments.filter(p => p.userId === u.id);
        return {
          ...u,
          profile: profile || null,
          payments
        };
      });

    res.json(list);
  });

  // Admin: Get live compiled metrics summaries
  app.get("/api/metrics/summary", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === userId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    // Tomorrow's counts calculation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().split("T")[0];

    const tomorrowPrefs = db.mealPreferences.filter(p => p.date === tomStr);
    
    // Total numbers
    const totalStudents = db.users.filter(u => u.role === "STUDENT").length;
    const activeSubscribers = db.profiles.filter(p => p.hostelBlock && p.roomNumber).length;
    const totalRevenue = db.payments
      .filter(p => p.status === "SUCCESSFUL")
      .reduce((sum, p) => sum + p.amount, 0);

    // Categories Breakdown for Tomorrow
    const bChoices: Record<string, number> = {};
    const lChoices: Record<string, number> = {};
    const dChoices: Record<string, number> = {};

    let bSkips = 0, lSkips = 0, dSkips = 0;

    tomorrowPrefs.forEach((p) => {
      if (p.mealType === "BREAKFAST") {
        if (p.isSkipped) bSkips++;
        else bChoices[p.category] = (bChoices[p.category] || 0) + 1;
      } else if (p.mealType === "LUNCH") {
        if (p.isSkipped) lSkips++;
        else lChoices[p.category] = (lChoices[p.category] || 0) + 1;
      } else if (p.mealType === "DINNER") {
        if (p.isSkipped) dSkips++;
        else dChoices[p.category] = (dChoices[p.category] || 0) + 1;
      }
    });

    // Seeded/Projected metrics for Recharts
    const monthlyWastageTrend = [
      { month: "Jan", wastageRate: 24, savings: 12000 },
      { month: "Feb", wastageRate: 21, savings: 14500 },
      { month: "Mar", wastageRate: 18, savings: 18200 },
      { month: "Apr", wastageRate: 14, savings: 24800 },
      { month: "May", wastageRate: 11, savings: 29000 },
      { month: "Jun", wastageRate: 8,  savings: 36400 }
    ];

    const weeklyAttendanceChart = [
      { day: "Mon", Breakfast: 92, Lunch: 88, Dinner: 85 },
      { day: "Tue", Breakfast: 89, Lunch: 91, Dinner: 87 },
      { day: "Wed", Breakfast: 94, Lunch: 85, Dinner: 91 },
      { day: "Thu", Breakfast: 91, Lunch: 89, Dinner: 84 },
      { day: "Fri", Breakfast: 85, Lunch: 72, Dinner: 78 }, // skips higher on weekends
      { day: "Sat", Breakfast: 78, Lunch: 64, Dinner: 61 },
      { day: "Sun", Breakfast: 69, Lunch: 58, Dinner: 65 }
    ];

    const paymentLedgerAggregate = [
      { name: "Paid Seats", value: db.payments.filter(p => p.status === "SUCCESSFUL").length, color: "#3B82F6" },
      { name: "Pending", value: db.payments.filter(p => p.status === "PENDING").length, color: "#F59E0B" },
      { name: "Unpaid / Due", value: Math.max(0, totalStudents - db.payments.length), color: "#EF4444" }
    ];

    res.json({
      tomorrowDate: tomStr,
      summary: {
        totalStudents,
        activeSubscribers,
        totalRevenue,
        wasteSavingsThisMonth: db.mealPreferences.filter(p => p.isSkipped).length * 60, // Assuming ₹60 saved per skipped meal
        expectedBreakfast: Math.max(0, activeSubscribers - bSkips),
        expectedLunch: Math.max(0, activeSubscribers - lSkips),
        expectedDinner: Math.max(0, activeSubscribers - dSkips),
      },
      choicesBreakdown: {
        breakfast: { choices: bChoices, skips: bSkips },
        lunch: { choices: lChoices, skips: lSkips },
        dinner: { choices: dChoices, skips: dSkips }
      },
      charts: {
        wastageTrend: monthlyWastageTrend,
        weeklyAttendance: weeklyAttendanceChart,
        paymentDistribution: paymentLedgerAggregate
      }
    });
  });

  // Admin: Get weekly attendance forecast (next 7 days) and historical missed meals details
  app.get("/api/admin/attendance-forecast", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === userId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const totalStudents = db.users.filter(u => u.role === "STUDENT");
    const activeSubscribers = db.profiles.filter(p => p.hostelBlock && p.roomNumber);

    // Generate next 7 days (including today)
    const forecast = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      // BREAKFAST, LUNCH, DINNER counts and students list
      const meals = ["BREAKFAST", "LUNCH", "DINNER"].map(mt => {
        const skips = db.mealPreferences.filter(p => p.date === dateStr && p.mealType === mt && p.isSkipped);
        const absentStudentIds = skips.map(s => s.userId);
        const absentStudents = totalStudents
          .filter(u => absentStudentIds.includes(u.id))
          .map(u => {
            const prof = db.profiles.find(p => p.userId === u.id);
            return {
              id: u.id,
              name: u.name,
              hostelBlock: prof?.hostelBlock || "N/A",
              roomNumber: prof?.roomNumber || "N/A"
            };
          });

        const totalActive = activeSubscribers.length;
        const presentCount = Math.max(0, totalActive - absentStudents.length);

        return {
          mealType: mt,
          absentCount: absentStudents.length,
          presentCount,
          absentStudents
        };
      });

      forecast.push({
        date: dateStr,
        dayName: d.toLocaleDateString([], { weekday: "long" }),
        formattedDate: d.toLocaleDateString([], { month: "short", day: "numeric" }),
        meals
      });
    }

    // Historical Missed Meals list for each student
    const studentMissedMeals = totalStudents.map(student => {
      const profile = db.profiles.find(p => p.userId === student.id);
      
      // Get all skipped preferences where date <= today
      const todayStr = new Date().toISOString().split("T")[0];
      const missed = db.mealPreferences.filter(p => p.userId === student.id && p.isSkipped && p.date <= todayStr);
      
      return {
        id: student.id,
        name: student.name,
        email: student.email,
        hostelBlock: profile?.hostelBlock || "N/A",
        roomNumber: profile?.roomNumber || "N/A",
        missedCount: missed.length,
        missedDetails: missed.map(m => ({
          date: m.date,
          mealType: m.mealType,
          category: m.category
        })).sort((a, b) => b.date.localeCompare(a.date))
      };
    });

    res.json({
      forecast,
      studentMissedMeals
    });
  });

  // Notifications list
  app.get("/api/notifications", (req, res) => {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const rawList = db.notifications.filter(n => n.userId === userId || n.userId === "ALL");
    
    // Map list to inject dynamic isRead status based on readByUsers array
    const list = rawList.map(n => {
      if (n.userId === "ALL") {
        const readByUsers = n.readByUsers || [];
        return {
          ...n,
          isRead: readByUsers.includes(userId)
        };
      }
      return n;
    });
    
    res.json(list);
  });

  // Notifications: mark as read
  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const notif = db.notifications.find(n => n.id === id);
    if (notif) {
      if (notif.userId === "ALL") {
        if (!notif.readByUsers) {
          notif.readByUsers = [];
        }
        if (!notif.readByUsers.includes(userId)) {
          notif.readByUsers.push(userId);
        }
      } else {
        notif.isRead = true;
      }
      writeDb(db);
    }
    res.json({ success: true });
  });

  // ==========================================
  // PHASE 3.5: QR SCANNING & MEAL SERVING
  // ==========================================

  // Admin: Verify scanned student QR code
  app.get("/api/admin/scan/:userId", (req, res) => {
    const adminId = req.headers.authorization?.replace("Bearer ", "");
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === adminId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { userId } = req.params;
    const student = db.users.find(u => u.id === userId && u.role === "STUDENT");
    if (!student) {
      return res.status(404).json({ error: "Student not found or invalid QR payload" });
    }

    const profile = db.profiles.find(p => p.userId === userId);
    const payments = db.payments.filter(p => p.userId === userId);
    const isPaid = payments.some(p => p.status === "SUCCESSFUL");

    // Determine today's date and active meal
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    const hour = today.getHours();
    let activeMeal: "BREAKFAST" | "LUNCH" | "DINNER" = "BREAKFAST";
    if (hour >= 10 && hour < 16) activeMeal = "LUNCH";
    else if (hour >= 16) activeMeal = "DINNER";

    // Find menu description
    const todayMenu = db.menus.find(m => m.date === todayDateStr);
    let menuDescription = "Regular Standard Mess Menu Meal";
    if (todayMenu) {
      if (activeMeal === "BREAKFAST") menuDescription = todayMenu.breakfastDescription || "";
      else if (activeMeal === "LUNCH") menuDescription = todayMenu.lunchDescription || "";
      else if (activeMeal === "DINNER") menuDescription = todayMenu.dinnerDescription || "";
    }

    // Find student preference for today's active meal
    const pref = db.mealPreferences.find(p => p.userId === userId && p.date === todayDateStr && p.mealType === activeMeal);
    
    const isSkipped = pref ? pref.isSkipped : false;
    const category = pref ? pref.category : (profile?.messType === "SPECIAL" ? "Special Menu" : "Regular");

    // Check if already served
    const alreadyServedRecord = db.scannedServings.find(s => s.userId === userId && s.date === todayDateStr && s.mealType === activeMeal);

    let verification = "VERIFIED";
    if (!isPaid) {
      verification = "UNPAID";
    } else if (isSkipped) {
      verification = "SKIPPED";
    } else if (alreadyServedRecord) {
      verification = "ALREADY_SERVED";
    }

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        hostelBlock: profile?.hostelBlock || "N/A",
        roomNumber: profile?.roomNumber || "N/A",
        messType: profile?.messType || "VEG"
      },
      isPaid,
      activeMeal,
      todayDate: todayDateStr,
      preference: {
        category,
        isSkipped
      },
      menuDescription,
      alreadyServed: !!alreadyServedRecord,
      servedAt: alreadyServedRecord ? alreadyServedRecord.servedAt : null,
      verification
    });
  });

  // Admin: Mark student meal as served
  app.post("/api/admin/mark-served", (req, res) => {
    const adminId = req.headers.authorization?.replace("Bearer ", "");
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === adminId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { userId, date, mealType, category } = req.body;
    if (!userId || !date || !mealType || !category) {
      return res.status(400).json({ error: "User ID, Date, Meal Type, and Category are required" });
    }

    const student = db.users.find(u => u.id === userId && u.role === "STUDENT");
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Double scan check
    const existingScan = db.scannedServings.find(s => s.userId === userId && s.date === date && s.mealType === mealType);
    if (existingScan) {
      return res.status(400).json({ error: "Meal already marked as served to this student today" });
    }

    const newScan = {
      id: "scan-" + generateId(),
      userId,
      studentName: student.name,
      date,
      mealType,
      category,
      servedAt: new Date().toISOString()
    };

    db.scannedServings.push(newScan);

    // Push notification to the student
    db.notifications.push({
      id: "notif-" + generateId(),
      userId,
      title: `${mealType.charAt(0) + mealType.slice(1).toLowerCase()} Served`,
      message: `Your Digital Pass was scanned at the Mess Gate. Your diet preference (${category}) has been verified and registered.`,
      type: "SUCCESS",
      createdAt: new Date().toISOString(),
      isRead: false
    });

    writeDb(db);

    res.status(201).json({
      message: "Meal successfully marked as served",
      scan: newScan
    });
  });

  // Admin: Get recent scan history
  app.get("/api/admin/scans/recent", (req, res) => {
    const adminId = req.headers.authorization?.replace("Bearer ", "");
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const admin = db.users.find(u => u.id === adminId);
    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    // Return the last 20 scans with student information
    const recentScans = [...db.scannedServings]
      .sort((a, b) => b.servedAt.localeCompare(a.servedAt))
      .slice(0, 20)
      .map(s => {
        const profile = db.profiles.find(p => p.userId === s.userId);
        return {
          ...s,
          hostelBlock: profile?.hostelBlock || "N/A",
          roomNumber: profile?.roomNumber || "N/A"
        };
      });

    res.json(recentScans);
  });

  // Vite middleware setup for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
