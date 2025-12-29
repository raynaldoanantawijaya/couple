"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); // treating "Admin" as the email/username input
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (email === "raynaldoanantawijaya180@gmail.com" && password === "yeamplow12345") ||
      (email === "shafrina77@gmail.com" && password === "abogoboga12345")
    ) {
      // Set a simple cookie or local storage to simulate auth
      document.cookie = "auth=true; path=/";
      router.push("/beranda");
    } else {
      setError("Email atau kata sandi salah.");
    }
  };

  return (
    <main className="flex-1 flex w-full relative h-screen max-h-screen overflow-hidden">
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col justify-center items-center relative z-10 bg-background-light dark:bg-background-dark p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md flex flex-col gap-8 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Selamat Datang Kembali
            </h1>
            <p className="text-slate-500 dark:text-text-muted text-base md:text-lg">
              Lanjutkan kisah cinta kalian hari ini.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-slate-900 dark:text-white text-sm font-semibold">
                Email / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-text-muted">
                  <span className="material-symbols-outlined text-xl">mail</span>
                </div>
                <input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input block w-full pl-10 pr-4 py-3.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-muted focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                  placeholder="masukkan.email@anda.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-slate-900 dark:text-white text-sm font-semibold">
                  Kata Sandi
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-text-muted">
                  <span className="material-symbols-outlined text-xl">lock</span>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input block w-full pl-10 pr-12 py-3.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-muted focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-text-muted hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-semibold">{error}</div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-bold rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 shadow-lg shadow-primary/30"
              >
                Masuk
                <span className="absolute right-4 inset-y-0 flex items-center transition-transform group-hover:translate-x-1">
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="hidden lg:block lg:w-1/2 xl:w-[55%] relative">
        <div className="absolute inset-0 bg-gradient-to-r from-background-light dark:from-background-dark via-transparent to-transparent z-10 w-24 h-full"></div>
        <div className="absolute inset-0 bg-primary/20 z-10 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxgczmtWhfaGzuTVSXZgTiP1dkCyrNTo0Vu63eT59dEz4lBieqK21x2uC2izYJs7ndPKzf2YOiYwNKUMyEDTAvVEgeR8wI3CliZJB66u4tq503F2AGeLE3hPu4DKRFHlhVANQeplLlhz_R6bfL20tFXAlpfvVSX4n3gPoVcicbDFGJw8uN3tiKdkTWqU2mqGnmdoBJb-71zZCQR1KTzfnpuTqislv5Q7rKc4cbTRNcibYUhp06WHj3pFJPHwu8bqsNgfbTl7Ofbps"
          alt="Couple holding hands watching sunset on a beach"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 p-12 z-20 text-white">
          <blockquote className="max-w-lg">
            <p className="text-2xl font-bold leading-relaxed mb-4">
              &quot;Cinta tidak terdiri dari saling memandang, tetapi memandang bersama ke arah yang sama.&quot;
            </p>
            <footer className="flex items-center gap-4">
              <div className="h-px w-12 bg-primary"></div>
              <cite className="not-italic font-medium text-white/90">
                Antoine de Saint-Exupéry
              </cite>
            </footer>
          </blockquote>
        </div>
      </div>
    </main>
  );
}
