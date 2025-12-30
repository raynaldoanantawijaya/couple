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
    capitalInitial: number; // Modal Awal
    fixedCosts: { id: string, name: string, amount: number }[]; // Rincian Fixed Cost
    cogsPerUnit: number; // Modal per pcs / HPP
    sellingPrice: number; // Harga Jual
    initialStock: number; // Stok Awal
    stockAdded: number; // Barang Masuk
    soldUnits: number; // Jumlah Terjual
    // Budget Fields (Non-Business)
    budgetItems?: { id: string, name: string, estimated: number, actual: number, isPaid: boolean }[];
    // Legacy mapping (optional)
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
    const [selectedBudgetItem, setSelectedBudgetItem] = useState<string>("");
    const [addToBusinessLogic, setAddToBusinessLogic] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Project Form
    const [editForm, setEditForm] = useState({
        capitalInitial: 0,
        fixedCosts: [] as { id: string, name: string, amount: number }[],
        cogsPerUnit: 0,
        sellingPrice: 0,
        initialStock: 0,
        stockAdded: 0,
        soldUnits: 0,
        // Budget State
        budgetItems: [] as { id: string, name: string, estimated: number, actual: number, isPaid: boolean }[],
        status: "Planning"
    });

    useEffect(() => {
        const fetchProject = async () => {
            if (!id) return;
            const unsubscribe = onSnapshot(doc(db, "projects", id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const projData = { id: docSnap.id, ...data } as Project;
                    setProject(projData);

                    // Initialize edit form
                    setEditForm({
                        capitalInitial: projData.capitalInitial || 0,
                        fixedCosts: projData.fixedCosts || [],
                        cogsPerUnit: projData.cogsPerUnit || 0,
                        sellingPrice: projData.sellingPrice || 0,
                        initialStock: projData.initialStock || 0,
                        stockAdded: projData.stockAdded || 0,
                        soldUnits: projData.soldUnits || 0,
                        budgetItems: projData.budgetItems || [],
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
        // ... (Transaction subscription remains same)
        if (id) {
            const q = query(collection(db, `projects/${id}/transactions`), orderBy("date", "desc"));
            const unsubscribeTrans = onSnapshot(q, (snapshot) => {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() || new Date() })) as Transaction[];
                setTransactions(items);
                setIsLoading(false);
            });
            return () => { if (unsubProject instanceof Function) unsubProject(); unsubscribeTrans(); }
        }
    }, [id, router]);

    const businessStats = useMemo(() => {
        if (!project || project.category !== 'Bisnis') return null;

        const totalPenjualan = (project.sellingPrice || 0) * (project.soldUnits || 0);

        const totalFixedCost = (project.fixedCosts || []).reduce((acc, curr) => acc + curr.amount, 0);
        const totalStock = (project.initialStock || 0) + (project.stockAdded || 0);
        const modalTerpakai = totalFixedCost + (totalStock * (project.cogsPerUnit || 0)); // As defined: Fixed + (TotalItems * HPP)
        // OR should it be (Initial + Added) * HPP? Yes.

        const labaKotor = totalPenjualan - ((project.soldUnits || 0) * (project.cogsPerUnit || 0));
        const labaBersih = labaKotor - totalFixedCost;

        const sisaStok = totalStock - (project.soldUnits || 0);

        // BEP Calculation
        const marginPerUnit = (project.sellingPrice || 0) - (project.cogsPerUnit || 0);
        const bepPcs = marginPerUnit > 0 ? (totalFixedCost / marginPerUnit) : 0;
        const bepRupiah = bepPcs * (project.sellingPrice || 0);

        const marginPercent = (project.sellingPrice || 0) > 0
            ? ((marginPerUnit / (project.sellingPrice || 0)) * 100)
            : 0;

        const cashFlow = totalPenjualan - modalTerpakai; // Simple In - Out

        return {
            totalPenjualan,
            modalTerpakai,
            labaKotor,
            labaBersih,
            sisaStok,
            bepPcs: Math.ceil(bepPcs),
            bepRupiah,
            marginPercent,
            cashFlow
        };
    }, [project]);

    // Budget Stats Calculation (For Non-Business)
    const budgetStats = useMemo(() => {
        if (!project || project.category === 'Bisnis') return null;

        const items = project.budgetItems || [];
        const totalBudget = items.reduce((sum, item) => sum + (item.estimated || 0), 0);
        const totalActual = items.reduce((sum, item) => sum + (item.actual || 0), 0);
        const diff = totalBudget - totalActual; // + means Under Budget (Good), - means Over Budget (Bad)

        const paidCount = items.filter(i => i.isPaid).length; // Future use if needed
        const totalItems = items.length;
        // const progress = totalItems > 0 ? (paidCount / totalItems) * 100 : 0;

        return {
            totalBudget,
            totalActual,
            diff,
            isOverBudget: diff < 0
        };
    }, [project]);

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !desc) return;
        setIsSubmitting(true);

        const transAmount = parseInt(amount.replace(/\D/g, ""));

        try {
            // 1. Add Transaction Log
            await addDoc(collection(db, `projects/${id}/transactions`), {
                amount: transAmount,
                description: desc,
                type: transType,
                date: Timestamp.now(),
                relatedBudgetItemId: selectedBudgetItem || null
            });

            // 2. Update Project Data based on Selection
            if (project) {
                const updates: any = {};

                // NON-BISNIS: Update Budget Item Actual
                if (project.category !== 'Bisnis' && selectedBudgetItem && transType === 'out') {
                    const currentItems = project.budgetItems || [];
                    const updatedItems = currentItems.map(item => {
                        if (item.id === selectedBudgetItem) {
                            return { ...item, actual: (item.actual || 0) + transAmount };
                        }
                        return item;
                    });
                    updates.budgetItems = updatedItems;
                }

                // BISNIS: Update Business Logic (Optional)
                if (project.category === 'Bisnis' && addToBusinessLogic) {
                    if (transType === 'out') {
                        // Add to Fixed Costs
                        const newCost = { id: Date.now().toString(), name: desc, amount: transAmount };
                        updates.fixedCosts = [...(project.fixedCosts || []), newCost];
                    } else if (transType === 'in') {
                        // Add to Sold Units (Estimate)
                        // This is tricky, assume Amount = Revenue. Increase Sold Units?
                        // Or just let user manage units manually in Edit.
                        // For SAFETY, let's just log it or maybe only support FixedCost for now to avoid messing up unit economics.
                        // Actually, let's only do Fixed Costs for "Out". For "In" users usually manually update Sold Units count.
                    }
                }

                if (Object.keys(updates).length > 0) {
                    await updateDoc(doc(db, "projects", id), updates);
                }
            }

            setShowTransModal(false);
            setAmount("");
            setDesc("");
            setSelectedBudgetItem("");
            setAddToBusinessLogic(false);
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
                // Common
                status: editForm.status,

                // Business Fields
                capitalInitial: Number(editForm.capitalInitial),
                fixedCosts: editForm.fixedCosts,
                cogsPerUnit: Number(editForm.cogsPerUnit),
                sellingPrice: Number(editForm.sellingPrice),
                initialStock: Number(editForm.initialStock),
                stockAdded: Number(editForm.stockAdded),
                soldUnits: Number(editForm.soldUnits),

                // Budget Fields
                budgetItems: editForm.budgetItems,
            });
            setShowEditModal(false);
            // Removed alert
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

                {/* Business Intelligence Grid */}
                {businessStats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* 1. Total Penjualan */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Total Penjualan</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(businessStats.totalPenjualan)}</h3>
                                <span className="material-symbols-outlined text-blue-300">shopping_bag</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{project.soldUnits} unit x {formatRupiah(project.sellingPrice || 0)}</span>
                        </div>

                        {/* 2. Modal Terpakai */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Modal Terpakai</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">{formatRupiah(businessStats.modalTerpakai)}</h3>
                                <span className="material-symbols-outlined text-slate-300">account_balance_wallet</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Fixed Cost + (Stok x HPP)</span>
                        </div>

                        {/* 3. Laba Kotor */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Laba Kotor</span>
                            <div className="flex items-end justify-between">
                                <h3 className={`text-xl font-black ${businessStats.labaKotor >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatRupiah(businessStats.labaKotor)}</h3>
                                <span className="material-symbols-outlined text-slate-300">data_exploration</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Penjualan - HPP Terjual</span>
                        </div>

                        {/* 4. Laba Bersih */}
                        <div className={`bg-white dark:bg-surface-dark p-5 rounded-2xl border shadow-sm flex flex-col ${businessStats.labaBersih >= 0 ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10'}`}>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Laba Bersih</span>
                            <div className="flex items-end justify-between">
                                <h3 className={`text-xl font-black ${businessStats.labaBersih >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatRupiah(businessStats.labaBersih)}
                                </h3>
                                <span className={`material-symbols-outlined ${businessStats.labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {businessStats.labaBersih >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{businessStats.labaBersih >= 0 ? 'Profit (Untung)' : 'Loss (Rugi)'}</span>
                        </div>

                        {/* 5. Sisa Stok */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Sisa Stok</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-purple-600 dark:text-purple-400">{businessStats.sisaStok} <span className="text-sm font-bold text-slate-400">Pcs</span></h3>
                                <span className="material-symbols-outlined text-purple-300">inventory_2</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Dari total {(project.initialStock || 0) + (project.stockAdded || 0)} stok</span>
                        </div>

                        {/* 6. BEP Unit */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">BEP (Unit)</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-orange-600 dark:text-orange-400">{businessStats.bepPcs} <span className="text-sm font-bold text-slate-400">Pcs</span></h3>
                                <span className="material-symbols-outlined text-orange-300">balance</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Target jual minimal</span>
                        </div>

                        {/* 7. BEP Rupiah */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">BEP (Rupiah)</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-orange-600 dark:text-orange-400">{formatRupiah(businessStats.bepRupiah)}</h3>
                                <span className="material-symbols-outlined text-orange-300">payments</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Omzet minimal impas</span>
                        </div>

                        {/* 8. Margin */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Margin Profit</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-teal-600 dark:text-teal-400">{businessStats.marginPercent.toFixed(1)}%</h3>
                                <span className="material-symbols-outlined text-teal-300">percent</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Persentase keuntungan</span>
                        </div>

                        {/* 9. Cashflow */}
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Cash Flow</span>
                            <div className="flex items-end justify-between">
                                <h3 className={`text-xl font-black ${businessStats.cashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatRupiah(businessStats.cashFlow)}</h3>
                                <span className="material-symbols-outlined text-slate-300">currency_exchange</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Selisih Uang Masuk & Keluar</span>
                        </div>
                    </div>
                )}

                {/* Budget Dashboard (Non-Business) */}
                {budgetStats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Rencana Anggaran</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">{formatRupiah(budgetStats.totalBudget)}</h3>
                                <span className="material-symbols-outlined text-slate-300">assignment</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Total Estimasi Biaya</span>
                        </div>

                        <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-200 dark:border-surface-border shadow-sm flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">Realisasi (Terpakai)</span>
                            <div className="flex items-end justify-between">
                                <h3 className="text-xl font-black text-blue-600 dark:text-blue-400">{formatRupiah(budgetStats.totalActual)}</h3>
                                <span className="material-symbols-outlined text-blue-300">receipt_long</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">Total Biaya Sesungguhnya</span>
                        </div>

                        <div className={`bg-white dark:bg-surface-dark p-5 rounded-2xl border shadow-sm flex flex-col ${budgetStats.isOverBudget ? 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10' : 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10'}`}>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">{budgetStats.isOverBudget ? 'Over Budget' : 'Sisa Budget'}</span>
                            <div className="flex items-end justify-between">
                                <h3 className={`text-xl font-black ${budgetStats.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {formatRupiah(Math.abs(budgetStats.diff))}
                                </h3>
                                <span className={`material-symbols-outlined ${budgetStats.isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                                    {budgetStats.isOverBudget ? 'warning' : 'savings'}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{budgetStats.isOverBudget ? 'Melebihi Estimasi' : 'Lebih Hemat'}</span>
                        </div>
                    </div>
                )}

                {/* Transaction List ... defaults to Generic Transactions for now, 
                    but could ideally link to budget items. 
                    For now keep it separate to avoid complexity. */}
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

                                {/* INTEGRATION OPTIONS */}
                                {project.category !== 'Bisnis' && transType === 'out' && project.budgetItems && project.budgetItems.length > 0 && (
                                    <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                                        <label className="text-xs font-bold text-slate-500 block mb-2">Alokasikan ke Anggaran (Opsional)</label>
                                        <select
                                            value={selectedBudgetItem}
                                            onChange={(e) => setSelectedBudgetItem(e.target.value)}
                                            className="w-full p-2 rounded-md bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm"
                                        >
                                            <option value="">-- Tidak Terkait Anggaran --</option>
                                            {project.budgetItems.map(item => (
                                                <option key={item.id} value={item.id}>{item.name} (Sisa: {formatRupiah((item.estimated || 0) - (item.actual || 0))})</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1">Jika dipilih, nilai ini akan menambah "Realisasi" pada item tersebut.</p>
                                    </div>
                                )}

                                {project.category === 'Bisnis' && transType === 'out' && (
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                                        <input
                                            type="checkbox"
                                            id="addToBusiness"
                                            checked={addToBusinessLogic}
                                            onChange={(e) => setAddToBusinessLogic(e.target.checked)}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <label htmlFor="addToBusiness" className="text-sm font-bold text-slate-700 dark:text-slate-200">Catat sebagai Fixed Cost</label>
                                            <p className="text-[10px] text-slate-400">Nilai ini akan ditambahkan ke daftar Fixed Cost project.</p>
                                        </div>
                                    </div>
                                )}

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
                        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col gap-6 border border-white/10 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-4">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Data {project.category === 'Bisnis' ? 'Bisnis' : 'Project'}</h3>
                                <button onClick={() => setShowEditModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-white/10 rounded-full hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"><span className="material-symbols-outlined text-sm">close</span></button>
                            </div>

                            <form onSubmit={handleUpdateProject} className="flex flex-col gap-8">
                                {/* CATEGORY: BISNIS */}
                                {project.category === 'Bisnis' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* COLUMN 1: COST & CAPITAL */}
                                        <div className="flex flex-col gap-6">
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                <h4 className="text-sm font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-lg">account_balance_wallet</span> Modal & Pengeluaran</h4>

                                                <div className="flex flex-col gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Modal Awal (Cash)</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.capitalInitial ? formatRupiah(editForm.capitalInitial).replace(",00", "") : ""}
                                                            onChange={e => setEditForm({ ...editForm, capitalInitial: Number(e.target.value.replace(/\D/g, "")) })}
                                                            className="w-full p-2.5 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary font-mono font-bold"
                                                            placeholder="Rp 0"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Modal Per Pcs (HPP)</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.cogsPerUnit ? formatRupiah(editForm.cogsPerUnit).replace(",00", "") : ""}
                                                            onChange={e => setEditForm({ ...editForm, cogsPerUnit: Number(e.target.value.replace(/\D/g, "")) })}
                                                            className="w-full p-2.5 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary font-mono font-bold"
                                                            placeholder="Rp 0"
                                                        />
                                                        <p className="text-[10px] text-slate-400 mt-1">Harga pokok per satu barang</p>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-xs font-bold text-slate-500 block">Rincian Fixed Cost</label>
                                                            <button type="button" onClick={() => setEditForm({ ...editForm, fixedCosts: [...(editForm.fixedCosts || []), { id: Date.now().toString(), name: "", amount: 0 }] })} className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors">+ Tambah</button>
                                                        </div>

                                                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                            {editForm.fixedCosts.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Belum ada fixed cost.</p>}
                                                            {editForm.fixedCosts.map((item, idx) => (
                                                                <div key={idx} className="flex gap-2 items-center">
                                                                    <input type="text" placeholder="Nama Biaya" value={item.name} onChange={e => {
                                                                        const newCosts = [...editForm.fixedCosts];
                                                                        newCosts[idx].name = e.target.value;
                                                                        setEditForm({ ...editForm, fixedCosts: newCosts });
                                                                    }} className="flex-1 p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs" />
                                                                    <input type="text" placeholder="0" value={item.amount ? parseInt(item.amount.toString()).toLocaleString("id-ID") : ""} onChange={e => {
                                                                        const newCosts = [...editForm.fixedCosts];
                                                                        newCosts[idx].amount = Number(e.target.value.replace(/\D/g, ""));
                                                                        setEditForm({ ...editForm, fixedCosts: newCosts });
                                                                    }} className="w-24 p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-xs font-mono text-right" />
                                                                    <button type="button" onClick={() => {
                                                                        const newCosts = editForm.fixedCosts.filter((_, i) => i !== idx);
                                                                        setEditForm({ ...editForm, fixedCosts: newCosts });
                                                                    }} className="text-slate-400 hover:text-red-500"><span className="material-symbols-outlined text-lg">delete</span></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* COLUMN 2: SALES & STOCK */}
                                        <div className="flex flex-col gap-6">
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                <h4 className="text-sm font-black text-blue-500 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-lg">inventory_2</span> Stok & Penjualan</h4>

                                                <div className="flex flex-col gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Harga Jual / Pcs</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.sellingPrice ? formatRupiah(editForm.sellingPrice).replace(",00", "") : ""}
                                                            onChange={e => setEditForm({ ...editForm, sellingPrice: Number(e.target.value.replace(/\D/g, "")) })}
                                                            className="w-full p-2.5 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary font-mono font-bold text-lg text-blue-600 dark:text-blue-400"
                                                            placeholder="Rp 0"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Stok Awal</label>
                                                            <input type="number" value={editForm.initialStock} onChange={e => setEditForm({ ...editForm, initialStock: Number(e.target.value) })} className="w-full p-2.5 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary font-bold" />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">Barang Masuk</label>
                                                            <input type="number" value={editForm.stockAdded} onChange={e => setEditForm({ ...editForm, stockAdded: Number(e.target.value) })} className="w-full p-2.5 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 outline-none focus:border-primary font-bold" />
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                                        <label className="text-xs font-bold text-green-700 dark:text-green-400 mb-1 block">Jumlah Terjual (Sold)</label>
                                                        <input type="number" value={editForm.soldUnits} onChange={e => setEditForm({ ...editForm, soldUnits: Number(e.target.value) })} className="w-full p-3 rounded-lg bg-white dark:bg-black/20 border border-green-200 dark:border-green-900/30 outline-none focus:border-green-500 font-bold text-2xl text-center text-green-600 dark:text-green-400" />
                                                        <p className="text-center text-[10px] text-green-600/70 mt-2">Ubah angka ini setiap ada penjualan baru</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CATEGORY: NON-BISNIS (Budget/Expense) */}
                                {project.category !== 'Bisnis' && (
                                    <div className="flex flex-col gap-6">
                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2"><span className="material-symbols-outlined text-lg">receipt_long</span> Rincian Anggaran</h4>
                                                <button type="button" onClick={() => setEditForm({ ...editForm, budgetItems: [...(editForm.budgetItems || []), { id: Date.now().toString(), name: "", estimated: 0, actual: 0, isPaid: false }] })} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm">+ Tambah Item</button>
                                            </div>

                                            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {editForm.budgetItems.length === 0 && (
                                                    <div className="text-center py-8 text-slate-400 italic bg-white dark:bg-black/10 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                                        Belum ada rincian anggaran. Tambahkan item keperluanmu!
                                                    </div>
                                                )}
                                                {editForm.budgetItems.map((item, idx) => (
                                                    <div key={idx} className="bg-white dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                        <div className="flex-1 w-full">
                                                            <label className="text-[10px] font-bold text-slate-400 mb-0.5 block uppercase">Nama Keperluan</label>
                                                            <input type="text" placeholder="Contoh: Tiket, Hotel, Cat Tembok" value={item.name} onChange={e => {
                                                                const newItems = [...editForm.budgetItems];
                                                                newItems[idx].name = e.target.value;
                                                                setEditForm({ ...editForm, budgetItems: newItems });
                                                            }} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/10 text-sm font-bold outline-none focus:border-primary" />
                                                        </div>
                                                        <div className="w-full sm:w-32">
                                                            <label className="text-[10px] font-bold text-slate-400 mb-0.5 block uppercase">Estimasi (Plan)</label>
                                                            <input type="text" placeholder="0" value={item.estimated ? parseInt(item.estimated.toString()).toLocaleString("id-ID") : ""} onChange={e => {
                                                                const newItems = [...editForm.budgetItems];
                                                                newItems[idx].estimated = Number(e.target.value.replace(/\D/g, ""));
                                                                setEditForm({ ...editForm, budgetItems: newItems });
                                                            }} className="w-full p-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/10 text-sm font-mono text-right outline-none focus:border-primary" />
                                                        </div>
                                                        <div className="w-full sm:w-32">
                                                            <label className="text-[10px] font-bold text-blue-400 mb-0.5 block uppercase">Realisasi (Act)</label>
                                                            <input type="text" placeholder="0" value={item.actual ? parseInt(item.actual.toString()).toLocaleString("id-ID") : ""} onChange={e => {
                                                                const newItems = [...editForm.budgetItems];
                                                                newItems[idx].actual = Number(e.target.value.replace(/\D/g, ""));
                                                                setEditForm({ ...editForm, budgetItems: newItems });
                                                            }} className="w-full p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 text-sm font-mono text-right text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500" />
                                                        </div>
                                                        <div className="flex items-center pt-5 pl-2">
                                                            <button type="button" onClick={() => {
                                                                const newItems = editForm.budgetItems.filter((_, i) => i !== idx);
                                                                setEditForm({ ...editForm, budgetItems: newItems });
                                                            }} className="text-slate-300 hover:text-red-500 transition-colors" title="Hapus Item">
                                                                <span className="material-symbols-outlined">delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-6 text-sm">
                                                <div className="text-right">
                                                    <span className="text-xs text-slate-500 block">Total Estimasi</span>
                                                    <span className="font-bold text-slate-900 dark:text-white text-lg">
                                                        {formatRupiah(editForm.budgetItems.reduce((acc, i) => acc + (i.estimated || 0), 0))}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs text-blue-500 block">Total Realisasi</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                                                        {formatRupiah(editForm.budgetItems.reduce((acc, i) => acc + (i.actual || 0), 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
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

                                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
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
