// === ส่วนที่ 1: การนำเข้าไลบรารีและเครื่องมือต่างๆ (Imports) ===
// ส่วนนี้คือการดึงความสามารถภายนอกมาใช้ในเว็บของเรา เช่น กราฟ, ไอคอน และตัวช่วยของ React
import './App.css'; // นำเข้าสไตล์การตกแต่งจากไฟล์ CSS
import webLogo from './img/Logo_umongcity_transparent.png';
import React, { useState, useEffect, useMemo } from 'react'; // นำเข้าหัวใจหลักของ React (State, Effect, Memo)
// นำเข้าส่วนประกอบของกราฟ (BarChart = กราฟแท่ง, PieChart = กราฟวงกลม)
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
// นำเข้าไอคอนต่างๆ จาก Lucide-React เพื่อใช้ในเมนูและปุ่ม (เช่น Dashboard, Users, Map)
import {
    LayoutDashboard, Users, Map as MapIcon, History, LogIn,
    Database, FileSpreadsheet, MapPin, Navigation, Info, AlertTriangle,
    Menu, X, ChevronRight, TrendingUp, Leaf, Wallet, PlusCircle, ChevronDown,
    Eye, EyeOff, Search, ChevronLeft, Home, Edit2, Save, Download, ShieldCheck
} from 'lucide-react';
import { db } from './firebase'; // อันนี้ตัวเดียวพอ!
import {
    collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, increment, serverTimestamp, startAfter, onSnapshot
} from 'firebase/firestore';
import MapView from './MapView.jsx';
// === ส่วนที่ 2: องค์ประกอบย่อย (Sub-Components & Constants) ===
// ส่วนนี้คือการสร้าง "ชิ้นส่วนเล็กๆ" ไว้ข้างนอก เพื่อให้ตัว App หลักเรียกใช้ได้ง่ายและไม่รก
/**
 * NavItem: ปุ่มเมนูหลักในแถบ Sidebar
 * @param {boolean} active - สถานะว่าตอนนี้กำลังเปิดหน้านี้อยู่หรือไม่ (ถ้าใช่ จะขึ้นเส้นใต้สีน้ำเงิน)
 * @param {function} onClick - ฟังก์ชันที่จะทำงานเมื่อกดปุ่ม (เช่น เปลี่ยนหน้า)
 * @param {string} label - ชื่อของเมนูที่จะแสดง
 */
