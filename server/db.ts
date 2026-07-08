import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { User, StudentProfile, MealPreference, DailyMenu, Payment, Notification, MealCategory, MealType } from "../src/types";

// DB Path in project root
const DB_FILE = path.join(process.cwd(), "db.json");

// Firebase configuration setup
const CONFIG_FILE = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseApp: any = null;
let firestoreDb: any = null;
let useFirestore = false;

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    if (config.projectId) {
      if (getApps().length === 0) {
        firebaseApp = initializeApp({
          projectId: config.projectId,
        });
      } else {
        firebaseApp = getApp();
      }
      
      const dbId = config.firestoreDatabaseId;
      if (dbId && dbId !== "(default)") {
        firestoreDb = getFirestore(firebaseApp, dbId);
      } else {
        firestoreDb = getFirestore(firebaseApp);
      }
      useFirestore = true;
      console.log(`[Firebase] Admin initialized with project: ${config.projectId}, database: ${dbId || "(default)"}`);
    }
  } catch (error) {
    console.error("[Firebase] Admin initialization failed. Falling back to local file storage.", error);
    useFirestore = false;
  }
}

let dbCache: DatabaseSchema | null = null;

interface DatabaseSchema {
  users: User[];
  profiles: StudentProfile[];
  mealPreferences: MealPreference[];
  menus: DailyMenu[];
  payments: Payment[];
  notifications: Notification[];
  scannedServings: any[];
}

const DEFAULT_USERS: User[] = [
  {
    id: "admin-1",
    email: "admin@amity.edu",
    name: "Prof. Anil Sharma",
    role: "ADMIN",
    createdAt: new Date().toISOString(),
    password: "password123"
  },
  {
    id: "student-1",
    email: "student@amity.edu",
    name: "Piyush Gautam",
    role: "STUDENT",
    createdAt: new Date().toISOString(),
    password: "password123"
  },
  {
    id: "student-2",
    email: "priya@amity.edu",
    name: "Priya Singh",
    role: "STUDENT",
    createdAt: new Date().toISOString(),
    password: "password123"
  },
  {
    id: "student-3",
    email: "rahul@amity.edu",
    name: "Rahul Sharma",
    role: "STUDENT",
    createdAt: new Date().toISOString(),
    password: "password123"
  },
  {
    id: "student-4",
    email: "kabir@amity.edu",
    name: "Kabir Verma",
    role: "STUDENT",
    createdAt: new Date().toISOString(),
    password: "password123"
  }
];

const DEFAULT_PROFILES: StudentProfile[] = [
  {
    userId: "student-1",
    hostelBlock: "H-1 Boys",
    roomNumber: "302",
    messType: "VEG",
    joinedAt: new Date().toISOString()
  },
  {
    userId: "student-2",
    hostelBlock: "G-3 Girls",
    roomNumber: "105",
    messType: "VEG",
    joinedAt: new Date().toISOString()
  },
  {
    userId: "student-3",
    hostelBlock: "H-2 Boys",
    roomNumber: "204",
    messType: "SPECIAL",
    joinedAt: new Date().toISOString()
  },
  {
    userId: "student-4",
    hostelBlock: "H-1 Boys",
    roomNumber: "112",
    messType: "SPECIAL",
    joinedAt: new Date().toISOString()
  }
];

const DEFAULT_PAYMENTS: Payment[] = [
  {
    id: "pay-1",
    userId: "student-1",
    amount: 15400,
    status: "SUCCESSFUL",
    razorpayOrderId: "order_Kmx82kso",
    razorpayPaymentId: "pay_Kmy928s",
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "pay-2",
    userId: "student-2",
    amount: 15400,
    status: "SUCCESSFUL",
    razorpayOrderId: "order_Lkx32kso",
    razorpayPaymentId: "pay_Lmy418s",
    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "pay-3",
    userId: "student-3",
    amount: 15400,
    status: "PENDING",
    razorpayOrderId: "order_Mkx56mzp",
    date: new Date().toISOString()
  }
];

