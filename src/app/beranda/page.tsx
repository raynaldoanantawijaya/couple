"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Interfaces
interface Project {
    id: string;
    title: string;
    description: string;
    deadline: string;
    isPriority: boolean;
    status: string;
    category?: string;
    cost?: number;
}

interface GalleryItem {
    title: string;
    date: string;
    tag: string;
    img: string;
}

interface VideoItem {
    title: string;
    date: string;
    duration: string;
    tag: string;
    img: string;
    videoUrl?: string;
}

interface Transaction {
    amount: number;
    contributor: "Kamu" | "Pasangan";
    type: "in" | "out";
    goalId?: string;
}

// Goals Interface
interface SavingsGoal {
    id: string;
    title: string;
    targetAmount: number;
}

export default function BerandaPage() {
    // State
    const [visi, setVisi] = useState("");
    const [misi, setMisi] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);

    // Savings State
    const [savingsTransactions, setSavingsTransactions] = useState<Transaction[]>([]);
    const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Fetch Visi
        const fetchVisi = async () => {
            try {
                const docRef = doc(db, "content", "visi_misi");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setVisi(docSnap.data().visi || "");
                    setMisi(docSnap.data().misi || "");
                } else {
                    setVisi("Membangun hubungan yang bertumbuh...");
                    setMisi("Saling mendukung, berkomunikasi dengan baik...");
                }
            } catch (e) { console.error("Error fetching visi", e); }
        };
        fetchVisi();

        // 2. Fetch Projects
        const qProjects = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const unsubProjects = onSnapshot(qProjects, (snapshot) => {
            const allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
            // Priority Sort
            const sorted = allProjects.sort((a, b) => {
                if (a.isPriority === b.isPriority) return 0;
                return a.isPriority ? -1 : 1;
            });
            setProjects(sorted.slice(0, 3));
        });

        // 3. Fetch Savings Data (Multi-Goal)
        const qGoals = query(collection(db, "savings_goals"));
        const unsubGoals = onSnapshot(qGoals, (snapshot) => {
            const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavingsGoal[];
            setSavingsGoals(goals);
        });

        const qSavings = query(collection(db, "savings_transactions"));
        const unsubSavings = onSnapshot(qSavings, (snapshot) => {
            const trans = snapshot.docs.map(doc => doc.data()) as Transaction[];
            setSavingsTransactions(trans);
        });

        // 4. LocalStorage Assets
        const loadLocalAssets = () => {
            const localGallery = localStorage.getItem("uploaded_gallery_items");
            if (localGallery) {
                try {
                    const parsed: GalleryItem[] = JSON.parse(localGallery);
                    setGalleryItems(parsed.slice(0, 2));
                } catch (e) { }
            }
            const localVideo = localStorage.getItem("uploaded_video_items");
            if (localVideo) {
                try {
                    const parsed: VideoItem[] = JSON.parse(localVideo);
                    setVideoItems(parsed.slice(0, 1));
                } catch (e) { }
            }
        };
        loadLocalAssets();
        setIsLoading(false);

        return () => {
            unsubProjects();
            unsubGoals();
            unsubSavings();
        };
    }, []);

    const savingsStats = useMemo(() => {
        const totalSaved = savingsTransactions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const totalTarget = savingsGoals.reduce((acc, curr) => acc + (Number(curr.targetAmount) || 0), 0);
        const progress = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;
        return { total: totalSaved, target: totalTarget, progress };
    }, [savingsTransactions, savingsGoals]);

    const formatRupiah = (value: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-x-hidden min-h-screen flex flex-col">

            <main className="flex-grow w-full max-w-[1440px] mx-auto flex flex-col items-center">
                <section className="w-full px-6 md:px-10 lg:px-40 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
                        {/* Hero Card */}
                        <div className="md:col-span-12 relative w-full h-[280px] md:h-[320px] rounded-3xl overflow-hidden shadow-xl group">
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                                style={{
                                    backgroundImage:
                                        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD8xrHpmhfXCo1oZqSBz7ikLdQg0-D96wM7mpIotB66K28Wubizy8kMXgLlEeA-YB0w38tKRzofoBkvatWS6CC7N6CqxEtKYiinr2nSASjSG4_zjijtVhZxHbq_0DeSglrxm2uMuNyubMOv3soXxfd6FUDjgpbe5etVsGSaMGk9K9aWkUH3njDMbUArmNhRkhNdAYYR1TuDB4ZplGrMFpO0RhtxF7PlQYEzeoRNlSWANKwawnfk4IT-_3Jfp6smjRc0vgybPkmi5_o")',
                                }}
                            ></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
                            <div className="relative z-10 h-full flex flex-col justify-center p-8 md:p-12 max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 w-fit mb-4">
                                    <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
                                    <span className="text-xs font-semibold text-white">Day 1 Together</span>
                                </div>
                                <h1 className="text-white text-3xl md:text-5xl font-bold leading-tight mb-4">
                                    Selamat Datang di <br /> <span className="text-primary">Rumah Digital Kita</span>
                                </h1>
                                <p className="text-slate-200 text-lg font-light mb-6 line-clamp-2">
                                    Tempat kita merangkai mimpi, menyimpan kenangan manis, dan merencanakan masa depan yang indah bersama.
                                </p>
                                <div className="flex gap-3">
                                    <Link href="/gallery" className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-primary/30 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">add_a_photo</span>
                                        Upload Kenangan
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Visi Kita / Proyek Bersama */}
                        <div className="md:col-span-4 flex flex-col gap-6">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">volunteer_activism</span>
                                        Visi &amp; Misi
                                    </h3>
                                    <Link href="/visi-misi" className="text-xs font-bold text-primary hover:underline">
                                        Detail
                                    </Link>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Visi</p>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-2 italic">
                                            &quot;{visi || "Belum ada visi yang ditulis."}&quot;
                                        </p>
                                    </div>
                                    <div className="w-full h-px bg-slate-100 dark:bg-white/5"></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Misi</p>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-2">
                                            {misi || "Belum ada misi yang ditulis."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs border border-blue-200 dark:border-blue-800" title="Komunikasi">
                                        <span className="material-symbols-outlined text-sm">chat</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-xs border border-green-200 dark:border-green-800" title="Growth">
                                        <span className="material-symbols-outlined text-sm">trending_up</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center text-xs border border-purple-200 dark:border-purple-800" title="Spiritual">
                                        <span className="material-symbols-outlined text-sm">spa</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-yellow-500">sticky_note_2</span>
                                        Proyek Bersama
                                    </h3>
                                    <Link href="/project" className="text-slate-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </Link>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {projects.length === 0 ? (
                                        <div className="text-center py-4 text-slate-400 text-sm">Belum ada project aktif.</div>
                                    ) : (
                                        projects.map(proj => (
                                            <div key={proj.id} className="flex items-start gap-3 group cursor-pointer" onClick={() => window.location.href = `/project/${proj.id}`}>
                                                <div className={`mt-0.5 size-5 rounded border-2 flex items-center justify-center transition-colors ${proj.status === 'Selesai'
                                                    ? 'border-primary bg-primary text-white'
                                                    : 'border-slate-300 dark:border-slate-600 group-hover:border-primary'
                                                    }`}>
                                                    {proj.status === 'Selesai' && <span className="material-symbols-outlined text-xs">check</span>}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors ${proj.status === 'Selesai' ? 'line-through opacity-60' : ''}`}>
                                                        {proj.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500">Deadline: {proj.deadline}</p>
                                                </div>
                                                {proj.isPriority && (
                                                    <span className="material-symbols-outlined text-yellow-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <Link href="/project" className="text-xs text-center text-primary mt-4 hover:underline">Lihat Semua Project</Link>
                            </div>
                        </div>

                        {/* Video & Galeri & Tabungan */}
                        <div className="md:col-span-5 flex flex-col gap-6">
                            {/* Video Partial */}
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-4">
                                <div className="flex items-center justify-between mb-3 px-2">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Video Kenangan</h3>
                                    <Link href="/video" className="text-xs font-medium text-slate-500 hover:text-primary">Lihat Semua</Link>
                                </div>
                                {videoItems.length > 0 ? (
                                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden group cursor-pointer shadow-inner"
                                        onClick={() => videoItems[0].videoUrl && window.open(videoItems[0].videoUrl, '_blank')}
                                    >
                                        <img
                                            src={videoItems[0].img}
                                            alt={videoItems[0].title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                                        />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="size-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-white text-3xl fill-current">play_arrow</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-bold truncate px-2 drop-shadow-md">
                                            {videoItems[0].title}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-video rounded-2xl bg-slate-100 dark:bg-black/20 flex items-center justify-center text-slate-400 text-sm">
                                        Belum ada video.
                                    </div>
                                )}
                            </div>

                            {/* Galeri Partial */}
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Galeri Foto</h3>
                                    <Link href="/gallery" className="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors">
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {galleryItems.length > 0 ? (
                                        galleryItems.map((item, idx) => (
                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group">
                                                <img src={item.img} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center text-slate-400 text-sm py-8 bg-slate-50 dark:bg-black/20 rounded-xl">
                                            Belum ada foto.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabungan Widget */}
                        <div className="md:col-span-3 flex flex-col gap-6">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-500">savings</span>
                                        Tabungan
                                    </h3>
                                    <Link href="/tabungan" className="text-xs font-bold text-primary hover:underline">Detail</Link>
                                </div>
                                <div className="space-y-6">
                                    {/* Total Summary */}
                                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                        <div className="flex justify-between items-center text-sm mb-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">Total Aset</span>
                                            <span className="text-primary font-bold">{savingsStats.progress}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden mb-1">
                                            <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${savingsStats.progress}%` }}></div>
                                        </div>
                                        <p className="text-xs text-slate-500 text-right font-mono">{formatRupiah(savingsStats.total)} / {formatRupiah(savingsStats.target)}</p>
                                    </div>

                                    {/* Individual Goals List */}
                                    <div className="space-y-4">
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detail Pos</p>
                                        {savingsGoals.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Belum ada pos tabungan.</p>
                                        ) : (
                                            savingsGoals.map(goal => {
                                                const goalSaved = savingsTransactions
                                                    .filter(t => (t as any).goalId === goal.id) // Cast to any if goalId missing in interface
                                                    .reduce((acc, curr) => acc + curr.amount, 0);
                                                const goalTarget = goal.targetAmount || 0;
                                                const goalProgress = goalTarget > 0 ? Math.min(Math.round((goalSaved / goalTarget) * 100), 100) : 0;

                                                return (
                                                    <div key={goal.id} className="group">
                                                        <div className="flex justify-between items-end mb-1">
                                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
                                                                {goal.title}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-500">{goalProgress}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${goalProgress >= 100 ? 'bg-green-500' : 'bg-primary/70'}`}
                                                                style={{ width: `${goalProgress}%` }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 text-right mt-0.5 font-mono">
                                                            {formatRupiah(goalSaved)}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">Status Keuangan</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {savingsStats.progress >= 100 ? "Target Tercapai! 🎉" :
                                                savingsStats.progress >= 50 ? "Setengah jalan lagi! Semangat! 💪" :
                                                    "Ayo mulai menabung rutin! 🌱"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full px-4 py-12 bg-transparent">
                    <div className="max-w-xl mx-auto text-center flex flex-col gap-4">
                        <span className="material-symbols-outlined text-3xl text-primary/40">format_quote</span>
                        <p className="text-xl md:text-2xl font-serif italic text-slate-800 dark:text-slate-200 leading-relaxed">
                            &quot;Cinta tidak berupa tatapan satu sama lain, tetapi memandang ke luar bersama ke arah yang sama.&quot;
                        </p>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-2">— Antoine de Saint-Exupéry</p>
                    </div>
                </section>
            </main>
        </div>
    );
}
