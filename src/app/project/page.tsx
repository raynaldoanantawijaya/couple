"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Project {
    id: string;
    title: string;
    description: string;
    cost: number;
    deadline: string;
    category: string;
    isPriority: boolean;
    status: "Planning" | "On Progress" | "Selesai" | "Pending";
    createdAt: any;
    // Business Fields
    capitalInitial?: number;
    fixedCosts?: { id: string, name: string, amount: number }[];
    cogsPerUnit?: number;
    sellingPrice?: number;
    initialStock?: number;
    stockAdded?: number;
    soldUnits?: number;
    // Budget Fields
    budgetItems?: { id: string, name: string, estimated: number, actual: number, isPaid: boolean }[];
}

const getProjectStats = (proj: Project) => {
    // Business Logic
    if (proj.category === 'Bisnis') {
        const totalSales = (proj.sellingPrice || 0) * (proj.soldUnits || 0);
        const totalFixedCost = (proj.fixedCosts || []).reduce((acc, curr) => acc + curr.amount, 0);
        const totalStockCost = ((proj.initialStock || 0) + (proj.stockAdded || 0)) * (proj.cogsPerUnit || 0);
        const modalTerpakai = totalFixedCost + totalStockCost;
        const profit = totalSales - modalTerpakai; // Simple cash flow profit for list view? 
        // Or strict accounting profit? Detail page uses: (Sales - COGS_Sold) - FixedCost. 
        // Let's match detail page "Laba Bersih":
        const cogsSold = (proj.soldUnits || 0) * (proj.cogsPerUnit || 0);
        const neto = totalSales - cogsSold - totalFixedCost;

        return {
            label: "Modal",
            value: proj.capitalInitial || proj.cost || 0,
            secondaryLabel: "Laba Bersih",
            secondaryValue: neto,
            isBusiness: true
        };
    }

    // Budget Logic (Non-Business)
    const items = proj.budgetItems || [];
    const totalEstimated = items.length > 0 ? items.reduce((sum, i) => sum + (i.estimated || 0), 0) : (proj.cost || 0);
    const totalActual = items.reduce((sum, i) => sum + (i.actual || 0), 0);

    return {
        label: "Estimasi",
        value: totalEstimated,
        secondaryLabel: "Terpakai",
        secondaryValue: totalActual,
        isBusiness: false,
        hasActivity: items.length > 0
    };
};

