import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { 
  User, 
  StudentProfile, 
  MealPreference, 
  DailyMenu, 
  Payment, 
  MealCategory, 
  MealType 
} from "../types";
import { 
  Calendar, 
  Utensils, 
  CheckCircle, 
  Lock, 
  AlertTriangle, 
  CreditCard, 
  History, 
  ArrowRight, 
  Check, 
  RefreshCw, 
  HelpCircle, 
  QrCode, 
  X,
  FileText,
  TrendingDown
} from "lucide-react";

interface StudentDashboardProps {
  currentUser: User;
  profile: StudentProfile | null;
  onProfileUpdate: (profile: StudentProfile) => void;
}

export default function StudentDashboard({ currentUser, profile, onProfileUpdate }: StudentDashboardProps) {
  // Navigation internal state
  const [activeTab, setActiveTab] = useState<"calendar" | "absences" | "billing" | "profile">("calendar");

  // Bulk absence planning states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [absentMeals, setAbsentMeals] = useState({ BREAKFAST: true, LUNCH: true, DINNER: true });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [absenceAction, setAbsenceAction] = useState<"ABSENT" | "RESTORE">("ABSENT");
  const [bulkFeedback, setBulkFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // State collections
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [preferences, setPreferences] = useState<MealPreference[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Loading & Feedback states
  const [loading, setLoading] = useState(true);
  const [savingPrefId, setSavingPrefId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Profile Form states
  const [hostelBlock, setHostelBlock] = useState(profile?.hostelBlock || "");
  const [roomNumber, setRoomNumber] = useState(profile?.roomNumber || "");
  const [messType, setMessType] = useState<"VEG" | "NON_VEG" | "SPECIAL">(profile?.messType || "VEG");
  const [profileSaving, setProfileSaving] = useState(false);

  // Razorpay Checkout Modal state
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(15400);
  const [payingState, setPayingState] = useState<"select" | "processing" | "success">("select");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // Receipt Modal state
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);

  // Student QR Code state
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    if (currentUser?.id) {
      QRCode.toDataURL(currentUser.id, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 300,
        color: {
          dark: "#0F172A", // slate-900
          light: "#FFFFFF"
        }
      })
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error("Error generating student QR code:", err);
        });
    }
  }, [currentUser?.id]);

  // Load Initial Data
  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetches for speed
      const [menusRes, prefsRes, paymentsRes] = await Promise.all([
        fetch("/api/menus"),
        fetch("/api/preferences", { headers: { "Authorization": `Bearer ${currentUser.id}` } }),
        fetch("/api/payments/history", { headers: { "Authorization": `Bearer ${currentUser.id}` } })
      ]);

      const menusData = await menusRes.json();
      const prefsData = await prefsRes.json();
      const paymentsData = await paymentsRes.json();

      setMenus(menusData || []);
      setPreferences(prefsData || []);
      setPayments(paymentsData || []);
    } catch (err) {
      console.error("Error loading student dashboard details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Profile configuration update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/profiles/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({ hostelBlock, roomNumber, messType })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile update failed");

      onProfileUpdate(data.profile);
      setFeedbackMsg({ text: "Hostel details & meal subscription configured successfully!", type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "An error occurred", type: "error" });
    } finally {
      setProfileSaving(false);
    }
  };

  // Bulk Absences / Restoration submit handlers
  const handleBulkAbsenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setBulkSaving(true);
    setBulkFeedback(null);

    const mealsArray = [];
    if (absentMeals.BREAKFAST) mealsArray.push("BREAKFAST");
    if (absentMeals.LUNCH) mealsArray.push("LUNCH");
    if (absentMeals.DINNER) mealsArray.push("DINNER");

    try {
      const res = await fetch("/api/preferences/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          startDate,
          endDate,
          meals: mealsArray,
          isSkipped: absenceAction === "ABSENT"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk absences");

      setBulkFeedback({
        text: `Successfully registered absent status! Modified ${data.updatedCount} meals. (${data.lockedSkipped} locked meals were safely preserved)`,
        type: "success"
      });
      
      // Reload calendars and lists
      fetchData();
    } catch (err: any) {
      setBulkFeedback({ text: err.message || "An error occurred", type: "error" });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkRestoreSubmit = async () => {
    setAbsenceAction("RESTORE");
    setTimeout(async () => {
      if (!startDate || !endDate) return;
      setBulkSaving(true);
      setBulkFeedback(null);

      const mealsArray = [];
      if (absentMeals.BREAKFAST) mealsArray.push("BREAKFAST");
      if (absentMeals.LUNCH) mealsArray.push("LUNCH");
      if (absentMeals.DINNER) mealsArray.push("DINNER");

      try {
        const res = await fetch("/api/preferences/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.id}`
          },
          body: JSON.stringify({
            startDate,
            endDate,
            meals: mealsArray,
            isSkipped: false
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to restore attendance");

        setBulkFeedback({
          text: `Successfully restored attendance status! Modified ${data.updatedCount} meals. (${data.lockedSkipped} locked meals were safely preserved)`,
          type: "success"
        });
        
        fetchData();
      } catch (err: any) {
        setBulkFeedback({ text: err.message || "An error occurred", type: "error" });
      } finally {
        setBulkSaving(false);
      }
    }, 50);
  };

  // Dynamic Rule check for 7-day Locking Threshold
  const getLockStatus = (dateStr: string): { isLocked: boolean; daysLeft: number } => {
    const mealDate = new Date(dateStr);
    const today = new Date();
    // Reset hours to midnight UTC
    const mealStart = Date.UTC(mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate());
    const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = mealStart - todayStart;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      isLocked: diffDays < 7,
      daysLeft: diffDays
    };
  };

  // Handle saving Preference (Meal Category or Skip toggle)
  const handleSavePreference = async (date: string, mealType: MealType, category: MealCategory, currentIsSkipped: boolean) => {
    const lockInfo = getLockStatus(date);
    if (lockInfo.isLocked) {
      setFeedbackMsg({
        text: `Error: Choices for ${date} are locked. Meals must be modified at least 7 days before the meal date.`,
        type: "error"
      });
      return;
    }

    const prefId = `pref-${currentUser.id}-${date}-${mealType}`;
    setSavingPrefId(prefId);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          date,
          mealType,
          category,
          isSkipped: !currentIsSkipped // Toggle current skip status
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state smoothly
      setPreferences(prev => {
        const idx = prev.findIndex(p => p.id === data.preference.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.preference;
          return updated;
        } else {
          return [...prev, data.preference];
        }
      });

      setFeedbackMsg({
        text: data.preference.isSkipped 
          ? `Successfully marked ${mealType.toLowerCase()} on ${date} as skipped.`
          : `Choice registered successfully! Enjoy your ${mealType.toLowerCase()}.`,
        type: "success"
      });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Failed to update choice", type: "error" });
    } finally {
      setSavingPrefId(null);
    }
  };

  // Change Preferred Diet Option directly
  const handleChangeCategory = async (date: string, mealType: MealType, newCategory: MealCategory, isSkipped: boolean) => {
    const lockInfo = getLockStatus(date);
    if (lockInfo.isLocked) {
      setFeedbackMsg({
        text: `Error: Choices for ${date} are finalized and locked.`,
        type: "error"
      });
      return;
    }

    const prefId = `pref-${currentUser.id}-${date}-${mealType}`;
    setSavingPrefId(prefId);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          date,
          mealType,
          category: newCategory,
          isSkipped
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update state
      setPreferences(prev => {
        const idx = prev.findIndex(p => p.id === data.preference.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.preference;
          return updated;
        } else {
          return [...prev, data.preference];
        }
      });

      setFeedbackMsg({ text: `Updated your diet preference for ${mealType.toLowerCase()} to ${newCategory}.`, type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Failed to update category", type: "error" });
    } finally {
      setSavingPrefId(null);
    }
  };

  // Helper: Dynamically load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Initiate Fees checkout via Razorpay popup simulator/real gateway
  const handleInitiatePayment = async () => {
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({ amount: paymentAmount })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRazorpayOrderId(data.orderId);

      // Launch real Razorpay checkout if configured on backend
      if (data.isRealGateway) {
        const loaded = await loadRazorpayScript();
        if (loaded && (window as any).Razorpay) {
          const options = {
            key: data.keyId,
            amount: data.amount * 100, // paise
            currency: "INR",
            name: "Amity AUR Mess Portal",
            description: "Semester Mess Fee Payment",
            order_id: data.orderId,
            handler: async function (response: any) {
              setPayingState("processing");
              try {
                const verifyRes = await fetch("/api/payments/verify", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentUser.id}`
                  },
                  body: JSON.stringify({
                    orderId: data.orderId,
                    success: true,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature
                  })
                });
                const verifyData = await verifyRes.json();
                if (verifyRes.ok && verifyData.status === "SUCCESSFUL") {
                  setPayingState("success");
                  // Refresh history
                  const histRes = await fetch("/api/payments/history", {
                    headers: { "Authorization": `Bearer ${currentUser.id}` }
                  });
                  const histData = await histRes.json();
                  setPayments(histData || []);
                } else {
                  throw new Error(verifyData.error || "Signature verification failed");
                }
              } catch (verifyErr: any) {
                setFeedbackMsg({ text: verifyErr.message || "Failed to verify transaction.", type: "error" });
              }
            },
            prefill: {
              name: currentUser.name,
              email: currentUser.email
            },
            theme: {
              color: "#0F172A"
            },
            modal: {
              ondismiss: function() {
                setFeedbackMsg({ text: "Payment window dismissed by student.", type: "error" });
              }
            }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
          return;
        }
      }

      // Fallback checkout interface (custom premium simulator for sandbox)
      setPayingState("select");
      setIsRazorpayOpen(true);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Failed to initiate payment", type: "error" });
    }
  };

  // Confirm Razorpay mock payment completion
  const handleVerifyPayment = async (success: boolean) => {
    if (!razorpayOrderId) return;
    setPayingState("processing");

    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          orderId: razorpayOrderId,
          success
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (success) {
        setPayingState("success");
        // Update payments state array
        fetch("/api/payments/history", { headers: { "Authorization": `Bearer ${currentUser.id}` } })
          .then(r => r.json())
          .then(data => setPayments(data || []));
      } else {
        setIsRazorpayOpen(false);
        setFeedbackMsg({ text: "Simulated payment cancelled or declined.", type: "error" });
      }
    } catch (err: any) {
      setIsRazorpayOpen(false);
      setFeedbackMsg({ text: err.message || "Verification failed", type: "error" });
    }
  };

  // Helper: Find preference record for a meal
  const getPreference = (date: string, mealType: MealType): MealPreference | null => {
    const pref = preferences.find(p => p.date === date && p.mealType === mealType);
    return pref || null;
  };

  // Helper: Get today's date in YYYY-MM-DD format
  const getTodayDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper: Get counts
  const totalSkipsCount = preferences.filter(p => p.isSkipped).length;
  const isPaid = payments.some(p => p.status === "SUCCESSFUL");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-semibold mt-3 uppercase tracking-wider">Syncing Amity DB...</p>
      </div>
    );
  }

  // Profile check gate
  const isProfileComplete = profile && profile.hostelBlock && profile.roomNumber;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      
      {/* Left Column: Tab Content */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Tab bar header */}
      <div className="flex bg-white border border-slate-200 p-1.5 rounded-xl max-w-xl shadow-xs">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "calendar" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Meal skipping & calendar
        </button>
        <button
          onClick={() => setActiveTab("absences")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "absences" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Mark Absences
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "billing" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Billing & transactions
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "profile" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Preferences & details
        </button>
      </div>

      {/* Global alert box feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
          feedbackMsg.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-rose-50 border-rose-100 text-rose-800"
        }`}>
          {feedbackMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <div>{feedbackMsg.text}</div>
        </div>
      )}

      {/* Profile incomplete Warning Banner */}
      {!isProfileComplete && (
        <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-900 font-display">Subscription Not Configured</h4>
              <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
                Please complete your Amity hostel details and preferred mess subscription to finalize your daily food deliveries.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("profile")}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            Go to Preferences
          </button>
        </div>
      )}

      {/* TAB 1.5: BULK ABSENCE MARKER */}
      {activeTab === "absences" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-xl">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-950">Vacation & Absence Planner</h3>
            <p className="text-xs text-slate-500 mt-0.5">Inform the kitchen in advance when you will be absent. Active meals will be automatically suspended to prevent wastage.</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-3">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <div>
              <span className="font-bold text-slate-800 block mb-1">Amity AUR 7-Day Lockout Policy:</span>
              To allow raw material procurement teams to plan recipes accurately, any meal inside the next 7 days is strictly locked. Absences can only be registered for days beyond the next 7 days.
            </div>
          </div>

          {bulkFeedback && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
              bulkFeedback.type === "success" 
                ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}>
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>{bulkFeedback.text}</div>
            </div>
          )}

          <form onSubmit={handleBulkAbsenceSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Start Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">End Date</label>
                <input
                  type="date"
                  required
                  min={startDate || new Date().toISOString().split("T")[0]}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Meals of Absence</label>
              <div className="flex gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={absentMeals.BREAKFAST}
                    onChange={(e) => setAbsentMeals(prev => ({ ...prev, BREAKFAST: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  Breakfast
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={absentMeals.LUNCH}
                    onChange={(e) => setAbsentMeals(prev => ({ ...prev, LUNCH: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  Lunch
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={absentMeals.DINNER}
                    onChange={(e) => setAbsentMeals(prev => ({ ...prev, DINNER: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  Dinner
                </label>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={bulkSaving || (!absentMeals.BREAKFAST && !absentMeals.LUNCH && !absentMeals.DINNER)}
                onClick={() => setAbsenceAction("ABSENT")}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {bulkSaving && absenceAction === "ABSENT" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Absences (Skip Meals)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={bulkSaving || (!absentMeals.BREAKFAST && !absentMeals.LUNCH && !absentMeals.DINNER)}
                onClick={() => handleBulkRestoreSubmit()}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {bulkSaving && absenceAction === "RESTORE" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Utensils className="w-4 h-4" />
                    <span>Restore Attendance (Going)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 1: CALENDAR & SKIPS */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950 font-display">Live Mess Calendar</h3>
              <p className="text-xs text-slate-500 mt-0.5">Modify meal selections and opt out of upcoming schedules to save resource costs.</p>
            </div>

            {/* Skips Tracker Widget */}
            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-xs">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">SKIPPED MEALS</span>
                <span className="text-sm font-bold text-slate-800">{totalSkipsCount} Registered Skips</span>
              </div>
            </div>
          </div>

          {/* Strict 7-Day Deadline Notice Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-900">AUR Skip Locking Policy:</strong> All skip and diet category preferences must be locked <strong className="text-slate-900">7 days</strong> prior to the date. Locked days display a <span className="font-bold text-amber-700 inline-flex items-center gap-0.5"><Lock className="w-3 h-3" /> Lock</span> badge to reflect kitchen procurement.
            </div>
          </div>

          {/* Interactive Days Calendar list */}
          <div className="space-y-6">
            {(() => {
              const todayStr = getTodayDateStr();
              const filteredMenus = menus.filter(menu => {
                if (menu.date < todayStr) return false;
                const mDate = new Date(menu.date);
                const tDate = new Date(todayStr);
                const mTime = Date.UTC(mDate.getFullYear(), mDate.getMonth(), mDate.getDate());
                const tTime = Date.UTC(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
                const diffDays = Math.round((mTime - tTime) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 7;
              }).sort((a, b) => a.date.localeCompare(b.date));

              return filteredMenus.map((menu) => {
                const lockInfo = getLockStatus(menu.date);
              
              // Get day name
              const dateObj = new Date(menu.date);
              const dayName = dateObj.toLocaleDateString([], { weekday: "long" });
              const cleanDate = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });

              return (
                <div key={menu.date} className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
                  lockInfo.isLocked ? "border-slate-200 bg-white" : "border-blue-600/20 ring-1 ring-blue-500/5"
                }`}>
                  
                  {/* Calendar row header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-4 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cleanDate.split(" ")[0]}</span>
                        <span className="text-sm font-black text-slate-800 leading-none">{cleanDate.split(" ")[1]}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-950 font-display flex items-center gap-1.5">
                          <span>{dayName}</span>
                          <span className="text-xs font-semibold text-slate-400">({menu.date})</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium">Daily meal procurement pipeline</p>
                      </div>
                    </div>

                    {/* Locking Badge */}
                    {lockInfo.isLocked ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/50 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Choices Finalized</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/50 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Modifiable ({lockInfo.daysLeft}d left)</span>
                      </span>
                    )}
                  </div>

                  {/* 3 Meals Periods Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    
                    {/* Breakfast */}
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-blue-500" />
                          <span>Breakfast</span>
                        </span>
                        
                        {/* Skip checkbox */}
                        <button
                          disabled={lockInfo.isLocked || savingPrefId !== null}
                          onClick={() => {
                            const pref = getPreference(menu.date, "BREAKFAST");
                            handleSavePreference(menu.date, "BREAKFAST", pref?.category || "Regular", pref?.isSkipped || false);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            getPreference(menu.date, "BREAKFAST")?.isSkipped
                              ? "bg-rose-100 text-rose-800 border border-rose-200/50"
                              : "bg-slate-100 text-slate-600 hover:bg-rose-50 border border-slate-200"
                          }`}
                        >
                          {getPreference(menu.date, "BREAKFAST")?.isSkipped ? "SKIPPED" : "Going"}
                        </button>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-relaxed italic min-h-[40px]">
                        "{menu.breakfastDescription || "Aloo Paratha with Curd, Mint Chutney"}"
                      </p>

                      {/* Dropdown Choice selector for category diet */}
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Preference</label>
                        <select
                          disabled={lockInfo.isLocked || getPreference(menu.date, "BREAKFAST")?.isSkipped}
                          value={getPreference(menu.date, "BREAKFAST")?.category || "Regular"}
                          onChange={(e) => handleChangeCategory(menu.date, "BREAKFAST", e.target.value as MealCategory, getPreference(menu.date, "BREAKFAST")?.isSkipped || false)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold py-1 px-2 text-slate-700 outline-hidden focus:border-blue-500 transition-colors"
                        >
                          <option value="Regular">Regular Diet</option>
                          <option value="North Indian">North Indian Choice</option>
                          <option value="South Indian">South Indian Choice</option>
                          <option value="Jain">Jain Pure Veg</option>
                          <option value="High Protein">High Protein</option>
                        </select>
                      </div>
                    </div>

                    {/* Lunch */}
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-blue-500" />
                          <span>Lunch</span>
                        </span>
                        
                        {/* Skip checkbox */}
                        <button
                          disabled={lockInfo.isLocked || savingPrefId !== null}
                          onClick={() => {
                            const pref = getPreference(menu.date, "LUNCH");
                            handleSavePreference(menu.date, "LUNCH", pref?.category || "Regular", pref?.isSkipped || false);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            getPreference(menu.date, "LUNCH")?.isSkipped
                              ? "bg-rose-100 text-rose-800 border border-rose-200/50"
                              : "bg-slate-100 text-slate-600 hover:bg-rose-50 border border-slate-200"
                          }`}
                        >
                          {getPreference(menu.date, "LUNCH")?.isSkipped ? "SKIPPED" : "Going"}
                        </button>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-relaxed italic min-h-[40px]">
                        "{menu.lunchDescription || "Paneer Makhani, Dal Tadka, Naan"}"
                      </p>

                      {/* Dropdown Choice selector for category diet */}
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Preference</label>
                        <select
                          disabled={lockInfo.isLocked || getPreference(menu.date, "LUNCH")?.isSkipped}
                          value={getPreference(menu.date, "LUNCH")?.category || "Regular"}
                          onChange={(e) => handleChangeCategory(menu.date, "LUNCH", e.target.value as MealCategory, getPreference(menu.date, "LUNCH")?.isSkipped || false)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold py-1 px-2 text-slate-700 outline-hidden focus:border-blue-500 transition-colors"
                        >
                          <option value="Regular">Regular Diet</option>
                          <option value="North Indian">North Indian Choice</option>
                          <option value="South Indian">South Indian Choice</option>
                          <option value="Jain">Jain Pure Veg</option>
                          <option value="High Protein">High Protein</option>
                        </select>
                      </div>
                    </div>

                    {/* Dinner */}
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Utensils className="w-3.5 h-3.5 text-blue-500" />
                          <span>Dinner</span>
                        </span>
                        
                        {/* Skip checkbox */}
                        <button
                          disabled={lockInfo.isLocked || savingPrefId !== null}
                          onClick={() => {
                            const pref = getPreference(menu.date, "DINNER");
                            handleSavePreference(menu.date, "DINNER", pref?.category || "Regular", pref?.isSkipped || false);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            getPreference(menu.date, "DINNER")?.isSkipped
                              ? "bg-rose-100 text-rose-800 border border-rose-200/50"
                              : "bg-slate-100 text-slate-600 hover:bg-rose-50 border border-slate-200"
                          }`}
                        >
                          {getPreference(menu.date, "DINNER")?.isSkipped ? "SKIPPED" : "Going"}
                        </button>
                      </div>

                      <p className="text-xs text-slate-700 font-medium leading-relaxed italic min-h-[40px]">
                        "{menu.dinnerDescription || "Mutter Mushroom, Chapati, Ice Cream"}"
                      </p>

                      {/* Dropdown Choice selector for category diet */}
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Preference</label>
                        <select
                          disabled={lockInfo.isLocked || getPreference(menu.date, "DINNER")?.isSkipped}
                          value={getPreference(menu.date, "DINNER")?.category || "Regular"}
                          onChange={(e) => handleChangeCategory(menu.date, "DINNER", e.target.value as MealCategory, getPreference(menu.date, "DINNER")?.isSkipped || false)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold py-1 px-2 text-slate-700 outline-hidden focus:border-blue-500 transition-colors"
                        >
                          <option value="Regular">Regular Diet</option>
                          <option value="North Indian">North Indian Choice</option>
                          <option value="South Indian">South Indian Choice</option>
                          <option value="Jain">Jain Pure Veg</option>
                          <option value="High Protein">High Protein</option>
                        </select>
                      </div>
                    </div>

                  </div>

                </div>
              );
            });
          })()}
        </div>
        </div>
      )}

      {/* TAB 2: BILLING & TRANSACTIONS */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-950 font-display">Mess Fees & Ledger Account</h3>
            <p className="text-xs text-slate-500 mt-0.5">Settle semester mess accounts and review all secure receipt transcripts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Outstanding Statement Widget */}
            <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">STATEMENT BALANCE</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                    isPaid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800 animate-pulse"
                  }`}>
                    {isPaid ? "PAID" : "DUE"}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-400 font-semibold">Semester Subscription</p>
                  <h4 className="text-3xl font-black font-display text-slate-950">
                    {isPaid ? "₹0.00" : "₹15,400.00"}
                  </h4>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                  Statement covers all regular hot buffet meals (Breakfast, Lunch, Dinner) served in AUR Halls.
                </p>
              </div>

              {!isPaid && (
                <button
                  onClick={handleInitiatePayment}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer mt-6 transition-all shadow-md"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Settle via Razorpay</span>
                </button>
              )}
            </div>

            {/* Payment Ledger History */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <History className="w-4 h-4 text-blue-600" />
                <h4 className="font-display font-bold text-sm text-slate-900">Historical Transaction Ledger</h4>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-semibold text-xs">No transactions recorded.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-black tracking-wider">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Reference ID</th>
                        <th className="py-2.5">Amount</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold text-slate-700 divide-y divide-slate-50">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3">{new Date(p.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td className="py-3 font-mono text-[10px] text-slate-500">{p.razorpayOrderId || "N/A"}</td>
                          <td className="py-3">₹{p.amount.toLocaleString()}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                              p.status === "SUCCESSFUL" ? "bg-emerald-50 text-emerald-800" :
                              p.status === "PENDING" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {p.status === "SUCCESSFUL" && (
                              <button
                                onClick={() => setSelectedReceipt(p)}
                                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 ml-auto text-[11px] cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: PROFILE SETTINGS */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Profile form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-slate-900 mb-6">Hostel Allocation details</h3>
            
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    AUR Hostel Block
                  </label>
                  <select
                    required
                    value={hostelBlock}
                    onChange={(e) => setHostelBlock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 outline-hidden transition-all"
                  >
                    <option value="">-- Choose Hostel Block --</option>
                    <option value="H-1 Boys">Block H-1 (Boys)</option>
                    <option value="H-2 Boys">Block H-2 (Boys)</option>
                    <option value="G-3 Girls">Block G-3 (Girls)</option>
                    <option value="G-4 Girls">Block G-4 (Girls)</option>
                    <option value="International Block">International Hostel Block</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Room Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 302-A"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl py-2 px-3.5 text-sm font-semibold text-slate-800 outline-hidden transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Preferred Mess Category Subscription
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setMessType("VEG")}
                    className={`border rounded-xl p-4 flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer ${
                      messType === "VEG"
                        ? "border-blue-600 bg-blue-50/30 text-blue-900 font-bold"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-bold">Standard Vegetarian</span>
                    <span className="text-[10px] text-slate-400 leading-relaxed">Regular Indian Veg menu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessType("NON_VEG")}
                    className={`border rounded-xl p-4 flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer ${
                      messType === "NON_VEG"
                        ? "border-blue-600 bg-blue-50/30 text-blue-900 font-bold"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-bold">Non-Veg Allowed</span>
                    <span className="text-[10px] text-slate-400 leading-relaxed">Mixed diet protein options</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessType("SPECIAL")}
                    className={`border rounded-xl p-4 flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer ${
                      messType === "SPECIAL"
                        ? "border-blue-600 bg-blue-50/30 text-blue-900 font-bold"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-bold">Special Dietary</span>
                    <span className="text-[10px] text-slate-400 leading-relaxed">Pure Jain / Gluten free</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-6"
              >
                {profileSaving ? "Saving details..." : "Update Subscription Details"}
              </button>
            </form>
          </div>

          {/* Guidelines info card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="font-display font-bold text-sm text-slate-950">AUR Mess Policy Handbook</h4>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Wastage Fee Penalties:</strong> Students who skip more than 15 meals without registering a skip in advance will receive administrative alerts.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Diet Preference Changes:</strong> Re-routing between Standard, Jain, or High Protein happens instantly.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Guest Meal Charges:</strong> Outside guests must purchase single buffet tokens at the reception desk for INR 120.</span>
                </li>
              </ul>
            </div>
            
            <div className="pt-4 mt-6 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SUPPORT HOTLINE</p>
              <p className="text-xs font-bold text-slate-800 mt-1">mess-support@amity.edu</p>
            </div>
          </div>

        </div>
      )}

      {/* RAZORPAY MOCK POPUP MODAL */}
      {isRazorpayOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0C111A] text-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
            
            {/* Razorpay Brand Header bar */}
            <div className="bg-[#172133] p-5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 text-white font-extrabold rounded-lg px-2 py-1 text-xs">R</div>
                <div>
                  <h4 className="font-bold text-sm leading-tight text-white">Razorpay Secure</h4>
                  <p className="text-[10px] text-slate-400">Order Ref: {razorpayOrderId}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsRazorpayOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content area based on payment state */}
            {payingState === "select" && (
              <div className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">PAYING TO AMITY UNIVERSITY</p>
                  <h3 className="text-3xl font-black text-white">₹15,400.00</h3>
                  <span className="inline-block bg-slate-800 text-[9px] text-slate-300 font-bold px-2 py-0.5 rounded mt-1">AUR SEMESTER FEES</span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Simulated Payment Option</p>
                  
                  <button
                    onClick={() => setSelectedPaymentMethod("upi")}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedPaymentMethod === "upi" ? "border-blue-600 bg-blue-900/20" : "border-slate-800 bg-slate-900/50 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode className="w-5 h-5 text-blue-400" />
                      <div>
                        <span className="text-xs font-bold block">Instant BHIM UPI GPay</span>
                        <span className="text-[10px] text-slate-400">Scan QR or enter virtual address</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    onClick={() => setSelectedPaymentMethod("card")}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedPaymentMethod === "card" ? "border-blue-600 bg-blue-900/20" : "border-slate-800 bg-slate-900/50 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                      <div>
                        <span className="text-xs font-bold block">Visa / MasterCard / RuPay</span>
                        <span className="text-[10px] text-slate-400">Save details securely</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleVerifyPayment(false)}
                    className="flex-1 border border-slate-800 text-slate-400 hover:text-white rounded-xl py-2.5 font-bold text-xs cursor-pointer text-center"
                  >
                    Decline Payment
                  </button>
                  <button
                    disabled={!selectedPaymentMethod}
                    onClick={() => handleVerifyPayment(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-55 text-white rounded-xl py-2.5 font-bold text-xs cursor-pointer text-center"
                  >
                    Simulate Success
                  </button>
                </div>
              </div>
            )}

            {payingState === "processing" && (
              <div className="p-12 text-center space-y-4">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                <h4 className="font-bold text-sm text-white">Verifying Transaction State...</h4>
                <p className="text-xs text-slate-400">Connecting securely to Amity banking routing systems.</p>
              </div>
            )}

            {payingState === "success" && (
              <div className="p-8 text-center space-y-6">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold shadow-lg shadow-emerald-500/20">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white font-display">Payment Succeeded</h4>
                  <p className="text-xs text-slate-400 mt-1">Transaction settled and registered with AUR Mess Registry.</p>
                </div>
                <button
                  onClick={() => setIsRazorpayOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Return to Billing
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* DETAILED RECEIPT DOWNLOADABLE DISPLAY */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-base leading-tight">Amity University Rajasthan</h3>
                <p className="text-[10px] text-slate-400">Official Semester Mess Receipt</p>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">ISSUED TO</p>
                  <p className="font-bold text-slate-800">{currentUser.name}</p>
                  <p className="text-slate-500">{currentUser.email}</p>
                  <p className="text-slate-500">Hostel: {profile?.hostelBlock || "N/A"} - Room {profile?.roomNumber || "N/A"}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">RECEIPT DETAILS</p>
                  <p className="font-bold text-slate-800">ID: {selectedReceipt.id}</p>
                  <p className="text-slate-500">Date: {new Date(selectedReceipt.date).toLocaleDateString()}</p>
                  <p className="text-slate-500">Txn: {selectedReceipt.razorpayPaymentId}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between font-bold text-slate-400 text-[10px] uppercase border-b border-slate-100 pb-2">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Hostel Buffet Subscription Semester charges (Veg/Non-Veg/Special)</span>
                  <span>₹{selectedReceipt.amount.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>AUR Infrastructure levy tax</span>
                  <span>₹0.00</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                <div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-full font-bold uppercase">
                    PAID IN FULL
                  </span>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-slate-400 font-semibold">Total Settle amount</span>
                  <p className="text-lg font-black text-slate-950">₹{selectedReceipt.amount.toLocaleString()}.00</p>
                </div>
              </div>

              <div className="pt-6 border-t border-dashed border-slate-200 flex justify-between items-center text-slate-400">
                <p className="text-[9px]">Generated automatically by Amity AUR Billing systems. No signature required.</p>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer transition-colors"
                >
                  Print Receipt
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      </div> {/* End Left Column */}

      {/* Right Column: Persistent Digital Mess Pass Card */}
      <div className="lg:col-span-1 sticky top-24 space-y-6 text-left">
        
        {/* DIGITAL PASS CARD */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
          
          {/* Subtle design accents: AUR logo colors gold and navy background mesh */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

          {/* Header */}
          <div className="relative border-b border-slate-800 pb-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Amity University Rajasthan</p>
              <h3 className="text-sm font-black tracking-tight text-slate-100">DIGITAL MESS PASS</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
              SECURE RFID
            </span>
          </div>

          {/* Student Profile Overview */}
          <div className="relative pt-6 flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-xl rounded-2xl shadow-md border border-amber-400">
                {currentUser.name.charAt(0)}
              </div>
              {/* Pulsing online marker */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-slate-950 flex items-center justify-center">
                <span className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold tracking-tight text-white">{currentUser.name}</h4>
              <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[9px] font-bold bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md">
                  ID: {currentUser.id}
                </span>
                {isProfileComplete ? (
                  <span className="text-[9px] font-bold bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md uppercase">
                    {profile.hostelBlock} • {profile.roomNumber}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase">
                    Profile Incomplete
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Status Pill */}
          <div className="relative mt-6 p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className="text-left">
                <p className="text-[10px] font-semibold text-slate-400 leading-none">Subscription Seat</p>
                <p className="text-xs font-bold text-slate-200 mt-1">
                  {isPaid ? 'Semester Fees Paid' : 'Fees Payment Due'}
                </p>
              </div>
            </div>
            {isPaid ? (
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                ACTIVE
              </span>
            ) : (
              <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                SUSPENDED
              </span>
            )}
          </div>

          {/* THE STATIC USER QR CODE */}
          <div className="relative mt-6 flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-800 shadow-inner">
            {qrCodeUrl ? (
              <div className="relative p-1 bg-white rounded-xl">
                <img 
                  src={qrCodeUrl} 
                  alt="Student Mess Pass QR" 
                  className="w-44 h-44 object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-slate-950 rounded-lg flex items-center justify-center border-2 border-white shadow-md">
                  <span className="text-[10px] font-black text-amber-400">AUR</span>
                </div>
              </div>
            ) : (
              <div className="w-44 h-44 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center mx-auto">
                <QrCode className="w-8 h-8 text-slate-300 animate-spin" />
              </div>
            )}
            
            <p className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mt-4 text-center">
              Scan Daily • Static Secure Pass
            </p>
          </div>

          {/* Footer warning if unpaid */}
          {!isPaid && (
            <div className="relative mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-red-200 uppercase leading-none">Security Gate Warning</p>
                <p className="text-[10px] text-red-400/95 mt-1 leading-normal">
                  Your entry gate pass is temporarily suspended. Please go to the **Billing** tab to pay your semester dues.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* TODAY'S ACTIVE MEAL SNAPSHOT CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-left space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-slate-700" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Gate Verification Today</h4>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
              {new Date().toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          </div>

          {(() => {
            // Determine active meal based on time of day
            const hour = new Date().getHours();
            let activeMeal: MealType = "BREAKFAST";
            if (hour >= 10 && hour < 16) activeMeal = "LUNCH";
            else if (hour >= 16) activeMeal = "DINNER";

            const todayStr = getTodayDateStr();
            const pref = getPreference(todayStr, activeMeal);
            
            const isSkipped = pref ? pref.isSkipped : false;
            const category = pref ? pref.category : (profile?.messType === "SPECIAL" ? "Special Menu" : "Regular");

            // Look up the actual menu item for today's active meal
            const todayMenu = menus.find(m => m.date === todayStr);
            let activeMenuText = "Regular Standard Meal Plan";
            if (todayMenu) {
              if (activeMeal === "BREAKFAST") activeMenuText = todayMenu.breakfastDescription || "";
              else if (activeMeal === "LUNCH") activeMenuText = todayMenu.lunchDescription || "";
              else if (activeMeal === "DINNER") activeMenuText = todayMenu.dinnerDescription || "";
            }

            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                    {activeMeal}
                  </span>
                  {isSkipped ? (
                    <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                      <X className="w-3 h-3" /> Skipped / Non-Attending
                    </span>
                  ) : (
                    <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                      <Check className="w-3 h-3" /> Attending Meal
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none">Registered Diet</p>
                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">{category}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none">Serving Menu Item</p>
                  <p className="text-[11px] text-slate-600 leading-normal font-semibold mt-1">
                    {activeMenuText}
                  </p>
                </div>

                {isSkipped ? (
                  <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-left">
                    <p className="text-[10px] font-extrabold text-amber-800 uppercase tracking-tight">⛔ DO NOT SERVE</p>
                    <p className="text-[10px] text-amber-700 mt-1 leading-snug font-medium">
                      You marked this meal as **skipped** to prevent food waste. The scanner will show red at the gate. Refund rebate credited!
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-left">
                    <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-tight">🟢 GATE PASS READY</p>
                    <p className="text-[10px] text-emerald-700 mt-1 leading-snug font-medium">
                      Scan your QR at the entrance. The security tablet will verify your attendance and greenlight your meal tray.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

        </div>

      </div>

    </div>
  );
}