const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    userId: "student-1",
    title: "Welcome to AUR Mess Portal",
    message: "Your account is secure. Please configure your daily meal subscriptions and explore active calendars.",
    type: "SUCCESS",
    createdAt: new Date().toISOString(),
    isRead: false
  },
  {
    id: "notif-2",
    userId: "ALL",
    title: "Upcoming Maintenance Schedule",
    message: "AUR Mess Hall H-1 will undergo regular deep cleansing on Sunday between 4:00 PM and 6:00 PM. High Protein snacks will be served in Hall H-2.",
    type: "WARNING",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: false
  }
];

// Generate standard descriptions based on day name
function getBreakfastDesc(day: number): string {
  const options = [
    "Aloo Paratha with Curd, Mint Chutney, Tea & Coffee",
    "Masala Dosa, Sambar, Coconut Chutney, Fruits, Milk",
    "Poha with Sev, Sprouts Salad, Boiled Eggs / Paneer Cubes",
    "Idli-Vada Combo, Sambar, Filter Coffee, Banana",
    "Veg Sandwich with French Fries, Ketchup, Hot Tea",
    "Chole Bhature, Lassi, Pickle, Fresh Cut Papaya",
    "Stuffed Paneer Paratha, Butter, Boiled Sprouts, Juice"
  ];
  return options[day % options.length];
}

function getLunchDesc(day: number): string {
  const options = [
    "Kadhai Paneer, Dal Makhani, Jeera Rice, Tandoori Roti, Salad & Boondi Raita",
    "Sambar Rice, Poriyal, Lemon Sevai, Pappadom, Buttermilk",
    "Rajma Masala, Kashmiri Pulao, Butter Roti, Green Salad, Gulab Jamun",
    "Veg Biryani, Salan, Raita, Masala Fried Papad, Onion Salad",
    "Aloo Gobhi Adraki, Yellow Dal Tadka, Steamed Rice, Phulka, Curd",
    "Paneer Butter Masala, Chana Masala, Veg Pulao, Garlic Naan",
    "Soyabean Matar Curry, Moong Dal, Steamed Rice, Chapati, Custard"
  ];
  return options[day % options.length];
}

function getDinnerDesc(day: number): string {
  const options = [
    "Palak Paneer, Masoor Dal, Steamed Rice, Tawa Roti, Fruit Custard",
    "Mutter Mushroom, Dal Panchmel, Veg Fried Rice, Butter Naan, Ice Cream",
    "Malai Kofta, Mix Veg, Steamed Rice, Rumali Roti, Kheer",
    "Shahi Paneer, Black Dal Tadka, Pulao, Missi Roti, Jalebi",
    "Bhindi Do Pyaza, Dal Fry, Steamed Rice, Chapati, Sevaiyaan Kheer",
    "Veg Manchurian, Hakka Noodles, Schezwan Fried Rice, Kimchi Salad",
    "Kadhi Pakoda, Gatte Ki Sabzi, Steamed Rice, Bajre Ki Roti, Ghee & Gur"
  ];
  return options[day % options.length];
}

// Generate menus dynamically around the current time
function generateSeededMenus(): DailyMenu[] {
  const menus: DailyMenu[] = [];
  const today = new Date();

  // Generate 7 days in the past and 14 days in future
  for (let i = -7; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay();

    menus.push({
      id: `menu-${dateStr}`,
      date: dateStr,
      breakfastOptions: ["Regular", "North Indian", "South Indian", "Jain"],
      lunchOptions: ["North Indian", "South Indian", "High Protein", "Jain"],
      dinnerOptions: ["Regular", "North Indian", "South Indian", "Special Menu"],
      breakfastDescription: getBreakfastDesc(dayOfWeek),
      lunchDescription: getLunchDesc(dayOfWeek),
      dinnerDescription: getDinnerDesc(dayOfWeek)
    });
  }

  return menus;
}