export default function ProjectPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form States
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [cost, setCost] = useState("");
    const [deadline, setDeadline] = useState("");
    const [category, setCategory] = useState("Lainnya");
    const [isPriority, setIsPriority] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quick Edit State
    const [showQuickEdit, setShowQuickEdit] = useState(false);
    const [quickEditData, setQuickEditData] = useState<{ id: string, cost: number, deadline: string } | null>(null);

    // Add Project Modal State
    const [showAddProject, setShowAddProject] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[];
            setProjects(items);
            isLoading && setIsLoading(false);
        });
        return () => unsubscribe();
    }, [isLoading]);

    const handleAddProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !cost) return;

        // Check priority limit if trying to add as priority
        if (isPriority) {
            const currentPriorities = projects.filter(p => p.isPriority).length;
            if (currentPriorities >= 3) {
                alert("Maksimal 3 project prioritas! Project ini akan disimpan tanpa status prioritas.");
                // We'll continue but set isPriority to false effectively for the save, 
                // or we could return. But user experience wise, saving as normal is better than failing.
                // Let's just strictly enforce by not allowing it.
                // Actually, let's just warn and save as non-priority or ask user? 
                // Simple approach: Alert and block or Alert and save as false.
                // Let's Alert and proceed as FALSE to avoid blocking data entry.
                // But let's verify logic:
            }
        }

        setIsSubmitting(true);

        try {
            // Re-check limit inside try to be safe if we want strict enforcement, 
            // but for now let's just proceed. 
            // Ideally we check before submitting.
            let finalIsPriority = isPriority;
            if (isPriority && projects.filter(p => p.isPriority).length >= 3) {
                finalIsPriority = false;
            }

            await addDoc(collection(db, "projects"), {
                title,
                description: desc,
                cost: parseInt(cost.replace(/\D/g, "")),
                deadline,
                category,
                isPriority: finalIsPriority,
                status: "Planning",
                createdAt: Timestamp.now()
            });

            // Reset form
            setTitle("");
            setDesc("");
            setCost("");
            setDeadline("");
            setCategory("Lainnya");
            setIsPriority(false);
            setShowAddProject(false); // Close modal on success
            alert(finalIsPriority !== isPriority ? "Project disimpan (Prioritas penuh, diset ke biasa)." : "Project berhasil ditambahkan!");
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Gagal menambahkan project.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus project ini?")) return;
        try {
            await deleteDoc(doc(db, "projects", id));
        } catch (error) {
            console.error("Error deleting project: ", error);
        }
    };

    const handleTogglePriority = async (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();

        if (!project.isPriority) {
            // Check limit
            const currentPriorities = projects.filter(p => p.isPriority).length;
            if (currentPriorities >= 3) {
                alert("Maksimal 3 project prioritas! Hapus salah satu prioritas terlebih dahulu.");
                return;
            }
        }

        try {
            await updateDoc(doc(db, "projects", project.id), { isPriority: !project.isPriority });
        } catch (error) {
            console.error("Error updating priority: ", error);
        }
    };

    const openQuickEdit = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setQuickEditData({
            id: project.id,
            cost: project.cost || project.capitalInitial || 0,
            deadline: project.deadline
        });
        setShowQuickEdit(true);
    };

    const handleQuickEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickEditData) return;

        try {
            await updateDoc(doc(db, "projects", quickEditData.id), {
                cost: Number(quickEditData.cost),
                // Update capitalInitial as well if it exists or use cost as legacy
                // ideally we sync them or just update cost if that's what we show
                // The prompt asked to edit "Estimasi Biaya" which creates confusion if we have separate fields.
                // For now, let's update 'cost' and 'capitalInitial' to keep them in sync if we treat them as same.
                capitalInitial: Number(quickEditData.cost),
                deadline: quickEditData.deadline
            });
            setShowQuickEdit(false);
            setQuickEditData(null);
        } catch (error) {
            console.error("Error updating project: ", error);
            alert("Gagal update project.");
        }
    };

    const formatRupiah = (value: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
    };

    // Logic for Priority Projects: Get all true priority, if none, maybe show none or fallback?
    // Request: "maksimal yang bisa di favoritkan itu ada 3 project"
    // So we just filter isPriority.
    const priorityProjects = projects.filter(p => p.isPriority);
    // If no priority projects, we don't show any, or maybe we show standard list.

    // Non-priority for the list below
    const otherProjects = projects.filter(p => !p.isPriority);

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display transition-colors duration-200 min-h-screen flex flex-col">

            <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-40 py-8 md:py-12 flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Manajemen Project</h1>
                        <p className="text-slate-500 dark:text-[#c992a4] text-base font-medium">Kelola dan pantau progress project bersama 🚀</p>
                    </div>
                    <button
                        onClick={() => setShowAddProject(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-rose-600 text-white font-bold shadow-lg shadow-primary/25 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Tambahkan Project Baru
                    </button>
                </div>

                <div className="flex flex-col gap-8">
                    {/* Priority Projects (Max 3) */}
                    {priorityProjects.length > 0 && (
                        <div className="grid grid-cols-1 gap-6">
                            {priorityProjects.map(proj => (
                                <div key={proj.id} className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-surface-dark dark:to-[#1a0c10] border border-gray-200 dark:border-surface-border shadow-lg p-6 relative overflow-hidden text-white group cursor-pointer transition-all hover:scale-[1.01]"
                                    onClick={() => router.push(`/project/${proj.id}`)}
                                >
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/30 transition-colors duration-500"></div>
                                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={(e) => handleTogglePriority(e, proj)}
                                                    className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-inner hover:bg-white/20 transition-colors"
                                                    title="Hapus dari Prioritas"
                                                >
                                                    <span className="material-symbols-outlined text-yellow-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                                </button>
                                                <div>
                                                    <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-0.5">Prioritas Utama</span>
                                                    <h3 className="text-xl md:text-2xl font-bold">{proj.title}</h3>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${proj.status === 'Selesai' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                                proj.status === 'On Progress' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                                    'bg-white/10 border-white/10'
                                                }`}>
                                                {proj.status}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                                            {(() => {
                                                const stats = getProjectStats(proj);
                                                return (
                                                    <>
                                                        <div className="relative group/edit">
                                                            <span className="text-xs opacity-60 block">{stats.label}</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold">{formatRupiah(stats.value)}</span>
                                                                <button
                                                                    onClick={(e) => openQuickEdit(e, proj)}
                                                                    className="opacity-0 group-hover/edit:opacity-100 hover:text-primary transition-opacity"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="relative group/edit">
                                                            <span className="text-xs opacity-60 block">Deadline</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold">{proj.deadline}</span>
                                                                <button
                                                                    onClick={(e) => openQuickEdit(e, proj)}
                                                                    className="opacity-0 group-hover/edit:opacity-100 hover:text-primary transition-opacity"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs opacity-60 block">Kategori</span>
                                                            <span className="font-bold">{proj.category}</span>
                                                            {(stats.isBusiness || stats.hasActivity) && (
                                                                <span className={`text-[10px] font-bold block mt-1 ${stats.isBusiness
                                                                    ? (stats.secondaryValue > 0 ? "text-green-400" : "text-red-400")
                                                                    : (stats.secondaryValue > stats.value ? "text-red-400" : "text-blue-300")
                                                                    }`}>
                                                                    {stats.secondaryLabel}: {formatRupiah(Math.abs(stats.secondaryValue))}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(proj.id); }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                                                    title="Hapus Project"
                                                >
                                                    <span className="material-symbols-outlined text-lg">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent Projects (Non-Priority) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {otherProjects.length === 0 && priorityProjects.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-slate-400 bg-white dark:bg-surface-dark rounded-3xl border border-dashed border-gray-200 dark:border-surface-border flex flex-col items-center justify-center gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full">
                                    <span className="material-symbols-outlined text-4xl opacity-50">folder_open</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Belum ada project</h3>
                                    <p>Mulai tambahkan project impian kalian! ✨</p>
                                </div>
                                <button
                                    onClick={() => setShowAddProject(true)}
                                    className="mt-2 text-primary font-bold hover:underline"
                                >
                                    Buat Project Baru
                                </button>
                            </div>
                        ) : (
                            otherProjects.map((proj) => (
                                <div key={proj.id} className="group bg-white dark:bg-surface-dark rounded-2xl p-5 border border-gray-200 dark:border-surface-border hover:border-primary/50 dark:hover:border-primary/50 transition-all cursor-pointer relative shadow-sm hover:shadow-lg h-full flex flex-col justify-between"
                                    onClick={() => router.push(`/project/${proj.id}`)}
                                >
                                    <div className="absolute top-3 right-3 flex items-center gap-1 z-10 transition-all opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={(e) => handleTogglePriority(e, proj)}
                                            className={`p-1 hover:text-yellow-400 transition-colors ${proj.isPriority ? 'text-yellow-400' : 'text-slate-300'}`}
                                            title={proj.isPriority ? "Hapus dari Prioritas" : "Jadikan Prioritas"}
                                        >
                                            <span className="material-symbols-outlined text-lg" style={proj.isPriority ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(proj.id); }}
                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                            title="Hapus Project"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>

                                    <div className="flex justify-between items-start mb-4 pr-6">
                                        <div className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 w-10 h-10 flex items-center justify-center rounded-lg">
                                            <span className="material-symbols-outlined text-xl">
                                                {proj.category === 'Liburan' ? 'flight' : proj.category === 'Rumah' ? 'home' : proj.category === 'Elektronik' ? 'devices' : 'list'}
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-1 leading-snug">{proj.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2 mb-4">{proj.description}</p>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-surface-border/50">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${proj.status === 'Selesai' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            proj.status === 'On Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                            }`}>
                                            {proj.status}
                                        </span>
                                        <div className="flex flex-col items-end">
                                            {(() => {
                                                const stats = getProjectStats(proj);
                                                return (
                                                    <>
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white capitalize text-right">
                                                            <span className="text-[10px] font-normal opacity-70 mr-1 block">{stats.label}</span>
                                                            {formatRupiah(stats.value)}
                                                        </span>
                                                        {(stats.isBusiness || stats.hasActivity) && (
                                                            <span className={`text-[10px] font-bold ${stats.isBusiness
                                                                ? (stats.secondaryValue > 0 ? "text-green-500" : "text-red-500")
                                                                : (stats.secondaryValue > stats.value ? "text-red-500" : "text-blue-500")
                                                                }`}>
                                                                {stats.secondaryLabel}: {formatRupiah(Math.abs(stats.secondaryValue))}
                                                            </span>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Add Project Modal */}
                {showAddProject && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowAddProject(false)}>
                        <div className="bg-white dark:bg-surface-dark p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-white/10 relative" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setShowAddProject(false)}
                                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary shadow-sm shadow-primary/20">
                                    <span className="material-symbols-outlined text-2xl">edit_note</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Project Baru</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Isi detail project impianmu di sini.</p>
                                </div>
                            </div>

                            <form onSubmit={handleAddProject} className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Nama Project</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#221117] border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                                        placeholder="Contoh: Renovasi Dapur"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Deskripsi Singkat</label>
                                    <textarea
                                        rows={2}
                                        value={desc}
                                        onChange={(e) => setDesc(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#221117] border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600 resize-none"
                                        placeholder="Detail project..."
                                    ></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Estimasi Biaya</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={cost ? formatRupiah(Number(cost)).replace(",00", "") : ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    setCost(val);
                                                }}
                                                className="w-full bg-gray-50 dark:bg-[#221117] border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                                                placeholder="Rp 0"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Deadline</label>
                                        <input
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#221117] border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all dark:[color-scheme:dark]"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Kategori</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {["Rumah", "Bisnis", "Liburan", "Barang", "Lainnya"].map(cat => (
                                            <label key={cat} className="cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="category"
                                                    value={cat}
                                                    checked={category === cat}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    className="peer sr-only"
                                                />
                                                <span className="block px-3 py-1.5 rounded-full border border-gray-200 dark:border-surface-border text-xs font-medium text-slate-600 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all hover:bg-gray-50 dark:hover:bg-surface-border">{cat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                                    <input
                                        type="checkbox"
                                        id="priority"
                                        checked={isPriority}
                                        onChange={(e) => setIsPriority(e.target.checked)}
                                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 accent-primary"
                                    />
                                    <label htmlFor="priority" className="text-sm font-medium text-slate-700 dark:text-yellow-100 cursor-pointer select-none">Jadikan Prioritas Utama (Tampil di atas)</label>
                                </div>
                                <div className="flex gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddProject(false)}
                                        className="flex-1 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-[2] py-3 rounded-xl bg-primary hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Menyimpan..." : "Simpan Project"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Quick Edit Modal */}
                {showQuickEdit && quickEditData && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowQuickEdit(false)}>
                        <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Edit Project</h3>
                            <form onSubmit={handleQuickEditSave} className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Estimasi Biaya</label>
                                    <input
                                        type="text"
                                        value={quickEditData.cost ? formatRupiah(quickEditData.cost).replace(",00", "") : ""}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            setQuickEditData({ ...quickEditData, cost: Number(val) });
                                        }}
                                        className="w-full p-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="Rp 0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Deadline</label>
                                    <input
                                        type="date"
                                        value={quickEditData.deadline}
                                        onChange={(e) => setQuickEditData({ ...quickEditData, deadline: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary outline-none dark:[color-scheme:dark]"
                                        required
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickEdit(false)}
                                        className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-white/10"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
