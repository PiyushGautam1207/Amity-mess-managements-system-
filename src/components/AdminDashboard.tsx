import React, { useState, useEffect } from "react";
import { User, DailyMenu, MealCategory } from "../types";
import { 
  Users, 
  Search, 
  Filter, 
  Utensils, 
  CheckCircle, 
  Database, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Calendar, 
  Save, 
  RefreshCw,
  Sliders,
  ChevronRight,
  Shield,
  HelpCircle,
  Download,
  QrCode,
  X
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

interface AdminDashboardProps {
  currentUser: User;
}

interface StudentAdminRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  profile: {
    hostelBlock: string;
    roomNumber: string;
    messType: "VEG" | "NON_VEG" | "SPECIAL";
    joinedAt: string;
  } | null;
  payments: Array<{
    id: string;
    amount: number;
    status: "PENDING" | "SUCCESSFUL" | "FAILED";
    date: string;
  }>;
}

interface MetricsSummary {
  tomorrowDate: string;
  summary: {
    totalStudents: number;
    activeSubscribers: number;
    totalRevenue: number;
    wasteSavingsThisMonth: number;
    expectedBreakfast: number;
    expectedLunch: number;
    expectedDinner: number;
  };
  choicesBreakdown: {
    breakfast: { choices: Record<string, number>; skips: number };
    lunch: { choices: Record<string, number>; skips: number };
    dinner: { choices: Record<string, number>; skips: number };
  };
  charts: {
    wastageTrend: Array<{ month: string; wastageRate: number; savings: number }>;
    weeklyAttendance: Array<{ day: string; Breakfast: number; Lunch: number; Dinner: number }>;
    paymentDistribution: Array<{ name: string; value: number; color: string }>;
  };
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "students" | "attendance" | "scan">("overview");

