import React, { useState, useEffect } from "react";
import { 
  Utensils, 
  Shield, 
  LogOut, 
  User as UserIcon, 
  Home, 
  AlertCircle, 
  Bell, 
  Sparkle,
  Layers,
  CheckCircle,
  HelpCircle,
  Activity,
  Menu,
  X
} from "lucide-react";
import { User, StudentProfile, Notification } from "./types";
// @ts-ignore
import amityLogo from "./assets/images/amity_logo_1783536358135.jpg";
import AuthScreen from "./components/AuthScreen";
import StudentDashboard from "./components/StudentDashboard";
import AdminDashboard from "./components/AdminDashboard";

interface ApiStatus {
  status: string;
  timestamp: string;
  system: string;
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"dashboard">("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Fetch baseline api health
  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("API Offline");
        return res.json();
      })
      .then((data: ApiStatus) => {
        setApiStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching health status:", err);
        setLoading(false);
      });

    // Restore session if exists
    const storedUser = localStorage.getItem("aur_session_user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser) as User;
        setCurrentUser(u);
      } catch (e) {
        console.error("Failed to parse stored session user", e);
      }
    }
  }, []);

  // Fetch current user profile details & notifications
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setNotifications([]);
      return;
    }

    // Fetch Profile
    fetch("/api/profiles/me", {
      headers: {
        "Authorization": `Bearer ${currentUser.id}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile);
        }
      })
      .catch(err => console.error("Error fetching profile:", err));

    // Fetch Notifications
    fetch("/api/notifications", {
      headers: {
        "Authorization": `Bearer ${currentUser.id}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(err => console.error("Error fetching notifications:", err));

  }, [currentUser]);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("aur_session_user");
    setCurrentUser(null);
    setProfile(null);
    setNotifications([]);
    setActiveView("dashboard");
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (!currentUser) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentUser.id}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleProfileUpdate = (updatedProfile: StudentProfile) => {
    setProfile(updatedProfile);
  };

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <h4 className="text-sm font-bold text-slate-800 mt-4 uppercase tracking-widest font-mono">Amity AUR Gateway...</h4>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased">
      
      {/* Top Professional Navigation Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <img 
            src={amityLogo}
            alt="Amity University Rajasthan Logo"
            className="h-10 w-auto object-contain bg-white rounded-lg px-1.5 py-0.5 border border-slate-100 shadow-2xs"
            referrerPolicy="no-referrer"
          />
          <div className="hidden xs:block border-l border-slate-200 h-6"></div>
          <div>
            <h1 className="text-sm font-black text-slate-950 font-display tracking-tight leading-none">Amity AUR</h1>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest mt-0.5">MESS PORTAL</span>
          </div>
        </div>

        {/* Action controls / session */}
        <div className="flex items-center gap-4">
          
          {/* Live system health status badge */}
          {apiStatus && (
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/50">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>AUR CLOUD SYSTEM ACTIVE</span>
            </span>
          )}

          {currentUser && (
            <>
              {/* Notifications Alert Bell Panel Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer relative"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                      {unreadNotifsCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Box */}
                {showNotificationsDropdown && (
                  <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-2 z-50 animate-fade-in text-xs max-h-96 overflow-y-auto">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                      <strong className="text-slate-900 font-display">System Alerts</strong>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{unreadNotifsCount} New</span>
                    </div>

                    {notifications.length === 0 ? (
                      <p className="text-center py-8 text-slate-400 font-medium italic">No recent alerts found.</p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left space-y-1 ${
                              !n.isRead ? "bg-blue-50/20" : ""
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-slate-900">{n.title}</span>
                              {!n.isRead && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0 mt-1"></span>}
                            </div>
                            <p className="text-slate-500 text-[11px] leading-relaxed">{n.message}</p>
                            <span className="text-[9px] text-slate-400 font-medium block pt-1">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Logged in User Tag and Logout */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 p-1.5 rounded-xl">
                <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs uppercase shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left pr-2">
                  <span className="text-[11px] font-black text-slate-900 block leading-tight">{currentUser.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{currentUser.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

        </div>
      </header>

      {/* Main Container Layout */}
      {!currentUser ? (
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        </main>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto px-6 py-8 gap-8">
          
          {/* LEFT COLUMN: NAVIGATION RAIL */}
          <aside className="w-full md:w-64 shrink-0 space-y-6">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2.5">
              
              <button
                onClick={() => setActiveView("dashboard")}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold bg-slate-950 text-white shadow-md rounded-xl cursor-pointer text-left"
              >
                <Home className="w-4 h-4" />
                <span>My Dashboard Portal</span>
              </button>

            </div>

            {/* Quick Profile Overview Info Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
              <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">Active Workspace</h4>
              
              <div className="space-y-2 text-xs leading-relaxed text-slate-500">
                <p>
                  <strong>University:</strong> Amity University Jaipur (Rajasthan)
                </p>
                <p>
                  <strong>Role Authorized:</strong> <span className="font-bold text-slate-800">{currentUser.role}</span>
                </p>
                {currentUser.role === "STUDENT" && profile && (
                  <>
                    <p>
                      <strong>Hostel:</strong> {profile.hostelBlock || "Unassigned"}
                    </p>
                    <p>
                      <strong>Room:</strong> {profile.roomNumber || "Unassigned"}
                    </p>
                  </>
                )}
              </div>
            </div>

          </aside>

          {/* RIGHT COLUMN: CORE DASHBOARD CONTENT STAGE */}
          <main className="flex-1 min-w-0">
            
            {activeView === "dashboard" && (
              currentUser.role === "STUDENT" ? (
                <StudentDashboard 
                  currentUser={currentUser} 
                  profile={profile} 
                  onProfileUpdate={handleProfileUpdate} 
                />
              ) : (
                <AdminDashboard currentUser={currentUser} />
              )
            )}

          </main>

        </div>
      )}

      {/* Humble Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200/60 bg-white text-center text-[11px] text-slate-400 font-semibold font-mono">
        <p>© 2026 AMITY UNIVERSITY RAJASTHAN • INTEGRATED ECO-FRIENDLY KITCHEN MANAGEMENT PLATFORM</p>
      </footer>

    </div>
  );
}
