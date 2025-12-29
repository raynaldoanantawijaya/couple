"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState, useMemo, use } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, Timestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Project {
    id: string;
    title: string;
    description: string;
    deadline: string;
    category: string;
    isPriority: boolean;
    status: "Planning" | "On Progress" | "Selesai" | "Pending";
    // Business Fields
    capitalInitial: number;
    capitalAdditional: number;
    expenditure: number;
    sellingPrice: number;
    soldUnits: number;
    remainingUnits: number;
    // Legacy mapping
    cost: number;
}

interface Transaction {
    id: string;
    amount: number;
    description: string;
    type: "in" | "out";
    date: Date;
    category?: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [project, setProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [showTransModal, setShowTransModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Transaction Form
    const [transType, setTransType] = useState<"in" | "out">("in");
    const [amount, setAmount] = useState("");
    const [desc, setDesc] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Project Form
    const [editForm, setEditForm] = useState({
        capitalInitial: 0,
        capitalAdditional: 0,
        expenditure: 0,
        sellingPrice: 0,
        soldUnits: 0,
        remainingUnits: 0,
        status: "Planning"
    });

    useEffect(() => {
        const fetchProject = async () => {
            if (!id) return;
            // Subscribe to project document for real-time updates
            const unsubscribe = onSnapshot(doc(db, "projects", id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const projData = { id: docSnap.id, ...data } as Project;
                    setProject(projData);
                    // Initialize edit form with existing data or defaults
                    setEditForm({
                        capitalInitial: projData.capitalInitial || projData.cost || 0,
                        capitalAdditional: projData.capitalAdditional || 0,
                        expenditure: projData.expenditure || 0,
                        sellingPrice: projData.sellingPrice || 0,
                        soldUnits: projData.soldUnits || 0,
                        remainingUnits: projData.remainingUnits || 0,
                        status: projData.status as string || "Planning"
                    });
                } else {
                    alert("Project tidak ditemukan!");
                    router.push("/project");
                }
            });
            return () => unsubscribe();
        };

        const unsubProject = fetchProject();

        // Subscribe to Transactions Sub-collection
        if (id) {
            const q = query(collection(db, `projects/${id}/transactions`), orderBy("date", "desc"));
            const unsubscribeTrans = onSnapshot(q, (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date?.toDate() || new Date()
                })) as Transaction[];
                setTransactions(items);
                setIsLoading(false);
            });
            return () => {
                if (unsubProject instanceof Function) unsubProject();
                unsubscribeTrans();
            }
        }
    }, [id, router]);

    const stats = useMemo(() => {
        if (!project) return { profit: 0, isProfit: false, totalModal: 0, totalSales: 0 };

        const totalModal = (project.capitalInitial || 0) + (project.capitalAdditional || 0) + (project.expenditure || 0);
        const totalSales = (project.sellingPrice || 0) * (project.soldUnits || 0);
        const profit = totalSales - totalModal;

        return {
            profit,
            isProfit: profit > 0,
            totalModal,
            totalSales
        };
    }, [project]);

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !desc) return;
        setIsSubmitting(true);

        try {
            await addDoc(collection(db, `projects/${id}/transactions`), {
                amount: parseInt(amount.replace(/\D/g, "")),
                description: desc,
                type: transType,
                date: Timestamp.now()
            });
            setShowTransModal(false);
            setAmount("");
            setDesc("");
            alert("Transaksi berhasil ditambahkan!");
        } catch (error) {
            console.error(error);
            alert("Gagal menambahkan transaksi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "projects", id), {
                capitalInitial: Number(editForm.capitalInitial),
                capitalAdditional: Number(editForm.capitalAdditional),
                expenditure: Number(editForm.expenditure),
                sellingPrice: Number(editForm.sellingPrice),
                soldUnits: Number(editForm.soldUnits),
                remainingUnits: Number(editForm.remainingUnits),
                status: editForm.status
            });
            setShowEditModal(false);
            alert("Data project berhasil diupdate!");
        } catch (error) {
            console.error(error);
            alert("Gagal update project.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTransaction = async (transId: string) => {
        if (!confirm("Hapus transaksi ini?")) return;
        try {
            await deleteDoc(doc(db, `projects/${id}/transactions`, transId));
        } catch (error) {
            console.error(error);
        }
    }

    const formatRupiah = (value: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
    }

    if (isLoading || !project) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <p className="text-slate-500">Memuat detail project...</p>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display transition-colors duration-200 min-h-screen flex flex-col">

            <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-40 py-8 md:py-12 flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <button onClick={() => router.back()} className="flex items-center text-slate-500 hover:text-primary transition-colors self-start text-sm font-bold">
                        <span className="material-symbols-outlined text-lg mr-1">arrow_back</span>
                        Kembali
                    </button>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">{project.title}</h1>
                                {project.isPriority && (
                                    <span className="material-symbols-outlined text-3xl text-yellow-400 fill-current" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                )}
                            </div>
                            <p className="text-slate-500 dark:text-gray-400 text-lg">{project.description}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${project.status === 'Selesai' ? 'bg-green-500/10 border-green-500/20 text-green-600' :
                                    project.status === 'On Progress' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                        'bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-500'
                                    }`}>
                                    {project.status}
                                </span>
                                {project.category && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-500">
                                        {project.category}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex items-center justify-center h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-surface-border hover:border-primary dark:hover:border-primary text-slate-600 dark:text-slate-300 hover:text-primary transaction-colors font-bold text-sm transition-all"
                            >
                                <span className="material-symbols-outlined text-xl mr-2">edit_document</span>
                                Edit Data
                            </button>
                            <button
                                onClick={() => setShowTransModal(true)}
                                className="flex items-center justify-center h-12 px-6 rounded-xl bg-primary hover:bg-rose-600 text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all transform hover:scale-105"
                            >
                                <span className="material-symbols-outlined text-xl mr-2">payments</span>
                                Catat Keuangan
                            </button>
                        </div>
                    </div>
                </div>

                {/* Business Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Total Modal</span>
                        <div className="flex items-end justify-between">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">{formatRupiah(stats.totalModal)}</h3>
                            <span className="material-symbols-outlined text-slate-300">account_balance</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">Awal + Tambahan + Pengeluaran</span>
                    </div>

                    <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Total Penjualan</span>
                        <div className="flex items-end justify-between">
                            <h3 className="text-xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(stats.totalSales)}</h3>
                            <span className="material-symbols-outlined text-blue-300">shopping_bag</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">{project.soldUnits} unit x {formatRupiah(project.sellingPrice || 0)}</span>
                    </div>

                    <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Stock Tersedia</span>
                        <div className="flex items-end justify-between">
                            <h3 className="text-xl font-black text-purple-600 dark:text-purple-400">{project.remainingUnits} <span className="text-sm font-bold text-slate-400">Pcs</span></h3>
                            <span className="material-symbols-outlined text-purple-300">inventory_2</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">Siap dijual</span>
                    </div>

                    <div className={`bg-white dark:bg-surface-dark p-5 rounded-2xl border shadow-sm flex flex-col ${stats.isProfit ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Keuntungan (Laba/Rugi)</span>
                        <div className="flex items-end justify-between">
                            <h3 className={`text-xl font-black ${stats.isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {stats.profit < 0 ? '-' : ''} {formatRupiah(Math.abs(stats.profit))}
                            </h3>
                            <span className={`material-symbols-outlined ${stats.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.isProfit ? 'trending_up' : 'trending_down'}
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">{stats.isProfit ? 'Profit (Untung)' : 'Loss (Rugi)'}</span>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
                    <div className="p-6 border-b border-gray-100 dark:border-surface-border flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Riwayat Keuangan (Arus Kas)</h3>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-surface-border rounded text-slate-500">{transactions.length} Data</span>
                    </div>
                    <div className="flex flex-col">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-surface-border rounded-full flex items-center justify-center text-slate-300">
                                    <span className="material-symbols-outlined text-3xl">receipt_long</span>
                                </div>
                                <p className="text-slate-400 font-medium">Belum ada transaksi tercatat.</p>
                            </div>
                        ) : (
                            transactions.map((trans) => (
                                <div key={trans.id} className="group flex items-center justify-between p-4 border-b border-gray-50 dark:border-surface-border/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${trans.type === 'in' ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600'
                                            }`}>
                                            <span className="material-symbols-outlined text-xl">
                                                {trans.type === 'in' ? 'arrow_downward' : 'arrow_upward'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{trans.description}</span>
                                            <span className="text-xs text-slate-500">{trans.date.toLocaleDateString()} • {trans.type === 'in' ? 'Uang Masuk' : 'Uang Keluar'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-sm font-bold ${trans.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                            {trans.type === 'in' ? '+' : '-'} {formatRupiah(trans.amount)}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteTransaction(trans.id)}
                                            className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Add Transaction Modal */}
                {showTransModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 border border-white/10">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Catat Transaksi Baru</h3>
                            <form onSubmit={handleAddTransaction} className="flex flex-col gap-4">
                                <div className="p-1 bg-slate-100 dark:bg-black/20 rounded-lg flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setTransType("in")}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${transType === "in" ? "bg-white dark:bg-surface-border text-green-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                            }`}
                                    >
                                        Uang Masuk
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTransType("out")}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${transType === "out" ? "bg-white dark:bg-surface-border text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                            }`}
                                    >
                                        Uang Keluar
                                    </button>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Jumlah (Rp)</label>
                                    <input
                                        type="text"
                                        value={amount ? formatRupiah(parseInt(amount)).replace(",00", "") : ''}
                                        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Rp 0"
                                        className="w-full p-3 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-lg"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Keterangan</label>
                                    <input
                                        type="text"
                                        value={desc}
                                        onChange={(e) => setDesc(e.target.value)}
                                        placeholder="Keterangan transaksi..."
                                        className="w-full p-3 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowTransModal(false)}
                                        className="flex-1 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Menyimpan..." : "Simpan"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Project Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 border border-white/10 my-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Data Bisnis Project</h3>
                            <form onSubmit={handleUpdateProject} className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Modal & Pengeluaran */}
                                    <div className="col-span-full border-b border-gray-100 dark:border-white/5 pb-2 mb-2">
                                        <h4 className="text-sm font-black text-primary uppercase tracking-wider mb-3">Keuangan (Modal)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Modal Awal</label>
                                                <input
                                                    type="text"
                                                    value={editForm.capitalInitial ? formatRupiah(editForm.capitalInitial).replace(",00", "") : ""}
                                                    onChange={e => setEditForm({ ...editForm, capitalInitial: Number(e.target.value.replace(/\D/g, "")) })}
                                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary"
                                                    placeholder="Rp 0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Modal Tambahan</label>
                                                <input
                                                    type="text"
                                                    value={editForm.capitalAdditional ? formatRupiah(editForm.capitalAdditional).replace(",00", "") : ""}
                                                    onChange={e => setEditForm({ ...editForm, capitalAdditional: Number(e.target.value.replace(/\D/g, "")) })}
                                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary"
                                                    placeholder="Rp 0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Pengeluaran Lain</label>
                                                <input
                                                    type="text"
                                                    value={editForm.expenditure ? formatRupiah(editForm.expenditure).replace(",00", "") : ""}
                                                    onChange={e => setEditForm({ ...editForm, expenditure: Number(e.target.value.replace(/\D/g, "")) })}
                                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary"
                                                    placeholder="Rp 0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Penjualan */}
                                    <div className="col-span-full border-b border-gray-100 dark:border-white/5 pb-2 mb-2">
                                        <h4 className="text-sm font-black text-blue-500 uppercase tracking-wider mb-3">Penjualan (Sales)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Harga Jual / Pcs</label>
                                                <input
                                                    type="text"
                                                    value={editForm.sellingPrice ? formatRupiah(editForm.sellingPrice).replace(",00", "") : ""}
                                                    onChange={e => setEditForm({ ...editForm, sellingPrice: Number(e.target.value.replace(/\D/g, "")) })}
                                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary"
                                                    placeholder="Rp 0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Terjual (Pcs)</label>
                                                <input type="number" value={editForm.soldUnits} onChange={e => setEditForm({ ...editForm, soldUnits: Number(e.target.value) })} className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Sisa Stock (Pcs)</label>
                                                <input type="number" value={editForm.remainingUnits} onChange={e => setEditForm({ ...editForm, remainingUnits: Number(e.target.value) })} className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-full">
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Status Project</label>
                                        <select
                                            value={editForm.status}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary"
                                        >
                                            <option value="Planning">Planning</option>
                                            <option value="On Progress">On Progress</option>
                                            <option value="Selesai">Selesai</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Menyimpan Data..." : "Simpan Perubahan"}
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