  // State collections
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [students, setStudents] = useState<StudentAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Scanning States
  const [scanInput, setScanInput] = useState("");
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [servingLoading, setServingLoading] = useState(false);
  const [servingFeedback, setServingFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [scansLoading, setScansLoading] = useState(false);

  const fetchRecentScans = async () => {
    setScansLoading(true);
    try {
      const res = await fetch("/api/admin/scans/recent", {
        headers: { "Authorization": `Bearer ${currentUser.id}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentScans(data);
      }
    } catch (err) {
      console.error("Error loading recent scans:", err);
    } finally {
      setScansLoading(false);
    }
  };

  const handleStudentScan = async (userId: string) => {
    if (!userId) return;
    setScanLoading(true);
    setScanError(null);
    setScannedUser(null);
    setServingFeedback(null);
    try {
      const res = await fetch(`/api/admin/scan/${userId}`, {
        headers: { "Authorization": `Bearer ${currentUser.id}` }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to parse student QR code payload");
      }
      const data = await res.json();
      setScannedUser(data);
      setScanInput("");
    } catch (err: any) {
      setScanError(err.message || "Invalid or unrecognized student QR ID.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleConfirmServing = async () => {
    if (!scannedUser) return;
    setServingLoading(true);
    setServingFeedback(null);
    try {
      const res = await fetch("/api/admin/mark-served", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          userId: scannedUser.student.id,
          date: scannedUser.todayDate,
          mealType: scannedUser.activeMeal,
          category: scannedUser.preference.category
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark meal as served");
      }
      setServingFeedback({ text: `Meal token logged successfully! Saved notification dispatched to ${scannedUser.student.name}.`, type: "success" });
      setScannedUser((prev: any) => ({
        ...prev,
        alreadyServed: true,
        verification: "ALREADY_SERVED"
      }));
      fetchRecentScans();
    } catch (err: any) {
      setServingFeedback({ text: err.message || "Error finalizing serving log", type: "error" });
    } finally {
      setServingLoading(false);
    }
  };

  // Attendance Forecast state
  const [forecastData, setForecastData] = useState<{
    forecast: Array<{
      date: string;
      dayName: string;
      formattedDate: string;
      meals: Array<{
        mealType: string;
        absentCount: number;
        presentCount: number;
        absentStudents: Array<{ id: string; name: string; hostelBlock: string; roomNumber: string }>;
      }>;
    }>;
    studentMissedMeals: Array<{
      id: string;
      name: string;
      email: string;
      hostelBlock: string;
      roomNumber: string;
      missedCount: number;
      missedDetails: Array<{ date: string; mealType: string; category: string }>;
    }>;
  } | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");
  const [dietFilter, setDietFilter] = useState("");

  // Menu form config
  const [selectedMenuDate, setSelectedMenuDate] = useState(new Date().toISOString().split("T")[0]);
  const [breakfastDesc, setBreakfastDesc] = useState("");
  const [lunchDesc, setLunchDesc] = useState("");
  const [dinnerDesc, setDinnerDesc] = useState("");
  
  // Menu Category Checkboxes
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuFeedback, setMenuFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, [currentUser, activeTab]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [metricsRes, studentsRes] = await Promise.all([
        fetch("/api/metrics/summary", { headers: { "Authorization": `Bearer ${currentUser.id}` } }),
        fetch("/api/admin/students", { headers: { "Authorization": `Bearer ${currentUser.id}` } })
      ]);

      const metricsData = await metricsRes.json();
      const studentsData = await studentsRes.json();

      setMetrics(metricsData);
      setStudents(studentsData || []);

      // If we are on the attendance tab, load weekly forecast details
      if (activeTab === "attendance") {
        setForecastLoading(true);
        try {
          const forecastRes = await fetch("/api/admin/attendance-forecast", {
            headers: { "Authorization": `Bearer ${currentUser.id}` }
          });
          const forecastJson = await forecastRes.json();
          setForecastData(forecastJson);
        } catch (fErr) {
          console.error("Error loading attendance forecast:", fErr);
        } finally {
          setForecastLoading(false);
        }
      }

      // If we are configuring a menu, backfill descriptions if already exists
      if (metricsData && activeTab === "menu") {
        fetch("/api/menus")
          .then(res => res.json())
          .then((menusList: DailyMenu[]) => {
            const found = menusList.find(m => m.date === selectedMenuDate);
            if (found) {
              setBreakfastDesc(found.breakfastDescription || "");
              setLunchDesc(found.lunchDescription || "");
              setDinnerDesc(found.dinnerDescription || "");
            } else {
              setBreakfastDesc("");
              setLunchDesc("");
              setDinnerDesc("");
            }
          });
      }

      // If we are on the scan tab, load recent scans history
      if (activeTab === "scan") {
        fetchRecentScans();
      }

    } catch (e) {
      console.error("Error fetching admin metrics:", e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger when menu date picker changes
  const handleMenuDateChange = async (dateStr: string) => {
    setSelectedMenuDate(dateStr);
    try {
      const res = await fetch("/api/menus");
      const menusList: DailyMenu[] = await res.json();
      const found = menusList.find(m => m.date === dateStr);
      if (found) {
        setBreakfastDesc(found.breakfastDescription || "");
        setLunchDesc(found.lunchDescription || "");
        setDinnerDesc(found.dinnerDescription || "");
      } else {
        setBreakfastDesc("");
        setLunchDesc("");
        setDinnerDesc("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save/Upload daily menu details
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuSaving(true);
    setMenuFeedback(null);

    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.id}`
        },
        body: JSON.stringify({
          date: selectedMenuDate,
          breakfastDescription: breakfastDesc,
          lunchDescription: lunchDesc,
          dinnerDescription: dinnerDesc,
          breakfastOptions: ["Regular", "North Indian", "South Indian", "Jain"],
          lunchOptions: ["North Indian", "South Indian", "High Protein", "Jain"],
          dinnerOptions: ["Regular", "North Indian", "South Indian", "Special Menu"]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMenuFeedback({ text: `Daily Menu for ${selectedMenuDate} successfully published to student directories!`, type: "success" });
    } catch (err: any) {
      setMenuFeedback({ text: err.message || "Failed to save menu configuration", type: "error" });
    } finally {
      setMenuSaving(false);
    }
  };

  // Filter students based on query
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesHostel = !hostelFilter || (s.profile?.hostelBlock === hostelFilter);
    const matchesDiet = !dietFilter || (s.profile?.messType === dietFilter);

    return matchesSearch && matchesHostel && matchesDiet;
  });

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        <p className="text-xs text-slate-500 font-semibold mt-3 uppercase tracking-wider">Syncing Admin Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Tab select header */}
      <div className="flex bg-white border border-slate-200 p-1.5 rounded-xl max-w-3xl shadow-xs overflow-x-auto gap-1">
        <button
          onClick={() => { setActiveTab("overview"); setMenuFeedback(null); }}
          className={`shrink-0 flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "overview" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview metrics
        </button>
        <button
          onClick={() => { setActiveTab("attendance"); setMenuFeedback(null); }}
          className={`shrink-0 flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "attendance" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Attendance & Absences
        </button>
        <button
          onClick={() => { setActiveTab("menu"); setMenuFeedback(null); }}
          className={`shrink-0 flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "menu" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Daily Menu Config
        </button>
        <button
          onClick={() => { setActiveTab("students"); setMenuFeedback(null); }}
          className={`shrink-0 flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "students" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Student directory
        </button>
        <button
          onClick={() => { setActiveTab("scan"); setMenuFeedback(null); }}
          className={`shrink-0 flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "scan" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>QR Gate Entry</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW METRICS & CHARTS */}
      {activeTab === "overview" && metrics && (
        <div className="space-y-6">
          
          {/* Top Info Stat Widgets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Total Students */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">REGISTERED STUDENTS</span>
              <div className="flex items-baseline justify-between mt-2">
                <h4 className="text-2xl font-black text-slate-900 font-display">
                  {metrics.summary.totalStudents} Students
                </h4>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-none">
                <strong className="text-emerald-600 font-bold">100%</strong> system profile integration
              </p>
            </div>

            {/* expected Breakfast Counts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">BREAKFAST TOMORROW</span>
              <div className="flex items-baseline justify-between mt-2">
                <h4 className="text-2xl font-black text-slate-900 font-display">
                  {metrics.summary.expectedBreakfast} Servings
                </h4>
                <Utensils className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-none">
                {metrics.choicesBreakdown.breakfast.skips} registered opt-outs
              </p>
            </div>

            {/* expected Lunch serving counts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">LUNCH TOMORROW</span>
              <div className="flex items-baseline justify-between mt-2">
                <h4 className="text-2xl font-black text-slate-900 font-display">
                  {metrics.summary.expectedLunch} Servings
                </h4>
                <Utensils className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-none">
                {metrics.choicesBreakdown.lunch.skips} registered opt-outs
              </p>
            </div>

            {/* total cash flow collections */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">TOTAL REVENUE RECORDED</span>
              <div className="flex items-baseline justify-between mt-2">
                <h4 className="text-2xl font-black text-slate-900 font-display">
                  ₹{metrics.summary.totalRevenue.toLocaleString()}
                </h4>
                <DollarSign className="w-5 h-5 text-violet-500" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-none">
                Settle with Razorpay API Gateway
              </p>
            </div>

          </div>

          {/* Core Recharts Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Weekly attendance pattern line chart */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="font-display font-bold text-sm text-slate-900">Weekly Mess Hall Turnout (%)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Estimated turnout by meal period based on historic skip logs</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block"></span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Breakfast</span>
                </div>
              </div>

              <div className="h-68">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.charts.weeklyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="Breakfast" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Lunch" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Dinner" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Payment Distribution status donut representation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900">Payment Reconciliation</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Status of semester fee collections</p>
              </div>

              <div className="h-44 my-4 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.charts.paymentDistribution}
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {metrics.charts.paymentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {metrics.charts.paymentDistribution.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }}></span>
                      <span className="text-slate-500">{item.name}</span>
                    </div>
                    <span className="text-slate-800">{item.value} Seats</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Monthly environmental resource savings bar chart */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <div>
                  <h4 className="font-display font-bold text-sm text-slate-900">Food Wastage Mitigation Trends</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Estimated procurement cost savings (INR) realized through active opt-outs</p>
                </div>
                
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Cost saved: ₹{metrics.summary.wasteSavingsThisMonth} total</span>
                </div>
              </div>

              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.charts.wastageTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="savings" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: MENU PUBLISHING/UPLOADER */}
      {activeTab === "menu" && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h3 className="font-display text-lg font-bold text-slate-950">Daily Mess Menu Publisher</h3>
          </div>

          <form onSubmit={handleSaveMenu} className="space-y-5">
            
            {menuFeedback && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                menuFeedback.type === "success" 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}>
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>{menuFeedback.text}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Target Menu Date
              </label>
              <input
                type="date"
                required
                value={selectedMenuDate}
                onChange={(e) => handleMenuDateChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all block w-full"
              />
              <p className="text-[10px] text-slate-400 mt-1">Select date to load and override existing recipes.</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              
              {/* Breakfast descriptor */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Breakfast Buffer Menu
                </label>
                <textarea
                  required
                  rows={2}
                  value={breakfastDesc}
                  placeholder="e.g. Aloo Paratha with Curd, Hot Tea, Fruit Bowl"
                  onChange={(e) => setBreakfastDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all"
                />
              </div>

              {/* Lunch Descriptor */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Lunch Buffer Menu
                </label>
                <textarea
                  required
                  rows={2}
                  value={lunchDesc}
                  placeholder="e.g. Kadhai Paneer, Yellow Dal, Pulao, Butter Roti, Curd"
                  onChange={(e) => setLunchDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all"
                />
              </div>

              {/* Dinner Descriptor */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Dinner Buffer Menu
                </label>
                <textarea
                  required
                  rows={2}
                  value={dinnerDesc}
                  placeholder="e.g. Malai Kofta, Mix Veg, Steamed Rice, Butter Naan, Sweets"
                  onChange={(e) => setDinnerDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-purple-600 outline-hidden transition-all"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={menuSaving}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {menuSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Publish Daily Menu</span>
                </>
              )}
            </button>

          </form>
        </div>
      )}

      {/* TAB 3: STUDENT DIRECTORY SEARCH/AUDIT */}
      {activeTab === "students" && (
        <div className="space-y-6">
          
          {/* Filtering bar row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                placeholder="Search students by name or email address..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-hidden transition-all"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-3 w-full md:w-auto">
              
              <select
                value={hostelFilter}
                onChange={(e) => setHostelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:bg-white outline-hidden transition-all flex-1 md:flex-initial"
              >
                <option value="">All Hostel Blocks</option>
                <option value="H-1 Boys">Block H-1 (Boys)</option>
                <option value="H-2 Boys">Block H-2 (Boys)</option>
                <option value="G-3 Girls">Block G-3 (Girls)</option>
                <option value="G-4 Girls">Block G-4 (Girls)</option>
                <option value="International Block">International Block</option>
              </select>

              <select
                value={dietFilter}
                onChange={(e) => setDietFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:bg-white outline-hidden transition-all flex-1 md:flex-initial"
              >
                <option value="">All Diets</option>
                <option value="VEG">Standard Vegetarian</option>
                <option value="NON_VEG">Non-Veg diet</option>
                <option value="SPECIAL">Special diet</option>
              </select>

            </div>

          </div>

          {/* Student list bento grid */}
          {filteredStudents.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold text-sm">No match found.</p>
              <p className="text-xs text-slate-400 mt-1">Try clarifying filters or typing general search words.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredStudents.map((student) => {
                const totalAmountPaid = student.payments
                  .filter(p => p.status === "SUCCESSFUL")
                  .reduce((sum, p) => sum + p.amount, 0);

                const hasOutstandingFee = student.payments.length === 0 || !student.payments.some(p => p.status === "SUCCESSFUL");

                return (
                  <div key={student.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    
                    {/* Top User card block */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm font-display">{student.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{student.email}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        hasOutstandingFee ? "bg-rose-50 text-rose-800 animate-pulse" : "bg-emerald-50 text-emerald-800"
                      }`}>
                        {hasOutstandingFee ? "FEES UNPAID" : "PAID"}
                      </span>
                    </div>

                    {/* Room Block details */}
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-50">
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">HOSTEL</span>
                        <span className="text-xs font-extrabold text-slate-800 truncate block mt-0.5">
                          {student.profile?.hostelBlock || "Unset"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">ROOM</span>
                        <span className="text-xs font-extrabold text-slate-800 truncate block mt-0.5">
                          {student.profile?.roomNumber || "Unset"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">DIET TYPE</span>
                        <span className="text-xs font-extrabold text-slate-800 truncate block mt-0.5">
                          {student.profile?.messType || "Unset"}
                        </span>
                      </div>
                    </div>

                    {/* Ledger audit trail */}
                    <div className="pt-2 flex justify-between items-center text-xs font-semibold text-slate-500">
                      <span>Total Fees Settle</span>
                      <strong className="text-slate-800">₹{totalAmountPaid.toLocaleString()}</strong>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* TAB 1.2: WEEKLY FORECASTS & ABSENTEE REPORTING */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-950 font-display">Weekly Attendance Projections</h3>
            <p className="text-xs text-slate-500 mt-0.5">Forecasted meal production demand metrics and comprehensive student absence records for Amity AUR.</p>
          </div>

          {forecastLoading && !forecastData ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
              <p className="text-xs text-slate-500 font-semibold mt-3 uppercase">Compiling Student Vacation Schedules...</p>
            </div>
          ) : forecastData ? (
            <div className="space-y-8 animate-fade-in">
              
              {/* NEXT 7 DAYS PRODUCTION FORECAST GRID */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Next 7 Days Meal Production Forecast</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {forecastData.forecast.map((dayObj: any) => (
                    <div key={dayObj.date} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
                      <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm font-display">{dayObj.dayName}</h5>
                          <span className="text-[11px] text-slate-400 font-bold">{dayObj.formattedDate}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2 py-0.5 rounded">
                          AUR Mess
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {dayObj.meals.map((m: any) => (
                          <div key={m.mealType} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                {m.mealType.toLowerCase()}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {m.presentCount} Present
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden mr-3">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full" 
                                  style={{ width: `${(m.presentCount / (m.presentCount + m.absentCount || 1)) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-black text-rose-600 shrink-0">
                                {m.absentCount} Absent
                              </span>
                            </div>

                            {m.absentStudents && m.absentStudents.length > 0 && (
                              <details className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                                <summary className="font-bold cursor-pointer hover:text-slate-800 list-none flex items-center justify-between">
                                  <span>View Absentees ({m.absentStudents.length})</span>
                                  <ChevronRight className="w-3 h-3 transition-transform rotate-90" />
                                </summary>
                                <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto divide-y divide-slate-100/60 pt-1">
                                  {m.absentStudents.map((abs: any) => (
                                    <div key={abs.id} className="text-[9px] py-1 flex justify-between">
                                      <span className="font-extrabold text-slate-700">{abs.name}</span>
                                      <span className="text-slate-400">Hostel {abs.hostelBlock} - Room {abs.roomNumber}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* STUDENT MISSED MEALS COMPREHENSIVE AUDIT LIST */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Student Absenteeism & Missed Meals Ledger</span>
                  </h4>
                  <span className="text-xs text-slate-400 font-semibold">
                    Cumulative missed meal counts per student (Historical tracker)
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-black tracking-wider">
                          <th className="py-3.5 px-6">Student Information</th>
                          <th className="py-3.5 px-6">AUR Hostel Allocation</th>
                          <th className="py-3.5 px-6 text-center">Meals Skipped / Missed</th>
                          <th className="py-3.5 px-6">Latest Skips Detail log</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-semibold text-slate-700 divide-y divide-slate-100">
                        {forecastData.studentMissedMeals.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-4 px-6">
                              <p className="font-bold text-slate-800 text-sm font-display">{s.name}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{s.email}</p>
                            </td>
                            <td className="py-4 px-6 text-slate-500">
                              <p className="text-slate-700 font-extrabold">{s.hostelBlock}</p>
                              <p className="text-[10px]">Room {s.roomNumber}</p>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                                s.missedCount >= 10 
                                  ? "bg-rose-50 text-rose-700 border border-rose-100" 
                                  : s.missedCount >= 5 
                                    ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              }`}>
                                {s.missedCount} Missed
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              {s.missedDetails && s.missedDetails.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-w-sm">
                                  {s.missedDetails.slice(0, 4).map((det: any, idx: number) => (
                                    <span key={idx} className="text-[9px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                                      {new Date(det.date).toLocaleDateString([], { month: "short", day: "numeric" })} - {det.mealType.toLowerCase()}
                                    </span>
                                  ))}
                                  {s.missedDetails.length > 4 && (
                                    <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded">
                                      +{s.missedDetails.length - 4} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic font-medium">Perfect Attendance (0 Skips)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <p className="text-slate-500 font-bold text-xs">Failed to load attendance projections.</p>
            </div>
          )}

        </div>
      )}

      {/* TAB 1.3: QR SCANNING GATE ENTRANCE TERMINAL */}
      {activeTab === "scan" && (
        <div className="space-y-6 animate-fade-in text-left">
          <div>
            <h3 className="text-lg font-bold text-slate-950 font-display flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <span>Amity Gate Entry & Attendance Terminal</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify student identity, check daily meal skip statuses, and log token-serving entries to reduce wastage.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Scanner Controller & Lookup */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  Secure Scanner Inputs
                </label>
                <p className="text-xs text-slate-500 leading-normal">
                  Type a Student's ID or scan payload (e.g. <code className="bg-slate-100 font-mono text-slate-700 px-1 rounded">student-1</code>), or search for student records.
                </p>
              </div>

              {/* Lookup form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStudentScan(scanInput.trim());
                }}
                className="space-y-3"
              >
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="student-1, priya@amity.edu, Rahul..."
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={scanLoading || !scanInput.trim()}
                  className="w-full bg-slate-950 hover:bg-slate-900 disabled:bg-slate-100 text-white disabled:text-slate-400 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex justify-center items-center gap-2"
                >
                  {scanLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Verify Student QR Pass</span>
                </button>
              </form>

              {/* Quick Testing Shortcuts */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Quick-Scan Simulation shortcuts
                </span>
                <div className="space-y-1.5">
                  <button
                    onClick={() => handleStudentScan("student-1")}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg p-2 flex items-center justify-between text-left text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-extrabold text-slate-800">Piyush Gautam</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: student-1 (Paid Sub)</p>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">SCAN</span>
                  </button>

                  <button
                    onClick={() => handleStudentScan("student-2")}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg p-2 flex items-center justify-between text-left text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-extrabold text-slate-800">Priya Singh</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: student-2 (Vegetarian)</p>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">SCAN</span>
                  </button>

                  <button
                    onClick={() => handleStudentScan("student-3")}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-lg p-2 flex items-center justify-between text-left text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-extrabold text-slate-800">Rahul Sharma</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: student-3 (Pending Fees)</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold">SCAN</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Middle Column: Current Scan Outcome */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* If empty */}
              {!scannedUser && !scanError && !scanLoading && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3.5">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="max-w-xs mx-auto">
                    <p className="text-sm font-bold text-slate-700">Awaiting QR scan...</p>
                    <p className="text-xs text-slate-400 leading-normal mt-1">
                      Ready at the main dining entrance. Trigger a simulated student scan from the shortcuts or search for an ID.
                    </p>
                  </div>
                </div>
              )}

              {/* If loading */}
              {scanLoading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3.5">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Retrieving Amity Database records...</p>
                </div>
              )}

              {/* If error */}
              {scanError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex gap-3.5 text-left">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-800">Incorrect Credentials / Unrecognized ID</h4>
                    <p className="text-xs text-red-700 mt-1 leading-normal">
                      The scanned payload does not correspond to a valid student identity record in our Amity AUR directories.
                    </p>
                    <button
                      onClick={() => setScanError(null)}
                      className="mt-3 text-[11px] font-bold text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Scanner
                    </button>
                  </div>
                </div>
              )}

              {/* Scanned user presentation */}
              {scannedUser && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 text-left animate-fade-in">
                  
                  {/* Verification Banner */}
                  {(() => {
                    const ver = scannedUser.verification;
                    if (ver === "VERIFIED") {
                      return (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black text-emerald-950 uppercase tracking-tight">🟢 ACCESS GRANTED</p>
                            <p className="text-xs text-emerald-700 mt-1 font-semibold leading-relaxed">
                              This student is fully registered, verified active, and has not skipped this meal period.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    if (ver === "SKIPPED") {
                      return (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black text-amber-950 uppercase tracking-tight">⛔ REFUSE SERVICE - MEAL SKIPPED</p>
                            <p className="text-xs text-amber-700 mt-1 font-semibold leading-relaxed">
                              Student opted out of today's {scannedUser.activeMeal} to prevent food waste. DO NOT SERVE!
                            </p>
                          </div>
                        </div>
                      );
                    }
                    if (ver === "UNPAID") {
                      return (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black text-rose-950 uppercase tracking-tight">❌ ACCESS REFUSED - UNPAID FEES</p>
                            <p className="text-xs text-rose-700 mt-1 font-semibold leading-relaxed">
                              Semester mess hall subscription fee has not been paid. Settle account first.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    if (ver === "ALREADY_SERVED") {
                      return (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black text-slate-950 uppercase tracking-tight">⚠️ DUPLICATE ENTRY - ALREADY SERVED</p>
                            <p className="text-xs text-slate-600 mt-1 font-semibold leading-relaxed">
                              This student has already scanned and been served today's {scannedUser.activeMeal} period.
                            </p>
                          </div>
                        </div>
                      );
                    }
                  })()}

                  {/* Student profile details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-6">
                    <div className="space-y-4">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Student details</span>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-900 text-white font-black rounded-xl flex items-center justify-center text-lg shadow-sm">
                          {scannedUser.student.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 font-display">{scannedUser.student.name}</h4>
                          <p className="text-xs text-slate-400 font-mono">{scannedUser.student.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Hostel Allocation</span>
                        <p className="text-xs font-black text-slate-800 mt-1 uppercase">{scannedUser.student.hostelBlock}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Room {scannedUser.student.roomNumber}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Preferred Diet</span>
                        <p className="text-xs font-black text-slate-800 mt-1 uppercase">{scannedUser.student.messType}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meal Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Active Scan period</span>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{scannedUser.activeMeal}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Today's menu</span>
                      <p className="text-xs text-slate-600 font-semibold mt-0.5 leading-tight">{scannedUser.menuDescription}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Student Choice</span>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{scannedUser.preference.category}</p>
                    </div>
                  </div>

                  {/* Serving Controls */}
                  {servingFeedback && (
                    <div className={`p-3 rounded-lg text-xs font-bold ${
                      servingFeedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}>
                      {servingFeedback.text}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setScannedUser(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      Clear Screen
                    </button>
                    {scannedUser.verification === "VERIFIED" && (
                      <button
                        onClick={handleConfirmServing}
                        disabled={servingLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-100 text-white disabled:text-emerald-300 font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      >
                        {servingLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Mark Meal as Served</span>
                      </button>
                    )}
                  </div>

                </div>
              )}

              {/* RECENT SCAN LOGS FEED */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Live Entrance Check-In Feed
                    </h4>
                  </div>
                  <button
                    onClick={fetchRecentScans}
                    disabled={scansLoading}
                    className="text-[11px] text-emerald-600 font-bold hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${scansLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {scansLoading && recentScans.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Loading scan log history...
                    </div>
                  ) : recentScans.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No student servings scanned yet today.
                    </div>
                  ) : (
                    recentScans.map((scan: any) => (
                      <div key={scan.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                            {scan.studentName.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-extrabold text-slate-900 text-xs leading-none">{scan.studentName}</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                              Hostel {scan.hostelBlock} • Room {scan.roomNumber}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div className="space-y-0.5">
                            <span className="text-[9px] bg-slate-100 text-slate-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {scan.mealType}
                            </span>
                            <p className="text-[9px] text-slate-400 font-medium">{scan.category}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-600 font-bold block">🟢 SERVED</span>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {new Date(scan.servedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
