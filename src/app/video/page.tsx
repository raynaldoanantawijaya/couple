"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface VideoItem {
    public_id: string;
    title: string;
    date: string;
    duration: string;
    tag: string;
    img: string; // Used for thumbnail
    videoUrl?: string; // Optional real video url if available
}

export default function VideoPage() {
    const [items, setItems] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("Semua");

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resources?type=video');
            const data = await res.json();

            if (data.resources) {
                const mapped: VideoItem[] = data.resources.map((r: any) => {
                    const ctx = r.context?.custom || {};

                    // 1. Resolve Duration: Context > API > 0
                    const rawDur = ctx.duration ? parseFloat(ctx.duration) : (r.duration || 0);
                    const m = Math.floor(rawDur / 60);
                    const s = Math.round(rawDur % 60); // Round seconds
                    const durationStr = `${m}:${s.toString().padStart(2, '0')}`;

                    // 2. Resolve Thumbnail with Custom Offset & Gravity
                    // Default to 0 and center if not set
                    const offset = ctx.cover_offset ? parseFloat(ctx.cover_offset) : 0;
                    const gravity = ctx.cover_gravity || 'center';

                    // Generate smart thumbnail URL (Optimized)
                    // https://res.cloudinary.com/<cloud>/video/upload/so_<offset>,g_<gravity>,w_500,h_280,c_fill,q_auto,f_auto/<public_id>.jpg
                    const thumbUrl = r.secure_url.replace(/\.[^/.]+$/, ".jpg")
                        .replace("/upload/", `/upload/so_${offset},g_${gravity},w_500,h_280,c_fill,q_auto,f_auto/`);

                    return {
                        public_id: r.public_id,
                        title: ctx.caption || "Momen Vidio",
                        date: ctx.date || new Date(r.created_at).toLocaleDateString(),
                        duration: durationStr,
                        tag: "Vidio",
                        img: thumbUrl,
                        videoUrl: r.secure_url
                    };
                });
                setItems(mapped);
            }
        } catch (error) {
            console.error("Failed to fetch video items", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Real-time listener for Favorites
        const unsubFavorites = onSnapshot(collection(db, "favorites"), (snapshot) => {
            const favSet = new Set<string>();
            snapshot.docs.forEach(doc => {
                if (doc.data().type === 'video') {
                    favSet.add(doc.id);
                }
            });
            setFavorites(favSet);
        });

        fetchItems();
        return () => unsubFavorites();
    }, []);

    const toggleFavorite = async (public_id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const isFav = favorites.has(public_id);

        try {
            if (isFav) {
                await deleteDoc(doc(db, "favorites", public_id));
            } else {
                await setDoc(doc(db, "favorites", public_id), {
                    type: "video",
                    createdAt: Date.now()
                });
            }
        } catch (error) {
            console.error("Error toggling favorite", error);
        }
    };

    const handleDelete = async (indexToDelete: number, item: VideoItem) => {
        if (!confirm("Apakah Anda yakin ingin menghapus vidio ini?")) return;

        // Optimistic update
        const previousItems = [...items];
        setItems(prev => prev.filter(i => i.public_id !== item.public_id));

        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id: item.public_id, resource_type: 'video' })
            });
            const data = await res.json();
            if (!data.success) {
                alert("Gagal menghapus vidio.");
                setItems(previousItems); // Revert
            }
        } catch (error) {
            console.error("Error removing item", error);
            alert("Gagal menghapus vidio.");
            setItems(previousItems); // Revert
            fetchItems();
        }
    };

    const filteredItems = items.filter(item => {
        if (filter === "Favorit") return favorites.has(item.public_id);
        return true;
    });

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-x-hidden min-h-screen flex flex-col">

            <main className="flex-1 flex flex-col items-center py-8 px-6 md:px-10 lg:px-40">
                <div className="max-w-[1440px] w-full flex flex-col gap-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#48232f] pb-6">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-white text-4xl md:text-5xl font-black tracking-tighter">Vidio Kita</h1>
                            <p className="text-[#c992a4] text-lg font-medium max-w-xl">
                                Kumpulan momen indah perjalanan cinta kita, dari tawa kecil hingga petualangan besar.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[#c992a4] text-sm font-medium">
                            <span className="material-symbols-outlined text-lg">movie</span>
                            <span>{items.length} Vidio Tersimpan</span>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto p-4">
                        <div className="flex gap-3 min-w-max">
                            {["Semua", "Favorit"].map((f, i) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex h-9 items-center justify-center px-6 rounded-full text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${filter === f
                                        ? "bg-primary text-white shadow-sm border border-transparent"
                                        : "bg-surface-border dark:bg-white/5 text-white hover:bg-white/10 border border-white/10"
                                        }`}
                                >
                                    {f === "Favorit" && <span className="material-symbols-outlined text-sm mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>}
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-[60vh] w-full">
                            <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {filteredItems.length === 0 && (
                                <p className="text-slate-400 col-span-full text-center py-20">
                                    {filter === "Favorit" ? "Belum ada vidio favorit." : "Belum ada vidio."}
                                </p>
                            )}

                            {filteredItems.map((item, idx) => (
                                <div key={idx} className="group relative aspect-video overflow-hidden rounded-xl bg-surface-dark cursor-pointer shadow-md transition-all hover:shadow-xl hover:shadow-primary/10"
                                    onClick={() => item.videoUrl && window.open(item.videoUrl, '_blank')}
                                >
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                        style={{ backgroundImage: `url("${item.img}")` }}
                                    >
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <div className="bg-white/20 backdrop-blur-sm w-16 h-16 flex items-center justify-center rounded-full group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-white text-4xl">play_arrow</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                        <span className="text-primary text-xs font-bold uppercase tracking-wider mb-1">{item.tag}</span>
                                        <h3 className="text-white font-bold text-lg leading-tight">{item.title}</h3>
                                        <div className="flex items-center gap-1 text-gray-300 text-xs mt-2">
                                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                                            <span>{item.date}</span>
                                            <span className="mx-1">•</span>
                                            <span className="material-symbols-outlined text-sm">schedule</span>
                                            <span>{item.duration}</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300">
                                        <button
                                            onClick={(e) => toggleFavorite(item.public_id, e)}
                                            className={`w-10 h-10 grid place-items-center rounded-full transition-colors p-0 ${favorites.has(item.public_id) ? "bg-white/90 text-red-500 shadow-sm" : "bg-black/30 backdrop-blur-sm text-white hover:text-red-500"}`}
                                        >
                                            <span className="material-symbols-outlined text-xl leading-none" style={favorites.has(item.public_id) ? { fontVariationSettings: "'FILL' 1" } : {}}>favorite</span>
                                        </button>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); handleDelete(idx, item); }}
                                            className="bg-black/30 backdrop-blur-sm w-10 h-10 grid place-items-center rounded-full text-white hover:text-red-500 transition-colors cursor-pointer p-0"
                                        >
                                            <span className="material-symbols-outlined text-xl leading-none">delete</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