const NavItem = ({ active, onClick, label }) => (
    <button onClick={onClick}
        className={`text-sm font-semibold transition-colors ${active
            ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
            : 'text-slate-500 hover:text-blue-500'}`}>{label}
    </button>
);
// --- ปุ่มเมนูสำหรับแสดงผลบนมือถือ ---
// ใช้แสดงผลเมื่อเปิดเว็บผ่านโทรศัพท์ จะมีไอคอนและพื้นหลังสีฟ้าเวลาที่เลือกเมนูนั้นๆ
const MobileNavItem = ({ active, onClick, label, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${active
            ? 'bg-blue-50 text-blue-600 font-bold'
            : 'text-slate-600'
            }`}
    >
        {/* แสดงไอคอนและชื่อเมนูต่อกัน */}
        {icon} {label}
    </button>
);
/**
 * === DashboardView: หน้าจอภาพรวมสถิติ (หน้าแรก) ===
 * ส่วนนี้ทำหน้าที่ดึงข้อมูลสรุปมาแสดงผลเป็นกราฟและกล่องตัวเลข
 * @param {Array} stats - ข้อมูลสถิติ 5 กล่อง (ขยะรวม, คาร์บอน, ฯลฯ)
 * @param {Array} villageData - ข้อมูลอันดับของแต่ละหมวด
 * @param {Array} wasteTypeData - ข้อมูลน้ำหนักขยะแยกตามประเภทสำหรับกราฟแท่ง
 * @param {Array} members - ข้อมูลสมาชิกเพื่อนำมาคำนวณสัดส่วนการคัดแยก
 */
const DashboardView = ({ stats, villageData, wasteTypeData, members, setCurrentPage }) => {
    // 1. สัดส่วนการคัดแยกขยะ
    // ใช้ useMemo คำนวณสัดส่วนสมาชิกที่คัดแยกขยะแล้ว เทียบกับที่ยังไม่คัดแยก
    const separationStats = useMemo(() => {
        // ระบบป้องกัน: ถ้ายังไม่มีข้อมูลสมาชิก ให้ค่าเป็น 0 ทั้งหมดก่อน
        if (!members) return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: 0, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: 0, color: '#ef4444' }
        ];

        // กรองหาจำนวนบ้านที่ทำเครื่องหมายว่าคัดแยกแล้ว (isSorted)
        const sortedCount = members.filter(m => m.isSorted).length;
        const notSortedCount = members.length - sortedCount;

        return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: sortedCount, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: notSortedCount, color: '#ef4444' }
        ];
    }, [members]);
    // 2. สัดส่วนการเข้าร่วมโครงการ (วงกลม 2)
    const participationStats = useMemo(() => {
        const participatedCount = members ? members.length : 0;
        const notParticipatedCount = 600; // ตั้งค่าเป้าหมายไว้ที่ 600 ก่อน
        return [
            { name: 'เข้าร่วมโครงการแล้ว', value: participatedCount, color: '#29c21bff' },
            { name: 'ยังไม่ได้เข้าร่วม', value: notParticipatedCount, color: '#8e978fff' }
        ];
    }, [members]);

    // 3. แนวโน้มการเติบโตของสมาชิก (ใช้ข้อมูลวันที่จริงจาก ID)
    const trendData = useMemo(() => {
        if (!members) return [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let beforeThisMonthCount = 0; // ยอดสะสมจนถึงเดือนที่แล้ว

        members.forEach(m => {
            // ระบบจะเอา ID ที่เป็นตัวเลข (Date.now()) มาแปลงกลับเป็นวันที่
            const joinDate = new Date(Number(m.id));

            // เช็คว่าถ้าไม่ใช่เดือนนี้และปีนี้ แปลว่าเป็นคนเก่าของเดือนก่อนๆ
            if (!isNaN(joinDate.getTime())) {
                if (joinDate.getMonth() !== currentMonth || joinDate.getFullYear() !== currentYear) {
                    beforeThisMonthCount++;
                }
            } else {
                // ถ้าดึงวันที่ไม่ได้ (เช่น ID แบบเก่าที่เป็นตัวหนังสือ) ให้เหมาว่าเป็นคนเก่าไว้ก่อน
                beforeThisMonthCount++;
            }
        });

        // เดือนก่อนหน้า = คนที่มีอยู่ก่อนเดือนนี้ทั้งหมด
        // เดือนนี้ = ยอดรวมทุกคนในระบบปัจจุบัน
        return [
            { name: 'เดือนก่อน', amount: beforeThisMonthCount, color: '#106e18ff' },
            { name: 'เดือนนี้', amount: members.length, color: '#19ac19ff' }
        ];
    }, [members]);

    return (
        <div className="space-y-6">
            {/* ส่วนที่ 1: การแสดงผลสถิติ 5 กล่องด้านบน (สรุปตัวเลขสำคัญ) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {stats && stats.length > 0 ? (
                    stats.map((stat, i) => (
                        <div key={i} className="modern-card flex flex-col gap-2 relative group cursor-default">
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-blue-50 rounded-2xl">{stat.icon}</div>
                                {stat.hasTooltip && <Info size={16} className="text-slate-300 cursor-help" />}
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-slate-500 mb-1">{stat.label}</p>
                                <p className="text-xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    // ถ้าข้อมูลยังมาไม่ถึง ให้แสดงกล่องเปล่าๆ 5 กล่องไว้จองพื้นที่
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="modern-card h-[120px] animate-pulse bg-slate-50 border border-slate-100 flex flex-col justify-center items-center">
                            <div className="w-10 h-10 bg-slate-200 rounded-2xl mb-2"></div>
                            <div className="w-20 h-4 bg-slate-200 rounded-md"></div>
                        </div>
                    ))
                )}
            </div>

            {/* ── 🌟 ส่วนที่ 2: จัด Layout ใหม่ (ซ้าย 70% : ขวา 30%) ── */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* 📊 ฝั่งซ้าย (70%): กราฟวงกลม */}
                <div className="lg:w-[70%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
                        <h3 className="font-bold text-lg mb-6 text-slate-800 flex items-center gap-2">
                            <Leaf size={22} className="text-emerald-500" />
                            สัดส่วนสมาชิกที่คัดแยกประเภทขยะ (หมู่ 6)
                        </h3>

                        <div className="h-[350px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center border border-slate-100 mb-6">
                            {separationStats && separationStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={separationStats}
                                            innerRadius="45%"
                                            outerRadius="75%"
                                            paddingAngle={8}
                                            dataKey="value"
                                            /* 🌟 ปรับตรงนี้: ถ้ามือถือจอเล็ก (<640px) ให้ซ่อน label ทันที */
                                            label={({ name, value, x, y, textAnchor }) => {
                                                const isMobile = window.innerWidth < 640;
                                                if (isMobile) return null; // มือถือไม่โชว์ label ตรงวงกลม

                                                const shortName = name === 'ยังไม่คัดแยกประเภทขยะ' ? 'ยังไม่คัดแยก' : 'คัดแยกแล้ว';
                                                return (
                                                    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill="#475569" fontSize={13} fontWeight="bold">
                                                        {name}: {value}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {separationStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.name === 'ยังไม่คัดแยกประเภทขยะ' ? '#ef4444' : '#10b981'} />
                                            ))}
                                        </Pie>

                                        <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />

                                        {/* 🌟 Legend จะโชว์ข้อมูลแทนบนมือถือ ทำให้ดูสะอาดตา */}
                                        <Legend
                                            iconType="circle"
                                            layout="horizontal"
                                            verticalAlign="bottom"
                                            align="center"
                                            wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-slate-400 font-medium">กำลังโหลดข้อมูล...</p>
                            )}
                        </div>

                        {/* สรุปตัวเลขใต้กราฟวงกลม */}
                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            <div className="p-4 bg-emerald-500/10 rounded-2xl text-center border-2 border-emerald-500/20 shadow-sm">
                                <p className="text-[13px] text-emerald-700 font-black mb-1">คัดแยกแล้ว</p>
                                <p className="text-2xl font-black text-emerald-700">
                                    {separationStats[0].value} <span className="text-xs font-bold opacity-70">หลัง</span>
                                </p>
                            </div>

                            {/* กล่องสีแดง: ปรับเป็น bg-red-500/10 ให้มีเนื้อสีแดงจางๆ ที่ชัดขึ้น */}
                            <div className="p-4 bg-red-500/10 rounded-2xl text-center border-2 border-red-500/20 shadow-sm">
                                <p className="text-[13px] text-red-700 font-black mb-1">ยังไม่คัดแยก</p>
                                <p className="text-2xl font-black text-red-600">
                                    {separationStats[1].value} <span className="text-xs font-bold opacity-70">หลัง</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🏆 ฝั่งขวา (30%): อันดับหมวดสูงสุด (List Box) */}
                <div className="lg:w-[30%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                🏆 อันดับหมวดที่มีคาร์บอนเครดิตสูงสุด
                            </h3>
                        </div>

                        {/* List Box แนวตั้ง */}
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            {[...villageData]
                                .sort((a, b) => b.credit - a.credit)
                                .map((v, i) => (
                                    <div key={v.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:bg-emerald-50 hover:border-emerald-100 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            {/* เหรียญรางวัล */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0
                                                ${i === 0 ? 'bg-amber-100 text-amber-600 shadow-sm' :
                                                    i === 1 ? 'bg-slate-200 text-slate-500' :
                                                        i === 2 ? 'bg-orange-100 text-orange-600' :
                                                            'bg-white border text-slate-400'}`}>
                                                {i + 1}
                                            </div>

                                            {/* ชื่อหมู่บ้าน */}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-700 group-hover:text-emerald-700 transition-colors">{v.name}</span>
                                            </div>
                                        </div>

                                        {/* 🌟 ยอดเงิน (ชิดขวา) */}
                                        <div className="text-right flex flex-col items-end">
                                            <span className="font-black text-emerald-600 font-mono text-sm">
                                                ฿{(v.totalBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">ยอดเงิน (บาท)</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

            </div>
            {/* ── แถวที่ 3: กราฟเข้าร่วม (60%) + กราฟแท่งแนวนอนเปรียบเทียบ (40%) ── */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* กราฟเข้าร่วม 60% */}
                <div className="lg:w-[60%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[350px]">
                        <h3 className="font-bold text-lg mb-6 text-slate-800 flex items-center gap-2">
                            <Users size={22} className="text-blue-500" /> การเข้าร่วมธนาคารขยะ
                        </h3>
                        <div className="h-[250px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center border border-slate-50 mb-6 flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={participationStats}
                                        innerRadius="45%"
                                        outerRadius="75%"
                                        paddingAngle={6}
                                        dataKey="value"
                                        /* 🌟 ปรับตรงนี้: ถ้าเป็นมือถือให้ซ่อน label (คืนค่า null), ถ้าจอใหญ่ให้แสดงปกติ */
                                        label={({ name, value, x, y, textAnchor }) => {
                                            const isMobile = window.innerWidth < 640;
                                            if (isMobile) return null; // 👈 ซ่อน Label ในมือถือทันที!

                                            const shortName = name.replace('โครงการ', '');
                                            return (
                                                <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill="#475569" fontSize={13} fontWeight="bold">
                                                    {name}: {value}
                                                </text>
                                            );
                                        }}
                                    >
                                        {participationStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>

                                    {/* 🌟 Legend จะมาทำหน้าที่แทนที่ข้อมูลในมือถือ สวยและอ่านง่ายแน่นอน */}
                                    <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Legend
                                        iconType="circle"
                                        layout="horizontal"
                                        verticalAlign="bottom"
                                        align="center"
                                        wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* กราฟแนวนอนเปรียบเทียบ + ปุ่ม 40% */}
                <div className="lg:w-[40%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[350px]">
                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                📈 แนวโน้มการเข้าร่วม
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">เปรียบเทียบยอดสมาชิกเดือนนี้และเดือนก่อนหน้า</p>
                        </div>

                        {/* กราฟแท่งแนวนอน (Horizontal Bar Chart) */}
                        <div className="h-[150px] w-full mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={trendData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 'bold' }} />
                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="amount" radius={[0, 8, 8, 0]} barSize={28} label={{ position: 'right', fill: '#475569', fontSize: 14, fontWeight: 'bold' }}>
                                        {trendData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* ปุ่ม Action กดทะลุไปหน้าข้อมูลสมาชิก */}
                        <div className="mt-auto">
                            <button
                                onClick={() => {
                                    if (typeof setCurrentPage !== 'undefined') {
                                        // 1. สั่งเปลี่ยนหน้าไปที่ข้อมูลสมาชิก
                                        setCurrentPage('villages');

                                        // 2. สั่งให้หน้าจอเด้งกลับไปบนสุดทันที (แบบสมูทๆ ไม่กระตุก)
                                        window.scrollTo({
                                            top: 0,
                                            behavior: 'smooth' // ถ้าอยากให้เด้งขึ้นไปทันทีแบบไม่ต้องเลื่อน ให้แก้คำว่า 'smooth' เป็น 'auto' ได้ครับ
                                        });
                                    }
                                }}
                                className="w-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors group shadow-sm"
                            >
                                <Users size={20} className="group-hover:scale-110 transition-transform" />
                                เปิดดูข้อมูลสมาชิกทั้งหมด
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ส่วนที่ 4: กราฟแท่ง (Bar Chart) แสดงปริมาณน้ำหนักขยะแยกตามประเภท */}
            <div className="modern-card">
                <h3 className="font-bold text-lg mb-4 text-slate-800">ปริมาณขยะแยกตามประเภท (กิโลกรัม)</h3>
                <div className="h-[300px] min-h-[300px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center">
                    {wasteTypeData && wasteTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={wasteTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="grad-plastic" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#86efac" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-paper" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#ffedd5" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-glass" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-aluminum" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#e9d5ff" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-alloy" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="0 0" vertical={false} stroke="#f1f5f9" opacity={0.4} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: window.innerWidth < 640 ? 9 : 11 }} // ปรับ font เล็กลงในมือถือ
                                    dy={10}
                                    interval={0} // บังคับให้โชว์ทุกอัน
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <RechartsTooltip cursor={{ fill: '#f8fafc', opacity: 0.4 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }} />

                                <Bar dataKey="amount" maxBarSize={40} radius={[6, 6, 0, 0]} >
                                    {wasteTypeData.map((entry, index) => {
                                        const colorGradients = [
                                            'url(#grad-plastic)', 'url(#grad-paper)', 'url(#grad-glass)', 'url(#grad-aluminum)', 'url(#grad-alloy)'
                                        ];
                                        return <Cell key={`cell-${index}`} fill={colorGradients[index % colorGradients.length]} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            กำลังโหลดข้อมูล...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const MemoizedDashboardView = React.memo(DashboardView);
// =========================================================================
// หน้าจอราคารับซื้อขยะ + เครื่องคำนวณเงินจำลองสำหรับผู้ใช้ทั่วไป
// =========================================================================
const PriceView = ({ isLoggedIn, isEditing, setIsEditing }) => {
    // ฐานข้อมูลราคารับซื้อตั้งต้น (5 ประเภทหลัก)
    const [prices, setPrices] = useState(() => {
        const savedPrices = localStorage.getItem('recycle_prices_data');
        return savedPrices ? JSON.parse(savedPrices) : [
            { id: 1, type: 'พลาสติก', price: 5.5, icon: '📦', color: 'bg-blue-50 text-blue-600' },
            { id: 2, type: 'กระดาษ', price: 4.0, icon: '📄', color: 'bg-amber-50 text-amber-600' },
            { id: 3, type: 'แก้ว', price: 1.5, icon: '🍾', color: 'bg-emerald-50 text-emerald-600' },
            { id: 4, type: 'อลูมิเนียม', price: 35.0, icon: '🥤', color: 'bg-purple-50 text-purple-600' },
            { id: 5, type: 'โลหะผสม', price: 8.0, icon: '⚙️', color: 'bg-rose-50 text-rose-600' },
        ];
    });

    // สเตตัสจำวันที่อัปเดตล่าสุด
    const [lastUpdated, setLastUpdated] = useState(() => {
        return localStorage.getItem('recycle_prices_updated_date') || 'ยังไม่มีการระบุวันที่';
    });

    const [tempPrices, setTempPrices] = useState({});

    // สเตตัสเก็บค่าน้ำหนักขยะ (กก.) ที่ประชาชนลองพิมพ์กรอกเล่นเพื่อคำนวณเงิน
    const [calcWeights, setCalcWeights] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '' });

    // ฟังก์ชันเปิดโหมดแอดมินแก้ไขราคา
    const handleStartEdit = () => {
        const currentTemp = {};
        prices.forEach(p => { currentTemp[p.id] = p.price; });
        setTempPrices(currentTemp);
        setIsEditing(true);
    };

    // ฟังก์ชันบันทึกราคาแอดมิน
    const handleSavePrices = () => {
        const updatedPrices = prices.map(p => ({ ...p, price: Number(tempPrices[p.id]) || 0 }));
        setPrices(updatedPrices);
        localStorage.setItem('recycle_prices_data', JSON.stringify(updatedPrices));

        const now = new Date();
        const ThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        setLastUpdated(dateString);
        localStorage.setItem('recycle_prices_updated_date', dateString);
        setIsEditing(false);
        alert("💾 บันทึกการปรับเปลี่ยนราคารับซื้อประจำเดือนสำเร็จ!");
    };

    // คำนวณยอดเงินรวมทั้งหมดจากค่าน้ำหนักที่ผู้ใช้ทั่วไปกรอกคูณกับราคาปัจจุบัน
    const totalCalcMoney = useMemo(() => {
        return prices.reduce((sum, item) => {
            const weight = Number(calcWeights[item.id]) || 0;
            return sum + (weight * item.price);
        }, 0);
    }, [prices, calcWeights]);

    return (
        <div className="space-y-6">
            {/* ส่วนหัวเมนู (Header) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        💰 ตารางราคารับซื้อขยะรีไซเคิล
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium">
                        📊 ราคารับซื้อประจำเดือน (อัปเดตราคาเมื่อ: <span className="text-emerald-600 font-bold">{lastUpdated}</span>)
                    </p>
                </div>

                {/* ปุ่มแอดมินแก้ไขราคา */}
                {isLoggedIn && (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 transition">ยกเลิก</button>
                                <button onClick={handleSavePrices} className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 shadow-md transition">✅ บันทึกราคา</button>
                            </>
                        ) : (
                            <button onClick={handleStartEdit} className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-md transition flex items-center gap-1">🔧 แก้ไขราคา</button>
                        )}
                    </div>
                )}
            </div>

            {/* บล็อกหลักแสดงราคารับซื้อแต่ละประเภท */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prices.map((item) => (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <span className={`text-2xl p-3 rounded-2xl ${item.color} font-bold`}>{item.icon}</span>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{item.type}</h4>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">ราคาต่อกิโลกรัม</p>
                            </div>
                        </div>

                        <div className="text-right">
                            {isEditing ? (
                                <div className="relative max-w-[100px]">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={tempPrices[item.id] ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTempPrices(prev => ({ ...prev, [item.id]: val === '' ? '' : Number(val) }));
                                        }}
                                        className="w-full border-2 border-emerald-400 rounded-xl px-2 py-1.5 text-right font-black text-slate-800 outline-none text-base bg-emerald-50/50"
                                    />
                                </div>
                            ) : (
                                <p className="text-xl font-black text-slate-800 font-mono">
                                    {item.price.toFixed(2)} <span className="text-xs font-bold text-slate-400">บาท</span>
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* เครื่องมือคำนวณยอดเงินจำลองสำหรับผู้ใช้ทั่วไป */}
            {!isEditing && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner space-y-4">
                    <div className="border-b border-slate-200 pb-3">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">🧮 เครื่องช่วยคำนวณเงินจำลอง</h3>
                        <p className="text-slate-400 text-xs mt-0.5">ลองใส่ปริมาณน้ำหนักขยะแต่ละประเภทด้านล่างเพื่อประเมินราคาที่ได้</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        {prices.map((item) => (
                            <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-between gap-2 shadow-sm">
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                    {item.icon} {item.type}
                                </span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={calcWeights[item.id]}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCalcWeights(prev => ({ ...prev, [item.id]: val }));
                                        }}
                                        className="w-full border-2 border-slate-100 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-right"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">กก.</span>
                                </div>
                                <div className="text-right text-[11px] text-slate-400 font-medium">
                                    เป็นเงิน: <span className="text-emerald-500 font-bold font-mono">{((Number(calcWeights[item.id]) || 0) * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> บ.
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                            💵 รวมเงินที่คาดว่าจะได้รับทั้งหมด:
                        </div>
                        <div className="text-2xl font-black text-emerald-600 font-mono">
                            {totalCalcMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-emerald-500">บาท</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};




// =========================================================================
// ➕ [ขั้นตอนที่ 3: Migration] หน้าต่างแก้ไขข้อมูลสมาชิกและพิกัดหมุด (รายบุคคล)
// =========================================================================
// =========================================================================
// ➕ [ขั้นตอนที่ 3: Migration] หน้าต่างแก้ไขข้อมูลสมาชิกและพิกัดหมุด (ระบบรายบุคคล)
// =========================================================================
const EditMemberModal = ({ member, villageData, onSave, onDelete, onClose }) => {
    // 🌟 ดึงข้อมูลเดิมมาตั้งต้น พร้อมดักจับแปลงร่างข้อมูลเก่า (String -> Object)
    const [editData, setEditData] = useState(() => {
        // Migration: แปลงชื่อที่เป็น String ให้กลายเป็น Object รายคน
        const migratedFamily = (member.familyMembers || []).map((person, index) => {
            if (typeof person === 'string') {
                return {
                    id: Date.now().toString() + index, // สร้าง ID จำลองให้ข้อมูลเก่า
                    name: person,
                    balance: 0,
                    credit: 0,
                    wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 },
                    hasWelfare: false,
                    isSorted: false
                };
            }
            return person; // ถ้าเป็นข้อมูลใหม่ (Object) อยู่แล้วก็ปล่อยผ่าน
        });

        // โยนข้อมูลที่อัปเกรดแล้วเข้า State
        return {
            ...member,
            familyMembers: migratedFamily.length > 0 ? migratedFamily : [{
                id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }, hasWelfare: false, isSorted: false
            }],
            balance: member.balance || 0,
            credit: member.credit || 0
        };
    });

    const CARBON_MULTIPLIERS = {
        'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910
    };

    // 📍 ระบบแผนที่
    useEffect(() => {
        const L = window.L;
        if (!L || !document.getElementById('edit-map-container')) return;

        const initLat = editData.lat || 18.5244;
        const initLng = editData.lng || 99.0435;

        const editMiniMap = L.map('edit-map-container').setView([initLat, initLng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(editMiniMap);

        const marker = L.marker([initLat, initLng], { draggable: true }).addTo(editMiniMap);
        marker.bindPopup("<b>🏠 ปรับพิกัดบ้านสมาชิก</b><br>สามารถลากหมุดไปวางตรงจุดใหม่ที่ถูกต้องได้").openPopup();

        marker.on('dragend', function (e) {
            const position = marker.getLatLng();
            setEditData(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
        });

        window.findEditMiniLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    editMiniMap.setView([latitude, longitude], 17);
                    marker.setLatLng([latitude, longitude]);
                    setEditData(prev => ({ ...prev, lat: latitude, lng: longitude }));
                });
            }
        };

        setTimeout(() => editMiniMap.invalidateSize(), 300);
        return () => { editMiniMap.remove(); delete window.findEditMiniLocation; };
    }, []);

    // 🌟 ฟังก์ชันเพิ่มคนเข้าบ้าน
    const handleAddFamilyMember = () => {
        setEditData(prev => ({
            ...prev,
            familyMembers: [...prev.familyMembers, {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                name: '', balance: 0, credit: 0,
                wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 },
                hasWelfare: false, isSorted: false
            }]
        }));
    };

    // 🌟 ฟังก์ชันลบคนออกจากบ้าน พร้อมคำนวณยอดเงินรวมบ้านใหม่
    const handleRemoveFamilyMember = (index) => {
        setEditData(prev => {
            const nextList = prev.familyMembers.filter((_, i) => i !== index);
            const totalHouseBalance = nextList.reduce((sum, person) => sum + (Number(person.balance) || 0), 0);
            const totalHouseCredit = nextList.reduce((sum, person) => sum + (Number(person.credit) || 0), 0);

            return {
                ...prev,
                familyMembers: nextList.length === 0 ? [{ id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }, hasWelfare: false, isSorted: false }] : nextList,
                balance: totalHouseBalance,
                credit: totalHouseCredit
            };
        });
    };

    // 🌟 ฟังก์ชันอัปเดตข้อมูลรายบุคคล
    const updatePersonField = (index, field, value) => {
        const updatedFamily = [...editData.familyMembers];
        updatedFamily[index] = { ...updatedFamily[index], [field]: value };

        // ให้ระบบคำนวณยอดเงินรวม และคาร์บอนรวม ของทั้งบ้านอัตโนมัติ
        const totalHouseBalance = updatedFamily.reduce((sum, person) => sum + (Number(person.balance) || 0), 0);
        const totalHouseCredit = updatedFamily.reduce((sum, person) => sum + (Number(person.credit) || 0), 0);

        // คำนวณสถานะรวมของบ้าน (ถ้ามีใครคนนึงคัดแยก ถือว่าบ้านนั้นคัดแยก)
        const isHouseSorted = updatedFamily.some(p => p.isSorted);

        setEditData({
            ...editData,
            familyMembers: updatedFamily,
            balance: totalHouseBalance,
            credit: totalHouseCredit,
            isSorted: isHouseSorted
        });
    };

    // 🌟 ฟังก์ชันอัปเดตขยะรายบุคคล
    const updatePersonWaste = (index, type, weightStr) => {
        const weight = Math.max(0, parseFloat(weightStr) || 0);
        const updatedFamily = [...editData.familyMembers];
        const person = updatedFamily[index];

        const nextWaste = { ...(person.wasteData || {}), [type]: weight };

        // คำนวณคาร์บอนเครดิตใหม่ของคนนี้
        const nextCredit = Object.entries(nextWaste).reduce((sum, [wType, wWeight]) => {
            return sum + (Number(wWeight) * (CARBON_MULTIPLIERS[wType] || 0));
        }, 0);

        person.wasteData = nextWaste;
        person.credit = Number(nextCredit.toFixed(4));

        // สั่งอัปเดต State หลัก
        updatePersonField(index, 'wasteData', nextWaste);
    };

    // ฟังก์ชันเปิด/ปิดกล่องแก้ไขขยะส่วนตัว
    const [expandedWasteIndex, setExpandedWasteIndex] = useState(null);

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh] text-slate-700">

                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold">✏️ แก้ไขข้อมูลครัวเรือนและสมาชิก</h3>
                        <p className="text-xs text-slate-400 mt-0.5">จัดการข้อมูลบ้าน และรายละเอียดลึกระดับบุคคล</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">✕</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50 scrollbar-thin">

                    {/* 1. แก้ไขบ้านเลขที่ และเลือกหมวดหมู่ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">🏠 บ้านเลขที่</label>
                            <input
                                type="text"
                                value={editData.houseNo}
                                onChange={(e) => setEditData({ ...editData, houseNo: e.target.value })}
                                className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none bg-white font-bold focus:border-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">📂 สังกัดหมวดขยะ</label>
                            <select
                                value={editData.villageId}
                                onChange={(e) => {
                                    const selectedId = Number(e.target.value);
                                    const selectedVillage = villageData.find(v => v.id === selectedId);
                                    setEditData({
                                        ...editData,
                                        villageId: selectedId,
                                        category: selectedVillage ? selectedVillage.name : 'ไม่ระบุหมวด'
                                    });
                                }}
                                className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none bg-white font-bold focus:border-blue-400 cursor-pointer"
                            >
                                {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 2. แผนที่ */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-700">🗺️ แก้ไขจุดปักหมุดบ้าน</label>
                            <button type="button" onClick={() => window.findEditMiniLocation && window.findEditMiniLocation()} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1 shadow-sm transition-colors">
                                <Navigation size={12} /> ดึงพิกัดปัจจุบัน
                            </button>
                        </div>
                        <div id="edit-map-container" className="h-48 w-full rounded-2xl border-2 border-slate-200 z-0 overflow-hidden relative"></div>
                    </div>

                    {/* 🌟 3. จัดการรายชื่อสมาชิก (รายบุคคลแบบเต็มสูบ) */}
                    <div>
                        <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                            <label className="text-base font-black text-slate-800">👥 จัดการข้อมูลสมาชิกภายในบ้าน</label>
                            <button type="button" onClick={handleAddFamilyMember} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                                ➕ เพิ่มชื่อสมาชิกใหม่
                            </button>
                        </div>

                        <div className="space-y-4">
                            {editData.familyMembers.map((person, index) => (
                                <div key={person.id || index} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">

                                    {/* แถว 1: ชื่อ และ เงิน */}
                                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                        <div className="flex items-center gap-2 flex-[2] w-full">
                                            <span className="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0">{index + 1}</span>
                                            <input
                                                type="text" placeholder="ชื่อ-นามสกุล"
                                                value={person.name}
                                                onChange={(e) => updatePersonField(index, 'name', e.target.value)}
                                                className="w-full border-2 border-slate-200 p-2.5 rounded-xl outline-none font-bold text-sm focus:border-blue-400"
                                            />
                                        </div>
                                        <div className="flex-[1] w-full relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                                            <input
                                                type="number" step="any" placeholder="ยอดเงิน"
                                                value={person.balance || ''}
                                                onChange={(e) => updatePersonField(index, 'balance', parseFloat(e.target.value) || 0)}
                                                className="w-full border-2 border-amber-200 p-2.5 pl-8 rounded-xl outline-none font-black text-amber-600 text-sm focus:border-amber-400 bg-amber-50/30"
                                            />
                                        </div>
                                        <button type="button" onClick={() => handleRemoveFamilyMember(index)} className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition border border-transparent hover:border-red-100 hidden sm:block shrink-0">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    {/* แถว 2: สถานะต่างๆ ของบุคคลนี้ */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <button type="button" onClick={() => updatePersonField(index, 'isSorted', !person.isSorted)} className={`py-2 rounded-lg text-xs font-bold transition-all border ${person.isSorted ? 'bg-green-100 text-green-700 border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                            {person.isSorted ? '✅ คัดแยกแล้ว' : '⚪ ไม่คัดแยก'}
                                        </button>
                                        <button type="button" onClick={() => updatePersonField(index, 'hasWelfare', !person.hasWelfare)} className={`py-2 rounded-lg text-xs font-bold transition-all border ${person.hasWelfare ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                            {person.hasWelfare ? '🎁 มีสวัสดิการ' : '❌ ไม่มีสวัสดิการ'}
                                        </button>

                                        <div className="col-span-2 sm:col-span-2 flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                                            <span className="text-xs font-bold text-emerald-700">🌱 คาร์บอน (แก้ไขได้):</span>
                                            <input
                                                type="number" step="any"
                                                value={person.credit || 0}
                                                onChange={(e) => updatePersonField(index, 'credit', Math.max(0, parseFloat(e.target.value) || 0))}
                                                className="w-20 text-right bg-white border border-emerald-200 rounded p-1 text-xs font-black text-emerald-600 outline-none focus:border-emerald-400"
                                            />
                                        </div>
                                    </div>

                                    {/* แถว 3: แผงแก้ไขขยะรายคน */}
                                    <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                                        <button type="button" onClick={() => setExpandedWasteIndex(expandedWasteIndex === index ? null : index)} className="w-full bg-slate-100 hover:bg-slate-200 p-2.5 text-xs font-bold text-slate-600 flex justify-between items-center transition">
                                            <span>📦 แก้ไขประวัติขยะ (น้ำหนัก) ของ {person.name || 'คนนี้'}</span>
                                            <span>{expandedWasteIndex === index ? '▲ ปิด' : '▼ เปิดดู'}</span>
                                        </button>
                                        {expandedWasteIndex === index && (
                                            <div className="p-3 bg-white grid grid-cols-2 gap-2 border-t border-slate-200">
                                                {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map((type) => (
                                                    <div key={type} className="flex flex-col gap-0.5">
                                                        <label className="text-[10px] font-bold text-slate-500">{type}</label>
                                                        <input
                                                            type="number" step="any"
                                                            value={person.wasteData?.[type] || 0}
                                                            onChange={(e) => updatePersonWaste(index, type, e.target.value)}
                                                            className="border border-slate-200 p-1.5 rounded-lg outline-none bg-slate-50 font-bold text-xs text-right pr-2 focus:border-blue-400"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* ปุ่มลบสำหรับมือถือ */}
                                    <button type="button" onClick={() => handleRemoveFamilyMember(index)} className="mt-2 w-full py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold sm:hidden border border-red-100">
                                        🗑️ ลบสมาชิกคนนี้
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* สรุปยอดรวมของบ้าน (โชว์ไว้ให้ดูอุ่นใจ) */}
                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 bg-amber-100/50 p-4 rounded-2xl border border-amber-200 text-center">
                                <span className="block text-xs font-bold text-amber-700 mb-1">ยอดเงินออมรวมของบ้าน</span>
                                <span className="text-xl font-black text-amber-600 font-mono">฿{editData.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex-1 bg-emerald-100/50 p-4 rounded-2xl border border-emerald-200 text-center">
                                <span className="block text-xs font-bold text-emerald-700 mb-1">คาร์บอนเครดิตรวมของบ้าน</span>
                                <span className="text-xl font-black text-emerald-600 font-mono">{editData.credit.toFixed(4)} <span className="text-[10px]">kgCO2e</span></span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* ส่วนท้ายสุดล่างสุด: ปุ่มลบสมาชิกทั้งบ้าน และปุ่มยืนยัน */}
                <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm(`⚠️ ยืนยันการลบข้อมูลบ้านเลขที่ ${editData.houseNo} ออกจากระบบอย่างถาวร?`)) {
                                onDelete(editData.id);
                            }
                        }}
                        className="w-full sm:w-auto px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition border border-dashed border-red-200"
                    >
                        🗑️ ลบบ้านหลังนี้ออกจากระบบ
                    </button>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button type="button" onClick={onClose} className="px-5 py-3 font-bold text-slate-500 hover:text-slate-700 transition text-sm bg-white border border-slate-200 rounded-xl">ยกเลิก</button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!editData.houseNo) return alert("กรุณาระบุบ้านเลขที่");
                                onSave(editData);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition text-sm"
                        >
                            💾 บันทึกการแก้ไข
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

const MembersView = ({ members, setMembers, villages, setVillages, isLoggedIn, logAdminAction, refreshData }) => {
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // 🔍 ตัวเก็บค่าที่พิมพ์ค้นหา

    // ฟังก์ชันโหลดข้อมูลสมาชิกแบบทีละหน้า
    const loadMembers = async (villageId, isReset = false) => {
        setLoadingMore(true);
        try {
            let q = query(
                collection(db, "members"),
                where("villageId", "==", Number(villageId)),
                orderBy("houseNo"),
                limit(20)
            );

            // ถ้าไม่ใช่การกดเริ่มใหม่ (Reset) ให้โหลดต่อจากคนสุดท้ายที่เคยโหลดไว้
            if (!isReset && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const snapshot = await getDocs(q);
            const newMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (isReset) {
                setMembers(newMembers);
            } else {
                setMembers(prev => [...prev, ...newMembers]);
            }

            // บันทึกเคอร์เซอร์คนล่าสุดไว้
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        } catch (err) {
            console.error("Error loading members:", err);
        }
        setLoadingMore(false);
    };
    // 🔄 [แก้ไขจุดที่ 1]: ดึงค่าหมวดที่แอดมินกดมาจากหน้าข้อมูลหมู่บ้านมาตั้งต้น ถ้าไม่มีให้ใช้หมวด 1
    const [selectedSortVillageId, setSelectedSortVillageId] = useState(() => {
        const savedZone = localStorage.getItem('active_sort_zone');
        return savedZone ? Number(savedZone) : 1;
    });

    // ➕ [เพิ่มใหม่]: ฟังก์ชันจดจำค่าเมื่อแอดมินเปลี่ยนตัวเลือกหมวดหมู่ที่ Dropdown ด้านบน
    const handleZoneChange = (zoneId) => {
        setSelectedSortVillageId(zoneId);
        localStorage.setItem('active_sort_zone', zoneId);
        loadMembers(zoneId, true); // โหลดหน้าแรกของหมวดใหม่
    };

    // ใช้ useEffect เพื่อโหลดครั้งแรก
    useEffect(() => {
        loadMembers(selectedSortVillageId, true);
    }, [selectedSortVillageId]);

    // 💾 ฟังก์ชันรับค่าเมื่อกดบันทึกความเปลี่ยนแปลงจากหน้าต่างแก้ไข
    const handleSaveEdit = async (updatedMember) => {
        const oldMember = members.find(m => m.id === updatedMember.id);
        const targetVillage = villages.find(v => v.id === updatedMember.villageId);
        if (targetVillage) {
            updatedMember.category = targetVillage.name;
        }

        const CARBON_MULTIPLIERS = {
            'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910
        };

        // 🌟 1. ดักจับข้อมูล: ถ้าครอบครัวถูกลบจนเกลี้ยง ให้สร้างกล่องข้อมูลเปล่าไว้กันระบบพัง
        if (!updatedMember.familyMembers || updatedMember.familyMembers.length === 0) {
            updatedMember.familyMembers = [{
                id: Date.now().toString(), name: '', balance: 0, credit: 0,
                wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 },
                hasWelfare: false, isSorted: false
            }];
        }

        // 🌟 2. คำนวณยอดรวมของบ้านใหม่ทั้งหมด (เงิน, คาร์บอน, สถานะ) จาก "รายบุคคล"
        updatedMember.balance = updatedMember.familyMembers.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
        updatedMember.credit = updatedMember.familyMembers.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);
        updatedMember.isSorted = updatedMember.familyMembers.some(p => p.isSorted);

        // 🌟 3. รวบรวมน้ำหนักขยะทั้งหมดของคนในบ้าน มาเป็นขยะรวมของบ้าน
        const aggregatedWaste = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 };
        updatedMember.familyMembers.forEach(person => {
            Object.entries(person.wasteData || {}).forEach(([type, weight]) => {
                aggregatedWaste[type] += Number(weight) || 0;
            });
        });
        updatedMember.wasteData = aggregatedWaste;

        // อัปเดตรายชื่อและย้ายหมวดในสเตตัสทะเบียนสมาชิกหลัก
        const nextMembers = members.map(m => m.id === updatedMember.id ? updatedMember : m);
        setMembers(nextMembers);
        localStorage.setItem('local_members_data', JSON.stringify(nextMembers));

        // หักลบน้ำหนักขยะออกจากหมวดเก่า และวิ่งไปบวกเพิ่มสะสมในหมวดใหม่
        setVillages(prevVillages => {
            const updatedVillages = prevVillages.map(v => {
                const nextWasteData = { ...v.wasteData };

                if (oldMember && v.id === oldMember.villageId) {
                    Object.keys(oldMember.wasteData || {}).forEach(type => {
                        nextWasteData[type] = Math.max(0, (Number(nextWasteData[type]) || 0) - (Number(oldMember.wasteData[type]) || 0));
                    });
                }

                if (v.id === updatedMember.villageId) {
                    Object.keys(updatedMember.wasteData || {}).forEach(type => {
                        nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(updatedMember.wasteData[type]) || 0);
                    });
                }

                return { ...v, wasteData: nextWasteData };
            });

            const finalVillages = updatedVillages.map(v => {
                const vMembers = nextMembers.filter(m => m.villageId === v.id);
                // 🌟 ยอดคาร์บอนและเงินรวมของหมวด จะถูกดึงมาจาก "ยอดรวมของบ้าน" อีกที
                const memberCredits = vMembers.reduce((sum, m) => sum + (Number(m.credit) || 0), 0);
                const memberBalances = vMembers.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);

                return { ...v, credit: Number(memberCredits.toFixed(4)), totalBalance: memberBalances };
            });

            localStorage.setItem('village_data', JSON.stringify(finalVillages));
            return finalVillages;
        });

        // ดันขึ้น Cloud
        try {
            await setDoc(doc(db, "members", String(updatedMember.id)), updatedMember, { merge: true });
            setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
            alert(`💾 อัปเดตข้อมูลบ้านเลขที่ ${updatedMember.houseNo} ลง Cloud สำเร็จเรียบร้อย!`);
        } catch (err) {
            console.error("อัปเดต Firebase พลาด:", err);
            alert("❌ บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
        }

        setEditingMember(null); refreshData();
    };

    // 🗑️ ฟังก์ชันลบข้อมูลบ้านสมาชิกออกจากระบบอย่างถาวร
    const handleDeleteMemberData = async (memberId) => {
        const targetMember = members.find(m => m.id === memberId);

        if (window.confirm("คุณแน่ใจใช่ไหมที่จะลบสมาชิกครัวเรือนนี้? ข้อมูลทุกคนในบ้านจะหายไปถาวร")) {
            try {
                await deleteDoc(doc(db, "members", String(memberId)));

                if (targetMember) {
                    if (typeof logAdminAction === 'function') {
                        logAdminAction(`ได้ทำการลบข้อมูลครัวเรือน "บ้านเลขที่ ${targetMember.houseNo}" ออกจากฐานข้อมูลถาวร`);
                    }

                    setVillages(prevVillages => {
                        const updatedVillages = prevVillages.map(v => {
                            if (v.id === targetMember.villageId) {
                                const nextWasteData = { ...v.wasteData };
                                Object.keys(targetMember.wasteData || {}).forEach(type => {
                                    nextWasteData[type] = Math.max(0, (Number(nextWasteData[type]) || 0) - (Number(targetMember.wasteData[type]) || 0));
                                });

                                const newCredit = Math.max(0, (Number(v.credit) || 0) - (Number(targetMember.credit) || 0));
                                const newTotalBalance = Math.max(0, (Number(v.totalBalance) || 0) - (Number(targetMember.balance) || 0));

                                return { ...v, wasteData: nextWasteData, credit: newCredit, totalBalance: newTotalBalance };
                            }
                            return v;
                        });
                        localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                        return updatedVillages;
                    });
                }

                const nextMembers = members.filter(m => m.id !== memberId);
                setMembers(nextMembers);
                localStorage.setItem('local_members_data', JSON.stringify(nextMembers));
                setEditingMember(null);

                alert("🗑️ ลบข้อมูลครัวเรือนและหักลบสถิติขยะออกจากระบบสำเร็จ"); refreshData();
            } catch (err) {
                console.error("ลบข้อมูลผิดพลาด:", err);
                alert("❌ เกิดข้อผิดพลาดในการลบข้อมูลจากระบบ");
            }
        }
    };

    const handleSaveWasteRecord = async (memberId, personId, turnWasteData, turnCredit, addedBalance) => {
        const finalBalanceToAdd = Number(addedBalance) || 0;
        const finalCreditToAdd = Number(turnCredit) || 0;

        // 1. อัปเดตข้อมูลใน State (ทำเฉพาะการคำนวณ)
        const updatedMembers = members.map(m => {
            if (String(m.id) === String(memberId)) {
                const updatedFamily = (m.familyMembers || []).map((person, index) => {
                    const pId = person.id || String(index);
                    if (String(pId) === String(personId)) {
                        const pObj = typeof person === 'string'
                            ? { id: pId, name: person, balance: 0, credit: 0, wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }, hasWelfare: false, isSorted: false }
                            : { ...person };

                        pObj.balance = (Number(pObj.balance) || 0) + finalBalanceToAdd;
                        pObj.credit = (Number(pObj.credit) || 0) + finalCreditToAdd;
                        pObj.isSorted = true;

                        Object.keys(turnWasteData).forEach(type => {
                            pObj.wasteData[type] = (Number(pObj.wasteData[type] || 0) || 0) + (Number(turnWasteData[type]) || 0);
                        });
                        return pObj;
                    }
                    return person;
                });

                const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
                const newHouseCredit = updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);

                const aggregatedWaste = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 };
                updatedFamily.forEach(p => {
                    Object.entries(p.wasteData || {}).forEach(([t, w]) => { aggregatedWaste[t] += Number(w) || 0; });
                });

                return { ...m, wasteData: aggregatedWaste, familyMembers: updatedFamily, credit: newHouseCredit, balance: newHouseBalance, isSorted: true };
            }
            return m;
        });

        // 2. ค้นหาชื่อสมาชิกจากข้อมูลที่อัปเดตเสร็จแล้ว (วิธีนี้ชัวร์ที่สุด ไม่ Error)
        const targetMemberObj = updatedMembers.find(m => String(m.id) === String(memberId));
        const targetPersonObj = targetMemberObj.familyMembers.find(p => String(p.id || '0') === String(personId));
        const finalName = targetPersonObj ? (typeof targetPersonObj === 'string' ? targetPersonObj : targetPersonObj.name) : 'สมาชิก';

        // 3. เซฟลง State และ Cloud
        setMembers(updatedMembers);
        localStorage.setItem('local_members_data', JSON.stringify(updatedMembers));

        try {
            await setDoc(doc(db, "members", String(memberId)), targetMemberObj);
        } catch (err) { console.error("Update Cloud Error:", err); }

        // 4. อัปเดต Villiges
        setVillages(prevVillages => {
            const updatedVillages = prevVillages.map(v => {
                if (v.id === targetMemberObj.villageId) {
                    const nextVillageWaste = { ...v.wasteData };
                    Object.keys(turnWasteData).forEach(type => {
                        nextVillageWaste[type] = (Number(nextVillageWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                    });
                    return { ...v, wasteData: nextVillageWaste, credit: (Number(v.credit) || 0) + finalCreditToAdd, totalBalance: (Number(v.totalBalance) || 0) + finalBalanceToAdd };
                }
                return v;
            });
            localStorage.setItem('village_data', JSON.stringify(updatedVillages));
            return updatedVillages;
        });

        // 5. บันทึก Log และประวัติ (ใช้ตัวแปร finalName ที่หาได้ชัวร์ๆ)
        const typesSummary = Object.entries(turnWasteData).filter(([_, w]) => w > 0).map(([t, w]) => `${t} ${w} กก.`).join(', ');
        logAdminAction(`บันทึกให้ "บ้านเลขที่ ${targetMemberObj.houseNo}" (โดย ${finalName}) | ขยะ: [${typesSummary}] (+${finalCreditToAdd.toFixed(4)} kgCO2e) | ฝากเงิน: +฿${finalBalanceToAdd.toLocaleString()}`);

        try {
            await addDoc(collection(db, "waste_transactions"), {
                houseNo: targetMemberObj.houseNo,
                personName: finalName,
                villageId: targetMemberObj.villageId,
                category: targetMemberObj.category,
                wasteData: turnWasteData,
                creditAdded: finalCreditToAdd,
                addedBalance: finalBalanceToAdd,
                date: new Date().toLocaleDateString('th-TH'),
                time: new Date().toLocaleTimeString('th-TH'),
                operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
                timestamp: serverTimestamp()
            });
        } catch (err) { console.error("History Error:", err); }

        if (typeof refreshData === 'function') await refreshData();
        setIsRecordWasteOpen(false);
        alert(`⚖️ บันทึกรายการฝากของ ${finalName} สำเร็จ!`);
    };

    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const itemsPerPage = 10;

    // รีเซ็ตกลับไปหน้า 1 เสมอเวลาค้นหาหรือเปลี่ยนหมวดหมู่
    React.useEffect(() => {
        setCurrentPageNumber(1);
    }, [selectedSortVillageId, searchTerm]);

    const displayedMembers = useMemo(() => {
        if (!members) return [];
        return members.filter(m => {
            const matchCategory = Number(m.villageId) === Number(selectedSortVillageId) ||
                String(m.villageId).trim() === String(selectedSortVillageId).trim();
            const matchSearch = String(m.houseNo).toLowerCase().includes(searchTerm.toLowerCase());
            return matchCategory && matchSearch;
        });
    }, [members, selectedSortVillageId, searchTerm]);

    // คำนวณจำนวนหน้าทั้งหมด
    const totalPages = Math.ceil(displayedMembers.length / itemsPerPage);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* หัวข้อหน้าจอ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">🏠 บ้านสมาชิกในระบบ</h2>
                    <p className="text-slate-500 text-sm">รายชื่อครัวเรือนที่ลงทะเบียนในโครงการ (หมู่ 6)</p>
                </div>

                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center px-3">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                        type="text"
                        placeholder="ค้นหาบ้านเลขที่..."
                        className="text-xs font-bold outline-none w-full sm:w-32"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 🔍 แผง Dropdown เลือก Sort คัดกรองหมวดหมู่ */}
                {isLoggedIn && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-bold text-slate-500 pl-2">🔍 คัดกรองหมวด:</span>
                        <select
                            value={selectedSortVillageId}
                            onChange={(e) => handleZoneChange(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                        >
                            {villages.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ส่วนรายการการ์ดสมาชิก */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
                {!displayedMembers || displayedMembers.length === 0 ? (
                    <div className="col-span-full bg-white p-10 text-center text-slate-400 border border-slate-100 rounded-3xl shadow-sm italic text-sm">
                        {isLoggedIn
                            ? `ยังไม่มีข้อมูลสมาชิกครัวเรือนลงทะเบียนอยู่ในหมวดที่ ${selectedSortVillageId}`
                            : "ยังไม่มีข้อมูลสมาชิกในระบบ"
                        }
                    </div>
                ) : (
                    // 🌟 ใช้ .slice() ตัดข้อมูลมาแสดงทีละ 10 รายการตามหน้าปัจจุบัน
                    displayedMembers
                        .slice((currentPageNumber - 1) * itemsPerPage, currentPageNumber * itemsPerPage)
                        .map((member) => {
                            const isExpanded = expandedMemberId === member.id;
                            const credit = Number(member.credit) || 0; // คาร์บอนเครดิต
                            const balance = Number(member.balance) || 0; // ยอดเงินคงเหลือ
                            const hasWelfare = member.hasWelfare || false; // สิทธิ์สวัสดิการ

                            return (
                                <div
                                    key={member.id}
                                    // 🌟 เติม h-fit ตรงนี้ เพื่อไม่ให้กล่องข้างๆ ยืดตามเวลาเรากดเปิด Dropdown
                                    className="bg-white/90 backdrop-blur-md border border-sky-100/80 rounded-[28px] p-5 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all duration-300 flex flex-col w-full h-fit self-start"
                                >
                                    {/* ชั้นที่ 1: ส่วนหัว (ฝั่งซ้าย=บ้าน, ฝั่งขวา=ปุ่มแก้ไข) */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="bg-blue-50 text-blue-700 text-sm sm:text-base font-black px-3.5 py-1.5 rounded-2xl w-fit border border-blue-100 flex items-center gap-2">
                                                🏠 บ้านเลขที่ {member.houseNo}
                                            </span>
                                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-500 rounded-xl w-fit">
                                                {member.category || 'ไม่ระบุหมวด'}
                                            </span>
                                        </div>
                                        {isLoggedIn && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingMember(member)}
                                                className="bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 border border-slate-200 shrink-0 shadow-sm"
                                            >
                                                ⚙️ <span className="hidden sm:inline">แก้ไขข้อมูล</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* ชั้นที่ 2: กล่องสถิติรวมของบ้าน (ดึงค่ารวมไปโชว์ใน Dashboard ได้เหมือนเดิม) */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 flex flex-col justify-center">
                                            <span className="text-xs text-amber-600 font-bold mb-0.5">ยอดเงินรวมของบ้าน</span>
                                            <span className="text-xl sm:text-2xl font-black text-amber-600 font-mono tracking-tight">
                                                ฿{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 flex flex-col justify-center">
                                            <span className="text-xs text-emerald-600 font-bold mb-0.5">คาร์บอนรวมของบ้าน</span>
                                            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono tracking-tight">
                                                {credit.toFixed(4)} <span className="text-xs font-bold">kgCO2e</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* ชั้นที่ 3: Dropdown เจาะลึกรายบุคคล (ย้ายสถานะทุกอย่างมาไว้ตรงนี้) */}
                                    <div className="w-full border-t border-slate-100 pt-4 mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                            className="w-full py-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-between px-4 transition-colors border border-slate-200 shadow-sm"
                                        >
                                            <span className="flex items-center gap-2">
                                                👥 ข้อมูลรายบุคคลในบ้าน
                                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-xs">
                                                    {member.familyMembers ? member.familyMembers.filter(p => {
                                                        const pName = typeof p === 'string' ? p : p?.name;
                                                        return pName && pName.trim() !== '';
                                                    }).length : 0} คน
                                                </span>
                                            </span>
                                            <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-3 space-y-3">
                                                {member.familyMembers && member.familyMembers.length > 0 ? (
                                                    member.familyMembers.map((person, idx) => {
                                                        const pName = typeof person === 'string' ? person : person?.name;
                                                        if (!pName || pName.trim() === '') return null;

                                                        // ดึงข้อมูลรายคน
                                                        const pBalance = typeof person === 'string' ? 0 : (Number(person?.balance) || 0);
                                                        const pCredit = typeof person === 'string' ? 0 : (Number(person?.credit) || 0);
                                                        const pIsSorted = typeof person === 'string' ? false : (person?.isSorted || false);
                                                        const pHasWelfare = typeof person === 'string' ? false : (person?.hasWelfare || false);
                                                        const pWasteData = typeof person === 'string' ? {} : (person?.wasteData || {});

                                                        return (
                                                            // 🌟 ปรับกล่องนี้ให้กระชับขึ้น และเพิ่มขนาดฟอนต์ด้านใน
                                                            <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col gap-2.5 shadow-sm">

                                                                {/* รายชื่อ และ เงิน/คาร์บอน ส่วนตัว */}
                                                                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <span className="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0">{idx + 1}</span>
                                                                        <span className="font-bold text-slate-800 text-base">{pName}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className="font-mono text-amber-600 font-black text-base bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                                                            ฿{pBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="font-mono text-emerald-600 font-bold text-xs">
                                                                            {pCredit.toFixed(4)} kgCO2e
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* ป้ายสถานะส่วนตัว */}
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${pIsSorted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                                        {pIsSorted ? '✅ คัดแยกแล้ว' : '⚪ ยังไม่คัดแยก'}
                                                                    </span>
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${pHasWelfare ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                                        {pHasWelfare ? '🎁 ได้สวัสดิการ' : '❌ ไม่มีสวัสดิการ'}
                                                                    </span>
                                                                </div>

                                                                {/* ประวัติขยะสะสมส่วนตัว */}
                                                                {Object.keys(pWasteData).length > 0 && Object.values(pWasteData).some(v => Number(v) > 0) && (
                                                                    <div className="flex flex-wrap gap-2 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                                        <p className="w-full text-xs font-bold text-slate-400 mb-0.5">📦 ประวัติขยะสะสมส่วนตัว</p>
                                                                        {Object.entries(pWasteData).map(([type, weight]) => {
                                                                            if (Number(weight) <= 0) return null;
                                                                            return (
                                                                                <span key={type} className="bg-white border border-slate-200 px-2 py-1 rounded-md text-xs font-bold text-blue-600 shadow-sm flex items-center gap-1.5">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                                    {type}: {Number(weight).toFixed(2)} กก.
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่มีข้อมูลรายบุคคล</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                )}

                {/* 🌟 ระบบแบ่งหน้า (Pagination) แทนปุ่มโหลดเพิ่ม */}
                {displayedMembers.length > itemsPerPage && (
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-6 gap-4">
                        <button
                            onClick={() => {
                                setCurrentPageNumber(prev => Math.max(prev - 1, 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPageNumber === 1}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm w-full sm:w-auto transition-all ${currentPageNumber === 1
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                }`}
                        >
                            ◀ หน้าก่อนหน้า
                        </button>

                        <span className="text-slate-600 font-bold text-sm bg-slate-50 px-6 py-2.5 rounded-xl border border-slate-100 w-full sm:w-auto text-center">
                            หน้าที่ {currentPageNumber} จาก {totalPages}
                        </span>

                        <button
                            onClick={() => {
                                setCurrentPageNumber(prev => Math.min(prev + 1, totalPages));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPageNumber === totalPages}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm w-full sm:w-auto transition-all ${currentPageNumber === totalPages
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                }`}
                        >
                            หน้าถัดไป ▶
                        </button>
                    </div>
                )}
            </div>

            {/* แสดงเปิดหน้าต่างป๊อปอัพแก้ไขข้อมูลครัวเรือน */}
            {editingMember && (
                <EditMemberModal
                    member={editingMember}
                    villageData={villages}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteMemberData}
                    onClose={() => setEditingMember(null)}
                />
            )}
        </div>
    );
};
// =========================================================================
// ➕ [อัปเดตใหม่]: หน้าต่างหักยอดเงินสมาชิกแบบกลุ่ม (Bulk Deduct - เลือกระดับบุคคล)
// =========================================================================
const BulkDeductModal = ({ members, villages, onClose, onSave }) => {
    const [selectedVillageId, setSelectedVillageId] = useState(villages.length > 0 ? villages[0].id : '');
    const [deductAmount, setDeductAmount] = useState('');

    // 🌟 เปลี่ยนมาเก็บคู่รหัส 'memberId|personId' แทน เพื่อให้รู้ว่าหักเงินใครในบ้านไหน
    const [checkedPersons, setCheckedPersons] = useState([]);

    // กรองสมาชิกตามหมวดที่เลือก
    const filteredMembers = useMemo(() => {
        if (!selectedVillageId) return [];
        return members.filter(m => Number(m.villageId) === Number(selectedVillageId));
    }, [members, selectedVillageId]);

    // ฟังก์ชันรวบรวม ID ของคนทุกคนในหมวดนี้
    const getAllPersonKeys = () => {
        const keys = [];
        filteredMembers.forEach(m => {
            (m.familyMembers || []).forEach((p, idx) => {
                const pId = p.id || String(idx);
                const pName = typeof p === 'string' ? p : p?.name;
                if (pName && pName.trim() !== '') {
                    keys.push(`${m.id}|${pId}`);
                }
            });
        });
        return keys;
    };

    // เมื่อเปลี่ยนหมวดหมู่ ให้ล้างการเลือกเก่าออก
    useEffect(() => {
        setCheckedPersons([]);
    }, [selectedVillageId]);

    // ฟังก์ชันจัดการการติ๊ก Checkbox รายคน
    const handleToggleCheck = (key) => {
        setCheckedPersons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh] text-slate-700">
                {/* Header */}
                <div className="p-6 bg-red-600 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-xl flex items-center gap-2">➖ หักยอดเงินสมาชิกแบบกลุ่ม</h3>
                        <p className="text-xs text-red-100 mt-0.5">เลือกลบยอดเงินรายบุคคล หลายคนพร้อมกันในคลิกเดียว</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-white">✕</button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 overflow-y-auto flex-grow scrollbar-thin">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. เลือกหมวด */}
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-slate-700">📂 เลือกหมวดหมู่ที่ต้องการหักเงิน</label>
                            <select
                                value={selectedVillageId}
                                onChange={(e) => setSelectedVillageId(e.target.value)}
                                className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold text-slate-700 focus:border-red-400 cursor-pointer"
                            >
                                {villages.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* 2. กรอกยอดเงินที่ต้องการหัก */}
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-red-600">💰 ระบุยอดเงินที่ต้องการหัก (บาท/คน)</label>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 font-bold text-slate-400">฿</span>
                                <input
                                    type="number" min="0" step="any" placeholder="0.00"
                                    value={deductAmount}
                                    onChange={(e) => setDeductAmount(e.target.value)}
                                    className="w-full border-2 border-slate-100 focus:border-red-400 outline-none text-right font-black text-red-600 pl-10 pr-4 py-3 rounded-xl bg-slate-50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. รายชื่อสมาชิกระดับรายบุคคล (ติ๊กเลือกได้) */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-100 p-3 flex justify-between items-center border-b border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700">
                                👥 รายชื่อบุคคลในหมวด ({getAllPersonKeys().length} คน)
                            </h4>
                            <div className="flex gap-2">
                                <button onClick={() => setCheckedPersons(getAllPersonKeys())} className="text-xs bg-white border px-2 py-1 rounded-lg font-bold hover:bg-slate-50 shadow-sm">ติ๊กทุกคน</button>
                                <button onClick={() => setCheckedPersons([])} className="text-xs bg-white border px-2 py-1 rounded-lg font-bold hover:bg-slate-50 text-red-500 shadow-sm">เอาออกทั้งหมด</button>
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto scrollbar-thin p-3 space-y-3 bg-slate-50">
                            {filteredMembers.length > 0 ? filteredMembers.map(m => {
                                // เช็คว่าบ้านนี้มีคนให้แสดงไหม
                                const validPersons = (m.familyMembers || []).filter(p => {
                                    const name = typeof p === 'string' ? p : p?.name;
                                    return name && name.trim() !== '';
                                });

                                if (validPersons.length === 0) return null;

                                return (
                                    <div key={m.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
                                            <span className="font-black text-blue-800 text-xs">🏠 บ้านเลขที่ {m.houseNo}</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {m.familyMembers.map((p, idx) => {
                                                const pId = p.id || String(idx);
                                                const pName = typeof p === 'string' ? p : p?.name;
                                                const pBalance = typeof p === 'string' ? 0 : (Number(p?.balance) || 0);

                                                if (!pName || pName.trim() === '') return null;

                                                const key = `${m.id}|${pId}`;
                                                const isChecked = checkedPersons.includes(key);
                                                const deductVal = Number(deductAmount) || 0;
                                                const afterBalance = Math.max(0, pBalance - deductVal);

                                                return (
                                                    <label key={key} className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded cursor-pointer accent-red-500"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleCheck(key)}
                                                            />
                                                            <span className="font-bold text-sm text-slate-700">{pName}</span>
                                                        </div>
                                                        <div className="text-right text-[11px] flex flex-col items-end gap-0.5">
                                                            <span className="font-bold text-slate-500">เดิม: ฿{pBalance.toLocaleString()}</span>
                                                            {isChecked && deductVal > 0 && (
                                                                <span className="font-black text-red-500 bg-red-100 px-1.5 py-0.5 rounded">
                                                                    เหลือ: ฿{afterBalance.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-center text-slate-400 py-4 text-sm font-bold">ไม่พบสมาชิกในหมวดนี้</p>}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0 items-center justify-between">
                    <span className="text-sm font-bold text-slate-500">เลือกไว้: <span className="text-red-600">{checkedPersons.length}</span> คน</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition">ยกเลิก</button>
                        <button
                            type="button"
                            onClick={() => {
                                const amount = Number(deductAmount);
                                if (isNaN(amount) || amount <= 0) return alert("❌ กรุณาระบุจำนวนเงินที่ต้องการหักให้ถูกต้องครับ");
                                if (checkedPersons.length === 0) return alert("❌ กรุณาติ๊กเลือกบุคคลอย่างน้อย 1 คนครับ");

                                // ส่ง Array ของคู่รหัส 'memberId|personId' กลับไปให้ App.jsx จัดการ
                                onSave(checkedPersons, amount, selectedVillageId);
                            }}
                            className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-red-700 transition"
                        >
                            💾 ยืนยันการหักเงิน
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
const ManageBalanceView = ({ members, villages, setMembers, db, logAdminAction, setCurrentPage, refreshData }) => {
    const [selectedVillageId, setSelectedVillageId] = useState(villages.length > 0 ? villages[0].id : '');
    const [currentPage, setCurrentPageNum] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    // สเตตัสสำหรับการกางดูรายบุคคล
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const [editingPersonId, setEditingPersonId] = useState(null); // ใช้เก็บ ID ของคนที่กำลังถูกแก้ไขเงิน
    const [editBalance, setEditBalance] = useState('');

    // 🌟 สเตตัสสำหรับเปิดหน้าต่างหักเงินกลุ่ม
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    const itemsPerPage = 10;

    const filteredMembers = useMemo(() => {
        let result = members;
        if (selectedVillageId !== 'all') {
            result = result.filter(m => Number(m.villageId) === Number(selectedVillageId));
        }
        if (searchTerm.trim() !== '') {
            result = result.filter(m => String(m.houseNo).includes(searchTerm.trim()));
        }
        return result;
    }, [members, selectedVillageId, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
    const currentMembers = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    React.useEffect(() => {
        setCurrentPageNum(1);
        setEditingPersonId(null);
        setExpandedMemberId(null);
    }, [selectedVillageId, searchTerm]);

    // 🌟 ฟังก์ชันเซฟเงินใหม่ (ระดับบุคคล)
    const handleSavePersonBalance = async (houseMember, personId) => {
        const newBalance = Number(editBalance);
        if (isNaN(newBalance)) return alert("❌ กรุณากรอกตัวเลขให้ถูกต้องครับ");

        try {
            // 1. จำลองร่างบ้านหลังนี้ แล้วเข้าไปอัปเดตเงินคนนั้น
            const updatedFamily = (houseMember.familyMembers || []).map((p, idx) => {
                const pId = p.id || String(idx);
                if (String(pId) === String(personId)) {
                    // ดักข้อมูลเก่า
                    if (typeof p === 'string') {
                        return { id: pId, name: p, balance: newBalance, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false };
                    }
                    return { ...p, balance: newBalance };
                }
                return p;
            });

            // 2. คำนวณยอดเงินรวมของบ้านใหม่
            const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

            // 3. แพ็คข้อมูลเซฟ
            const updatedMember = { ...houseMember, familyMembers: updatedFamily, balance: newHouseBalance };

            // 4. ยิงขึ้น Cloud
            await setDoc(doc(db, "members", String(houseMember.id)), updatedMember, { merge: true });

            // 5. แจ้งเตือน Log แอดมิน
            const targetPerson = updatedFamily.find(p => (p.id || String(p)) === String(personId));
            const pName = typeof targetPerson === 'string' ? targetPerson : targetPerson?.name;
            if (typeof logAdminAction === 'function') {
                logAdminAction(`แก้ไขยอดเงินของ "${pName}" (บ้านเลขที่ ${houseMember.houseNo}) เป็น ฿${newBalance.toLocaleString()}`);
            }

            setEditingPersonId(null);
            if (typeof refreshData === 'function') await refreshData();

        } catch (error) {
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่");
        }
    };

    // 🌟 ฟังก์ชันจัดการการหักเงินแบบกลุ่ม (Bulk Deduct - ระดับบุคคล)
    const handleBulkSave = async (checkedPersonKeys, deductAmount, villageId) => {
        if (!confirm(`⚠️ ยืนยันการหักเงิน ฿${deductAmount} จากบุคคลที่เลือกจำนวน ${checkedPersonKeys.length} คน?`)) return;

        try {
            // 1. จัดกลุ่มคีย์ตาม "บ้านเลขที่" (memberId) ก่อน เพื่อลดการเขียน DB ซ้ำซ้อน
            const houseUpdates = {};
            checkedPersonKeys.forEach(key => {
                const [mId, pId] = key.split('|');
                if (!houseUpdates[mId]) houseUpdates[mId] = [];
                houseUpdates[mId].push(pId);
            });

            // 2. วนลูปอัปเดตไปทีละบ้าน
            for (const [mId, personIdsToDeduct] of Object.entries(houseUpdates)) {
                const targetMem = members.find(m => String(m.id) === String(mId));
                if (targetMem) {

                    // 🌟 วนลูปหักเงินรายคนภายในบ้าน
                    const updatedFamily = (targetMem.familyMembers || []).map((p, idx) => {
                        const pId = p.id || String(idx);
                        if (personIdsToDeduct.includes(String(pId))) {
                            // ดักจับข้อมูลเก่า
                            const pBalance = typeof p === 'string' ? 0 : (Number(p.balance) || 0);
                            const newBalance = Math.max(0, pBalance - deductAmount);

                            if (typeof p === 'string') {
                                return { id: pId, name: p, balance: newBalance, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false };
                            }
                            return { ...p, balance: newBalance };
                        }
                        return p;
                    });

                    // 🌟 คำนวณยอดเงินรวมของบ้านใหม่
                    const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

                    // อัปเดตขึ้น Firebase แบบรายบ้าน
                    await setDoc(doc(db, "members", String(mId)), { ...targetMem, familyMembers: updatedFamily, balance: newHouseBalance }, { merge: true });
                }
            }

            // 3. บันทึกประวัติการทำงานแอดมิน
            const targetVillage = villages.find(v => Number(v.id) === Number(villageId));
            if (typeof logAdminAction === 'function') {
                logAdminAction(`หักยอดเงินแบบกลุ่ม หมวด: ${targetVillage ? targetVillage.name : 'ไม่ระบุ'} จำนวน ${checkedPersonKeys.length} คน (หักคนละ ฿${deductAmount.toLocaleString()})`);
            }

            // โหลดข้อมูลใหม่เพื่อให้หน้าจออัปเดตทันที
            if (typeof refreshData === 'function') await refreshData();

            setIsBulkModalOpen(false);
            alert(`✅ ทำการหักยอดเงินสำเร็จแล้วทั้งสิ้น ${checkedPersonKeys.length} คน!`);

        } catch (err) {
            console.error(err);
            alert("❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูลบน Cloud");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-emerald-800 flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> จัดการยอดเงินสมาชิก
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">อัปเดตยอดเงินคงเหลือ และหักยอดเงินแบบกลุ่ม</p>
                </div>
                <button
                    onClick={() => setCurrentPage('admin-home')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm"
                >
                    ← กลับหน้าแผงจัดการ
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col sm:flex-row items-stretch sm:items-center px-3 gap-2">
                    <span className="text-sm font-bold text-slate-500 whitespace-nowrap pl-2 hidden sm:block">📂 หมวด:</span>
                    <select
                        value={selectedVillageId}
                        onChange={(e) => setSelectedVillageId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 flex-1 cursor-pointer"
                    >
                        <option value="all">-- แสดงทุกหมวดหมู่ --</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>

                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 flex items-center px-3">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <input
                        type="text"
                        placeholder="ค้นหาบ้านเลขที่..."
                        className="text-sm font-bold outline-none w-full bg-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 🌟 ปุ่มหักเงินกลุ่ม */}
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-5 py-3 lg:py-2 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm w-full lg:w-auto shrink-0"
                >
                    ➖ หักเงินรายกลุ่ม
                </button>
            </div>

            {/* 📋 ตารางรายชื่อ */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="grid grid-cols-2 bg-slate-50 p-4 border-b border-slate-100 text-sm font-bold text-slate-500">
                    <div>บ้านเลขที่ (สมาชิก)</div>
                    <div className="text-right pr-4">ยอดเงินคงเหลือ (บาท)</div>
                </div>

                <div className="divide-y divide-slate-50 flex-grow">
                    {currentMembers.length > 0 ? (
                        currentMembers.map(m => (
                            <div key={m.id} className="flex flex-col border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                {/* แถวหลัก (บ้าน) */}
                                <div className="grid grid-cols-2 p-4 items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center shrink-0">
                                            <Home size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-slate-700 truncate">บ้านเลขที่ {m.houseNo}</div>
                                            <div className="text-[10px] font-bold text-slate-400 truncate">{m.category || 'ไม่ระบุหมวด'}</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end items-center gap-3">
                                        <span className="font-black text-slate-400 text-sm font-mono bg-slate-100 px-3 py-1 rounded-lg">
                                            รวม: ฿{(Number(m.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                        <button
                                            onClick={() => setExpandedMemberId(expandedMemberId === m.id ? null : m.id)}
                                            className={`p-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${expandedMemberId === m.id ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                        >
                                            {expandedMemberId === m.id ? '▲ ซ่อนรายชื่อ' : '▼ เปิดรายชื่อ'}
                                        </button>
                                    </div>
                                </div>

                                {/* แผง Dropdown รายคน */}
                                {expandedMemberId === m.id && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-3 sm:p-4 space-y-2 rounded-b-3xl">
                                        {m.familyMembers && m.familyMembers.length > 0 ? (
                                            m.familyMembers.map((person, idx) => {
                                                const pId = person.id || String(idx);
                                                const pName = typeof person === 'string' ? person : person?.name;
                                                const pBalance = typeof person === 'string' ? 0 : (Number(person?.balance) || 0);

                                                if (!pName || pName.trim() === '') return null;

                                                const isEditingThisPerson = editingPersonId === pId;

                                                return (
                                                    <div key={pId} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-emerald-50 text-emerald-600 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                                            <span className="font-bold text-sm text-slate-700">{pName}</span>
                                                        </div>

                                                        {/* โซนแก้ไขเงินรายคน */}
                                                        {isEditingThisPerson ? (
                                                            <div className="flex items-center gap-1.5 bg-emerald-50 p-1.5 rounded-xl border border-emerald-200 shadow-inner">
                                                                <span className="text-emerald-700 font-bold pl-2">฿</span>
                                                                <input
                                                                    type="number" step="any" autoFocus
                                                                    value={editBalance}
                                                                    onChange={(e) => setEditBalance(e.target.value)}
                                                                    className="w-20 sm:w-24 bg-white border border-emerald-200 rounded-lg px-2 py-1 font-black text-emerald-700 text-right outline-none focus:ring-2 focus:ring-emerald-400"
                                                                />
                                                                <button onClick={() => handleSavePersonBalance(m, pId)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"><Save size={14} /></button>
                                                                <button onClick={() => setEditingPersonId(null)} className="p-1.5 bg-white text-slate-400 border rounded-lg hover:bg-slate-100"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono font-black text-amber-600 text-base">
                                                                    ฿{pBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingPersonId(pId);
                                                                        setEditBalance(pBalance);
                                                                    }}
                                                                    className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-amber-100 hover:text-amber-600 transition border border-slate-200 shadow-sm"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs text-slate-400 italic text-center py-2">ไม่มีข้อมูลรายบุคคล</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="p-10 text-center text-slate-400 font-bold flex flex-col items-center justify-center h-full">
                            <Wallet size={48} className="mb-4 text-slate-200" />ไม่พบข้อมูลสมาชิกในหมวดนี้
                        </div>
                    )}
                </div>

                {filteredMembers.length > 0 && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between">
                        <button onClick={() => setCurrentPageNum(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`flex items-center gap-1 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === 1 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border shadow-sm'}`}>
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">ก่อนหน้า</span>
                        </button>
                        <span className="font-bold text-slate-500 text-sm bg-slate-100 px-4 py-2 rounded-xl">หน้า {currentPage}/{totalPages}</span>
                        <button onClick={() => setCurrentPageNum(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className={`flex items-center gap-1 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === totalPages ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border shadow-sm'}`}>
                            <span className="hidden sm:inline">ถัดไป</span> <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* 🌟 เรียกใช้งานหน้าต่างหักเงินเมื่อสเตตัส isBulkModalOpen เป็น true */}
            {isBulkModalOpen && (
                <BulkDeductModal
                    members={members}
                    villages={villages}
                    onClose={() => setIsBulkModalOpen(false)}
                    onSave={handleBulkSave}
                />
            )}
        </div>
    );
};
// === หน้าจอแสดงประวัติการทำรายการ (HistoryView) โฉมใหม่ ===
const HistoryView = ({ transactions, villages, db }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');

    const filteredTx = (transactions || []).filter(tx =>
        selectedCategory === 'all' || tx.category === selectedCategory
    );

    const handleExportExcel = () => {
        // 🌟 เพิ่มคอลัมน์ชื่อคนฝาก เข้าไปใน Excel ด้วย
        const headers = ['ลำดับ', 'วันที่', 'เวลา', 'ผู้ดำเนินการ', 'หมวดหมู่', 'บ้านเลขที่', 'สมาชิกผู้ฝาก', 'ยอดเงินฝากเพิ่ม (บาท)', 'คาร์บอนที่ได้ (kgCO2e)', 'พลาสติก (กก.)', 'กระดาษ (กก.)', 'แก้ว (กก.)', 'อลูมิเนียม (กก.)', 'โลหะผสม (กก.)'];
        const dataRows = filteredTx.map((tx, i) => [
            i + 1, tx.date, tx.time, tx.operator || 'ไม่ระบุ', tx.category || 'ไม่ระบุ', tx.houseNo, tx.personName || 'ไม่ระบุชื่อ',
            (Number(tx.addedBalance) || 0).toFixed(2),
            (Number(tx.creditAdded) || 0).toFixed(4),
            (Number(tx.wasteData?.['พลาสติก']) || 0).toFixed(2),
            (Number(tx.wasteData?.['กระดาษ']) || 0).toFixed(2),
            (Number(tx.wasteData?.['แก้ว']) || 0).toFixed(2),
            (Number(tx.wasteData?.['อลูมิเนียม']) || 0).toFixed(2),
            (Number(tx.wasteData?.['โลหะผสม']) || 0).toFixed(2)
        ]);

        const rows = [headers, ...dataRows];
        const csvContent = "\uFEFF" + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const fileName = selectedCategory === 'all' ? 'ประวัติฝากขยะทุกหมวด' : `ประวัติฝากขยะ_${selectedCategory}`;
        link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleClearHistory = async () => {
        if (!confirm(`⚠️ ยืนยันการ "ล้างประวัติการฝาก" ของ ${selectedCategory === 'all' ? 'ทุกหมวดหมู่' : selectedCategory} ออกจากฐานข้อมูล?\n(ยอดเงินและคาร์บอนจริงของสมาชิกจะไม่หายไป แนะนำให้ Export ไว้ก่อน)`)) return;

        try {
            for (const tx of filteredTx) {
                await deleteDoc(doc(db, "waste_transactions", String(tx.id)));
            }
            alert("🗑️ ล้างประวัติบนระบบ Cloud สำเร็จ (กรุณารีเฟรชเพื่อดูผลลัพธ์)");
        } catch (error) {
            console.error("Error clearing DB:", error);
            alert("❌ ลบประวัติผิดพลาด");
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300 text-slate-700">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">

                <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                    <div>
                        <h2 className="font-bold text-2xl text-slate-800 flex items-center gap-2"><History className="text-purple-500" /> ประวัติการฝากขยะและเงิน</h2>
                        <p className="text-base text-slate-500 mt-1">บันทึกประวัติการฝากแต่ละครั้ง (ล้างเพื่อลดภาระฐานข้อมูลได้)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-slate-50 border p-3 rounded-xl text-sm font-bold outline-none w-full sm:w-auto cursor-pointer">
                            <option value="all">คัดกรอง: ดูทุกหมวดหมู่</option>
                            {villages && villages.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
                        </select>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {filteredTx.length > 0 && <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 border border-emerald-200 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition shadow-sm"><Download size={18} /> Export</button>}
                            {filteredTx.length > 0 && <button onClick={handleClearHistory} className="flex-1 sm:flex-none bg-white text-red-500 border border-red-200 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition shadow-sm">🗑️ ล้างประวัติ</button>}
                        </div>
                    </div>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
                    {filteredTx.length > 0 ? filteredTx.map((tx) => (
                        <div key={tx.id} className="p-5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 transition-colors">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-3">
                                <div>
                                    {/* 🌟 โชว์ชื่อคนฝาก คู่กับ บ้านเลขที่ */}
                                    <div className="font-black text-xl flex items-center flex-wrap gap-2 text-slate-800">
                                        🏠 บ้านเลขที่ {tx.houseNo}
                                        <span className="text-slate-400 font-medium">/</span>
                                        <span className="text-blue-700">👤 {tx.personName || 'ไม่ได้ระบุชื่อ'}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg ml-2">{tx.category}</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-bold border border-amber-200">ผู้คีย์ระบบ: {tx.operator || 'ไม่ระบุ'}</span>
                                    </div>
                                </div>

                                <div className="text-left sm:text-right bg-white p-3.5 rounded-xl border border-slate-200 w-fit flex flex-col gap-1.5 items-start sm:items-end shadow-sm">
                                    <p className="text-slate-400 font-bold text-xs mb-1.5">{tx.date} • {tx.time}</p>

                                    {Number(tx.addedBalance) > 0 && (
                                        <p className="text-amber-600 font-black text-base bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                            +฿{Number(tx.addedBalance).toLocaleString()}
                                        </p>
                                    )}
                                    {Number(tx.creditAdded) > 0 && (
                                        <p className="text-emerald-600 font-black text-base bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                                            +{Number(tx.creditAdded).toFixed(4)} <span className="text-[10px]">kgCO2e</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map(type => Number(tx.wasteData?.[type]) > 0 && (
                                    <span key={type} className="bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-blue-600 shadow-sm flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                        {type}: {Number(tx.wasteData[type]).toFixed(2)} กก.
                                    </span>
                                ))}
                            </div>
                        </div>
                    )) : <p className="text-center text-slate-400 py-10 text-lg font-bold">ยังไม่มีประวัติการฝากในหมวดนี้</p>}
                </div>
            </div>
        </div>
    );
};
// === หน้าจอประวัติแอดมิน (AdminLogsView) โฉมใหม่ ===
const AdminLogsView = ({ adminLogs, db }) => {
    const [selectedOperator, setSelectedOperator] = useState('all');
    const uniqueOperators = [...new Set(adminLogs.map(log => log.operator))];
    const filteredLogs = adminLogs.filter(log => selectedOperator === 'all' || log.operator === selectedOperator);

    const handleExportExcel = () => {
        const headers = ['ลำดับ', 'วันที่', 'เวลา', 'ผู้ดำเนินการ', 'รายละเอียดกิจกรรมที่ทำ'];
        const dataRows = filteredLogs.map((log, i) => [i + 1, log.date, log.time, log.operator, log.action]);
        const rows = [headers, ...dataRows];
        const csvContent = "\uFEFF" + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ประวัติงาน_${selectedOperator === 'all' ? 'ทั้งหมด' : selectedOperator}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleClearLogs = async () => {
        if (!confirm(`⚠️ ยืนยันการ "ล้างประวัติแอดมิน" ของ ${selectedOperator === 'all' ? 'ทุกคน' : selectedOperator} ออกจากฐานข้อมูล?\n(แนะนำให้ Export ไว้ก่อน)`)) return;
        try {
            for (const log of filteredLogs) {
                await deleteDoc(doc(db, "admin_logs", String(log.id)));
            }
            alert("🗑️ ล้างประวัติแอดมินบนระบบ Cloud สำเร็จ");
        } catch (error) {
            alert("❌ ลบประวัติผิดพลาด");
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300 text-slate-700">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">

                <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                    <div>
                        <h2 className="font-bold text-2xl text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-red-500" /> บันทึกประวัติกิจกรรมแอดมิน</h2>
                        <p className="text-base text-slate-500 mt-1">ตรวจสอบการแก้ไขและบันทึกข้อมูลทุกอย่างที่เกิดขึ้นในระบบ</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} className="bg-slate-50 border p-3 rounded-xl text-sm font-bold outline-none w-full sm:w-auto cursor-pointer">
                            <option value="all">คัดกรอง: ดูแอดมินทุกคน</option>
                            {uniqueOperators.map((op, i) => <option key={i} value={op}>{op}</option>)}
                        </select>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {filteredLogs.length > 0 && <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 border border-emerald-200 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition shadow-sm"><Download size={18} /> Export</button>}
                            {filteredLogs.length > 0 && <button onClick={handleClearLogs} className="flex-1 sm:flex-none bg-white text-red-500 border border-red-200 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition shadow-sm">🗑️ ล้างประวัติ</button>}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
                    {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                        <div key={log.id} className="flex flex-col sm:flex-row p-5 bg-slate-50 hover:bg-amber-50/50 rounded-2xl border border-slate-200 shadow-sm justify-between items-start sm:items-center gap-4 transition-colors">
                            <div className="w-full">
                                <span className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-lg font-bold border border-amber-200 shadow-sm">👤 ผู้ดำเนินการ: {log.operator}</span>
                                {/* 🌟 ขยายขนาดฟอนต์รายละเอียดกิจกรรม (action) ให้ใหญ่ขึ้น */}
                                <p className="font-bold text-base text-slate-800 mt-3 bg-white p-3.5 rounded-xl border border-slate-200 w-full shadow-sm">{log.action}</p>
                            </div>
                            <div className="text-left sm:text-right bg-white px-4 py-2.5 rounded-xl border border-slate-200 w-full sm:w-auto shrink-0 shadow-sm">
                                <p className="font-black text-slate-700 text-sm">{log.time}</p>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">{log.date}</p>
                            </div>
                        </div>
                    )) : <p className="text-center text-slate-400 py-10 text-lg font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">ไม่พบประวัติการทำงาน</p>}
                </div>
            </div>
        </div>
    );
};
// === หน้าจอเข้าสู่ระบบสำหรับเจ้าหน้าที่ (LoginView) ===
// ทำหน้าที่ตรวจสอบ Username และ Password เพื่อให้สิทธิ์ในการเข้าถึงระบบจัดการ (Admin Panel)
const LoginView = ({ setIsLoggedIn, staffs, setCurrentUser, logAdminAction }) => {
    // ใช้ useState ภายในเพื่อเก็บค่าที่พิมพ์ในช่อง Input
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false); // 🌟 สเตตัสสำหรับเปิด/ปิดตาดูรหัส

    // ฟังก์ชันตรวจสอบการเข้าสู่ระบบ
    const handleLogin = () => {
        const foundStaff = staffs.find(s => s.username === username && s.password === password);

        if (foundStaff) {
            setIsLoggedIn(true);
            localStorage.setItem('is_logged_in', 'true'); // 🌟 จำสถานะเข้าสู่ระบบ

            setCurrentUser(foundStaff);
            localStorage.setItem('current_user', JSON.stringify(foundStaff)); // 🌟 จำว่าใครล็อกอิน

            setError('');
        } else {
            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 animate-in zoom-in duration-300">
            {/* ส่วนหัวของฟอร์ม Login */}
            <div className="text-center mb-8">
                <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-inner">
                    <LogIn size={32} />
                </div>
                <h2 className="font-bold text-2xl text-slate-800">สำหรับเจ้าหน้าที่</h2>
                <p className="text-slate-500 text-sm mt-1">เข้าสู่ระบบเพื่อจัดการข้อมูลธนาคารขยะ</p>
            </div>

            {/* ส่วนกรอกข้อมูล */}
            <div className="space-y-4">
                {/* แสดงข้อความ Error สีแดงเมื่อล็อกอินไม่สำเร็จ */}
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center font-bold border border-red-100">{error}</div>}

                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-600">ชื่อผู้ใช้</label>
                    <input
                        type="text"
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 focus:border-emerald-400 focus:bg-white outline-none transition-all font-medium text-slate-700"
                        placeholder="admin"
                        value={username}
                        onKeyDown={(e) => {
                            if (e.key === ' ') e.preventDefault();
                            if (e.key === 'Enter') handleLogin(); // 🌟 กด Enter เพื่อรันฟังก์ชันล็อกอิน
                        }}
                        onChange={(e) => {
                            setUsername(e.target.value.replace(/\s/g, ''));
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-600">รหัสผ่าน</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"} // 🌟 สลับชนิดของ input ตามการกดปุ่มตา
                            className="w-full border-2 border-slate-100 rounded-xl pl-4 pr-12 py-3 bg-slate-50 focus:border-emerald-400 focus:bg-white outline-none transition-all font-medium text-slate-700"
                            placeholder="••••••••"
                            value={password}
                            onKeyDown={(e) => {
                                if (e.key === ' ') e.preventDefault();
                                if (e.key === 'Enter') handleLogin(); // 🌟 กด Enter เพื่อรันฟังก์ชันล็อกอิน
                            }}
                            onChange={(e) => {
                                setPassword(e.target.value.replace(/\s/g, ''));
                            }}
                        />
                        {/* 🌟 ปุ่มรูปตาสำหรับดูรหัสผ่าน */}
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none p-1"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {/* ปุ่มกดยืนยันการเข้าสู่ระบบ */}
                <div className="pt-2">
                    <button
                        onClick={handleLogin}
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                    >
                        เข้าสู่ระบบ
                    </button>
                </div>
            </div>
        </div>
    );
};
// === แผงควบคุมหลักสำหรับเจ้าหน้าที่ (AdminPanel) โฉมใหม่ (Mobile Responsive) ===
const AdminPanel = ({
    currentUser, setCurrentPage, members, setMembers, editingVillage, setEditingVillage, onDeleteMember,
    isAddMemberOpen, setIsAddMemberOpen, currentLocation, setTempLocation, tempLocation, villageData,
    setIsPriceEditing, isRecordWasteOpen, setIsRecordWasteOpen, onSaveWasteRecord
}) => {
    return (
        <div className="space-y-6">
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden border border-emerald-400/30">
                {/* ลายกราฟิกจางๆ เพิ่มความพรีเมียมแบบสว่าง */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/20">
                            {/* ใช้ ShieldCheck ตามที่น้าชอบ */}
                            <ShieldCheck className="text-emerald-50" size={24} />
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                            ระบบจัดการธนาคารขยะบ้านป่าลาน
                        </h2>
                    </div>

                    {/* เส้นคั่นพรีเมียม (สีสว่างขึ้น) */}
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent my-4"></div>

                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-100/80 mb-1">
                                ผู้ใช้งานปัจจุบัน
                            </p>
                            <p className="text-base sm:text-xl font-bold text-white">
                                {currentUser ? currentUser.name : 'เจ้าหน้าที่'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] sm:text-xs font-bold text-emerald-100/80 mb-1 uppercase tracking-widest">
                                สถานะระบบ
                            </p>
                            <span className="inline-flex items-center gap-1.5 bg-white/20 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-white/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                                ONLINE
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🌟 เปลี่ยนเป็น grid-cols-2 ในมือถือ และลดช่องว่าง (gap) ลง */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">

                {/* ปุ่มที่ 1 */}
                <button onClick={() => { if (typeof setTempLocation === 'function') { setTempLocation(currentLocation); setIsAddMemberOpen(true); } }}
                    className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-blue-100 text-blue-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ลงทะเบียนสมาชิก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ปักหมุดบ้านและบันทึกข้อมูลสมาชิกใหม่</p>
                </button>

                {/* ปุ่มที่ 2 */}
                <button onClick={() => setIsRecordWasteOpen(true)}
                    className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-emerald-100 text-emerald-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">บันทึกการทิ้งขยะ</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">บันทึกประเภท น้ำหนัก และเงินฝากเพิ่ม</p>
                </button>

                {/* ปุ่มที่ 3 */}
                <button onClick={() => setCurrentPage('members')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-green-100 text-green-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">จัดการรายชื่อสมาชิก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">เพิ่ม/ลบ หรือแก้ไขข้อมูลบ้านสมาชิก</p>
                </button>

                {/* ปุ่มที่ 4 */}
                <button onClick={() => { setCurrentPage('prices'); if (typeof setIsPriceEditing === 'function') { setIsPriceEditing(true); } }} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-amber-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-amber-100 text-amber-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <Database className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">แก้ไขราคารับซื้อ</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ปรับเปลี่ยนมูลค่าราคากลางรายเดือน</p>
                </button>

                {/* ปุ่มที่ 5 */}
                <button onClick={() => setCurrentPage('manageBalance')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-emerald-100 text-emerald-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">จัดการยอดเงิน</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">แก้ไข หรือ หักเงินสมาชิกแบบกลุ่ม</p>
                </button>

                {/* ปุ่มที่ 6 */}
                <button onClick={() => setCurrentPage('history')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-purple-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-purple-100 text-purple-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <History className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ประวัติรายครัวเรือน</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ดูสถิติและล้างข้อมูลประจำเดือน</p>
                </button>

                {/* ปุ่มที่ 7 */}
                <button onClick={() => setCurrentPage('admin_logs')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-red-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-red-100 text-red-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ประวัติงานแอดมิน</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ตรวจสอบบันทึกการทำงานในระบบ</p>
                </button>
            </div>

            {isAddMemberOpen && tempLocation && (
                <AddMemberModal
                    lat={tempLocation.lat}
                    lng={tempLocation.lng}
                    villageData={villageData}
                    onSave={async (newMem) => {
                        setMembers([...members, newMem]);
                        // ☁️ บรรทัดทองคำ: สั่งดันดาต้าขึ้นฐานข้อมูลคลาวด์สดๆ 
                        await setDoc(doc(db, "members", String(newMem.id)), newMem);
                        setIsAddMemberOpen(false);
                        alert("📍 บันทึกข้อมูลสมาชิกสำเร็จ!");
                    }}
                    onClose={() => setIsAddMemberOpen(false)}
                />
            )}

            {/* ➕ [หน้าต่างเด้งเพิ่มใหม่]: หน้าต่างบันทึกขยะนำฝากเพิ่มรายวัน */}
            {isRecordWasteOpen && (
                <RecordWasteModal
                    members={members}
                    onClose={() => setIsRecordWasteOpen(false)}
                    onSave={onSaveWasteRecord}
                />
            )}
        </div>
    );
};

// === หน้าต่างแสดงรายละเอียดเชิงลึกของแต่ละหมวด (VillageDetailsModal) ===
// ใช้แสดงตัวเลขน้ำหนักขยะแยกประเภท และคะแนนเครดิตสะสมของแต่ละหมวด
const VillageDetailsModal = ({ village, onClose, villages, members }) => {
    if (!village) return null;

    // 🌟 สเตตัสสำหรับช่องค้นหาบ้านเลขที่ในหมวด (เผื่ออนาคตคนเยอะ)
    const [searchHouse, setSearchHouse] = useState('');

    const latestVillage = villages?.find(v => Number(v.id) === Number(village?.id)) || village;

    // 🔄 กรองสมาชิก และรองรับการค้นหา
    const villageMembers = members
        ? members.filter(m => Number(m.villageId) === Number(latestVillage.id))
        : [];

    const filteredMembers = villageMembers.filter(m =>
        String(m.houseNo).toLowerCase().includes(searchHouse.toLowerCase())
    );

    const aggregatedWaste = villageMembers.reduce((acc, m) => {
        const data = m.wasteData || {};
        Object.keys(data).forEach(type => {
            acc[type] = (acc[type] || 0) + Number(data[type] || 0);
        });
        return acc;
    }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });

    // 🌟 คำนวณยอดเงินรวม (balance) และคาร์บอน ของหมวด
    const totalVillageBalance = villageMembers.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);
    const totalVillageCarbon = villageMembers.reduce((sum, m) => sum + (Number(m.credit) || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 text-slate-700 flex flex-col max-h-[90vh]">

                {/* ส่วนหัว (Header) สีเขียวมรกต */}
                <div className="p-6 bg-emerald-600 text-white flex justify-between items-center shrink-0 shadow-sm relative overflow-hidden">
                    {/* ลายกราฟิกจางๆ */}
                    <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
                        <TrendingUp size={120} className="-mt-4 -mr-4" />
                    </div>

                    <div className="relative z-10">
                        <h3 className="font-black text-2xl drop-shadow-md">🏠 {latestVillage.name}</h3>
                        <p className="text-emerald-100 text-sm font-medium mt-1 flex items-center gap-2">
                            <Users size={14} /> จำนวน: {villageMembers.length} หลังคาเรือน
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition relative z-10 backdrop-blur-md text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* ส่วนเนื้อหาหลัก (Content) แบบเลื่อนได้ */}
                <div className="p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-200">

                    {/* แสดงน้ำหนักขยะแยก 5 ประเภท */}
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database size={18} className="text-emerald-500" /> ปริมาณขยะแยกประเภท (กก.)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map(type => (
                            <div key={type} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm text-center hover:border-emerald-200 hover:shadow-md transition-all">
                                <p className="text-[10px] text-slate-500 font-black mb-1.5">{type}</p>
                                <div className="flex flex-col items-center">
                                    <span className="text-xl font-black text-slate-700">
                                        {Number(aggregatedWaste[type] || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 📋 บัญชีรายชื่อ (พร้อมช่องค้นหา & Scrollbar ป้องกันล้น) */}
                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                <Users size={16} className="text-slate-400" /> บัญชีรายชื่อบ้านภายในหมวด
                            </h4>
                            {/* 🌟 ช่องค้นหาเพื่อแก้ปัญหาคนเยอะในอนาคต */}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                                <input
                                    type="text"
                                    placeholder="ค้นหาบ้านเลขที่..."
                                    value={searchHouse}
                                    onChange={(e) => setSearchHouse(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 w-full sm:w-40"
                                />
                            </div>
                        </div>

                        {/* 🌟 กล่องรายชื่อจำกัดความสูง (max-h-48) มี Scrollbar ในตัว */}
                        <div className="max-h-48 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
                            {filteredMembers.length > 0 ? (
                                filteredMembers.map((m, idx) => {
                                    const mBalance = Number(m.balance) || 0;
                                    const mCarbon = Number(m.credit) || 0;

                                    return (
                                        <div key={m.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-100 transition-colors gap-2">
                                            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                <span className="bg-slate-200 text-slate-500 w-5 h-5 rounded-full flex items-center justify-center text-[9px]">{idx + 1}</span>
                                                บ้านเลขที่ {m.houseNo}
                                            </span>

                                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                                {/* 🌟 โชว์คาร์บอนและยอดเงินรายบุคคล */}
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-lg">
                                                    🌱 {mCarbon.toFixed(4)} kgCO2e
                                                </span>
                                                <span className="text-xs font-black text-amber-600">
                                                    ฿{mBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-xs text-slate-400 font-bold">ไม่พบข้อมูลสมาชิกที่ค้นหา</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🌟 กล่องสรุปผลรวม (เงิน & คาร์บอน) */}
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center shadow-sm">
                            <span className="font-bold text-emerald-600 text-xs mb-1 flex items-center gap-1"><Leaf size={14} /> ลดคาร์บอนรวม</span>
                            <span className="text-xl font-black text-emerald-700 font-mono">
                                {totalVillageCarbon.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">kgCO2e</span>
                        </div>

                        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200/60 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10"><Wallet size={80} className="text-amber-500" /></div>
                            <span className="font-bold text-amber-700 text-xs mb-1 relative z-10 flex items-center gap-1"><Wallet size={14} /> ยอดเงินออมรวม</span>
                            <span className="text-2xl font-black text-amber-600 font-mono relative z-10">
                                ฿{totalVillageBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ส่วนท้าย (Footer) */}
                <div className="p-6 bg-white border-t border-slate-100 text-center shrink-0">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition shadow-lg active:scale-[0.98]">
                        ปิดหน้าต่างสถิติ
                    </button>
                </div>
            </div>
        </div>
    );
};
// === หน้าจอรายการหมวดทั้ง 9 (VillagesView) ===
// แสดงการ์ดสรุปข้อมูลของแต่ละหมวด เช่น น้ำหนักขยะรวม, ค่าการลดคาร์บอน และยอดเงิน
const VillagesView = ({ villageData, setSelectedVillage, setCurrentPage, isLoggedIn, setEditingVillage }) => {
    // สูตรคำนวณคาร์บอน (Factor อ้างอิงจาก อบก.)
    const calculateCarbon = (wasteData) => {
        const FACTORS = {
            'พลาสติก': 1.0310,
            'กระดาษ': 5.6735,     // มาจาก 3.5460 + 2.1275
            'แก้ว': 0.2760,
            'อลูมิเนียม': 9.1270,
            'โลหะผสม': 4.3910
        };
        return Object.entries(wasteData || {}).reduce((total, [type, weight]) => {
            return total + (Number(weight) * (FACTORS[type] || 0));
        }, 0);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {villageData.map((v) => {
                const totalWaste = v.totalWaste || 0;
                const carbonReduced = calculateCarbon(v.wasteData);
                const totalBalance = v.totalBalance || 0; // 🌟 ดึงยอดเงินรวมของหมวดมาใช้

                return (
                    <div
                        key={v.id}
                        className="bg-white rounded-[24px] p-6 border-2 border-emerald-100/60 shadow-[0_2px_10px_-4px_rgba(16,185,129,0.1)] hover:shadow-xl hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 flex flex-col relative overflow-hidden group"
                    >
                        {/* ลวดลายตกแต่งมุมขวาบน (ลายวงกต/รังผึ้งจางๆ) */}
                        <div className="absolute -right-6 -top-6 w-32 h-32 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 0L93.3013 25V75L50 100L6.69873 75V25L50 0Z" stroke="#059669" strokeWidth="2" />
                                <path d="M50 20L75.9808 35V65L50 80L24.0192 65V35L50 20Z" stroke="#059669" strokeWidth="2" />
                            </svg>
                        </div>

                        {/* ส่วนหัวของการ์ด */}
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div>
                                <h3 className="font-black text-2xl text-slate-800">{v.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">หมู่ 6 ต.อุโมงค์</p>
                            </div>
                            <div className="bg-emerald-50 text-emerald-600 text-[10px] px-3 py-1.5 rounded-full font-black flex items-center gap-1.5 border border-emerald-100">
                                <Leaf size={12} /> ECO ACTIVE
                            </div>
                        </div>

                        {/* ส่วนข้อมูล (Data Rows) */}
                        <div className="space-y-4 mb-6 relative z-10 flex-grow text-sm">

                            {/* 1. น้ำหนักขยะรวม */}
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="font-bold text-slate-500">น้ำหนักขยะรวม:</span>
                                <div className="text-right">
                                    <span className="font-black text-slate-700 text-lg">{totalWaste.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-400 ml-1">กก.</span>
                                </div>
                            </div>

                            {/* 2. ลดคาร์บอนได้ */}
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                                    <Leaf size={14} /> ลดคาร์บอนได้:
                                </span>
                                <div className="text-right flex items-baseline gap-1">
                                    <span className="font-black text-emerald-600 text-lg">
                                        {carbonReduced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">kgCO2e</span>
                                </div>
                            </div>

                            {/* 🌟 3. ยอดเงินรวม (เปลี่ยนจากเครดิต) */}
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-bold text-amber-600 flex items-center gap-1.5">
                                    <Wallet size={14} /> ยอดเงินรวม:
                                </span>
                                <div className="text-right flex items-center gap-1.5">
                                    <span className="font-black text-amber-500 text-lg">
                                        {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="bg-amber-100 text-amber-600 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                                        ฿
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ส่วนปุ่มกดด้านล่าง */}
                        <div className="flex flex-col gap-2 relative z-10 mt-auto">
                            {isLoggedIn && (
                                <button
                                    onClick={() => setEditingVillage(v)}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold shadow-md shadow-emerald-100 text-sm"
                                >
                                    <FileSpreadsheet size={16} /> บันทึกข้อมูลหมวด
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        localStorage.setItem('active_sort_zone', v.id);
                                        setCurrentPage('members');
                                    }}
                                    className="py-3 bg-white border-2 border-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-100 transition-all font-bold text-xs shadow-sm"
                                >
                                    <Users size={15} /> สมาชิก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedVillage(v)}
                                    className="py-3 bg-white border-2 border-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-100 transition-all font-bold text-xs shadow-sm"
                                >
                                    <TrendingUp size={15} /> สถิติ
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// === หน้าต่างแก้ไขข้อมูลหมวด (EditVillageModal) ===
// ใช้สำหรับแอดมินในการแก้ไขชื่อหมวด บันทึกน้ำหนักขยะ และลบสมาชิกในหมวด
const EditVillageModal = ({ village, onClose, onSave, members, onDeleteMember }) => {
    const [editName, setEditName] = useState(village.name);
    const [wasteWeights, setWasteWeights] = useState({
        'พลาสติก': village.wasteData?.['พลาสติก'] || 0,
        'กระดาษ': village.wasteData?.['กระดาษ'] || 0,
        'แก้ว': village.wasteData?.['แก้ว'] || 0,
        'อลูมิเนียม': village.wasteData?.['อลูมิเนียม'] || 0,
        'โลหะผสม': village.wasteData?.['โลหะผสม'] || 0
    });

    // 🔄 [แก้ไขจุดคัดกรอง]: ล็อกให้ดึงเฉพาะสมาชิกที่อยู่ในหมวดนี้เท่านั้นมาแสดง (เทียบละเอียดทุกรูปแบบ ป้องกันข้อมูลปนกันมั่ว)
    const villageMembers = members
        ? members.filter(m => m.category === village.name || m.category === editName)
        : [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <div className="flex-grow mr-4">
                        <label className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1 block">แก้ไขชื่อหมู่บ้าน/ชุมชน</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-slate-800 text-xl font-bold focus:border-blue-400 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow text-slate-700">
                    {/* ส่วนที่ 1: ขยะ */}
                    <div>
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Database size={18} className="text-emerald-500" /> ข้อมูลขยะแยกประเภท
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map((type) => (
                                <div key={type} className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        📦 {type}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={wasteWeights[type] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setWasteWeights(prev => ({
                                                    ...prev,
                                                    [type]: val === '' ? 0 : Number(val)
                                                }));
                                            }}
                                            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-blue-400 outline-none transition-all font-bold text-lg"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                            กก.
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ส่วนที่ 2: รายชื่อสมาชิกประจำหมวด */}
                    <div className="space-y-2">
                        {villageMembers.map(m => {
                            // 🌟 1. ดึงข้อมูลใหม่มาใช้งาน (เงินบาท, คาร์บอน, และปุ่มติ๊กสวัสดิการ)
                            const carbonCredit = Number(m.credit) || 0;
                            const balance = Number(m.balance) || 0;
                            const hasWelfare = m.hasWelfare || false;
                            // 3. ต้องมีคำสั่ง return ตามมาครับ
                            return (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">🏠 บ้านเลขที่ {m.houseNo}</p>
                                        {/* 🌟 2. อัปเดตข้อมูลที่โชว์ให้เป็น ยอดเงิน และ คาร์บอน */}
                                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border">ID: {m.id}</span>
                                            <span className="text-amber-600 font-bold">ยอดเงิน: ฿{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            <span className="text-emerald-600 font-bold">คาร์บอน: {carbonCredit.toFixed(4)} kgCO2e</span>
                                        </p>
                                    </div>

                                    {/* 🌟 3. ป้ายสวัสดิการเปลี่ยนมาดึงค่า True/False ของสมาชิกแต่ละคน */}
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${hasWelfare ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                        {hasWelfare ? '🎁 ได้สิทธิ์สวัสดิการ' : 'ไม่มีสิทธิ์'}
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (window.confirm(`ยืนยันการลบข้อมูลบ้านเลขที่ ${m.houseNo}?`)) {
                                                onDeleteMember(m.id);
                                            }
                                        }}
                                        className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })} {/* 4. ปิดด้วยวงเล็บปีกกาและวงเล็บปิดของ map */}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-700 transition">
                        ยกเลิก
                    </button>
                    <button
                        onClick={() => {
                            const finalWasteData = {
                                'พลาสติก': Number(wasteWeights?.['พลาสติก'] || 0),
                                'กระดาษ': Number(wasteWeights?.['กระดาษ'] || 0),
                                'แก้ว': Number(wasteWeights?.['แก้ว'] || 0),
                                'อลูมิเนียม': Number(wasteWeights?.['อลูมิเนียม'] || 0),
                                'โลหะผสม': Number(wasteWeights?.['โลหะผสม'] || 0)
                            };

                            // 🌟 แก้ไขจุดอันตราย! เปลี่ยนตัวคูณจาก 10 ให้กลายเป็นสูตรคาร์บอนใหม่
                            const CARBON_MULTIPLIERS = {
                                'พลาสติก': 1.0310,
                                'กระดาษ': 5.6735,
                                'แก้ว': 0.2760,
                                'อลูมิเนียม': 9.1270,
                                'โลหะผสม': 4.3910
                            };

                            const totalCarbonCredit = Object.entries(finalWasteData).reduce((sum, [type, weight]) => {
                                return sum + (weight * (CARBON_MULTIPLIERS[type] || 0));
                            }, 0);

                            const updatedData = {
                                ...village,
                                name: editName,
                                wasteData: finalWasteData,
                                credit: Number(totalCarbonCredit.toFixed(4)) // บันทึกเป็นคาร์บอนเครดิต
                            };

                            onSave(updatedData);
                            onClose();
                        }}
                        className="flex-[2] py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 transition"
                    >
                        💾 บันทึกข้อมูลหมวด
                    </button>
                </div>
            </div>
        </div>
    );
};
const AddMemberModal = ({ initialLat, initialLng, villageData, onSave, onClose }) => {
    // 1. 🌟 ปรับโครงสร้าง State ให้รองรับการเก็บข้อมูลรายบุคคล (Object)
    const [newMember, setNewMember] = useState({
        id: Date.now(),
        houseNo: '',
        villageId: villageData[0]?.id || 1,
        category: villageData[0]?.name || 'หมวดที่ 1',
        // 🌟 เปลี่ยน familyMembers ให้เป็น Object เก็บข้อมูลส่วนตัว
        familyMembers: [{
            id: Date.now().toString(),
            name: '',
            balance: 0,
            credit: 0,
            wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 },
            hasWelfare: false
        }],
        isSorted: false,
        hasWelfare: false,
        balance: 0,          // ยอดเงินรวมของบ้าน (ให้ระบบคำนวณอัตโนมัติ)
        lat: initialLat,
        lng: initialLng,
        credit: 0,           // ยอดคาร์บอนรวมของบ้าน
        wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }
    });

    const [selectedWastes, setSelectedWastes] = React.useState({
        'พลาสติก': false, 'กระดาษ': false, 'แก้ว': false, 'อลูมิเนียม': false, 'โลหะผสม': false
    });

    const CARBON_MULTIPLIERS = {
        'พลาสติก': 1.0310,
        'กระดาษ': 5.6735,
        'แก้ว': 0.2760,
        'อลูมิเนียม': 9.1270,
        'โลหะผสม': 4.3910
    };

    // 🌟 ฟังก์ชันเพิ่มกล่องข้อมูลสมาชิกคนใหม่ในบ้าน
    const addMemberField = () => {
        setNewMember({
            ...newMember,
            familyMembers: [
                ...newMember.familyMembers,
                {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: '',
                    balance: 0,
                    credit: 0,
                    wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 },
                    hasWelfare: false
                }
            ]
        });
    };

    // 🌟 ฟังก์ชันแก้ไขข้อมูลรายคน (ชื่อ หรือ ยอดเงิน)
    const updateMemberField = (index, field, value) => {
        const updatedFamily = [...newMember.familyMembers];
        updatedFamily[index] = { ...updatedFamily[index], [field]: value };

        // คำนวณยอดเงินรวมของบ้านอัตโนมัติจากสมาชิกทุกคน
        const totalHouseBalance = updatedFamily.reduce((sum, person) => sum + (Number(person.balance) || 0), 0);

        setNewMember({ ...newMember, familyMembers: updatedFamily, balance: totalHouseBalance });
    };

    // 🌟 ฟังก์ชันลบสมาชิกรายคนออก
    const removeMemberField = (index) => {
        const updatedFamily = newMember.familyMembers.filter((_, i) => i !== index);
        const totalHouseBalance = updatedFamily.reduce((sum, person) => sum + (Number(person.balance) || 0), 0);

        setNewMember({
            ...newMember,
            familyMembers: updatedFamily.length > 0 ? updatedFamily : [{
                id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }, hasWelfare: false
            }],
            balance: totalHouseBalance
        });
    };

    // แผนที่ย่อ (Mini Map)
    React.useEffect(() => {
        const L = window.L;
        if (!L) return;

        const miniMap = L.map('mini-map-container').setView([newMember.lat, newMember.lng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(miniMap);

        const marker = L.marker([newMember.lat, newMember.lng], { draggable: true }).addTo(miniMap);
        marker.bindPopup("<b>🏠 ตำแหน่งบ้านสมาชิก</b><br>สามารถลากหมุดเพื่อปรับพิกัดให้ตรงกับตัวบ้านได้").openPopup();

        marker.on('dragend', function (e) {
            const position = marker.getLatLng();
            setNewMember(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
        });

        window.findMiniLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    miniMap.setView([latitude, longitude], 17);
                    marker.setLatLng([latitude, longitude]);
                    setNewMember(prev => ({ ...prev, lat: latitude, lng: longitude }));
                });
            }
        };
        setTimeout(() => {
            miniMap.invalidateSize();
        }, 300);
        return () => miniMap.remove();
    }, [initialLat, initialLng]);

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
                <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                    <h3 className="font-bold text-xl flex items-center gap-2">📍 ลงทะเบียนสมาชิก</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-grow text-slate-700 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-700">🗺️ แผนที่พิกัดบ้าน (ลากหมุดเพื่อปรับความแม่นยำได้)</label>
                            <button type="button" onClick={() => window.findMiniLocation && window.findMiniLocation()} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1 shadow-sm">
                                <Navigation size={12} /> ค้นหาตัวฉัน
                            </button>
                        </div>
                        <div id="mini-map-container" className="h-48 w-full rounded-2xl border-2 border-slate-100 z-0 overflow-hidden"></div>
                        <p className="text-[11px] text-slate-400 font-mono">พิกัดปัจจุบัน: {newMember.lat.toFixed(5)}, {newMember.lng.toFixed(5)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">บ้านเลขที่</label>
                            <input type="text" className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold" value={newMember.houseNo} onChange={e => setNewMember({ ...newMember, houseNo: e.target.value })} placeholder="เช่น 123/4" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">หมวดที่รับผิดชอบ</label>
                            <select className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold" value={newMember.villageId} onChange={e => {
                                const selectedId = parseInt(e.target.value);
                                const v = villageData.find(item => item.id === selectedId);
                                if (v) setNewMember({ ...newMember, villageId: v.id, category: v.name });
                            }}>
                                {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 🌟 ปรับปรุง UI ส่วนรายชื่อสมาชิก: ให้กรอกชื่อ พร้อม ยอดเงินตั้งต้น */}
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700">👥 รายชื่อและยอดเงินของสมาชิกแต่ละคน</label>
                        <div className="space-y-3">
                            {newMember.familyMembers.map((person, index) => (
                                <div key={person.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 font-mono w-5 shrink-0">{index + 1}.</span>

                                    {/* ช่องกรอกชื่อ */}
                                    <input
                                        type="text"
                                        className="flex-[2] w-full border-2 border-slate-200 p-2.5 rounded-xl outline-none bg-white text-sm font-bold focus:border-blue-400"
                                        placeholder={`ชื่อ-นามสกุล คนที่ ${index + 1}`}
                                        value={person.name}
                                        onChange={(e) => updateMemberField(index, 'name', e.target.value)}
                                    />

                                    {/* ช่องกรอกยอดเงินรายบุคคล */}
                                    <div className="flex-[1] w-full relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                                        <input
                                            type="number"
                                            className="w-full border-2 border-slate-200 p-2.5 pl-8 rounded-xl outline-none bg-white text-sm font-black text-amber-600 focus:border-amber-400"
                                            placeholder="เงินตั้งต้น"
                                            value={person.balance || ''}
                                            onChange={(e) => updateMemberField(index, 'balance', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>

                                    {newMember.familyMembers.length > 1 && (
                                        <button type="button" onClick={() => removeMemberField(index)} className="p-2.5 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-xl transition shadow-sm shrink-0">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addMemberField} className="mt-3 w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50 flex items-center justify-center gap-2 transition">
                            <PlusCircle size={18} /> เพิ่มสมาชิกในบ้าน
                        </button>

                        {/* แสดงยอดเงินรวมของบ้านแบบ Real-time */}
                        <div className="mt-4 text-right bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <span className="text-xs font-bold text-amber-800">ยอดเงินรวมของครัวเรือน:</span>
                            <span className="ml-2 text-amber-600 text-lg font-black font-mono">฿{newMember.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* 🌟 (ลบกล่องกรอกยอดเงินรวมบ้านทิ้งไปแล้ว เพราะมันคำนวณจากรายคนด้านบน) */}

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold mb-3 text-slate-700">📦 ขยะนำฝากตั้งต้น (ส่วนนี้จะถูกรวมเป็นยอดของบ้าน)</label>
                        <div className="space-y-3">
                            {Object.keys(newMember.wasteData).map(type => (
                                <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border rounded-2xl gap-2">
                                    <label className="flex items-center gap-3 font-bold text-slate-700 cursor-pointer select-none">
                                        <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selectedWastes[type]} onChange={e => setSelectedWastes({ ...selectedWastes, [type]: e.target.checked })} />
                                        <span>{type}</span>
                                    </label>
                                    {selectedWastes[type] && (
                                        <div className="relative flex items-center">
                                            <input type="number" step="any" placeholder="0.00" className="border-2 border-slate-200 px-4 py-1.5 rounded-xl outline-none w-32 text-right font-bold pr-10 focus:border-blue-500 bg-white" onChange={e => {
                                                const weight = Math.max(0, parseFloat(e.target.value) || 0);
                                                setNewMember(prev => {
                                                    const updatedWaste = { ...prev.wasteData, [type]: weight };
                                                    const totalCarbon = Object.entries(updatedWaste).reduce((sum, [wType, wWeight]) => {
                                                        return sum + (wWeight * (CARBON_MULTIPLIERS[wType] || 0));
                                                    }, 0);
                                                    return { ...prev, wasteData: updatedWaste, credit: Number(totalCarbon.toFixed(4)) };
                                                });
                                            }} />
                                            <span className="absolute right-3 text-xs text-slate-400 font-bold">กก.</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-dashed text-center gap-2">
                            <span className="font-bold text-slate-700 text-sm">การคัดแยกประเภทขยะ</span>
                            <button type="button" onClick={() => setNewMember({ ...newMember, isSorted: !newMember.isSorted })} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${newMember.isSorted ? 'bg-green-500 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                {newMember.isSorted ? '✅ คัดแยกแล้ว' : '⚪ ยังไม่คัดแยก'}
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-dashed text-center gap-2">
                            <span className="font-bold text-slate-700 text-sm">สิทธิ์สวัสดิการรวมของบ้าน</span>
                            <button type="button" onClick={() => setNewMember({ ...newMember, hasWelfare: !newMember.hasWelfare })} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${newMember.hasWelfare ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                {newMember.hasWelfare ? '🎁 ได้รับสิทธิ์' : '❌ ยังไม่ได้สิทธิ์'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition">ยกเลิก</button>
                    <button type="button" onClick={() => {
                        if (!newMember.houseNo || !newMember.familyMembers[0].name.trim()) return alert("กรุณากรอกบ้านเลขที่ และชื่อสมาชิกอย่างน้อย 1 คน");
                        onSave(newMember);
                    }} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition">
                        บันทึกข้อมูลสมาชิก
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// ➕ [ขั้นตอนที่ 2]: หน้าต่างบันทึกการทิ้งขยะประจำวัน (RecordWasteModal) แบบระบุตัวบุคคล
// =========================================================================
const RecordWasteModal = ({ members, onSave, onClose }) => {
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState(''); // 🌟 เพิ่ม State เก็บ ID ของคนที่มาฝาก

    const [wasteInputs, setWasteInputs] = useState({
        'พลาสติก': '', 'กระดาษ': '', 'แก้ว': '', 'อลูมิเนียม': '', 'โลหะผสม': ''
    });
    const [addedBalance, setAddedBalance] = useState('');

    const CARBON_MULTIPLIERS = {
        'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910
    };

    const currentTurnCarbon = useMemo(() => {
        return Object.entries(wasteInputs).reduce((sum, [type, weight]) => {
            return sum + (Number(weight || 0) * (CARBON_MULTIPLIERS[type] || 0));
        }, 0);
    }, [wasteInputs]);

    // 🌟 ดึงข้อมูลบ้านที่ถูกเลือกมาดูว่ามีใครอยู่บ้าง
    const selectedHouse = useMemo(() => {
        return members.find(m => String(m.id) === String(selectedMemberId));
    }, [members, selectedMemberId]);

    // 🌟 เมื่อเปลี่ยนบ้าน ให้รีเซ็ตคนที่เลือกเป็นคนแรกของบ้านนั้นเสมอ
    React.useEffect(() => {
        if (selectedHouse && selectedHouse.familyMembers && selectedHouse.familyMembers.length > 0) {
            const firstPerson = selectedHouse.familyMembers[0];
            // รองรับทั้งข้อมูลแบบใหม่ (มี id) และแบบเก่า (ใช้ index แทนชั่วคราว)
            setSelectedPersonId(firstPerson.id || '0');
        } else {
            setSelectedPersonId('');
        }
    }, [selectedHouse]);

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh] text-slate-700">
                <div className="p-6 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-xl flex items-center gap-2">⚖️ บันทึกฝากขยะและยอดเงิน</h3>
                        <p className="text-xs text-emerald-100 mt-0.5">ระบุตัวบุคคล เพื่อนำฝากเงินเข้าบัญชีส่วนตัว</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-white">✕</button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-grow scrollbar-thin">

                    {/* 🌟 1. เลือกบ้าน และ เลือกคน (Dropdown 2 ชั้น) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* เลือกบ้านเลขที่ */}
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-slate-700">🏠 เลือกครัวเรือน</label>
                            <select
                                value={selectedMemberId}
                                onChange={(e) => setSelectedMemberId(e.target.value)}
                                className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold text-slate-700 focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="">-- เลือกบ้านเลขที่ --</option>
                                {members && members.map(m => (
                                    <option key={m.id} value={m.id}>
                                        บ้านเลขที่ {m.houseNo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* เลือกคนในบ้าน */}
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-slate-700">👤 สมาชิกผู้ฝาก</label>
                            <select
                                value={selectedPersonId}
                                onChange={(e) => setSelectedPersonId(e.target.value)}
                                disabled={!selectedMemberId}
                                className={`w-full border-2 p-3 rounded-xl outline-none font-bold text-sm cursor-pointer ${selectedMemberId ? 'border-slate-100 bg-emerald-50 text-emerald-700 focus:border-emerald-500' : 'border-slate-100 bg-slate-100 text-slate-400'}`}
                            >
                                {!selectedMemberId && <option value="">-- รอเลือกบ้าน --</option>}
                                {selectedHouse && selectedHouse.familyMembers && selectedHouse.familyMembers.map((person, index) => {
                                    // 🌟 ดักจับข้อมูลเก่าที่เป็น String
                                    const pId = person.id || index.toString();
                                    const pName = typeof person === 'string' ? person : person.name;
                                    return (
                                        <option key={pId} value={pId}>
                                            {pName || `สมาชิกคนที่ ${index + 1}`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* 2. กรอกน้ำหนักแยกประเภทขยะ */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <label className="block text-sm font-bold text-slate-700">📦 ปริมาณน้ำหนักขยะ (กิโลกรัม)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map((type) => (
                                <div key={type} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border">
                                    <label className="text-xs font-bold text-slate-500">{type}</label>
                                    <div className="relative flex items-center">
                                        <input
                                            type="number" min="0" step="any" placeholder="0.00"
                                            value={wasteInputs[type]}
                                            onChange={(e) => setWasteInputs(prev => ({ ...prev, [type]: e.target.value }))}
                                            className="w-full border-b-2 border-slate-100 focus:border-emerald-500 outline-none text-right font-black text-slate-800 pr-8 py-1"
                                        />
                                        <span className="absolute right-1 text-xs text-slate-400 font-bold">กก.</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. กรอกยอดเงิน และโชว์คาร์บอน */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
                            <label className="block text-sm font-bold text-amber-800 mb-2">💰 ยอดเงินฝากเข้าบัญชี</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                                <input
                                    type="number" min="0" step="any" placeholder="0.00"
                                    value={addedBalance}
                                    onChange={(e) => setAddedBalance(e.target.value)}
                                    className="w-full border-2 border-white focus:border-amber-400 outline-none text-right font-black text-amber-600 pl-8 pr-3 py-2 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-center items-end text-right shadow-sm">
                            <span className="font-bold text-emerald-800 text-xs mb-1">🌱 คาร์บอนที่จะได้รับเพิ่ม</span>
                            <span className="text-xl font-black text-emerald-600 font-mono">
                                +{currentTurnCarbon.toFixed(4)} <span className="text-[10px] text-emerald-500">kgCO₂e</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 transition">ยกเลิก</button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!selectedMemberId) return alert("❌ กรุณาเลือกบ้านเลขที่สมาชิกก่อนบันทึก");
                            if (!selectedPersonId) return alert("❌ กรุณาเลือกสมาชิกผู้ฝากก่อนบันทึก");

                            const hasWaste = Object.values(wasteInputs).some(v => Number(v) > 0);
                            const finalBalance = Number(addedBalance) || 0;

                            if (!hasWaste && finalBalance <= 0) {
                                return alert("❌ กรุณากรอกน้ำหนักขยะ หรือ ยอดเงิน อย่างน้อย 1 อย่าง");
                            }

                            const finalTurnWaste = {
                                'พลาสติก': Number(wasteInputs['พลาสติก']) || 0,
                                'กระดาษ': Number(wasteInputs['กระดาษ']) || 0,
                                'แก้ว': Number(wasteInputs['แก้ว']) || 0,
                                'อลูมิเนียม': Number(wasteInputs['อลูมิเนียม']) || 0,
                                'โลหะผสม': Number(wasteInputs['โลหะผสม']) || 0
                            };

                            // 🌟 แก้ไข: ส่งค่า selectedPersonId กลับไปที่ App.jsx ด้วย (มี 5 ตัวแปรแล้ว)
                            onSave(selectedMemberId, selectedPersonId, finalTurnWaste, Number(currentTurnCarbon.toFixed(4)), finalBalance);
                        }}
                        className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition"
                    >
                        💾 ยืนยันบันทึกข้อมูล
                    </button>
                </div>
            </div>
        </div>
    );
};
const App = () => {
    // --- DATABASE: ส่วนเก็บข้อมูลหลักของแอปพลิเคชัน ---
    useEffect(() => {
        const now = new Date();
        const todayKey = `visit_date_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
        const monthKey = `visit_month_${now.getFullYear()}_${now.getMonth()}`;
        const totalKey = `visit_total_counter`;

        // 1. ดึงข้อมูลเก่าที่เคยนับค้างไว้ในเครื่องขึ้นมาตรวจ
        let currentToday = Number(localStorage.getItem(todayKey)) || 0;
        let currentMonth = Number(localStorage.getItem(monthKey)) || 0;
        let currentTotal = Number(localStorage.getItem(totalKey)) || 0;

        // 2. เช็กว่าสิทธิ์การเข้าชมรอบนี้ (Session) ถูกนับไปหรือยังในหน้านี้ เพื่อป้องกันตัวเลขดีดรัวๆ ตอนกดสลับเมนู
        const hasCountedInSession = sessionStorage.getItem('page_view_counted');

        if (!hasCountedInSession) {
            currentToday += 1;
            currentMonth += 1;
            currentTotal += 1;

            // สั่งอัปเดตลงหน่วยความจำถาวรของเบราว์เซอร์
            localStorage.setItem(todayKey, currentToday);
            localStorage.setItem(monthKey, currentMonth);
            localStorage.setItem(totalKey, currentTotal);

            // ล็อกไว้ว่าเซสชันการเปิดรอบนี้บวกแต้มไปแล้วเรียบร้อยนะ
            sessionStorage.setItem('page_view_counted', 'true');
        }

        // 3. ส่งยอดที่นับได้จริงเข้าสู่ระบบสเตตัสเพื่อนำไปพ่นออกหน้าจอ Footer
        setVisitorStats({
            today: currentToday,
            month: currentMonth,
            total: currentTotal
        });
    }, []);

    // 🌟 ฟังก์ชันแกนกลางสำหรับโหลดข้อมูลจาก DB (เรียกใช้เมื่อเปิดเว็บ หรือหลังกดเซฟ)
    const refreshData = async () => {
        try {
            // 1. โหลดข้อมูลสมาชิก
            const memberSnap = await getDocs(collection(db, "members"));
            const membersData = memberSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMembers(membersData);
            setAllMembers(membersData);
            localStorage.setItem('local_members_data', JSON.stringify(membersData));

            // 2. โหลดข้อมูลหมู่บ้าน
            const villageSnap = await getDocs(collection(db, "villages"));
            const villagesData = villageSnap.docs.map(doc => doc.data());
            if (villagesData.length > 0) {
                setVillages(villagesData);
                localStorage.setItem('village_data', JSON.stringify(villagesData));
            }

            // 3. โหลดประวัติแอดมิน (เอาแค่ 200 รายการล่าสุด จะได้ไม่หนัก)
            const logsSnap = await getDocs(query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(200)));
            setAdminLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 4. โหลดประวัติฝากขยะ (เอาแค่ 200 รายการล่าสุด)
            const txSnap = await getDocs(query(collection(db, "waste_transactions"), orderBy("timestamp", "desc"), limit(200)));
            setTransactions(txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error("ดึงข้อมูลผิดพลาด:", error);
        }
    };

    // สั่งให้ดึงข้อมูลครั้งแรก เมื่อเปิดเว็บ
    useEffect(() => {
        refreshData();
    }, []);

    const fetchAllMembersForStats = async () => {
        try {
            const q = query(collection(db, "members"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllMembers(data);
        } catch (err) {
            console.error("ดึงข้อมูลสมาชิกทั้งหมดพลาด:", err);
        }
    };

    useEffect(() => {
        fetchAllMembersForStats();
    }, []);

    useEffect(() => {
        const loadLogsFromCloud = async () => {
            try {
                // 1. ดึงข้อมูลจากคอลเลกชัน admin_logs
                const logsCollection = collection(db, "admin_logs");

                // 2. เรียงลำดับจากใหม่ไปเก่า (ตาม timestamp ที่เราเพิ่งเพิ่มเข้าไป)
                const q = query(logsCollection, orderBy("timestamp", "desc"), limit(50));
                const querySnapshot = await getDocs(q);

                // 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ State ของน้าต้องการ
                const fetchedLogs = querySnapshot.docs.map(doc => ({
                    ...doc.data()
                }));

                // 4. เอา Log ที่ดึงมาได้ ไปใส่ใน State
                setAdminLogs(fetchedLogs);

                // 5. อัปเดต localStorage เผื่อกรณีออฟไลน์
                localStorage.setItem('admin_action_logs', JSON.stringify(fetchedLogs));

                console.log("โหลดประวัติจาก Cloud เรียบร้อย");
            } catch (err) {
                console.error("ดึงประวัติจาก Cloud ไม่สำเร็จ:", err);
            }
        };

        loadLogsFromCloud();
    }, []);

    // ☁️ ฟังก์ชันสำหรับบันทึกน้ำหนักขยะและยอดเงิน พุ่งขึ้น Firebase
    const handleSaveWasteRecord = async (memberId, turnWasteData, turnCredit, addedBalance) => {
        let targetHouseNo = '';

        // 1. ค้นหาตัวสมาชิก
        const targetMemberObj = members.find(m => String(m.id) === String(memberId));
        if (!targetMemberObj) return alert("❌ ไม่พบข้อมูลสมาชิกรายนี้ในระบบ");

        targetHouseNo = targetMemberObj.houseNo;
        const nextWasteData = { ...targetMemberObj.wasteData };

        // วนลูปบวกสะสมค่าน้ำหนักขยะ
        Object.keys(turnWasteData).forEach(type => {
            nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(turnWasteData[type]) || 0);
        });

        const finalBalanceToAdd = Number(addedBalance) || 0; // ยอดเงินฝากเพิ่ม

        const updatedMember = {
            ...targetMemberObj,
            wasteData: nextWasteData,
            credit: (Number(targetMemberObj.credit) || 0) + Number(turnCredit),
            balance: (Number(targetMemberObj.balance) || 0) + finalBalanceToAdd, // 🌟 บวกยอดเงินให้สมาชิก
            isSorted: true
        };

        // 2. อัปเดตสมาชิกและเซฟลง LocalStorage
        const updatedMembers = members.map(m => String(m.id) === String(memberId) ? updatedMember : m);
        setMembers(updatedMembers);
        localStorage.setItem('local_members_data', JSON.stringify(updatedMembers));

        // 3. ☁️ ยิงอัปเดตสมาชิกขึ้น Cloud
        try {
            await setDoc(doc(db, "members", String(memberId)), updatedMember);
        } catch (err) {
            console.error("เซฟยอดขยะลงคลาวด์ล้มเหลว:", err);
        }

        // 4. นำปริมาณขยะวิ่งไปบวกสะสมเพิ่มให้ "หมวดใหญ่"
        setVillages(prevVillages => {
            const updatedVillages = prevVillages.map(v => {
                if (v.id === targetMemberObj.villageId) {
                    const nextVillageWaste = { ...v.wasteData };
                    Object.keys(turnWasteData).forEach(type => {
                        nextVillageWaste[type] = (Number(nextVillageWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                    });
                    return {
                        ...v,
                        wasteData: nextVillageWaste,
                        credit: (Number(v.credit) || 0) + Number(turnCredit),
                        totalBalance: (Number(v.totalBalance) || 0) + finalBalanceToAdd // 🌟 บวกเงินให้หมวด
                    };
                }
                return v;
            });
            localStorage.setItem('village_data', JSON.stringify(updatedVillages));
            return updatedVillages;
        });

        // =======================================================
        // 🌟 5. บันทึกประวัติและแจ้งเตือน (Admin Logs) - เวอร์ชันใหม่โชว์เงิน
        // =======================================================
        const typesSummary = Object.entries(turnWasteData)
            .filter(([_, w]) => w > 0)
            .map(([t, w]) => `${t} ${w} กก.`)
            .join(', ');

        let logMessage = `บันทึกข้อมูลให้ "บ้านเลขที่ ${targetHouseNo}" `;
        if (typesSummary) logMessage += `| ขยะ: [${typesSummary}] (+${turnCredit.toFixed(4)} kgCO2e) `;
        if (finalBalanceToAdd > 0) logMessage += `| ฝากเงิน: +฿${finalBalanceToAdd.toLocaleString()} `;

        logAdminAction(logMessage);

        // =======================================================
        // 🌟 6. ยิง "ประวัติฝากขยะ (History)" ขึ้น Firebase
        // =======================================================
        const now = new Date();
        const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        const newTx = {
            houseNo: targetHouseNo,
            personName: targetPersonName,
            villageId: targetMemberObj.villageId,
            category: targetMemberObj.category,
            wasteData: turnWasteData,
            creditAdded: turnCredit,
            addedBalance: finalBalanceToAdd,
            date: dateString,
            time: timeString,
            operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, "waste_transactions"), newTx);
        } catch (err) {
            console.error("เซฟประวัติพลาด:", err);
        }

        // =======================================================
        // 🌟 7. สั่งโหลดข้อมูลใหม่ให้หน้าจออัปเดตทันที
        // =======================================================
        if (typeof refreshData === 'function') {
            await refreshData();
        }

        setIsRecordWasteOpen(false);
        alert(`⚖️ บันทึกรายการสำเร็จ!`);
    };
    const [expandedMemberId, setExpandedMemberId] = React.useState(null); // ➕ บันทึกว่ากล่องของบ้านหลังไหนกำลังถูกคลิกเปิดดูรายชื่อ
    // สถานะหน้าจอและเมนู
    const [currentPage, setCurrentPage] = useState('dashboard'); // ควบคุมว่าตอนนี้อยู่หน้าไหน
    // 🌟 เปลี่ยนการจำสถานะล็อกอิน ให้จำชื่อแอดมินด้วย
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return localStorage.getItem('is_logged_in') === 'true';
    });
    const [currentUser, setCurrentUser] = useState(() => {
        const savedUser = localStorage.getItem('current_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    // ทุกครั้งที่เปลี่ยนสถานะ login ให้เซฟลง storage
    const toggleLogin = (status) => {
        setIsLoggedIn(status);
        localStorage.setItem('is_logged_in', status);
    };
    const [isMenuOpen, setIsMenuOpen] = useState(false);        // สถานะการเปิด/ปิดเมนูมือถือ

    // ข้อมูลสมาชิกและตำแหน่ง
    const [members, setMembers] = useState([]);
    const [allMembers, setAllMembers] = useState([]);
    const [currentLocation, setCurrentLocation] = useState({ lat: 18.5244, lng: 99.0435 }); // จุดกึ่งกลางแผนที่ (อุโมงค์)
    // ข้อมูลแอดมินที่ล็อกอินอยู่

    // ข้อมูลสำหรับการแก้ไขและแจ้งเตือน
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [editingVillage, setEditingVillage] = useState(null);
    const [showValidationAlert, setShowValidationAlert] = useState(false);
    const [visitorStats, setVisitorStats] = useState({ today: 0, month: 0, total: 0 });
    const [isPriceEditing, setIsPriceEditing] = useState(false);
    useEffect(() => {
        // ถ้าย้ายไปหน้าอื่นที่ไม่ใช่หน้าตั้งราคา ('prices') ให้ปิดโหมดแก้ไขทันที
        if (currentPage !== 'prices') {
            setIsPriceEditing(false);
        }
    }, [currentPage]);

    // 📡 [ปรับเป็นระบบคลาวด์]: ตั้งค่าประวัติแอดมินเริ่มต้นเป็นกล่องเปล่าเพื่อรอดึงจากอินเทอร์เน็ต
    const [adminLogs, setAdminLogs] = useState([]);
    const [isRecordWasteOpen, setIsRecordWasteOpen] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // ➕ [เพิ่มใหม่]: ฟังก์ชันส่วนกลางสำหรับบันทึกประวัติการกระทำของเจ้าหน้าที่ระบบ
    const logAdminAction = async (actionText) => { // 1. เติม async เข้าไป
        const now = new Date();
        const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        const newLog = {
            id: Date.now(),
            operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
            action: actionText,
            time: timeString,
            date: dateString,
            timestamp: now // ➕ เพิ่ม timestamp จริงๆ เอาไว้ใช้เรียงลำดับใน Cloud
        };

        // 2. บันทึกลง Cloud (Firestore)
        try {
            await addDoc(collection(db, "admin_logs"), newLog);
            console.log("บันทึกประวัติการทำงานลง Cloud สำเร็จ");
        } catch (err) {
            console.error("บันทึกประวัติลง Cloud ไม่สำเร็จ:", err);
        }

        // 3. อัปเดตหน้าจอทันที (ไม่ต้องรอโหลดจาก Cloud)
        setAdminLogs(prev => {
            const nextLogs = [newLog, ...prev];
            localStorage.setItem('admin_action_logs', JSON.stringify(nextLogs));
            return nextLogs;
        });
    };

    // --- ฐานข้อมูล 9 หมวด (เชื่อมต่อ LocalStorage) ---
    const [villages, setVillages] = useState(() => {
        const saved = localStorage.getItem('village_data');
        if (saved) return JSON.parse(saved);

        // ถ้าไม่มีข้อมูลเก่า ให้สร้างข้อมูลเริ่มต้น 9 หมวด ของหมู่ 6
        return Array.from({ length: 9 }, (_, i) => ({
            id: i + 1,
            name: `หมวดที่ ${i + 1}`,
            goal: 1000,
            wasteData: {
                'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0
            },
            credit: 0
        }));

    });
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [tempLocation, setTempLocation] = useState(null); // ไว้เก็บพิกัดชั่วคราวก่อนกดเซฟ

    // --- 1. ข้อมูลเจ้าหน้าที่ (Database จำลอง) ---
    const [staffs] = useState([
        { id: 'admin01', username: 'mo', password: '1', name: 'เจ้าหน้าที่ระบบ Mo' },
        { id: 'admin02', username: 'admin1', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 1' },
        { id: 'admin03', username: 'admin2', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 2' },
        { id: 'admin04', username: 'admin3', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 3' },
        { id: 'admin05', username: 'admin4', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 4' },
        { id: 'admin06', username: 'admin5', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 5' },
        { id: 'admin07', username: 'admin6', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 6' },
        { id: 'admin08', username: 'admin7', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 7' },
        { id: 'admin09', username: 'admin8', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 8' },
        { id: 'admin10', username: 'admin9', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 9' },
    ]);
    const [currentStaff, setCurrentStaff] = useState(null);

    // --- 3. ประวัติการทิ้งขยะ (เชื่อมโยงกับกราฟแท่ง) ---
    const [transactions, setTransactions] = useState([]);

    // --- ฟังก์ชัน: ลบสมาชิกออกจากระบบ ---
    const handleDeleteMember = (memberId) => {
        const targetMem = members.find(m => m.id === memberId);
        if (window.confirm("คุณแน่ใจใช่ไหมที่จะลบสมาชิกคนนี้? ข้อมูลทั้งหมดจะหายไปทันที")) {
            if (targetMem) {
                logAdminAction(`ได้ลบข้อมูลครัวเรือน "บ้านเลขที่ ${targetMem.houseNo}" ออกจากฐานข้อมู`);
            }
            setMembers(prev => prev.filter(m => m.id !== memberId));
        }
    };

    // --- ฟังก์ชัน: ค้นหาตำแหน่งปัจจุบันผ่าน GPS ---
    const findMyLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentLocation({ lat: latitude, lng: longitude });
                    alert("พบตำแหน่งของคุณแล้ว!");
                },
                () => alert("โปรดเปิด GPS หรืออนุญาตให้เข้าถึงตำแหน่งใน Browser ครับ")
            );
        }
    };
    // --- ฟังก์ชัน: อัปเดตข้อมูลหมวดขยะและบันทึกลง LocalStorage ---
    const handleUpdateVillage = async (updatedVillage) => {
        try {
            // 1. อัปเดตขึ้น Firebase
            await setDoc(doc(db, "villages", String(updatedVillage.id)), updatedVillage); await refreshData();

            // 2. อัปเดต State และ LocalStorage
            setVillages(prevVillages => {
                const newVillages = prevVillages.map(v => v.id === updatedVillage.id ? updatedVillage : v);
                localStorage.setItem('village_data', JSON.stringify(newVillages));
                return newVillages;
            });

            setSelectedVillage(null);
            setTimeout(() => {
                setSelectedVillage(updatedVillage);
            }, 0);

            setEditingVillage(null); refreshData();
        } catch (error) {
            console.error("อัปเดตข้อมูลหมู่บ้านล้มเหลว:", error);
            alert("❌ อัปเดตหมวดหมู่ลง Cloud ไม่สำเร็จ!");
        }
    };

    // --- 4. คำนวณค่าการลดการปล่อยคาร์บอน (Carbon Stats) ---
    const carbonStats = useMemo(() => {
        const FACTORS = {
            'พลาสติก': 1.0310,
            'กระดาษ': 5.6735,     // มาจาก 3.5460 + 2.1275
            'แก้ว': 0.2760,
            'อลูมิเนียม': 9.1270,
            'โลหะผสม': 4.3910
        };
        let total = 0;
        villages.forEach(v => {
            Object.entries(v.wasteData || {}).forEach(([type, weight]) => {
                total += (Number(weight) * (FACTORS[type] || 0));
            });
        });
        return total;
    }, [villages]); // คำนวณใหม่เฉพาะเมื่อข้อมูลหมู่บ้าน (villages) เปลี่ยนแปลง

    // --- 5. สรุปสถิติ 5 กล่องหลักสำหรับหน้า Dashboard 
    const stats = useMemo(() => {
        // 1. รวมขยะรวมจากสมาชิกทุกคน
        const totalWeight = allMembers.reduce((acc, m) => {
            return acc + Object.values(m.wasteData || {}).reduce((a, b) => a + Number(b), 0);
        }, 0);

        // 2. หาประเภทขยะมากที่สุดจากสมาชิก
        const typeTotals = allMembers.reduce((acc, m) => {
            Object.entries(m.wasteData || {}).forEach(([type, weight]) => {
                acc[type] = (acc[type] || 0) + Number(weight);
            });
            return acc;
        }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });

        // หาตัวที่มากที่สุด
        const topType = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0];
        const topLabel = topType && topType[1] > 0 ? topType[0] : 'รอดำเนินการ';
        const totalBalance = allMembers.reduce((acc, m) => acc + (Number(m.balance) || 0), 0);
        return [
            { label: 'ประเภทขยะมากที่สุด', value: topLabel, icon: <Database className="text-yellow-500" /> },
            { label: 'ขยะรวมทั้งระบบ', value: `${totalWeight.toLocaleString()} กก.`, icon: <TrendingUp className="text-yellow-500" /> },
            {
                label: 'ยอดเงินออมรวมทั้งโครงการ',
                value: `฿${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: <Wallet className="text-yellow-500" />
            },
            { label: 'จำนวนครัวเรือน', value: allMembers.length, icon: <Users className="text-yellow-500" /> },
            {
                label: 'ลดการปล่อยคาร์บอน',
                value: `${carbonStats.toFixed(2)} kgCO2e`,
                icon: <Leaf className="text-emerald-500" />,
                hasTooltip: true
            }
        ];
    }, [allMembers, carbonStats]);

    // --- 6. ข้อมูลสรุปรายหมวด (Village Data Calculation) ---
    // ทำหน้าที่รวบรวมคะแนนจาก "รายบ้าน" และ "น้ำหนักขยะในหมวด" มารวมกันเป็นคะแนนรวมของแต่ละหมวด
    const villageData = useMemo(() => {
        return villages.map(v => {
            // 1. กรองสมาชิกที่อยู่หมวดนี้จริงๆ
            const vMembers = allMembers.filter(m => Number(m.villageId) === Number(v.id));

            // 🌟 2. คำนวณยอดเงินรวม (balance) จากสมาชิกในหมวดนี้ แทนเครดิตเก่า
            const totalVillageBalance = vMembers.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);

            const aggregatedWaste = vMembers.reduce((acc, m) => {
                const data = m.wasteData || {};
                Object.keys(data).forEach(type => {
                    acc[type] = (acc[type] || 0) + Number(data[type] || 0);
                });
                return acc;
            }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });
            // 3. ➕ คำนวณน้ำหนักขยะรวม (รวมทุกประเภทของทุกคนในหมวด)
            const totalWasteInVillage = vMembers.reduce((sum, m) => {
                const houseWaste = Object.values(m.wasteData || {}).reduce((a, b) => a + Number(b), 0);
                return sum + houseWaste;
            }, 0);

            return {
                ...v,
                members: vMembers.length,
                totalBalance: totalVillageBalance,
                totalWaste: totalWasteInVillage,
                wasteData: aggregatedWaste,
            };
        });
    }, [villages, allMembers]);

    // --- 7. ข้อมูลสำหรับกราฟแท่ง (Bar Chart Calculation) ---
    const wasteTypeData = useMemo(() => {
        const types = ['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'];

        // 1. รวมขยะทุกประเภทจากสมาชิกทุกคน
        const totals = allMembers.reduce((acc, m) => {
            Object.entries(m.wasteData || {}).forEach(([type, weight]) => {
                acc[type] = (acc[type] || 0) + Number(weight);
            });
            return acc;
        }, {});

        // 2. Map ออกมาเป็นอาร์เรย์เพื่อให้ Recharts นำไปวาดกราฟ
        return types.map(type => ({
            name: type,
            amount: totals[type] || 0
        }));
    }, [allMembers]);

    //* --- renderContent: ฟังก์ชันสำหรับตัดสินใจว่าจะแสดงหน้าจอไหน-- -
    //* ทำหน้าที่เหมือนสวิตช์ไฟ(Switch Case) ตามค่าของตัวแปร currentPage
    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <MemoizedDashboardView stats={stats} villageData={villageData} wasteTypeData={wasteTypeData} members={allMembers} setCurrentPage={setCurrentPage} />;

            case 'villages':
                return <VillagesView villageData={villageData} setSelectedVillage={setSelectedVillage} setCurrentPage={setCurrentPage} isLoggedIn={isLoggedIn} setEditingVillage={setEditingVillage} />;

            case 'prices':
                return (
                    <PriceView
                        isLoggedIn={isLoggedIn}
                        isEditing={isPriceEditing}
                        setIsEditing={setIsPriceEditing}
                    />
                );

            case 'members':
                return <MembersView
                    members={members}
                    setMembers={setMembers}
                    villages={villages}
                    setVillages={setVillages}
                    isLoggedIn={isLoggedIn}
                    logAdminAction={logAdminAction}
                    refreshData={refreshData} />;

            case 'history':
                // 🔄 [แก้ไขเปิดทำงานจริง]: ดีดส่งตัวแปร members เข้าหน้าประวัติเพื่อทำการแจกแจงรายบ้านจริง
                return <HistoryView transactions={transactions} villages={villages} db={db} refreshData={refreshData} />;

            case 'admin_logs':
                // ส่งต่อสเตตัสแอดมินล็อกเข้าไปทำงานในหน้าแยกได้อย่างปลอดภัย
                return <AdminLogsView adminLogs={adminLogs} setAdminLogs={setAdminLogs} />; return <AdminLogsView adminLogs={adminLogs} db={db} refreshData={refreshData} />;
            case 'manageBalance':
                return (
                    <ManageBalanceView
                        members={members}
                        villages={villages}
                        setMembers={setMembers}
                        db={db}
                        logAdminAction={logAdminAction}
                        setCurrentPage={setCurrentPage}
                    />
                );
            case 'map':
                return !isMapLoaded ? (
                    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-3xl m-4 border-2 border-dashed border-slate-200">
                        <h3 className="font-bold text-slate-600 mb-4">แผนที่ครัวเรือนสมาชิก</h3>
                        <button
                            onClick={() => setIsMapLoaded(true)}
                            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg"
                        >
                            เปิดแผนที่ (กดเพื่อโหลด)
                        </button>
                    </div>
                ) : (
                    <React.Suspense fallback={<div className="h-[500px] flex items-center justify-center">กำลังเตรียมแผนที่...</div>}>
                        <MapView
                            currentLocation={currentLocation || { lat: 18.57, lng: 98.98 }}
                            members={members}
                            findMyLocation={findMyLocation}
                            onPinLocation={(loc) => {
                                setTempLocation(loc);
                                setIsAddMemberOpen(true);
                            }}
                            isLoggedIn={isLoggedIn}
                            villages={villages} // อย่าลืมส่งตัวแปร villages เข้าไปด้วยนะครับ
                        />
                    </React.Suspense>
                );

            case 'admin':
                return isLoggedIn ? (
                    <AdminPanel
                        currentUser={currentUser}
                        setCurrentPage={setCurrentPage}
                        members={allMembers}
                        setMembers={setMembers}
                        editingVillage={editingVillage}
                        setEditingVillage={setEditingVillage}
                        onDeleteMember={handleDeleteMember}
                        currentLocation={currentLocation}
                        setTempLocation={setTempLocation}
                        isAddMemberOpen={isAddMemberOpen}
                        setIsAddMemberOpen={setIsAddMemberOpen}
                        setIsPriceEditing={setIsPriceEditing}
                        villageData={villages}
                        isRecordWasteOpen={isRecordWasteOpen}
                        setIsRecordWasteOpen={setIsRecordWasteOpen}
                        onSaveWasteRecord={handleSaveWasteRecord}
                    />
                ) : (
                    <LoginView setIsLoggedIn={setIsLoggedIn} staffs={staffs} setCurrentUser={setCurrentUser} logAdminAction={logAdminAction} />
                );

            default:
                return <MemoizedDashboardView stats={stats} villageData={villageData} wasteTypeData={wasteTypeData} members={allMembers} setCurrentPage={setCurrentPage} />;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-800">

            {/* ── 🟢 1. แถบเมนูข้าง Sidebar (แสดงเฉพาะจอ Desktop เท่านั้น) ── */}
            <aside className="hidden md:flex w-72 flex-col bg-gradient-to-b from-emerald-500 to-emerald-700 p-6 shadow-2xl shrink-0 sticky top-0 h-screen overflow-y-auto select-none border-r border-emerald-600/30">

                {/* โลโก้และชื่อเว็บ (จัดเรียงใหม่ ปรับขนาดใหญ่ขึ้น และวางกึ่งกลาง) */}
                <div className="flex flex-col items-center text-center gap-3 mb-6 cursor-pointer border-b border-white/30 pb-6 mt-2" onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); }}>
                    <div className="bg-white p-2.5 rounded-2xl shadow-md">
                        <img src={webLogo} alt="โลโก้" className="w-16 h-16 object-contain" />
                    </div>
                    <div className="flex flex-col text-white mt-1">
                        <span className="font-black text-xl tracking-tight leading-tight drop-shadow-sm">ธนาคารขยะบ้านป่าลาน</span>
                        <span className="text-sm text-green-100 font-bold opacity-90 drop-shadow-sm mt-1">เทศบาลตำบลอุโมงค์</span>
                    </div>
                </div>

                {/* เมนูหลัก (ปรับฟอนต์ใหญ่ขึ้น + มีเส้นแบ่งขีดใต้บรรทัดชัดเจน) */}
                <nav className="flex flex-col flex-grow w-full">
                    <button
                        onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'dashboard' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        📊 ภาพรวมระบบ
                    </button>
                    <button
                        onClick={() => { setCurrentPage('villages'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'villages' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🏠 ข้อมูลสมาชิก
                    </button>
                    <button
                        onClick={() => { setCurrentPage('prices'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'prices' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🪙 ราคารับซื้อ
                    </button>
                    <button
                        onClick={() => { setCurrentPage('map'); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'map' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🗺️ แผนที่ครัวเรือน
                    </button>

                    {/* ปุ่มจัดการแอดมิน */}
                    {isLoggedIn && (
                        <button
                            onClick={() => { setCurrentPage('admin'); setIsMapLoaded(false); }}
                            className={`w-full text-left px-4 py-4 text-base font-bold transition-all mt-6 rounded-xl border ${currentPage === 'admin' ? 'bg-amber-400 text-slate-900 shadow-md border-transparent' : 'border-white/40 text-white hover:bg-white/10 bg-black/10'}`}>
                            🛠️ จัดการระบบแอดมิน
                        </button>
                    )}
                </nav>

                {/* ข้อมูลแอดมิน */}
                {isLoggedIn && currentUser && (
                    <div className="pt-5 border-t border-white/30 text-white text-sm mt-4 text-center">
                        <p className="opacity-70">ผู้ใช้งานปัจจุบัน:</p>
                        <p className="font-black mt-1 text-amber-300 drop-shadow-sm">👤 {currentUser.name}</p>
                    </div>
                )}
            </aside>

            {/* ── ⚪ 2. พื้นที่เนื้อหาหลักฝั่งขวา (Main Content) ── */}
            <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">

                {/* Header Desktop */}
                <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-5 items-center justify-between sticky top-0 z-40 shadow-sm">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                        {currentPage === 'dashboard' && '📊 ภาพรวมระบบและสถิติ'}
                        {currentPage === 'villages' && '🏠 ทะเบียนข้อมูลสมาชิกแต่ละหมวด'}
                        {currentPage === 'prices' && '🪙 ตารางราคารับซื้อขยะประจำเดือน'}
                        {currentPage === 'map' && '🗺️ ระบบแผนที่ครัวเรือนระบบสารสนเทศ'}
                        {currentPage === 'admin' && '🛠️ แผงควบคุมระบบจัดการแอดมิน'}
                        {currentPage === 'members' && '👥 ทะเบียนรายชื่อสมาชิกระบบ'}
                        {currentPage === 'history' && '📋 ทะเบียนสรุปแต้มเครดิตรายครัวเรือน'}
                        {currentPage === 'admin_logs' && '📜 ประวัติกิจกรรมการทำงานของเจ้าหน้าที่'}
                    </h2>
                    <div>
                        {!isLoggedIn ? (
                            <button onClick={() => setCurrentPage('admin')} className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                                <LogIn size={14} /> <span>เข้าสู่ระบบ</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    // 🌟 ล้างค่าออกจากระบบแบบหมดจด (ฝั่ง Desktop)
                                    setIsLoggedIn(false);
                                    setCurrentUser(null);
                                    localStorage.removeItem('is_logged_in');
                                    localStorage.removeItem('current_user');
                                    setCurrentPage('dashboard');
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-red-100 flex items-center gap-1.5 shadow-sm"
                            >
                                <LogIn size={14} className="rotate-180" /> <span>ออกจากระบบ</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Header Mobile */}
                <header className="md:hidden bg-emerald-900 sticky top-0 z-50 shadow-sm">
                    <div className="px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentPage('dashboard'); setIsMenuOpen(false); }}>
                            <img src={webLogo} alt="โลโก้" className="w-8 h-8 object-contain bg-white rounded-lg p-0.5" />
                            <span className="font-black text-sm text-white tracking-tight">ธนาคารขยะบ้านป่าลาน</span>
                        </div>
                        <button
                            onClick={() => {
                                if (isLoggedIn) {
                                    // 🌟 กรณี "ออกจากระบบ" (ล้างค่าที่เครื่องจำไว้ทั้งหมด)
                                    setIsLoggedIn(false);
                                    setCurrentUser(null);
                                    localStorage.removeItem('is_logged_in');
                                    localStorage.removeItem('current_user');
                                    setCurrentPage('dashboard');
                                } else {
                                    // 🌟 กรณี "เข้าสู่ระบบ"
                                    setCurrentPage('admin');
                                }
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-white/20 transition-colors"
                        >
                            {isLoggedIn ? 'ออกจากระบบ' : 'เข้าสู่ระบบ'}
                        </button>
                    </div>
                    <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-emerald-950 text-white px-4 py-3.5 flex items-center justify-between border-t border-emerald-800 cursor-pointer active:bg-emerald-900 transition-colors select-none">
                        <div className="flex items-center gap-2 font-black text-xs tracking-wide">
                            <Menu size={16} className="text-emerald-400" />
                            <span>เมนูตัวเลือกระบบ</span>
                        </div>
                        <div className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={16} className="text-emerald-400" />
                        </div>
                    </div>
                </header>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden bg-white border-b border-slate-200 p-4 flex flex-col gap-1.5 shadow-xl animate-fadeIn sticky top-[105px] z-40">
                        <MobileNavItem active={currentPage === 'dashboard'} onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="📊 ภาพรวมระบบ" icon={<LayoutDashboard size={20} />} />
                        <MobileNavItem active={currentPage === 'villages'} onClick={() => { setCurrentPage('villages'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="🏠 ข้อมูลสมาชิก" icon={<Users size={20} />} />
                        <MobileNavItem active={currentPage === 'prices'} onClick={() => { setCurrentPage('prices'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="🪙 ราคารับซื้อ" icon={<Wallet size={20} />} />
                        <MobileNavItem active={currentPage === 'map'} onClick={() => { setCurrentPage('map'); setIsMenuOpen(false); }} label="🗺️ แผนที่ครัวเรือน" icon={<MapIcon size={20} />} />
                        {isLoggedIn && (
                            <button onClick={() => { setCurrentPage('admin'); setIsMapLoaded(false); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl text-sm font-black mt-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                                <LayoutDashboard size={20} /> <span>🛠️ จัดการระบบแอดมิน</span>
                            </button>
                        )}
                    </div>
                )}

                {/* ── 📦 3. ส่วนเนื้อหา (แสดงกราฟ ตาราง สถิติ) ── */}
                <div className="flex-grow p-4 md:p-8 max-w-[1600px] w-full mx-auto">
                    {renderContent()}
                </div>

                {/* ── Footer ── */}
                <footer className="bg-white border-t border-slate-100 py-6 mt-auto">
                    <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                        <div className="flex flex-wrap justify-center gap-3 mb-3">
                            <span className="font-bold text-slate-400 flex items-center">📊 สถิติผู้เข้าชม:</span>
                            <span className="font-mono bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold shadow-sm">วันนี้: {(visitorStats?.today || 0).toLocaleString()}</span>
                            <span className="font-mono bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold shadow-sm">เดือนนี้: {(visitorStats?.month || 0).toLocaleString()}</span>
                            <span className="font-mono bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg font-black text-emerald-600 shadow-sm">รวมทั้งหมด: {(visitorStats?.total || 0).toLocaleString()} รอบ</span>
                        </div>
                        <p className="font-medium">© 2026 กองสาธารณสุขและสิ่งแวดล้อมเทศบาลตำบลอุโมงค์</p>
                    </div>
                </footer>

            </main>

            {/* ── 🚨 4. แจ้งเตือนและป๊อปอัพ (Modals) ── */}
            {showValidationAlert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border text-slate-700 animate-in zoom-in">
                        <div className="flex items-center gap-3 text-amber-600 mb-4">
                            <AlertTriangle size={32} />
                            <h3 className="font-bold text-xl">แจ้งเตือนข้อมูลผิดปกติ</h3>
                        </div>
                        <p className="text-slate-600 mb-6 text-sm font-medium">น้ำหนักที่ระบุ (5000 กก.) สูงกว่าค่าเฉลี่ยปกติ กรุณาตรวจสอบเลขศูนย์หรือหน่วยวัดอีกครั้ง</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowValidationAlert(false)} className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition-colors">แก้ไข</button>
                            <button onClick={() => setShowValidationAlert(false)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">ยืนยันค่านี้</button>
                        </div>
                    </div>
                </div>
            )}

            {editingVillage && (
                <EditVillageModal village={editingVillage} members={allMembers} onClose={() => setEditingVillage(null)} onSave={handleUpdateVillage} onDeleteMember={handleDeleteMember} />
            )}

            {isAddMemberOpen && tempLocation && (
                <AddMemberModal
                    initialLat={tempLocation.lat} initialLng={tempLocation.lng} villageData={villages}
                    onSave={async (newMemberData) => {
                        const dataToSave = { ...newMemberData, villageId: Number(newMemberData.villageId) };
                        try { await setDoc(doc(db, "members", String(newMemberData.id)), newMemberData); }
                        catch (error) { alert("บันทึกเข้าฐานข้อมูลไม่สำเร็จ!"); return; }
                        logAdminAction(`ได้ลงทะเบียนและปักหมุดสมาชิกใหม่ "บ้านเลขที่ ${newMemberData.houseNo}" เข้าสู่หมวดระบบ`); await refreshData();
                        setMembers(prev => {
                            const nextMembers = [...prev, newMemberData];
                            localStorage.setItem('local_members_data', JSON.stringify(nextMembers));
                            return nextMembers;
                        });
                        setVillages(prevVillages => {
                            const updatedVillages = prevVillages.map(v => {
                                if (v.id === newMemberData.villageId) {
                                    const nextWasteData = { ...v.wasteData };
                                    Object.keys(newMemberData.wasteData).forEach(type => {
                                        nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(newMemberData.wasteData[type]) || 0);
                                    });
                                    return { ...v, wasteData: nextWasteData };
                                }
                                return v;
                            });
                            localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                            return updatedVillages;
                        });
                        setIsAddMemberOpen(false); setTempLocation(null); alert("📍 ลงทะเบียนสมาชิกครัวเรือนใหม่สำเร็จ!"); refreshData();
                    }}
                    onClose={() => { setIsAddMemberOpen(false); setTempLocation(null); }}
                />
            )}

            {selectedVillage && (
                <VillageDetailsModal
                    key={selectedVillage.id + JSON.stringify(selectedVillage.wasteData)}
                    village={selectedVillage} onClose={() => setSelectedVillage(null)} villages={villages} members={members}
                />
            )}
        </div>
    );
};
export default App;