// Generate realistic seeded user preferences
function generateSeededPreferences(): MealPreference[] {
  const prefs: MealPreference[] = [];
  const users = ["student-1", "student-2", "student-3", "student-4"];
  const categories: MealCategory[] = ["North Indian", "South Indian", "Jain", "High Protein", "Regular", "Vegetarian", "Special Menu"];
  const mealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
  const today = new Date();

  // Seed preferences for last 5 days and next 7 days
  users.forEach((u, uIdx) => {
    // Determine student preferred default category to make it realistic
    let defaultCat: MealCategory = "Regular";
    if (u === "student-2") defaultCat = "Vegetarian";
    if (u === "student-3") defaultCat = "High Protein";
    if (u === "student-4") defaultCat = "Jain";

    for (let i = -5; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      mealTypes.forEach((mt) => {
        // Randomly skip some meals to make metrics look realistic (e.g. skip Sunday dinner or Friday lunch)
        const dayOfWeek = d.getDay();
        let isSkipped = false;
        
        // Let's make some skips: Rahul skips Sunday lunch, Piyush skips Saturday dinner, etc.
        if (dayOfWeek === 0 && mt === "LUNCH" && uIdx % 2 === 0) isSkipped = true;
        if (dayOfWeek === 6 && mt === "DINNER" && uIdx % 3 === 0) isSkipped = true;

        // Ensure we don't skip ALL meals
        prefs.push({
          id: `pref-${u}-${dateStr}-${mt}`,
          userId: u,
          date: dateStr,
          mealType: mt,
          category: defaultCat,
          isSkipped,
          updatedAt: new Date().toISOString()
        });
      });
    }
  });

  return prefs;
}

// Ensure database file exists with initial data
export async function initializeDb() {
  if (dbCache) return;

  if (useFirestore && firestoreDb) {
    try {
      console.log("[Firebase] Loading database from Firestore...");
      const collections = ["users", "profiles", "mealPreferences", "menus", "payments", "notifications", "scannedServings"];
      const loadedData: any = {};

      for (const coll of collections) {
        const snapshot = await firestoreDb.collection(coll).get();
        loadedData[coll] = [];
        snapshot.forEach((doc: any) => {
          loadedData[coll].push(doc.data());
        });
      }

      // Check if the database needs seeding
      const hasUsers = loadedData.users && loadedData.users.length > 0;
      if (!hasUsers) {
        console.log("[Firebase] Firestore is empty. Initializing and seeding Firestore with defaults...");
        const defaultDb: DatabaseSchema = {
          users: DEFAULT_USERS,
          profiles: DEFAULT_PROFILES,
          mealPreferences: generateSeededPreferences(),
          menus: generateSeededMenus(),
          payments: DEFAULT_PAYMENTS,
          notifications: DEFAULT_NOTIFICATIONS,
          scannedServings: []
        };

        // Seed to Firestore
        await persistToFirestoreAsync(defaultDb);
        dbCache = defaultDb;
        console.log("[Firebase] Firestore database seeded successfully!");
      } else {
        dbCache = {
          users: loadedData.users || [],
          profiles: loadedData.profiles || [],
          mealPreferences: loadedData.mealPreferences || [],
          menus: loadedData.menus || [],
          payments: loadedData.payments || [],
          notifications: loadedData.notifications || [],
          scannedServings: loadedData.scannedServings || []
        };
        console.log("[Firebase] Loaded database successfully from Firestore!");
      }
      return;
    } catch (error) {
      console.error("[Firebase] Error loading database from Firestore, falling back to local file...", error);
      useFirestore = false;
    }
  }

  // Fallback to local file db.json
  if (!fs.existsSync(DB_FILE)) {
    const db: DatabaseSchema = {
      users: DEFAULT_USERS,
      profiles: DEFAULT_PROFILES,
      mealPreferences: generateSeededPreferences(),
      menus: generateSeededMenus(),
      payments: DEFAULT_PAYMENTS,
      notifications: DEFAULT_NOTIFICATIONS,
      scannedServings: []
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
    } catch (e) {
      console.error("[Database] Failed to write initial db.json file:", e);
    }
    dbCache = db;
  } else {
    try {
      const data = fs.readFileSync(DB_FILE, "utf8");
      const db = JSON.parse(data) as DatabaseSchema;
      let dirty = false;

      if (!db.menus || db.menus.length === 0) {
        db.menus = generateSeededMenus();
        dirty = true;
      }
      if (!db.mealPreferences || db.mealPreferences.length === 0) {
        db.mealPreferences = generateSeededPreferences();
        dirty = true;
      }
      if (!db.users || db.users.length === 0) {
        db.users = DEFAULT_USERS;
        dirty = true;
      } else {
        db.users.forEach(user => {
          if (!user.password) {
            user.password = "password123";
            dirty = true;
          }
        });
      }
      if (!db.profiles || db.profiles.length === 0) {
        db.profiles = DEFAULT_PROFILES;
        dirty = true;
      }
      if (!db.payments || db.payments.length === 0) {
        db.payments = DEFAULT_PAYMENTS;
        dirty = true;
      }
      if (!db.notifications || db.notifications.length === 0) {
        db.notifications = DEFAULT_NOTIFICATIONS;
        dirty = true;
      }
      if (!db.scannedServings) {
        db.scannedServings = [];
        dirty = true;
      }

      if (dirty) {
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
        } catch (e) {
          console.error("[Database] Failed to write backfilled db.json:", e);
        }
      }
      dbCache = db;
    } catch (e) {
      console.error("[Database] Failed to parse db.json, using defaults:", e);
      dbCache = {
        users: DEFAULT_USERS,
        profiles: DEFAULT_PROFILES,
        mealPreferences: generateSeededPreferences(),
        menus: generateSeededMenus(),
        payments: DEFAULT_PAYMENTS,
        notifications: DEFAULT_NOTIFICATIONS,
        scannedServings: []
      };
    }
  }
}

