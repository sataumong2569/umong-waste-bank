import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { Download, Trash2 } from 'lucide-react'; // 🌟 นำเข้าไอคอนแบบเดียวกับหน้าตารางประวัติฝากขยะ

const AdminLogsView = ({ adminLogs, setCurrentPage, db, refreshData }) => {

    const getActionBadge = (actionText) => {
        const text = actionText || '';
        if (text.includes('นำเข้า') || text.includes('Import')) return { label: 'นำเข้าข้อมูล', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        if (text.includes('ลบ')) return { label: 'ลบข้อมูล', color: 'bg-rose-100 text-rose-700 border-rose-200' };
        if (text.includes('แก้ไข') || text.includes('ปรับเปลี่ยน')) return { label: 'แก้ไขข้อมูล', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (text.includes('หักเงิน') || text.includes('ธุรกรรมการเงิน')) return { label: 'ธุรกรรมการเงิน', color: 'bg-purple-100 text-purple-700 border-purple-200' };
        if (text.includes('ลงทะเบียน') || text.includes('เพิ่ม')) return { label: 'เพิ่มข้อมูล', color: 'bg-blue-100 text-blue-700 border-blue-200' };
        if (text.includes('ราคากลาง')) return { label: 'ตั้งค่าระบบ', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
        return { label: 'บันทึกระบบ', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    };

    const formatDisplayTime = (log) => {
        if (log.date && log.time) {
            return `${log.date} ${log.time}`;
        }
        if (log.timestamp) {
            const date = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            return date.toLocaleString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        return '-';
    };

    const handleExportLogs = () => {
        if (!adminLogs || adminLogs.length === 0) return alert("❌ ไม่มีข้อมูลประวัติให้ส่งออก");

        const headers = ['วัน-เวลา', 'ผู้ทำรายการ', 'ประเภท', 'รายละเอียดกิจกรรม'];
        const rows = adminLogs.map(log => {
            const badge = getActionBadge(log.action);
            return [
                formatDisplayTime(log),
                log.operator || 'System / Admin',
                badge.label,
                log.action
            ];
        });

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ประวัติการทำงานเจ้าหน้าที่_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const handleClearLogs = async () => {
        if (!adminLogs || adminLogs.length === 0) return alert("ไม่มีข้อมูลประวัติให้ลบครับ");

        if (!window.confirm("⚠️ ยืนยันการ 'ล้างประวัติ' การทำงานของเจ้าหน้าที่ทั้งหมด?\n\n(ข้อมูลจะถูกลบออกจากฐานข้อมูลอย่างถาวร แนะนำให้กด Export เก็บไว้ก่อน)")) return;

        try {
            for (const log of adminLogs) {
                if (log.id) {
                    await deleteDoc(doc(db, "admin_logs", String(log.id)));
                }
            }
            alert("🗑️ ล้างประวัติการทำงานของเจ้าหน้าที่เรียบร้อยแล้ว!");
            if (typeof refreshData === 'function') refreshData();
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการลบข้อมูล: ", error);
            alert("❌ เกิดข้อผิดพลาดในการล้างข้อมูล กรุณาลองใหม่");
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col p-4">

            {/* 🌟 ปรับ Header ให้ล้อตามสไตล์ HistoryView เป๊ะๆ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center shrink-0 flex-wrap gap-4">
                <div>
                    <h2 className="font-black text-2xl text-slate-800 tracking-tight">
                        ประวัติการทำงานเจ้าหน้าที่
                    </h2>
                    <p className="text-sm text-slate-500 font-bold mt-1">ตรวจสอบบันทึกและกิจกรรมการจัดการระบบของแอดมิน</p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => setCurrentPage('admin')}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap"
                    >
                        ← ย้อนกลับ
                    </button>
                    {adminLogs && adminLogs.length > 0 && (
                        <>
                            <button
                                onClick={handleExportLogs}
                                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition whitespace-nowrap flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> Export CSV
                            </button>

                            <button
                                onClick={handleClearLogs}
                                className="bg-rose-50 text-rose-600 border border-rose-200 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-600 hover:text-white transition whitespace-nowrap flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} /> ล้างประวัติทั้งหมด
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 🌟 ปรับตารางให้โครงสร้างเหมือน HistoryView */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-slate-100 text-[11px] uppercase font-black text-slate-600 sticky top-0 z-20">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">วัน-เวลา</th>
                                <th className="p-4 text-left">ผู้ทำรายการ</th>
                                <th className="p-4 text-center">ประเภทกิจกรรม</th>
                                <th className="p-4 text-left">รายละเอียดการกระทำในระบบ</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {adminLogs && adminLogs.length > 0 ? adminLogs.map((log, index) => {
                                const badge = getActionBadge(log.action);
                                return (
                                    <tr key={log.id || index} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4 sticky left-0 bg-white border-r border-slate-50 min-w-[180px] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                            <div className="text-slate-600 font-bold whitespace-nowrap">
                                                {formatDisplayTime(log)}
                                            </div>
                                        </td>
                                        <td className="p-4 font-black text-slate-800">
                                            {log.operator || 'System / Admin'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1 rounded-lg border text-xs font-black whitespace-nowrap ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium leading-relaxed max-w-xl">
                                            {log.action}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center text-slate-400 font-bold bg-slate-50/50 text-base">
                                        ยังไม่มีประวัติการทำงานของเจ้าหน้าที่บนฐานข้อมูลคลาวด์
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminLogsView;