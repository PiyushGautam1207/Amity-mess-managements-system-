import React, { useState } from "react";
import { User, UserRole } from "../types";
// @ts-ignore
import amityLogo from "../assets/images/amity_logo_1783536358135.jpg";
import { Shield, Mail, User as UserIcon, LogIn, UserPlus, AlertCircle, RefreshCw, Lock } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [adminSecret, setAdminSecret] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = isLogin ? "/api/auth/login" : "/api/auth/register";
    const body = isLogin 
      ? { email, password } 
      : { email, name, role, adminSecret, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred during authentication");
      }

      // Success
      localStorage.setItem("aur_session_user", JSON.stringify(data.user));
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Failed to connect to authentication server");
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill quick test accounts for convenience
  const handleQuickLogin = async (testEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: "password123" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }
      localStorage.setItem("aur_session_user", JSON.stringify(data.user));
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600"></div>
      
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-lg p-6 sm:p-8 relative overflow-hidden">
        
        {/* Decorative ambient blobs */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-purple-500/5 rounded-full blur-xl"></div>
        
        {/* Brand Banner */}
        <div className="text-center mb-6 relative z-10">
          <img 
            src={amityLogo}
            alt="Amity University Rajasthan"
            className="h-16 mx-auto mb-4 object-contain bg-white rounded-xl px-3.5 py-1.5 border border-slate-100 shadow-xs"
            referrerPolicy="no-referrer"
          />
          <h2 className="font-display font-bold text-xl tracking-tight text-slate-900 leading-tight">
            Amity University Rajasthan
          </h2>
          <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase mt-1">
            AUR Mess Management Portal
          </p>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(null); setPassword(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isLogin 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(null); setPassword(""); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isLogin 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Account</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Access Denied:</span> {error}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Piyush Gautam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Amity Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="e.g. student@amity.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                minLength={6}
                placeholder={isLogin ? "••••••••" : "Create password (min 6 chars)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("STUDENT")}
                  className={`border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    role === "STUDENT"
                      ? "border-blue-600 bg-blue-50/30 text-blue-900 font-bold"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="text-xs">Student Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("ADMIN")}
                  className={`border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    role === "ADMIN"
                      ? "border-blue-600 bg-blue-50/30 text-blue-900 font-bold"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Administrator</span>
                </button>
              </div>
            </div>
          )}

          {!isLogin && role === "ADMIN" && (
            <div className="pt-2 animate-fade-in">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Admin Registration Secret</span>
                <span className="text-[10px] text-slate-400 font-semibold normal-case">Contact kitchen Lead</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Shield className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Enter secret passcode to authorize admin privileges"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-hidden"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl py-2.5 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Dashboard</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create AUR Account</span>
              </>
            )}
          </button>
        </form>

        {/* SANDBOX QUICK DEMO ACCOUNTS */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200/85"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-bold tracking-wider text-[9px]">
              Or Quick Sandbox Access
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleQuickLogin("student@amity.edu")}
            disabled={loading}
            className="border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/10 rounded-xl p-3 text-left transition-all cursor-pointer group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                STUDENT
              </span>
              <span className="text-[9px] text-slate-400 font-mono">pass: password123</span>
            </div>
            <p className="text-xs font-black text-slate-800 group-hover:text-blue-900 transition-colors">
              Piyush Gautam
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">student@amity.edu</p>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("admin@amity.edu")}
            disabled={loading}
            className="border border-slate-200/80 hover:border-emerald-600 hover:bg-emerald-50/10 rounded-xl p-3 text-left transition-all cursor-pointer group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                ADMINISTRATOR
              </span>
              <span className="text-[9px] text-slate-400 font-mono">pass: password123</span>
            </div>
            <p className="text-xs font-black text-slate-800 group-hover:text-emerald-900 transition-colors">
              Prof. Anil Sharma
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">admin@amity.edu</p>
          </button>
        </div>

      </div>
    </div>
  );
}
