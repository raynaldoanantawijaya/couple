"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (email === "raynaldoanantawijaya180@gmail.com" && password === "yeamplow12345") ||
      (email === "shafrina77@gmail.com" && password === "abogoboga12345")
    ) {
      document.cookie = "auth=true; path=/";
      localStorage.setItem("auth_session", JSON.stringify({
        isLoggedIn: true,
        loginTime: Date.now()
      }));
      router.push("/beranda");
    } else {
      setError("Email atau kata sandi salah.");
    }
  };

  return (
    <main className="flex-1 flex w-full relative h-screen max-h-screen overflow-hidden bg-slate-900 selection:bg-rose-500/30 selection:text-rose-200">

      {/* Animated Aurora Background */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-rose-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10 animate-pulse"></div>
      </div>

      {/* Love Rain Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute -top-10 animate-fall text-rose-500/20"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${5 + Math.random() * 10}s`,
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${10 + Math.random() * 20}px`,
            }}
          >
            <span className="material-symbols-outlined">favorite</span>
          </div>
        ))}
      </div>

      <div className="w-full flex flex-col justify-center items-center relative z-10 p-4 sm:p-6">
        <div className="w-full max-w-[400px] glass-card-premium p-8 sm:p-10 rounded-[2rem] animate-in fade-in zoom-in duration-700 sm:border sm:border-white/10">

          <div className="mb-10 text-center relative">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 bg-rose-500/20 blur-2xl rounded-full pointer-events-none"></div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2 relative">
              Our Space
            </h1>
            <p className="text-slate-400 text-sm tracking-wide font-medium">
              Start your journey together.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-slate-300 text-[10px] font-bold uppercase tracking-widest ml-1">
                Email
              </label>
              <div className="relative group">
                <input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:ring-0 focus:border-rose-500/50 focus:bg-white/10 transition-all duration-300 outline-none backdrop-blur-md text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-slate-300 text-[10px] font-bold uppercase tracking-widest ml-1">
                Password
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:ring-0 focus:border-rose-500/50 focus:bg-white/10 transition-all duration-300 outline-none backdrop-blur-md text-sm pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-4 w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-lg shadow-rose-500/20 transition-all duration-300 transform active:scale-[0.98]"
            >
              Sign In
            </button>
          </form>
        </div>

        <div className="mt-8 text-center max-w-sm mx-auto">
          <p className="text-white/60 text-sm font-light italic tracking-wide">
            &quot;Every love story is beautiful, but ours is my favorite.&quot;
          </p>
        </div>
      </div>
    </main>
  );
}
