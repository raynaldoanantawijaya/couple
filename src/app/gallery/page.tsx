"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface GalleryItem {
    public_id: string;
    title: string;
    date: string;
    tag: string;
    img: string;
    thumbnail?: string;
}

export default function GalleryPage() {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("Semua");

    useEffect(() => {
        // Real-time listener for Favorites
        const unsubFavorites = onSnapshot(collection(db, "favorites"), (snapshot) => {
            const favSet = new Set<string>();
            snapshot.docs.forEach(doc => {
                if (doc.data().type === 'image') {
                    favSet.add(doc.id);
                }
            });
            setFavorites(favSet);
        });

        // Fetch from Cloudinary API
        const fetchImages = async () => {
            try {
                const res = await fetch('/api/resources?type=image');
                const data = await res.json();

                if (data.resources) {
                    const mapped: GalleryItem[] = data.resources.map((r: any) => {
                        const ctx = r.context?.custom || {};
                        return {
                            public_id: r.public_id,
                            title: ctx.caption || "Momen Kita",
                            date: ctx.date || new Date(r.created_at).toLocaleDateString(),
                            tag: "Upload",
                            img: r.secure_url,
                            thumbnail: r.secure_url.replace("/upload/", `/upload/g_${ctx.cover_gravity || 'center'},w_300,h_300,c_fill,q_auto,f_auto/`)
                        };
                    });
                    setItems(mapped);
                }
            } catch (error) {
                console.error("Failed to fetch gallery items", error);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
        return () => unsubFavorites();
    }, []);

    // Helper to generate download URL
    const getDownloadUrl = (url: string) => {
        return url.replace("/upload/", "/upload/fl_attachment/");
    };

    const toggleFavorite = async (public_id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const isFav = favorites.has(public_id);

        try {
            if (isFav) {
                await deleteDoc(doc(db, "favorites", public_id));
            } else {
                await setDoc(doc(db, "favorites", public_id), {
                    type: "image",
                    createdAt: Date.now()
                });
            }
        } catch (error) {
            console.error("Error toggling favorite", error);
        }
    };

    const handleDelete = async (public_id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening modal
        if (!confirm("Yakin mau hapus foto ini?")) return;

        // Optimistic update
        const previousItems = [...items];
        setItems(prev => prev.filter(i => i.public_id !== public_id));

        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id, resource_type: 'image' })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Deletion failed");
            }
        } catch (error) {
            console.error("Delete failed", error);
            alert("Gagal menghapus foto. Silakan coba lagi.");
            setItems(previousItems); // Revert on failure
        }
    };

    const filteredItems = items.filter(item => {
        if (filter === "Favorit") return favorites.has(item.public_id);
        return true;
    });

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20 font-display">

            <main className="flex-1 flex flex-col items-center py-8 px-6 md:px-10 lg:px-40">
                <div className="max-w-[1440px] w-full flex flex-col gap-8">
                    {/* Header Section matching Video Page */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-slate-900 dark:text-white text-4xl md:text-5xl font-black tracking-tighter">Galeri Kita</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl">
                                Kumpulan momen indah yang tak terlupakan, tersimpan rapi disini.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                            <span className="material-symbols-outlined text-lg">photo_library</span>
                            <span>{items.length} Foto Tersimpan</span>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="w-full overflow-x-auto p-4">
                        <div className="flex gap-3 min-w-max">
                            {["Semua", "Favorit"].map((f, i) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex h-9 items-center justify-center px-6 rounded-full text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${filter === f
                                        ? "bg-primary text-white shadow-sm border border-transparent"
                                        : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10"
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
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredItems.length === 0 && (
                                <p className="text-slate-400 col-span-full text-center py-20">
                                    {filter === "Favorit" ? "Belum ada foto favorit." : "Belum ada foto."}
                                </p>
                            )}

                            {filteredItems.map((item) => (
                                <div
                                    key={item.public_id}
                                    className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5 cursor-pointer shadow-md transition-all hover:shadow-xl hover:shadow-primary/10"
                                    onClick={() => setSelectedItem(item)}
                                >
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                        style={{ backgroundImage: `url("${item.thumbnail || item.img}")` }}
                                    >
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </div>

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                        <span className="text-primary text-xs font-bold uppercase tracking-wider mb-1">{item.tag}</span>
                                        <h3 className="text-white font-bold text-lg leading-tight truncate">{item.title}</h3>
                                        <div className="flex items-center gap-1 text-gray-300 text-xs mt-2">
                                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                                            <span>{item.date}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="absolute top-3 right-3 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300">
                                        <button
                                            onClick={(e) => toggleFavorite(item.public_id, e)}
                                            className={`w-10 h-10 grid place-items-center rounded-full transition-colors p-0 ${favorites.has(item.public_id) ? "bg-white/90 text-red-500 shadow-sm" : "bg-black/30 backdrop-blur-sm text-white hover:text-red-500"}`}
                                            title="Favorit"
                                        >
                                            <span className="material-symbols-outlined text-xl leading-none" style={favorites.has(item.public_id) ? { fontVariationSettings: "'FILL' 1" } : {}}>favorite</span>
                                        </button>
                                        <div
                                            onClick={(e) => handleDelete(item.public_id, e)}
                                            className="bg-black/30 backdrop-blur-sm w-10 h-10 grid place-items-center rounded-full text-white hover:text-red-500 transition-colors cursor-pointer p-0"
                                            title="Hapus"
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

            {/* Robust Lightbox Layout */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm animate-in fade-in duration-200 h-[100dvh]">
                    {/* Close Button - Fixed Top Right */}
                    <button
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-4 right-4 z-[60] w-12 h-12 flex items-center justify-center bg-black/20 hover:bg-white/20 text-white/70 hover:text-white rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>

                    {/* Image Area - Flex 1 to take available space */}
                    <div
                        className="flex-1 w-full flex items-center justify-center min-h-0 p-4 relative"
                        onClick={() => setSelectedItem(null)}
                    >
                        <img
                            src={selectedItem.img}
                            alt={selectedItem.title}
                            className="max-w-full max-h-full object-contain drop-shadow-2xl"
                        />
                    </div>

                    {/* Footer Area - Flex None / Shrink 0 to never be squished */}
                    <div className="shrink-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-8 px-4 flex flex-col items-center text-center z-10">
                        <h3 className="text-white text-xl font-bold truncate max-w-md">{selectedItem.title}</h3>
                        <p className="text-white/60 text-sm mb-4">{selectedItem.date}</p>

                        <div className="flex justify-center mt-2">
                            <a
                                href={getDownloadUrl(selectedItem.img)}
                                className="flex items-center gap-2 px-6 py-2 bg-white text-black hover:bg-slate-200 rounded-full font-bold text-sm transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className="material-symbols-outlined text-lg">download</span>
                                Download
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
