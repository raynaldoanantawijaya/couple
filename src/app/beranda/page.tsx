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

interface SavingsGoal {
    id: string;
    title: string;
    targetAmount: number;
}

export default function BerandaPage() {
    const [visi, setVisi] = useState("");
    const [misi, setMisi] = useState<string[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [savingsTransactions, setSavingsTransactions] = useState<Transaction[]>([]);
    const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const generateSummary = (text: string, isListMode: boolean = false) => {
        if (!text) return "";
        let clean = text.replace(/\*/g, "");
        if (isListMode) return clean; // Fallback only
        clean = clean.replace(/\s+/g, " ").trim();
        if (clean.length <= 250) return clean;
        return clean.substring(0, 250) + "...";
    };

    useEffect(() => {
        const fetchVisi = async () => {
            try {
                const docRef = doc(db, "content", "visi_misi");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const visiData = data.visi || "";
                    const misiData = data.misi || []; // Default to empty array
                    setVisi(Array.isArray(visiData) ? visiData.join(". ") : visiData);
                    setMisi(Array.isArray(misiData) ? misiData : [misiData].filter(Boolean));
                } else {
                    setVisi("Membangun hubungan yang bertumbuh...");
                    setMisi([
                        "Saling mendukung karir dan impian masing-masing.",
                        "Meluangkan quality time minimal seminggu sekali.",
                        "Terbuka dalam komunikasi dan keuangan."
                    ]);
                }
            } catch (e) { console.error("Error fetching visi", e); }
        };
        fetchVisi();

        const qProjects = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const unsubProjects = onSnapshot(qProjects, (snapshot) => {
            const allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
            const sorted = allProjects.sort((a, b) => {
                if (a.isPriority === b.isPriority) return 0;
                return a.isPriority ? -1 : 1;
            });
            setProjects(sorted.slice(0, 3));
        });

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

        const fetchCloudinaryAssets = async () => {
            try {
                // Fetch up to 2 images
                const imgRes = await fetch('/api/resources?type=image');
                const imgData = await imgRes.json();
                if (imgData.resources) {
                    const mappedImg: GalleryItem[] = imgData.resources.slice(0, 2).map((r: any) => {
                        const ctx = r.context?.custom || {};
                        return { title: ctx.caption || "Momen Kita", date: ctx.date || new Date(r.created_at).toLocaleDateString(), tag: "Upload", img: r.secure_url.replace("/upload/", "/upload/w_500,h_500,c_fill,q_auto,f_auto/") };
                    });
                    setGalleryItems(mappedImg);
                }
                // Fetch up to 2 videos
                const vidRes = await fetch('/api/resources?type=video');
                const vidData = await vidRes.json();
                if (vidData.resources) {
                    const mappedVid: VideoItem[] = vidData.resources.slice(0, 2).map((r: any) => {
                        const ctx = r.context?.custom || {};
                        const rawDur = ctx.duration ? parseFloat(ctx.duration) : (r.duration || 0);
                        const m = Math.floor(rawDur / 60);
                        const s = Math.round(rawDur % 60);
                        const durationStr = `${m}:${s.toString().padStart(2, '0')}`;
                        const offset = ctx.cover_offset ? parseFloat(ctx.cover_offset) : 0;
                        const gravity = ctx.cover_gravity || 'center';
                        const thumbUrl = r.secure_url.replace(/\.[^/.]+$/, ".jpg").replace("/upload/", `/upload/so_${offset},g_${gravity},w_500,h_280,c_fill,q_auto,f_auto/`);
                        return { title: ctx.caption || "Momen Vidio", date: ctx.date || new Date(r.created_at).toLocaleDateString(), duration: durationStr, tag: "Vidio", img: thumbUrl, videoUrl: r.secure_url };
                    });
                    setVideoItems(mappedVid);
                }
            } catch (error) { console.error("Error fetching assets:", error); } finally { setIsLoading(false); }
        };
        fetchCloudinaryAssets();
        return () => { unsubProjects(); unsubGoals(); unsubSavings(); };
    }, []);

    const savingsStats = useMemo(() => {
        // Filter out orphaned transactions (those with no matching goal)
        const validTransactions = savingsTransactions.filter(t =>
            t.goalId && savingsGoals.some(g => g.id === t.goalId)
        );

        const totalSaved = validTransactions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
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
                <section className="w-full px-4 md:px-10 lg:px-40 py-6 md:py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 w-full items-stretch">

                        {/* Hero Card */}
                        <div className="lg:col-span-12 relative w-full min-h-[350px] md:min-h-[320px] rounded-3xl overflow-hidden shadow-xl group flex flex-col justify-center">
                            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD8xrHpmhfXCo1oZqSBz7ikLdQg0-D96wM7mpIotB66K28Wubizy8kMXgLlEeA-YB0w38tKRzofoBkvatWS6CC7N6CqxEtKYiinr2nSASjSG4_zjijtVhZxHbq_0DeSglrxm2uMuNyubMOv3soXxfd6FUDjgpbe5etVsGSaMGk9K9aWkUH3njDMbUArmNhRkhNdAYYR1TuDB4ZplGrMFpO0RhtxF7PlQYEzeoRNlSWANKwawnfk4IT-_3Jfp6smjRc0vgybPkmi5_o")' }}></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
                            <div className="relative z-10 h-full flex flex-col justify-center p-6 md:p-12 max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 w-fit mb-4">
                                    <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
                                    <span className="text-xs font-semibold text-white">Day {Math.floor((new Date().getTime() - new Date("2025-12-30").getTime()) / (1000 * 3600 * 24)) + 1} Together</span>
                                </div>
                                <h1 className="text-white text-3xl md:text-5xl font-bold leading-tight mb-4">Selamat Datang di <br /> <span className="text-primary">Rumah Digital Kita</span></h1>
                                <p className="text-slate-200 text-lg font-light mb-6 line-clamp-2">Tempat kita merangkai mimpi, menyimpan kenangan manis, dan merencanakan masa depan yang indah bersama.</p>
                                <div className="flex gap-3">
                                    <Link href="/gallery" className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-primary/30 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">add_a_photo</span>
                                        Upload Kenangan
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* ROW 1: Visi Misi (6) + Tabungan (6) */}
                        <div className="lg:col-span-6 flex flex-col">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">volunteer_activism</span>Visi &amp; Misi</h3>
                                    <Link href="/visi-misi" className="text-xs font-bold text-primary hover:underline">Detail</Link>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Visi</p>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic">&quot;{generateSummary(visi || "Belum ada visi yang ditulis.", false)}&quot;</p>
                                    </div>
                                    <div className="w-full h-px bg-slate-100 dark:bg-white/5"></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Misi</p>
                                        {Array.isArray(misi) && misi.length > 0 ? (
                                            <ul className="space-y-2">
                                                {misi.slice(0, 3).map((item, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                                        <span className="mt-1.5 size-1.5 rounded-full bg-primary flex-shrink-0"></span>
                                                        <span className="line-clamp-2">{item}</span>
                                                    </li>
                                                ))}
                                                {misi.length > 3 && (
                                                    <li className="text-xs text-primary font-bold pt-1">
                                                        +{misi.length - 3} poin lainnya...
                                                    </li>
                                                )}
                                            </ul>
                                        ) : (
                                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">Belum ada misi yang ditulis.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 absolute bottom-6 right-6 opacity-30 group-hover:opacity-100 transition-opacity">
                                    <span className="material-symbols-outlined text-slate-400">format_quote</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-6 flex flex-col">
                            {/* Savings Widget */}
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-green-500">savings</span>Tabungan</h3>
                                    <Link href="/tabungan" className="text-xs font-bold text-primary hover:underline">Detail</Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center text-sm mb-2"><span className="font-bold text-slate-800 dark:text-slate-200">Total Aset</span><span className="text-primary font-bold">{savingsStats.progress}%</span></div>
                                            <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-3 overflow-hidden mb-2"><div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${savingsStats.progress}%` }}></div></div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">{formatRupiah(savingsStats.total)}</p>
                                            <p className="text-xs text-slate-400 font-mono mt-0.5">Target: {formatRupiah(savingsStats.target)}</p>
                                        </div>
                                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                            <p className="text-[10px] text-green-600 dark:text-green-400 font-bold mb-1">Status Keuangan</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 italic">{savingsStats.progress >= 50 ? "Hebat! Pertahankan!" : "Yuk semangat menabung!"}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 min-h-[160px]">
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Top Goals</p>
                                        <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                                            {savingsGoals.length === 0 ? (<p className="text-sm text-slate-400 italic">Belum ada pos tabungan.</p>) : (savingsGoals.map(goal => {
                                                const goalSaved = savingsTransactions.filter(t => (t as any).goalId === goal.id).reduce((acc, curr) => acc + curr.amount, 0);
                                                const goalTarget = goal.targetAmount || 0;
                                                const goalProgress = goalTarget > 0 ? Math.min(Math.round((goalSaved / goalTarget) * 100), 100) : 0;
                                                return (
                                                    <div key={goal.id} className="group">
                                                        <div className="flex justify-between items-end mb-1"><span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px] group-hover:text-primary transition-colors">{goal.title}</span><span className="text-xs font-bold text-slate-500">{goalProgress}%</span></div>
                                                        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${goalProgress >= 100 ? 'bg-green-500' : 'bg-primary/70'}`} style={{ width: `${goalProgress}%` }}></div></div>
                                                    </div>
                                                );
                                            }))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Projects (4) + Gallery (4) + Video (4) */}
                        <div className="lg:col-span-4 flex flex-col">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-yellow-500">sticky_note_2</span>Proyek ({projects.length})</h3>
                                    <Link href="/project" className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">arrow_forward</span></Link>
                                </div>
                                <div className="space-y-3 flex-1">
                                    {projects.length === 0 ? (<div className="text-center py-4 text-slate-400 text-sm">Belum ada project aktif.</div>) : (projects.slice(0, 3).map(proj => (
                                        <div key={proj.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer" onClick={() => window.location.href = `/project/${proj.id}`}>
                                            <div className={`size-4 rounded-full border-2 ${proj.status === 'Selesai' ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{proj.title}</p>
                                                <p className="text-[10px] text-slate-500">{proj.deadline}</p>
                                            </div>
                                        </div>
                                    )))}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4 flex flex-col">
                            {/* Gallery Widget - SIDE-BY-SIDE GRID */}
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Galeri Foto</h3>
                                    <Link href="/gallery" className="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors"><span className="material-symbols-outlined">arrow_forward</span></Link>
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                                    {isLoading ? (<div className="col-span-2 flex justify-center items-center h-full"><div className="size-8 border-2 border-primary rounded-full animate-spin border-t-transparent"></div></div>) : (
                                        galleryItems.slice(0, 2).map((item, idx) => (
                                            <div key={idx} className="w-full aspect-square rounded-xl overflow-hidden relative group">
                                                <img src={item.img} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                                    <p className="text-white text-[10px] font-medium truncate">{item.title}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {!isLoading && galleryItems.length === 0 && (
                                        <div className="col-span-2 text-center text-xs text-slate-400 py-4">Belum ada foto.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4 flex flex-col">
                            {/* Video Widget - SIDE-BY-SIDE GRID */}
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg rounded-3xl p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Video</h3>
                                    <Link href="/video" className="text-primary hover:bg-primary/10 p-1.5 rounded-full transition-colors"><span className="material-symbols-outlined">arrow_forward</span></Link>
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                                    {isLoading ? (<div className="col-span-2 flex justify-center items-center h-full"><div className="size-8 border-2 border-primary rounded-full animate-spin border-t-transparent"></div></div>) : videoItems.length > 0 ? (
                                        videoItems.map((vid, idx) => (
                                            <div key={idx} className="relative w-full aspect-square rounded-xl overflow-hidden group cursor-pointer shadow-md" onClick={() => vid.videoUrl && window.open(vid.videoUrl, '_blank')}>
                                                <img src={vid.img} alt={vid.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                                    <div className="size-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border border-white/50"><span className="material-symbols-outlined text-white text-lg fill-current">play_arrow</span></div>
                                                </div>
                                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-[8px] text-white font-mono">{vid.duration}</span>
                                            </div>
                                        ))
                                    ) : (<div className="col-span-2 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded-xl">0 Video</div>)}
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                <section className="w-full px-4 py-8 bg-transparent">
                    <div className="max-w-xl mx-auto text-center flex flex-col gap-2">
                        <p className="text-lg font-serif italic text-slate-700 dark:text-slate-300">&quot;Grow old along with me! The best is yet to be.&quot;</p>
                        <p className="text-xs text-slate-400 uppercase tracking-widest">— Robert Browning</p>
                    </div>
                </section>
            </main>
        </div>
    );
}
