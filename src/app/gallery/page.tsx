"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";

interface GalleryItem {
    title: string;
    date: string;
    tag: string;
    img: string;
}

export default function GalleryPage() {
    const [items, setItems] = useState<GalleryItem[]>([]);

    useEffect(() => {
        // Load from localStorage for immediate feedback
        const localData = localStorage.getItem("uploaded_gallery_items");
        if (localData) {
            try {
                const parsed: GalleryItem[] = JSON.parse(localData);
                setItems(prev => {
                    // Create a set of existing image URLs to prevent duplicates
                    const existingimgs = new Set(prev.map(item => item.img));
                    // Only add items that aren't already in the list
                    const uniqueNewItems = parsed.filter(item => !existingimgs.has(item.img));

                    return [...uniqueNewItems, ...prev];
                });
            } catch (e) {
                console.error("Failed to parse local gallery items", e);
            }
        }
    }, []);

    const handleDelete = async (indexToDelete: number, item: GalleryItem) => {
        if (!confirm("Apakah Anda yakin ingin menghapus foto ini?")) return;

        // 1. Remove from State immediately for UI responsiveness
        setItems(prev => prev.filter((_, idx) => idx !== indexToDelete));

        // 2. Remove from LocalStorage & Cloudinary (if it's an uploaded item)
        if (item.tag === "Upload") {
            try {
                // Remove from Local Storage
                const localData = localStorage.getItem("uploaded_gallery_items");
                if (localData) {
                    const parsed: GalleryItem[] = JSON.parse(localData);
                    const updated = parsed.filter(p => p.img !== item.img);
                    localStorage.setItem("uploaded_gallery_items", JSON.stringify(updated));
                }

                // Remove from Cloudinary
                // Extract public_id from URL: .../upload/v<ver>/<public_id>.<ext>
                const matches = item.img.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
                if (matches && matches[1]) {
                    const public_id = matches[1];
                    const res = await fetch('/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ public_id, resource_type: 'image' })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        console.error("Gagal menghapus dari Cloudinary:", data);
                        alert("Gagal menghapus dari server, tapi sudah dihapus dari tampilan.");
                    }
                }
            } catch (e) {
                console.error("Error removing item", e);
            }
        } else {
            alert("Foto bawaan hanya terhapus dari tampilan sementara.");
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-x-hidden min-h-screen flex flex-col">

            <main className="flex-1 flex flex-col items-center py-8 px-6 md:px-10 lg:px-40">
                <div className="max-w-[1440px] w-full flex flex-col gap-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#48232f] pb-6">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-white text-4xl md:text-5xl font-black tracking-tighter">Galeri Kita</h1>
                            <p className="text-[#c992a4] text-lg font-medium max-w-xl">
                                Kumpulan momen indah perjalanan cinta kita, dari tawa kecil hingga petualangan besar.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[#c992a4] text-sm font-medium">
                            <span className="material-symbols-outlined text-lg">photo_library</span>
                            <span>{items.length} Foto Tersimpan</span>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto pb-2">
                        <div className="flex gap-3 min-w-max">
                            {["Semua", "Upload", "2024", "2023", "Liburan", "Kencan", "Anniversary", "Keluarga"].map((filter, i) => (
                                <button
                                    key={filter}
                                    className={`flex h-9 items-center justify-center px-5 rounded-full text-sm font-medium transition-transform hover:scale-105 ${i === 0
                                        ? "bg-primary text-white"
                                        : "bg-surface-border text-white hover:bg-primary/20 hover:border-primary/30 border border-transparent"
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {/* Gallery Items */}
                        {items.map((item, idx) => (
                            <div key={idx} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-dark cursor-pointer shadow-md transition-all hover:shadow-xl hover:shadow-primary/10">
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                    style={{ backgroundImage: `url("${item.img}")` }}
                                ></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <span className="text-primary text-xs font-bold uppercase tracking-wider mb-1">{item.tag}</span>
                                    <h3 className="text-white font-bold text-lg leading-tight">{item.title}</h3>
                                    <div className="flex items-center gap-1 text-gray-300 text-xs mt-2">
                                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                                        <span>{item.date}</span>
                                    </div>
                                </div>
                                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="bg-black/30 backdrop-blur-sm w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-xl">favorite_border</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(idx, item); }}
                                        className="bg-black/30 backdrop-blur-sm w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-red-500 transition-colors z-20"
                                    >
                                        <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