// Background async Firestore persistence helper
async function persistToFirestoreAsync(data: DatabaseSchema) {
  if (!useFirestore || !firestoreDb) return;
  const collections = ["users", "profiles", "mealPreferences", "menus", "payments", "notifications", "scannedServings"];
  
  for (const coll of collections) {
    const items = (data as any)[coll] || [];
    
    // We can do individual batch commits to handle up to 500 documents per batch.
    let batch = firestoreDb.batch();
    let ops = 0;
    
    for (const item of items) {
      const id = item.id || item.userId || `auto_${Math.random().toString(36).substr(2, 9)}`;
      const docRef = firestoreDb.collection(coll).doc(id);
      batch.set(docRef, item);
      ops++;
      
      if (ops === 400) {
        await batch.commit();
        batch = firestoreDb.batch();
        ops = 0;
      }
    }
    
    if (ops > 0) {
      await batch.commit();
    }
  }
  console.log("[Firebase] Successfully synchronized database to Firestore in background!");
}

// Read database
export function readDb(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }
  
  // Hard fallback synchronous load if called before initializeDb is finished
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      dbCache = JSON.parse(data) as DatabaseSchema;
      return dbCache!;
    }
  } catch (error) {
    console.error("[Database] Synchronous read fallback failed:", error);
  }
  
  return {
    users: DEFAULT_USERS,
    profiles: DEFAULT_PROFILES,
    mealPreferences: [],
    menus: [],
    payments: DEFAULT_PAYMENTS,
    notifications: DEFAULT_NOTIFICATIONS,
    scannedServings: []
  };
}

// Write database
export function writeDb(data: DatabaseSchema): void {
  dbCache = data;

  // 1. Synchronously save to local file for fast UI feedback & local survival
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("[Database] Error writing db.json:", error);
  }

  // 2. Asynchronously sync to Firestore in background (non-blocking)
  if (useFirestore && firestoreDb) {
    persistToFirestoreAsync(data).catch((err) => {
      console.error("[Firebase] Error in background Firestore sync:", err);
    });
  }
}
