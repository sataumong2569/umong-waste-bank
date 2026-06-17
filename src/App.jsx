// === ส่วนที่ 1: การนำเข้าไลบรารีและเครื่องมือต่างๆ (Imports) ===
import './App.css'; // นำเข้าสไตล์การตกแต่งจากไฟล์ CSS
import webLogo from './img/Logo_umongcity_transparent.png';
import React, { useState, useEffect, useMemo, useRef } from 'react'; // นำเข้าหัวใจหลักของ React (State, Effect, Memo)
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
    Eye, EyeOff, Search, ChevronLeft, Home, Edit2, Save, Download, ShieldCheck,
    Trash2, ShoppingCart, UserPlus, PackageOpen, Tags, ClipboardList, UploadCloud,
    LayoutList
} from 'lucide-react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
    collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, increment, serverTimestamp, startAfter, onSnapshot, runTransaction
} from 'firebase/firestore';

import MapView from './MapView.jsx';
import AdminLogsView from './AdminLogsView'

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
const DashboardView = ({ stats, villageData, wasteTypeData, members, setCurrentPage, selectedPeriod, setSelectedPeriod, historicalSummary }) => {
    const isHistorical = selectedPeriod?.month !== 'current';
    const histData = historicalSummary || {};
    // 1. สัดส่วนการคัดแยกขยะ
    const separationStats = useMemo(() => {
        if (isHistorical) {
            return [
                { name: 'คัดแยกประเภทขยะแล้ว', value: histData.sortedPersons || 0, color: '#16a34a' },
                { name: 'ยังไม่คัดแยกประเภทขยะ', value: histData.unsortedPersons || 0, color: '#ef4444' }
            ];
        }
        if (!members) return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: 0, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: 0, color: '#ef4444' }
        ];

        let sortedCount = 0;
        let notSortedCount = 0;

        members.forEach(m => {
            const validPersons = (m.familyMembers || []).filter(p => {
                const name = typeof p === 'string' ? p : p?.name;
                return name && name.trim() !== '';
            });
            validPersons.forEach(p => {
                if (typeof p === 'object' && p.isSorted) sortedCount += 1;
                else notSortedCount += 1;
            });
        });

        return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: sortedCount, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: notSortedCount, color: '#ef4444' }
        ];
    }, [members, isHistorical, histData]);

    // 2. สัดส่วนการเข้าร่วมโครงการ (วงกลม 2)
    const participationStats = useMemo(() => {
        if (isHistorical) {
            const participatedCount = histData.totalHouses || 0;
            return [
                { name: 'เข้าร่วมโครงการแล้ว', value: participatedCount, color: '#29c21bff' },
                { name: 'ยังไม่ได้เข้าร่วม', value: Math.max(0, 600 - participatedCount), color: '#8e978fff' }
            ];
        }
        const participatedCount = members ? members.length : 0;
        const notParticipatedCount = 600;
        return [
            { name: 'เข้าร่วมโครงการแล้ว', value: participatedCount, color: '#29c21bff' },
            { name: 'ยังไม่ได้เข้าร่วม', value: notParticipatedCount, color: '#8e978fff' }
        ];
    }, [members, isHistorical, histData]);

    // 3. แนวโน้มการเติบโตของสมาชิก
    const trendData = useMemo(() => {
        if (isHistorical) {
            return [
                { name: 'เดือนก่อน', amount: histData.previousMonthPersons || 0, color: '#106e18ff' },
                { name: 'เดือนนี้', amount: histData.totalPersons || 0, color: '#19ac19ff' }
            ];
        }
        if (!members || members.length === 0) return [
            { name: 'เดือนก่อน', amount: 0, color: '#106e18ff' },
            { name: 'เดือนนี้', amount: 0, color: '#19ac19ff' }
        ];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        let beforeThisMonthCount = 0;
        let currentTotalCount = 0;

        members.forEach(m => {
            const validPersonsCount = (m.familyMembers || []).filter(p => {
                const name = typeof p === 'string' ? p : p?.name;
                return name && name.trim() !== '';
            }).length;

            const joinDate = new Date(Number(m.id));
            const isOldHouse = (!isNaN(joinDate.getTime()) && (joinDate.getMonth() !== currentMonth || joinDate.getFullYear() !== currentYear));

            currentTotalCount += validPersonsCount;
            if (isNaN(joinDate.getTime()) || isOldHouse) {
                beforeThisMonthCount += validPersonsCount;
            }
        });

        return [
            { name: 'เดือนก่อน', amount: beforeThisMonthCount, color: '#106e18ff' },
            { name: 'เดือนนี้', amount: currentTotalCount, color: '#19ac19ff' }
        ];
    }, [members, isHistorical, histData]); // 🌟 เพิ่ม isHistorical, histData ตรงนี้

    // 🌟 4. ตัวสลับรางข้อมูล "ปริมาณขยะแยกตามประเภท"
    const currentWasteTypeData = useMemo(() => {
        // ถ้าเป็นการดูย้อนหลัง ให้แกะข้อมูลขยะจากบิลสรุป (histData)
        if (isHistorical) {
            const types = ['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม', 'เหล็ก'];
            return types.map(type => ({
                name: type,
                amount: Number(histData.wasteData?.[type]) || 0
            }));
        }
        // ถ้าดูเดือนปัจจุบัน ให้ใช้ข้อมูลสดที่ส่งมาจาก App.jsx
        return wasteTypeData;
    }, [isHistorical, histData, wasteTypeData]);
    return (
        <div className="space-y-6">
            {/* ── 🌟 แถบเลือกเดือน/ปี (Modern UI) ── */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                <div>
                    <h3 className="font-black text-xl text-slate-800 flex items-center gap-2 tracking-tight">
                        📅 เลือกช่วงเวลาสถิติ
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                        {selectedPeriod.month === 'current'
                            ? <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md">กำลังแสดงผลเดือนปัจจุบัน</span>
                            : `แสดงข้อมูลบิลสรุปย้อนหลัง: ${selectedPeriod.month} ${selectedPeriod.year}`}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <select
                        value={selectedPeriod.month}
                        onChange={(e) => {
                            const m = e.target.value;
                            setSelectedPeriod(prev => ({ ...prev, month: m, ...(m === 'current' && { year: 'current' }) }));
                        }}
                        className="flex-1 sm:w-48 bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-black text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                    >
                        <option value="current">เดือนปัจจุบัน</option>
                        <option disabled>──────────</option>
                        {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    <select
                        value={selectedPeriod.year}
                        onChange={(e) => setSelectedPeriod(prev => ({ ...prev, year: e.target.value }))}
                        disabled={selectedPeriod.month === 'current'}
                        className={`flex-1 sm:w-32 bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-black outline-none cursor-pointer transition-all shadow-sm ${selectedPeriod.month === 'current' ? 'opacity-50 text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                    >
                        {selectedPeriod.month === 'current' ? (
                            <option value="current">ปีปัจจุบัน</option>
                        ) : (
                            Array.from({ length: new Date().getFullYear() + 543 - 2567 + 1 }, (_, i) => 2567 + i)
                                .reverse()
                                .map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))
                        )}
                    </select>
                </div>
            </div>
            {/* ส่วนที่ 1: การแสดงผลสถิติ 5 กล่องด้านบน (สรุปตัวเลขสำคัญ) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {stats && stats.length > 0 ? (
                    stats.map((stat, i) => (
                        <div key={i} className="modern-card flex flex-col gap-3 relative group cursor-default p-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-3.5 bg-blue-50 rounded-2xl shadow-sm">{stat.icon}</div>
                                {stat.hasTooltip && <Info size={18} className="text-slate-300 cursor-help" />}
                            </div>
                            <div>
                                {/* 🌟 ขยายขนาดฟอนต์หัวข้อ */}
                                <p className="text-sm font-bold text-slate-500 mb-1.5">{stat.label}</p>
                                {/* 🌟 ขยายขนาดฟอนต์ตัวเลขให้ใหญ่ขึ้นเป็น 2xl ถึง 3xl */}
                                <p className="text-xl sm:text-xl font-black text-slate-800 tracking-tight leading-none">{stat.value}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    // ถ้าข้อมูลยังมาไม่ถึง ให้แสดงกล่องเปล่าๆ 5 กล่องไว้จองพื้นที่
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="modern-card h-[140px] animate-pulse bg-slate-50 border border-slate-100 flex flex-col justify-center items-center p-5">
                            <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-3"></div>
                            <div className="w-24 h-5 bg-slate-200 rounded-md"></div>
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
                                            labelLine={window.innerWidth >= 640}
                                            /* ปรับตรงนี้: ถ้ามือถือจอเล็ก (<640px) ให้ซ่อน label ทันที */
                                            label={({ name, value, x, y, textAnchor }) => {
                                                const isMobile = window.innerWidth < 640;
                                                if (isMobile) return null;

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
                                    {separationStats[0].value} <span className="text-xs font-bold opacity-70">คน</span>
                                </p>
                            </div>

                            {/* กล่องสีแดง: ยังไม่คัดแยก */}
                            <div className="p-4 bg-red-500/10 rounded-2xl text-center border-2 border-red-500/20 shadow-sm">
                                <p className="text-[13px] text-red-700 font-black mb-1">ยังไม่คัดแยก</p>
                                <p className="text-2xl font-black text-red-600">
                                    {separationStats[1].value} <span className="text-xs font-bold opacity-70">คน</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🏆 ฝั่งขวา (30%): อันดับหมวดยอดเงินสูงสุด (List Box) */}
                <div className="lg:w-[30%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                🏆 อันดับหมวดยอดเงินออม
                            </h3>
                        </div>

                        {/* List Box  */}
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pb-4">
                            {[...villageData]
                                .map(v => {
                                    // 🌟 กลไกสับราง: ถ้าดูย้อนหลัง ให้ดึงยอดที่บันทึกไว้ในบิลสรุปมาโชว์เลย ไม่ต้องคำนวณใหม่!
                                    let calculatedBalance = 0;

                                    if (isHistorical) {
                                        // สำหรับข้อมูลย้อนหลัง เราบันทึก realBalance ไว้แล้วใน histData.villageData ตอน Import
                                        calculatedBalance = Number(v.realBalance) || 0;
                                    } else {
                                        // สำหรับเดือนปัจจุบัน ก็ไปบวกเลขสดๆ จาก members ตามปกติ
                                        const vMembers = members ? members.filter(m => Number(m.villageId) === Number(v.id)) : [];
                                        calculatedBalance = vMembers.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);
                                    }

                                    return { ...v, realBalance: calculatedBalance };
                                })
                                .sort((a, b) => b.realBalance - a.realBalance)
                                .map((v, i) => (
                                    // 🌟 1. ใช้ border-l-[6px] และใส่สีที่ขอบแทนการใช้กล่อง absolute
                                    <div key={v.id} className={`group bg-white border border-slate-100 p-3 rounded-2xl flex items-center justify-between hover:shadow-md transition-all duration-300 gap-2 border-l-[6px] ${i === 0 ? 'border-l-amber-400 hover:border-y-amber-200 hover:border-r-amber-200' :
                                        i === 1 ? 'border-l-slate-300 hover:border-y-slate-200 hover:border-r-slate-200' :
                                            i === 2 ? 'border-l-orange-400 hover:border-y-orange-200 hover:border-r-orange-200' :
                                                'border-l-transparent hover:border-emerald-300'
                                        }`}>

                                        {/* ฝั่งซ้าย: วงกลมอันดับ + ชื่อหมวด (เอา pl-2 ออกเพื่อให้จัดกึ่งกลางสวยๆ) */}
                                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                            {/* เลขอันดับ */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${i === 0 ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900' :
                                                i === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-800' :
                                                    i === 2 ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-900' :
                                                        'bg-slate-50 text-slate-400 border border-slate-100'
                                                }`}>
                                                {i + 1}
                                            </div>

                                            {/* ชื่อหมวด */}
                                            <h4 className="font-bold text-slate-700 text-sm leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                                                {v.name}
                                            </h4>
                                        </div>

                                        {/* ฝั่งขวา: ยอดเงิน */}
                                        <div className="text-right shrink-0">
                                            <div className="font-black text-emerald-600 font-mono text-base sm:text-lg tracking-tight bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100/50">
                                                ฿{v.realBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </div>
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
                                        labelLine={window.innerWidth >= 640}
                                        label={({ name, value, x, y, textAnchor }) => {
                                            const isMobile = window.innerWidth < 640;
                                            if (isMobile) return null;

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

                                    {/* Legend จะมาทำหน้าที่แทนที่ข้อมูลในมือถือ สวยและอ่านง่ายแน่นอน */}
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
                                {/*  1. ปรับขอบซ้าย (left) จาก -10 เป็น 30 และขอบขวา (right) เป็น 40 เพื่อกันตกขอบ */}
                                <BarChart layout="vertical" data={trendData} margin={{ top: 10, right: 40, left: 30, bottom: 0 }}>
                                    <XAxis type="number" hide />

                                    {/*  2. เพิ่ม width={80} ให้แกน Y มีพื้นที่ และปรับฟอนต์เป็น 16 */}
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        width={80}
                                        tick={{ fill: '#64748b', fontSize: 16, fontWeight: 'bold' }}
                                    />

                                    <RechartsTooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [`${value} คน`, 'จำนวนสมาชิก']}
                                    />
                                    {/*  3. ขยายตัวเลขด้านขวาเป็น 16 และปรับขนาดแท่ง (barSize) ให้หนาขึ้นรับกับฟอนต์ */}
                                    <Bar
                                        dataKey="amount"
                                        radius={[0, 8, 8, 0]}
                                        barSize={32}
                                        label={{ position: 'right', fill: '#475569', fontSize: 16, fontWeight: 'black' }}
                                    >
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
                                            behavior: 'smooth' // ถ้าอยากให้เด้งขึ้นไปทันทีแบบไม่ต้องเลื่อน ให้แก้คำว่า 'smooth' เป็น 'auto' ได้
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
                    {currentWasteTypeData && currentWasteTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={currentWasteTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                    <linearGradient id="grad-iron" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#475569" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.8} />
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
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc', opacity: 0.4 }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                                    formatter={(value) => [`${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} กก.`, 'ทั้งหมด']}
                                />

                                <Bar dataKey="amount" maxBarSize={40} radius={[6, 6, 0, 0]} >
                                    {wasteTypeData.map((entry, index) => {
                                        const colorGradients = [
                                            'url(#grad-plastic)', 'url(#grad-paper)', 'url(#grad-glass)', 'url(#grad-aluminum)', 'url(#grad-alloy)', 'url(#grad-iron)'
                                        ];
                                        return <Cell key={`cell-${index}`} fill={colorGradients[index % colorGradients.length]} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            {isHistorical && Object.keys(histData).length === 0 ? "ไม่มีประวัติการฝากขยะในเดือนย้อนหลังที่เลือก" : "กำลังโหลดข้อมูล..."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const MemoizedDashboardView = React.memo(DashboardView);

// =========================================================================
// 🪙 หน้าจอราคารับซื้อขยะ (PriceView) โฉมใหม่ เชื่อม Cloud + เพิ่มลดขยะได้
// =========================================================================
const PriceView = ({ isLoggedIn, isEditing, setIsEditing, setCurrentPage, globalPrices, refreshData, db, logAdminAction }) => {
    // 1. ใช้ globalPrices จาก App.jsx เป็นสารตั้งต้น
    const [prices, setPrices] = useState(globalPrices || []);
    const [tempPrices, setTempPrices] = useState({});
    const [calcWeights, setCalcWeights] = useState({});
    const [lastUpdated, setLastUpdated] = useState('กำลังโหลด...');

    useEffect(() => {
        setPrices(globalPrices || []);
    }, [globalPrices]);

    //  2. ดึงวันที่อัปเดตล่าสุดจาก Firebase โดยตรง
    useEffect(() => {
        const fetchLastUpdated = async () => {
            try {
                const snap = await getDoc(doc(db, "settings", "waste_prices"));
                if (snap.exists() && snap.data().lastUpdated) {
                    setLastUpdated(snap.data().lastUpdated);
                } else {
                    setLastUpdated('ยังไม่มีการระบุวันที่');
                }
            } catch (error) {
                setLastUpdated('ไม่สามารถดึงข้อมูลได้');
            }
        };
        fetchLastUpdated();
    }, [db]);

    // 3. ฟังก์ชันเตรียมตัวแก้ไข
    const handleStartEdit = () => {
        const currentTemp = {};
        prices.forEach(p => { currentTemp[p.id] = p.price; });
        setTempPrices(currentTemp);
        setIsEditing(true);
    };

    // 4. ฟังก์ชันบันทึกขึ้น Firebase
    const handleSavePrices = async () => {
        const updatedPrices = prices.map(p => ({
            ...p,
            price: tempPrices[p.id] !== undefined ? Number(tempPrices[p.id]) : Number(p.price) || 0
        }));

        try {
            // 🌟 1. สร้างวันที่ก่อนเลย จะได้เอาไปส่งขึ้น Cloud ทัน
            const now = new Date();
            const ThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

            // 🌟 2. ยิงขึ้น Firestore (ใส่ lastUpdated เข้าไปรวมกับ items เลย)
            await setDoc(doc(db, "settings", "waste_prices"), {
                items: updatedPrices,
                lastUpdated: dateString // ส่งวันที่ขึ้น Cloud ตรงนี้!
            }, { merge: true });

            if (typeof logAdminAction === 'function') {
                logAdminAction("ได้ทำการอัปเดตปรับเปลี่ยนมูลค่าราคากลางและประเภทขยะรีไซเคิลประจำเดือนบนระบบ Cloud");
            }

            // 🌟 3. อัปเดตหน้าจอทันที (ลบ localStorage ทิ้งไปเลย เพราะเราใช้ Cloud แทนแล้ว)
            setLastUpdated(dateString);
            setIsEditing(false);

            alert("💾 บันทึกราคากลางและประเภทขยะขึ้นระบบ Cloud สำเร็จ!");
            if (refreshData) refreshData(); // สั่งให้ App โหลดข้อมูลใหม่
        } catch (err) {
            console.error(err);
            alert("❌ บันทึกไม่สำเร็จ กรุณาลองใหม่");
        }
    };

    // 5. ฟังก์ชันเพิ่มขยะใหม่
    const handleAddNewWasteType = () => {
        const newId = Date.now();
        const newType = {
            id: newId,
            type: 'ขยะประเภทใหม่', // ชื่อตั้งต้น (ให้แอดมินไปแก้ชื่อเองได้)
            price: 0,
            icon: '🗑️',
            color: 'bg-slate-100 text-slate-700'
        };
        setPrices([...prices, newType]);
        setTempPrices({ ...tempPrices, [newId]: 0 });
    };

    // 6. ฟังก์ชันลบขยะ
    const handleDeleteWasteType = (idToDelete) => {
        if (confirm("⚠️ ยืนยันการลบขยะประเภทนี้ออกจากระบบ?")) {
            setPrices(prices.filter(p => p.id !== idToDelete));
        }
    };

    // 7. คำนวณเงินจำลอง
    const totalCalcMoney = useMemo(() => {
        return prices.reduce((sum, item) => {
            const weight = Number(calcWeights[item.id]) || 0;
            const price = tempPrices[item.id] !== undefined ? Number(tempPrices[item.id]) : Number(item.price);
            return sum + (weight * price);
        }, 0);
    }, [prices, calcWeights, tempPrices]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 🌟 1. Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        💰 รับซื้อขยะรีไซเคิล
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">
                        ราคารับซื้อประจำเดือน (อัปเดตราคาเมื่อ: <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">{lastUpdated}</span>)
                    </p>
                </div>

                {isLoggedIn && (
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        {setCurrentPage && (
                            <button onClick={() => setCurrentPage('admin')} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition shadow-sm whitespace-nowrap">
                                ← ย้อนกลับ
                            </button>
                        )}
                        {isEditing ? (
                            <>
                                <button onClick={() => { setIsEditing(false); setPrices(globalPrices); }} className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-200 transition">ยกเลิก</button>
                                <button onClick={handleSavePrices} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-md transition flex items-center gap-1.5"><Save size={16} /> บันทึกข้อมูล</button>
                            </>
                        ) : (
                            <button onClick={handleStartEdit} className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 shadow-md transition flex items-center gap-1.5"><Edit2 size={16} /> แก้ไขข้อมูลขยะ</button>
                        )}
                    </div>
                )}
            </div>

            {/* 🌟 2. โครงสร้างหลัก */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 mb-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-200 p-2.5 rounded-xl">
                            <Database size={20} className="text-slate-600" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800 text-lg">รายการรับซื้อขยะ</h2>
                            <p className="text-xs text-slate-500 font-bold">จำนวนประเภทขยะในระบบตอนนี้: <span className="text-emerald-600">{prices.length}</span> รายการ</p>
                        </div>
                    </div>

                    {/* ปุ่มเพิ่มขยะ (โชว์เฉพาะตอนกดแก้ไข) */}
                    {isEditing && (
                        <button onClick={handleAddNewWasteType} className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2">
                            <PlusCircle size={16} /> เพิ่มประเภทขยะ
                        </button>
                    )}
                </div>

                {/* 🌟 3. Item Rows */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-3">
                    {prices.map((item, index) => (
                        <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between hover:border-emerald-400 transition-all group relative">

                            {/* ปุ่มลบขยะ (โชว์เฉพาะโหมดแก้ไข) */}
                            {isEditing && (
                                <button onClick={() => handleDeleteWasteType(item.id)} className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                                    <X size={14} />
                                </button>
                            )}

                            {/* ส่วนหัว: ไอคอน + ชื่อ */}
                            <div className="flex items-center gap-3 mb-4 pr-6">
                                <span className={`text-xl w-10 h-10 flex items-center justify-center rounded-lg ${item.color} font-bold shrink-0`}>
                                    {item.icon}
                                </span>
                                {isEditing ? (
                                    // โหมดแก้ไข: แก้ชื่อขยะได้
                                    <input
                                        type="text"
                                        value={item.type}
                                        onChange={(e) => {
                                            const newPrices = [...prices];
                                            newPrices[index].type = e.target.value;
                                            setPrices(newPrices);
                                        }}
                                        className="font-bold text-sm text-slate-800 border-b border-dashed border-slate-300 w-full outline-none focus:border-blue-500"
                                    />
                                ) : (
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{item.type}</h4>
                                )}
                            </div>

                            {/* ส่วนราคาและช่องกรอก */}
                            <div className="space-y-2">
                                {/* ราคาต่อหน่วย */}
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[11px] text-slate-400 font-bold uppercase">ราคา:</span>
                                    <span className="text-xs font-black text-slate-700">
                                        {isEditing ? (
                                            `${Number(tempPrices[item.id] !== undefined ? tempPrices[item.id] : item.price)} ฿`
                                        ) : (
                                            `${Number(item.price).toFixed(2)} ฿`
                                        )}
                                    </span>
                                </div>

                                {/* ช่องกรอกน้ำหนัก / ราคา */}
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={tempPrices[item.id] !== undefined ? tempPrices[item.id] : item.price}
                                        onChange={(e) => setTempPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        className="w-full text-center py-2 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200 text-sm outline-none"
                                        placeholder="ระบุราคาใหม่"
                                    />
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="number" min="0" step="any" placeholder="ลองคำนวณ"
                                            value={calcWeights[item.id] || ''}
                                            onChange={(e) => setCalcWeights(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            className="w-full text-right py-2.5 pr-8 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-800 text-sm outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
                                        />
                                        <span className="absolute right-2 top-2.5 text-[10px] text-slate-400 font-bold">กก.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 🌟 4. ส่วนยอดเงินรวม (เครื่องคิดเลข) */}
                {!isEditing && (
                    <div className="bg-emerald-600 border-t-4 border-emerald-700 p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500 rounded-xl shadow-inner">
                                <Wallet size={28} className="text-white" />
                            </div>
                            <h3 className="font-bold text-xl sm:text-2xl drop-shadow-sm">เครื่องคิดเลขจำลองยอดเงิน</h3>
                        </div>
                        <div className="bg-white/10 border border-white/20 px-6 py-3 rounded-2xl flex items-baseline gap-2 w-full sm:w-auto justify-center shadow-inner">
                            <span className="text-emerald-100 font-bold text-2xl">฿</span>
                            <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight drop-shadow-md">
                                {totalCalcMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
// =========================================================================
// ✏️ หน้าต่างแก้ไขข้อมูลสมาชิกและพิกัดหมุด (EditMemberModal) - True Full Page UX/UI
// =========================================================================
const EditMemberModal = ({ member, villageData, onSave, onDelete, onClose, globalPrices }) => {
    const [editData, setEditData] = useState(() => {
        const migratedFamily = (member.familyMembers || []).map((person, index) => {
            if (typeof person === 'string') return { id: Date.now().toString() + index, name: person, balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false };
            return person;
        });
        return {
            ...member,
            familyMembers: migratedFamily.length > 0 ? migratedFamily : [{ id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }],
            balance: member.balance || 0, credit: member.credit || 0
        };
    });

    const [expandedWasteIndex, setExpandedWasteIndex] = useState(null);
    const [selectedWasteId, setSelectedWasteId] = useState(globalPrices?.[0]?.id || '');
    const [inputWeight, setInputWeight] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const CARBON_MULTIPLIERS = { 'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'ขวดแก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910, 'เหล็ก': 1.8320, 'พลาสติก': 1.0310, 'แก้ว': 0.2760, 'เหล็ก': 1.8320 };

    useEffect(() => {
        const L = window.L;
        const container = document.getElementById('edit-map-container');
        if (!L || !container) return;
        if (container._leaflet_id) { container._leaflet_id = null; }

        const initLat = editData.lat || 18.5244;
        const initLng = editData.lng || 99.0435;

        const editMiniMap = L.map('edit-map-container').setView([initLat, initLng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(editMiniMap);
        const marker = L.marker([initLat, initLng], { draggable: true }).addTo(editMiniMap);
        marker.bindPopup("<b>🏠 ปรับพิกัดบ้านสมาชิก</b><br>สามารถลากหมุดไปวางตรงจุดใหม่ได้").openPopup();

        marker.on('dragend', () => { const position = marker.getLatLng(); setEditData(prev => ({ ...prev, lat: position.lat, lng: position.lng })); });
        window.findEditMiniLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    editMiniMap.setView([latitude, longitude], 17); marker.setLatLng([latitude, longitude]);
                    setEditData(prev => ({ ...prev, lat: latitude, lng: longitude }));
                });
            }
        };

        const timeout = setTimeout(() => editMiniMap.invalidateSize(), 300);
        return () => { clearTimeout(timeout); editMiniMap.remove(); delete window.findEditMiniLocation; };
    }, []);

    const handleAddFamilyMember = () => setEditData(prev => ({ ...prev, familyMembers: [...prev.familyMembers, { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }] }));
    const handleRemoveFamilyMember = (index) => {
        setEditData(prev => {
            const nextList = prev.familyMembers.filter((_, i) => i !== index);
            return {
                ...prev,
                familyMembers: nextList.length === 0 ? [{ id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }] : nextList,
                balance: nextList.reduce((sum, p) => sum + (Number(p.balance) || 0), 0),
                credit: nextList.reduce((sum, p) => sum + (Number(p.credit) || 0), 0)
            };
        });
    };

    const updatePersonField = (index, field, value) => {
        const updatedFamily = [...editData.familyMembers];
        updatedFamily[index] = { ...updatedFamily[index], [field]: value };
        setEditData({
            ...editData, familyMembers: updatedFamily,
            balance: updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0),
            credit: updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0),
            isSorted: updatedFamily.some(p => p.isSorted)
        });
    };

    const handleUpdateWasteRecord = (personIndex) => {
        if (!selectedWasteId || inputWeight === '') return alert("⚠️ กรุณาระบุน้ำหนัก");
        const wasteInfo = globalPrices.find(p => String(p.id) === String(selectedWasteId));
        if (!wasteInfo) return;

        const weight = Number(inputWeight);
        const updatedFamily = [...editData.familyMembers];
        const person = updatedFamily[personIndex];

        person.wasteData = { ...(person.wasteData || {}), [wasteInfo.type]: weight };
        person.credit = Object.entries(person.wasteData).reduce((sum, [wType, wWeight]) => sum + (Number(wWeight) * (CARBON_MULTIPLIERS[wType] || 0)), 0);

        setEditData({ ...editData, familyMembers: updatedFamily, credit: updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0) });
        setInputWeight('');
    };

    const handleDeleteWasteRecord = (personIndex, typeToRemove) => {
        const updatedFamily = [...editData.familyMembers];
        const person = updatedFamily[personIndex];
        const newWasteData = { ...person.wasteData };
        delete newWasteData[typeToRemove];
        person.wasteData = newWasteData;
        person.credit = Object.entries(person.wasteData).reduce((sum, [wType, wWeight]) => sum + (Number(wWeight) * (CARBON_MULTIPLIERS[wType] || 0)), 0);

        setEditData({ ...editData, familyMembers: updatedFamily, credit: updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0) });
    };

    const handlePreSave = () => {
        if (!editData.houseNo.trim()) return alert("❌ กรุณาระบุบ้านเลขที่");
        if (!editData.familyMembers[0].name.trim()) return alert("❌ กรุณากรอกชื่อสมาชิกอย่างน้อย 1 คน");
        setShowConfirm(true);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            {/* 🌟 1. Sticky Header */}
            <header className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0 z-50">
                <div>
                    <h3 className="font-black text-xl flex items-center gap-2"><Edit2 size={22} className="text-amber-400" /> แก้ไขข้อมูลครัวเรือน</h3>
                    <p className="text-sm text-slate-300 mt-0.5 opacity-90 hidden sm:block">ปรับปรุงข้อมูลและประวัติการฝากขยะรายบุคคล</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition bg-white/10 flex items-center gap-2 font-bold text-sm">
                    <X size={20} /> <span className="hidden sm:inline">ปิด</span>
                </button>
            </header>

            {/* 🌟 2. Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* คอลัมน์ซ้าย: ข้อมูลบ้าน & แผนที่ */}
                    <div className="w-full lg:w-[35%] flex flex-col gap-6">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2"><Home className="text-slate-500" /> ข้อมูลครัวเรือน</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1.5 text-slate-600">🏠 บ้านเลขที่</label>
                                    <input type="text" className="w-full border-2 border-slate-100 p-3.5 rounded-xl outline-none bg-slate-50 font-black text-slate-800 focus:border-amber-400 focus:bg-white transition text-lg" value={editData.houseNo} onChange={e => setEditData({ ...editData, houseNo: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1.5 text-slate-600">📂 หมวดที่สังกัด</label>
                                    <select className="w-full border-2 border-slate-100 p-3.5 rounded-xl outline-none bg-slate-50 font-bold text-slate-800 focus:border-amber-400 cursor-pointer transition text-base" value={editData.villageId} onChange={e => {
                                        const v = villageData.find(item => item.id === parseInt(e.target.value));
                                        if (v) setEditData({ ...editData, villageId: v.id, category: v.name });
                                    }}>
                                        {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold text-slate-700">🗺️ แก้ไขจุดปักหมุด</label>
                                <button type="button" onClick={() => window.findEditMiniLocation && window.findEditMiniLocation()} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1 transition">
                                    <Navigation size={14} /> ดึงพิกัด
                                </button>
                            </div>
                            <div id="edit-map-container" className="h-48 sm:h-64 w-full rounded-2xl border-2 border-slate-100 z-0 overflow-hidden"></div>
                        </div>
                    </div>

                    {/* คอลัมน์ขวา: รายชื่อบุคคล */}
                    <div className="w-full lg:w-[65%] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">👥 แก้ไขข้อมูลบุคคล</h4>
                            <button type="button" onClick={handleAddFamilyMember} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 flex items-center gap-2 transition shadow-md">
                                <PlusCircle size={16} /> <span className="hidden sm:inline">เพิ่มสมาชิก</span>
                            </button>
                        </div>

                        <div className="space-y-4 pb-10">
                            {editData.familyMembers.map((person, index) => (
                                <div key={person.id} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-amber-400 transition-colors flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="flex items-center gap-3 w-full sm:w-1/2">
                                            <span className="bg-amber-100 text-amber-700 w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0">{index + 1}</span>
                                            <input type="text" placeholder="ชื่อ-นามสกุล" value={person.name} onChange={(e) => updatePersonField(index, 'name', e.target.value)} className="w-full border-b-2 border-slate-200 px-2 py-2 outline-none font-bold text-slate-800 focus:border-amber-500 transition bg-transparent text-lg" />
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-1/2 justify-end">
                                            <div className="relative w-full">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                                                <input
                                                    type="number" step="any" min="0" placeholder="0" value={person.balance ?? ''} onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        updatePersonField(index, 'balance', Math.max(0, val));
                                                    }} className="w-full border-2 border-slate-100 pl-10 pr-4 py-2.5 rounded-xl outline-none font-black text-amber-600 focus:border-amber-400 bg-slate-50 transition text-right text-lg" />
                                            </div>
                                            {editData.familyMembers.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveFamilyMember(index)} className="p-3 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition shrink-0 bg-slate-50">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => updatePersonField(index, 'isSorted', !person.isSorted)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${person.isSorted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {person.isSorted ? '✅ คัดแยกขยะแล้ว' : '⚪ ไม่คัดแยก'}
                                        </button>
                                        <button type="button" onClick={() => updatePersonField(index, 'hasWelfare', !person.hasWelfare)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${person.hasWelfare ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {person.hasWelfare ? '🎁 มีสวัสดิการ' : '❌ ไม่มีสิทธิ'}
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden mt-2">
                                        <button type="button" onClick={() => { setExpandedWasteIndex(expandedWasteIndex === index ? null : index); setSelectedWasteId(globalPrices?.[0]?.id || ''); setInputWeight(''); }} className="w-full p-3.5 text-sm font-bold text-slate-600 flex justify-between items-center hover:bg-slate-100 transition">
                                            <div className="flex items-center gap-2"><PackageOpen size={18} className="text-amber-500" /> แก้ไขน้ำหนักขยะสะสม (อัปเดตคาร์บอนออโต้)</div>
                                            <span className="bg-white px-2 py-1 rounded-md shadow-sm text-xs border border-slate-200">{expandedWasteIndex === index ? 'ปิด ▲' : 'เปิด ▼'}</span>
                                        </button>

                                        {expandedWasteIndex === index && (
                                            <div className="p-4 bg-white border-t border-slate-200">
                                                <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                                    <select value={selectedWasteId} onChange={e => setSelectedWasteId(e.target.value)} className="w-full sm:flex-1 bg-white border border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none">
                                                        <option value="" disabled>-- เลือกขยะ --</option>
                                                        {globalPrices && globalPrices.map(p => <option key={p.id} value={p.id}>{p.type}</option>)}
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <div className="relative w-full sm:w-28">
                                                            <input type="number" step="any" placeholder="แทนที่ น.น." value={inputWeight} onChange={e => setInputWeight(e.target.value)} className="w-full bg-white border border-slate-200 pl-3 pr-8 py-2.5 rounded-lg text-sm font-black text-slate-700 outline-none text-right" />
                                                            <span className="absolute right-3 top-3 text-[10px] text-slate-400 font-bold">กก.</span>
                                                        </div>
                                                        <button type="button" onClick={() => handleUpdateWasteRecord(index)} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-lg text-sm transition shrink-0">บันทึกค่า</button>
                                                    </div>
                                                </div>

                                                {Object.keys(person.wasteData || {}).length > 0 ? (
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                        <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between">
                                                            <span>ประวัติขยะสะสม</span>
                                                            <span className="text-emerald-600 font-black">🌱 คาร์บอนคนนี้: {Number(person.credit || 0).toFixed(4)}</span>
                                                        </div>
                                                        <div className="divide-y divide-slate-100">
                                                            {Object.entries(person.wasteData).map(([wType, wWeight]) => (
                                                                <div key={wType} className="px-4 py-2.5 flex justify-between items-center text-sm">
                                                                    <span className="font-bold text-slate-700">{wType} <span className="text-slate-400">({wWeight} กก.)</span></span>
                                                                    <button type="button" onClick={() => handleDeleteWasteRecord(index, wType)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md transition"><Trash2 size={16} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : <p className="text-center text-xs font-bold text-slate-400 py-2">ยังไม่มีประวัติขยะ</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* 🌟 3. Sticky Footer */}
            <footer className="bg-white border-t border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <button type="button" onClick={() => { if (confirm("⚠️ ยืนยันการลบบ้านนี้ออกจากระบบอย่างถาวร?")) onDelete(editData.id); }} className="w-full sm:w-auto px-6 py-3.5 font-bold text-red-500 hover:bg-red-50 transition border border-dashed border-red-200 rounded-xl flex items-center justify-center gap-2 text-sm">
                    <Trash2 size={18} /> ลบบ้านหลังนี้
                </button>

                <div className="flex gap-4 items-center w-full sm:w-auto bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">เงินสะสมรวม</span>
                        <span className="text-xl font-black text-amber-600 font-mono">฿{editData.balance.toLocaleString()}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200"></div>
                    <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">คาร์บอนเครดิต</span>
                        <span className="text-xl font-black text-emerald-600 font-mono">{editData.credit.toFixed(4)}</span>
                    </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-3.5 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition">ยกเลิก</button>
                    <button type="button" onClick={handlePreSave} className="flex-[2] sm:flex-none px-10 py-3.5 bg-slate-800 text-white rounded-xl font-black shadow-lg hover:bg-slate-900 transition flex justify-center items-center gap-2">
                        <Save size={20} /> บันทึกการแก้ไข
                    </button>
                </div>
            </footer>

            {/* ป๊อปอัพยืนยันก่อนบันทึก */}
            {showConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><Edit2 size={32} /></div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">ยืนยันการแก้ไขข้อมูล?</h3>
                        <p className="text-sm text-slate-500 mb-6">ตรวจสอบความถูกต้องก่อนบันทึกข้อมูลเข้าสู่ระบบ</p>

                        <div className="w-full bg-slate-50 rounded-2xl p-4 space-y-3 mb-6 border border-slate-100 text-left">
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">บ้านเลขที่</span><span className="text-sm font-black text-slate-700">{editData.houseNo}</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">หมวดหมู่</span><span className="text-sm font-bold text-slate-700">{editData.category}</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">สมาชิก</span><span className="text-sm font-black text-blue-600">{editData.familyMembers.length} คน</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">เงินตั้งต้นรวม</span><span className="text-sm font-black text-amber-600">฿{editData.balance.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-xs font-bold text-slate-400">คาร์บอนรวม</span><span className="text-sm font-black text-emerald-600">{editData.credit.toFixed(4)}</span></div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">กลับไปแก้ไข</button>
                            <button onClick={() => { setShowConfirm(false); onSave(editData); }} className="flex-[2] py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-900 shadow-md transition">✅ ยืนยันบันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MembersView = ({ members, setMembers, villages, setVillages, isLoggedIn, logAdminAction, refreshData, setCurrentPage, globalPrices }) => {
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // 🌟 ปรับค่าเริ่มต้นให้เป็น 'all' เพื่อให้แสดงผลทุกหมวดก่อนเลือกกรอง
    const [selectedSortVillageId, setSelectedSortVillageId] = useState(() => {
        const savedZone = localStorage.getItem('active_sort_zone');
        return savedZone ? savedZone : 'all';
    });

    // 🌟 เปลี่ยนสถานะในเครื่องเฉยๆ ไม่เรียกดึงฐานข้อมูลใหม่มาลบทับตัวแปรหลัก
    const handleZoneChange = (zoneId) => {
        setSelectedSortVillageId(zoneId);
        localStorage.setItem('active_sort_zone', String(zoneId));
    };

    // 💾 ฟังก์ชันรับค่าเมื่อกดบันทึกความเปลี่ยนแปลงจากหน้าต่างแก้ไข
    // 💾 ฟังก์ชันรับค่าเมื่อกดบันทึกความเปลี่ยนแปลงจากหน้าต่างแก้ไข
    const handleSaveEdit = async (updatedMember) => {
        const oldMember = members.find(m => m.id === updatedMember.id);
        const targetVillage = villages.find(v => v.id === updatedMember.villageId);
        if (targetVillage) {
            updatedMember.category = targetVillage.name;
        }

        const CARBON_MULTIPLIERS = {
            'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910, 'เหล็ก': 1.8320
        };

        //  1. ดักจับข้อมูล: ถ้าครอบครัวถูกลบจนเกลี้ยง ให้สร้างกล่องข้อมูลเปล่าไว้กันระบบพัง
        if (!updatedMember.familyMembers || updatedMember.familyMembers.length === 0) {
            updatedMember.familyMembers = [{
                id: Date.now().toString(), name: '', balance: 0, credit: 0,
                wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 },
                hasWelfare: false, isSorted: false
            }];
        }

        //  2. คำนวณยอดรวมของบ้านใหม่ทั้งหมด (เงิน, คาร์บอน, สถานะ) จาก "รายบุคคล"
        updatedMember.balance = updatedMember.familyMembers.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
        updatedMember.credit = updatedMember.familyMembers.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);
        updatedMember.isSorted = updatedMember.familyMembers.some(p => p.isSorted);

        //  3. รวบรวมน้ำหนักขยะทั้งหมดของคนในบ้าน มาเป็นขยะรวมของบ้าน
        const aggregatedWaste = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 };
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
                //  ยอดคาร์บอนและเงินรวมของหมวด จะถูกดึงมาจาก "ยอดรวมของบ้าน" อีกที
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

            // 🌟 เพิ่มคำสั่งบันทึกประวัติ (Log) ตรงนี้!
            if (typeof logAdminAction === 'function') {
                // เช็กว่ามีการเปลี่ยนยอดเงินรวมของบ้านหรือไม่
                const oldBal = oldMember ? Number(oldMember.balance) || 0 : 0;
                const newBal = Number(updatedMember.balance) || 0;

                if (oldBal !== newBal) {
                    logAdminAction(`แก้ไขยอดเงิน บ้านเลขที่ ${updatedMember.houseNo} (จากเดิม ฿${oldBal.toLocaleString()} เปลี่ยนเป็น ฿${newBal.toLocaleString()})`);
                } else {
                    logAdminAction(`แก้ไขข้อมูลทั่วไป ครัวเรือนบ้านเลขที่ ${updatedMember.houseNo}`);
                }
            }

            alert(`💾 อัปเดตข้อมูลบ้านเลขที่ ${updatedMember.houseNo} ลง Cloud สำเร็จเรียบร้อย!`);
        } catch (err) {
            console.error("อัปเดต Firebase พลาด:", err);
            alert("❌ บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
        }

        setEditingMember(null);
        refreshData();
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

    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const itemsPerPage = 10;

    React.useEffect(() => {
        setCurrentPageNumber(1);
    }, [selectedSortVillageId, searchTerm]);

    // 🌟 เปลี่ยนระบบมาเป็นการกรองข้อมูลในเครื่อง (Client-side) ป้องกันแมพและหน้าอื่นพังถาวร
    const displayedMembers = useMemo(() => {
        if (!members) return [];
        let result = members;

        // 1. กรองตามหมวดหมู่
        if (selectedSortVillageId !== 'all') {
            result = result.filter(m =>
                Number(m.villageId) === Number(selectedSortVillageId) ||
                String(m.villageId).trim() === String(selectedSortVillageId).trim() ||
                String(m.category).trim() === String(selectedSortVillageId).trim()
            );
        }

        // 2. กรองตามคำค้นหา (ค้นได้ทั้งเลขบ้านและชื่อคน)
        if (searchTerm.trim() !== '') {
            result = result.filter(m => {
                const matchHouse = String(m.houseNo).includes(searchTerm.trim());
                const matchName = (m.familyMembers || []).some(p => {
                    const pName = typeof p === 'string' ? p : p?.name;
                    return pName && pName.toLowerCase().includes(searchTerm.toLowerCase().trim());
                });
                return matchHouse || matchName;
            });
        }

        // 3. จัดเรียงบ้านเลขที่จากน้อยไปมากให้อัตโนมัติ
        return result.sort((a, b) => {
            const numA = parseFloat(String(a.houseNo).replace(/[^\d.]/g, '')) || 0;
            const numB = parseFloat(String(b.houseNo).replace(/[^\d.]/g, '')) || 0;
            return numA - numB;
        });
    }, [members, selectedSortVillageId, searchTerm]);

    // คำนวณจำนวนหน้าทั้งหมด
    const totalPages = Math.max(1, Math.ceil(displayedMembers.length / itemsPerPage));
    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* หัวข้อหน้าจอ */}
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">🏠 บ้านสมาชิกในระบบ</h2>
                            <p className="text-slate-500 text-sm mt-1">รายชื่อครัวเรือนที่ลงทะเบียนในโครงการ (หมู่ 6)</p>
                        </div>
                        {isLoggedIn && setCurrentPage && (
                            <button onClick={() => setCurrentPage('admin')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm">
                                ← ย้อนกลับ
                            </button>
                        )}
                    </div>

                    {/* 🌟 แถบตัวกรอง ค้นหา และปุ่มนำเข้าข้อมูล */}
                    <div className="flex flex-col lg:flex-row gap-4">

                        {/* ฝั่งซ้าย: กล่องกรองหมวด และ ค้นหา */}
                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                            {isLoggedIn && (
                                <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 sm:flex-none">
                                    <span className="text-sm font-bold text-slate-500 pl-2 whitespace-nowrap">📂 หมวด:</span>
                                    <select
                                        value={selectedSortVillageId}
                                        onChange={(e) => handleZoneChange(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer w-full"
                                    >
                                        <option value="all">-- แสดงทุกหมวดหมู่ --</option>
                                        {villages.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center px-3 flex-1">
                                <span className="text-slate-400 mr-2">🔍</span>
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อ-นามสกุล หรือ บ้านเลขที่..."
                                    className="text-sm font-bold outline-none w-full bg-transparent py-1"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* ฝั่งขวา: ปุ่มนำเข้าข้อมูล 📥 */}
                        {isLoggedIn && (
                            <button
                                onClick={() => setCurrentPage('import_excel')}
                                className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white px-6 py-3 lg:py-2 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                            >
                                <FileSpreadsheet size={18} /> นำเข้าข้อมูล (CSV)
                            </button>
                        )}
                    </div>
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
                        //  ใช้ .slice() ตัดข้อมูลมาแสดงทีละ 10 รายการตามหน้าปัจจุบัน
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
                                        //  เติม h-fit ตรงนี้ เพื่อไม่ให้กล่องข้างๆ ยืดตามเวลาเรากดเปิด Dropdown
                                        className="bg-white/90 backdrop-blur-md border border-sky-100/80 rounded-[28px] p-5 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all duration-300 flex flex-col w-full h-fit self-start"
                                    >
                                        {/* ชั้นที่ 1: ส่วนหัว (ฝั่งซ้าย=บ้าน, ฝั่งขวา=ปุ่มแก้ไข) */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-col gap-2">
                                                <span className="bg-blue-50 text-blue-700 text-base font-black px-4 py-2 rounded-xl w-fit border border-blue-100 flex items-center gap-2 shadow-sm">
                                                    🏠 บ้านเลขที่ {member.houseNo}
                                                </span>
                                                <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-500 rounded-lg w-fit">
                                                    {member.category || 'ไม่ระบุหมวด'}
                                                </span>
                                            </div>
                                            {isLoggedIn && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingMember(member)}
                                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5 border border-slate-200 shrink-0 shadow-sm"
                                                >
                                                    ⚙️ <span className="hidden sm:inline">แก้ไข</span>
                                                </button>
                                            )}
                                        </div>

                                        {/*  ชั้นที่ 2: สถิติรวมของบ้าน (ขยายฟอนต์ให้อ่านง่าย แต่ไม่เกะกะ และเอาขยะบ้านออก) */}
                                        <div className="flex gap-3 mb-4">
                                            <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col justify-center shadow-sm">
                                                <span className="text-xs text-amber-600 font-bold mb-1">ยอดเงินรวม</span>
                                                <span className="text-lg font-black text-amber-600 font-mono tracking-tight">
                                                    ฿{balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col justify-center shadow-sm">
                                                <span className="text-xs text-emerald-600 font-bold mb-1">คาร์บอนรวม</span>
                                                <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                                                    {credit.toFixed(4)} <span className="text-[10px]">kgCO2e</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/*  ชั้นที่ 3: Dropdown เจาะลึกรายบุคคล (ขยายใหญ่ โชว์ขยะรายคนชัดๆ) */}
                                        <div className="w-full border-t border-slate-100 pt-4 mt-auto">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                                className="w-full py-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-between px-4 transition-colors border border-slate-200 shadow-sm"
                                            >
                                                <span className="flex items-center gap-2">
                                                    👥 ข้อมูลรายบุคคล
                                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-xs">
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

                                                            const pBalance = typeof person === 'string' ? 0 : (Number(person?.balance) || 0);
                                                            const pCredit = typeof person === 'string' ? 0 : (Number(person?.credit) || 0);
                                                            const pIsSorted = typeof person === 'string' ? false : (person?.isSorted || false);
                                                            const pHasWelfare = typeof person === 'string' ? false : (person?.hasWelfare || false);
                                                            const pWasteData = typeof person === 'string' ? {} : (person?.wasteData || {});

                                                            return (
                                                                //  การ์ดรายบุคคล (ขยายขนาดกล่องให้ดูเต็มตา)
                                                                <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-3 shadow-sm">

                                                                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                                                        {/* ฝั่งซ้าย: ชื่อและป้ายสถานะ */}
                                                                        <div className="flex items-start gap-3">
                                                                            <span className="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0">{idx + 1}</span>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-slate-800 text-base">{pName}</span>
                                                                                <div className="flex gap-2 mt-1.5">
                                                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${pIsSorted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                                                        {pIsSorted ? '✅ แยกขยะ' : '⚪ ไม่แยก'}
                                                                                    </span>
                                                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${pHasWelfare ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                                                        {pHasWelfare ? '🎁 สวัสดิการ' : '❌ ไม่มีสิทธิ'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* ฝั่งขวา: เงินและคาร์บอนส่วนตัว */}
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <span className="font-mono text-amber-600 font-black text-base">
                                                                                ฿{pBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                                            </span>
                                                                            <span className="font-mono text-emerald-600 font-bold text-xs">
                                                                                {pCredit.toFixed(4)} <span className="text-[10px]">kgCO2e</span>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/*  โชว์ประวัติขยะส่วนตัวแบบใหม่ ใหญ่ขึ้นและชัดเจนขึ้น */}
                                                                    <div className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                                        <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                                                                            📦 ขยะที่สมาชิกท่านนี้ฝาก:
                                                                        </p>
                                                                        {Object.keys(pWasteData).length > 0 && Object.values(pWasteData).some(v => Number(v) > 0) ? (
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {Object.entries(pWasteData).map(([type, weight]) => {
                                                                                    if (Number(weight) <= 0) return null;
                                                                                    return (
                                                                                        <span key={type} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 shadow-sm flex items-center gap-1.5">
                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                                            {type} {Number(weight).toFixed(2)} กก.
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-xs text-slate-400 italic">ยังไม่มีประวัติการฝากขยะ</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่มีข้อมูลบุคคล</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                    )}

                    {/*  ระบบแบ่งหน้า (Pagination) แทนปุ่มโหลดเพิ่ม */}
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
            </div>
            {/* แสดงเปิดหน้าต่างป๊อปอัพแก้ไขข้อมูลครัวเรือน */}
            {editingMember && (
                <EditMemberModal
                    member={editingMember}
                    villageData={villages}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteMemberData}
                    onClose={() => setEditingMember(null)}
                    globalPrices={globalPrices}
                />
            )}
        </>
    );
};

// =========================================================================
// ➕ หน้าต่างหักยอดเงินสมาชิกแบบกลุ่ม (Bulk Deduct - เลือกระดับบุคคล) - Full Page UX
// =========================================================================
const BulkDeductModal = ({ members, villages, onClose, onSave }) => {
    const [selectedVillageId, setSelectedVillageId] = useState('all');
    const [deductAmount, setDeductAmount] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [checkedPersons, setCheckedPersons] = useState([]);

    const filteredMembers = useMemo(() => {
        let result = members;

        if (selectedVillageId !== 'all') {
            result = result.filter(m =>
                Number(m.villageId) === Number(selectedVillageId) ||
                String(m.villageId).trim() === String(selectedVillageId).trim() ||
                String(m.category).trim() === String(selectedVillageId).trim()
            );
        }

        if (searchTerm.trim() !== '') {
            result = result.filter(m => {
                const matchHouse = String(m.houseNo).includes(searchTerm.trim());
                const matchName = (m.familyMembers || []).some(p => {
                    const pName = typeof p === 'string' ? p : p?.name;
                    return pName && pName.toLowerCase().includes(searchTerm.toLowerCase().trim());
                });
                return matchHouse || matchName;
            });
        }

        return result;
    }, [members, selectedVillageId, searchTerm]);

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

    useEffect(() => {
        setCheckedPersons([]);
    }, [selectedVillageId, searchTerm]);

    const handleToggleCheck = (key) => {
        setCheckedPersons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col w-full h-full animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
            {/* 🌟 1. Header (Sticky Top) */}
            <header className="bg-red-600 text-white px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center shadow-md shrink-0 z-50">
                <div>
                    <h3 className="font-black text-lg sm:text-xl flex items-center gap-2">
                        <Wallet size={24} className="hidden sm:block" /> หักยอดเงินสมาชิกแบบกลุ่ม
                    </h3>
                    <p className="text-xs sm:text-sm text-red-100 mt-1 opacity-90">เลือกลบยอดเงินรายบุคคล หลายคนพร้อมกันในคลิกเดียว</p>
                </div>
                <button onClick={onClose} className="p-2 sm:px-4 sm:py-2 hover:bg-white/20 rounded-xl transition bg-white/10 backdrop-blur-sm flex items-center gap-2 font-bold text-xs sm:text-sm">
                    <X size={20} /> <span className="hidden sm:inline">ปิดหน้าต่าง</span>
                </button>
            </header>

            {/* 🌟 2. เนื้อหาหลัก (Scrollable) */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto flex flex-col gap-6">

                    {/* แผงควบคุมด้านบน (ปรับขนาดเล็กลง) */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-slate-700">📂 เลือกหมวดหมู่ที่ต้องการหักเงิน</label>
                            <select
                                value={selectedVillageId}
                                onChange={(e) => setSelectedVillageId(e.target.value)}
                                className="w-full border border-slate-200 p-3 rounded-xl outline-none bg-slate-50 font-bold text-slate-800 focus:border-red-400 focus:bg-white cursor-pointer transition text-sm"
                            >
                                <option value="all">-- ทุกหมวดหมู่ --</option>
                                {villages.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-red-600">💰 ระบุยอดเงินที่ต้องการหัก (บาท/คน)</label>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 font-black text-slate-400 text-lg">฿</span>
                                <input
                                    type="number" min="0" step="any" placeholder="0.00"
                                    value={deductAmount}
                                    onChange={(e) => setDeductAmount(e.target.value)}
                                    className="w-full border border-slate-200 focus:border-red-400 focus:bg-white outline-none text-right font-black text-red-600 pl-10 pr-4 py-3 rounded-xl bg-slate-50 transition-colors shadow-inner text-base sm:text-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* กล่องรายชื่อบุคคล */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
                        {/* แถบเครื่องมือค้นหาและเลือก */}
                        <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <h4 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                                    👥 รายชื่อบุคคล
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs">พบ {getAllPersonKeys().length} คน</span>
                                </h4>
                                <div className="flex gap-2">
                                    <button onClick={() => setCheckedPersons(getAllPersonKeys())} className="flex-1 sm:flex-none text-xs bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold hover:bg-slate-100 shadow-sm transition-colors text-slate-700">ติ๊กเลือกทุกคน</button>
                                    <button onClick={() => setCheckedPersons([])} className="flex-1 sm:flex-none text-xs bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold hover:bg-red-50 text-red-500 shadow-sm transition-colors">เอาออกทั้งหมด</button>
                                </div>
                            </div>

                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
                                <input
                                    type="text" placeholder="ค้นหาชื่อ-นามสกุล หรือ บ้านเลขที่..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm focus:border-red-400 transition-colors"
                                />
                            </div>
                        </div>

                        {/* 🌟 3. รายชื่อแบ่งเป็น Grid 2 ฝั่ง (ช่วยลดการไถหน้าจอ) */}
                        <div className="p-4 sm:p-5 bg-slate-50/50">
                            {filteredMembers.length > 0 ? (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {filteredMembers.map(m => {
                                        const validPersons = (m.familyMembers || []).filter(p => {
                                            const name = typeof p === 'string' ? p : p?.name;
                                            return name && name.trim() !== '';
                                        });

                                        if (validPersons.length === 0) return null;

                                        // ซ่อนบ้านที่ไม่ตรงกับช่องค้นหา (เฉพาะเวลาที่พิมพ์ค้นหา)
                                        const houseMatch = String(m.houseNo).includes(searchTerm.trim());
                                        const personMatch = validPersons.some(p => {
                                            const name = typeof p === 'string' ? p : p?.name;
                                            return name.toLowerCase().includes(searchTerm.toLowerCase().trim());
                                        });
                                        if (searchTerm.trim() !== '' && !houseMatch && !personMatch) return null;

                                        return (
                                            <div key={m.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-red-200 transition-colors h-fit">
                                                <div className="bg-blue-50/50 px-4 py-2.5 border-b border-blue-100 flex items-center justify-between">
                                                    <span className="font-black text-blue-800 text-sm">🏠 บ้านเลขที่ {m.houseNo}</span>
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-md">{validPersons.length} คน</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {m.familyMembers.map((p, idx) => {
                                                        const pId = p.id || String(idx);
                                                        const pName = typeof p === 'string' ? p : p?.name;
                                                        const pBalance = typeof p === 'string' ? 0 : (Number(p?.balance) || 0);

                                                        if (!pName || pName.trim() === '') return null;

                                                        // กรองระดับบุคคลอีกที
                                                        if (searchTerm.trim() !== '' && !pName.toLowerCase().includes(searchTerm.toLowerCase().trim()) && !houseMatch) {
                                                            return null;
                                                        }

                                                        const key = `${m.id}|${pId}`;
                                                        const isChecked = checkedPersons.includes(key);
                                                        const deductVal = Number(deductAmount) || 0;
                                                        const afterBalance = Math.max(0, pBalance - deductVal);

                                                        return (
                                                            <label key={key} className={`flex items-center justify-between p-3 sm:p-4 cursor-pointer transition-colors ${isChecked ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 sm:w-5 sm:h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleCheck(key)}
                                                                    />
                                                                    <span className="font-bold text-sm sm:text-base text-slate-800">{pName}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    <span className="font-bold text-slate-500 text-xs">เดิม: ฿{pBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                                                                    {isChecked && deductVal > 0 && (
                                                                        <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-lg text-xs shadow-sm border border-red-200">
                                                                            เหลือ: ฿{afterBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-500 font-bold">ไม่พบข้อมูลสมาชิกที่ค้นหา</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* 🌟 4. Sticky Footer */}
            <footer className="bg-white border-t border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3 items-center w-full sm:w-auto bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 justify-center">
                    <span className="text-sm font-bold text-slate-600">เลือกหักเงินแล้ว:</span>
                    <span className="text-xl font-black text-red-600">{checkedPersons.length} <span className="text-xs font-bold text-slate-500">คน</span></span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition text-sm">
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const amount = Number(deductAmount);
                            if (isNaN(amount) || amount <= 0) return alert("❌ กรุณาระบุจำนวนเงินที่ต้องการหักให้ถูกต้อง");
                            if (checkedPersons.length === 0) return alert("❌ กรุณาติ๊กเลือกบุคคลอย่างน้อย 1 คน");

                            onSave(checkedPersons, amount, selectedVillageId);
                        }}
                        className="flex-[2] sm:flex-none bg-red-600 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-red-700 transition flex items-center justify-center gap-2 text-base"
                    >
                        <Save size={18} className="hidden sm:block" /> ยืนยันการหักเงิน
                    </button>
                </div>
            </footer>
        </div>
    );
};
const ManageBalanceView = ({ members, villages, setMembers, db, logAdminAction, setCurrentPage, refreshData }) => {
    const [selectedVillageId, setSelectedVillageId] = useState('all');
    const [currentPage, setCurrentPageNum] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    // สเตตัสสำหรับการกางดูรายบุคคล
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const [editingPersonId, setEditingPersonId] = useState(null); // ใช้เก็บ ID ของคนที่กำลังถูกแก้ไขเงิน
    const [editBalance, setEditBalance] = useState('');

    //  สเตตัสสำหรับเปิดหน้าต่างหักเงินกลุ่ม
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

    //  ฟังก์ชันเซฟเงินใหม่ (ระดับบุคคล)
    const handleSavePersonBalance = async (houseMember, personId) => {
        const newBalance = Math.max(0, Number(editBalance));
        if (isNaN(newBalance)) return alert("❌ กรุณากรอกตัวเลขให้ถูกต้อง");

        try {
            // 🌟 1. ค้นหา "ยอดเงินเดิม" และ "ชื่อ" เพื่อเตรียมส่งเข้าประวัติ (Log)
            const targetPersonForLog = (houseMember.familyMembers || []).find(p => (p.id || String(p)) === String(personId));
            const oldBalance = typeof targetPersonForLog === 'string' ? 0 : (Number(targetPersonForLog?.balance) || 0);
            const pName = typeof targetPersonForLog === 'string' ? targetPersonForLog : (targetPersonForLog?.name || 'ไม่ระบุชื่อ');

            // 2. จำลองร่างบ้านหลังนี้ แล้วเข้าไปอัปเดตเงินคนนั้น
            const updatedFamily = (houseMember.familyMembers || []).map((p, idx) => {
                const pId = p.id || String(idx);
                if (String(pId) === String(personId)) {
                    if (typeof p === 'string') {
                        return { id: pId, name: p, balance: newBalance, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false };
                    }
                    return { ...p, balance: newBalance };
                }
                return p;
            });

            // 3. คำนวณยอดเงินรวมของบ้านใหม่
            const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
            const updatedMember = { ...houseMember, familyMembers: updatedFamily, balance: newHouseBalance };

            // 4. ยิงขึ้น Cloud
            await setDoc(doc(db, "members", String(houseMember.id)), updatedMember, { merge: true });

            // 🌟 5. แจ้งเตือน Log แอดมิน (ใส่รายละเอียด ยอดเดิม -> ยอดใหม่)
            if (typeof logAdminAction === 'function') {
                logAdminAction(`แก้ไขยอดเงินของ "${pName}" (บ้านเลขที่ ${houseMember.houseNo}) จากเดิม ฿${oldBalance.toLocaleString()} เปลี่ยนเป็น ฿${newBalance.toLocaleString()}`);
            }

            setEditingPersonId(null);

            // รีเฟรชข้อมูลให้ตารางอัปเดตทันที
            if (typeof refreshData === 'function') await refreshData();

        } catch (error) {
            console.error("Error saving balance:", error);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่");
        }
    };
    //  ฟังก์ชันจัดการการหักเงินแบบกลุ่ม (Bulk Deduct - ระดับบุคคล)
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

                    //  วนลูปหักเงินรายคนภายในบ้าน
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

                    // คำนวณยอดเงินรวมของบ้านใหม่
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

    return (<>
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-emerald-800 flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> จัดการยอดเงินสมาชิก
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">อัปเดตยอดเงินคงเหลือ และหักยอดเงินแบบกลุ่ม</p>
                </div>
                <button
                    onClick={() => setCurrentPage('admin')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm"
                >
                    ← ย้อนกลับ
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

                {/*  ปุ่มหักเงินกลุ่ม */}
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-5 py-3 lg:py-2 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm w-full lg:w-auto shrink-0"
                >
                    หักเงินรายกลุ่ม
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
                                                                    ฿{pBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
        </div>
        {/* เรียกใช้งานหน้าต่างหักเงินเมื่อสเตตัส isBulkModalOpen เป็น true */}
        {isBulkModalOpen && (
            <BulkDeductModal
                members={members}
                villages={villages}
                onClose={() => setIsBulkModalOpen(false)}
                onSave={handleBulkSave}
            />
        )}
    </>
    );
};

// === หน้าจอแสดงประวัติการทำรายการ (HistoryView) โฉมใหม่ แบบตารางรายเดือน ===
const HistoryView = ({ transactions, villages, db, refreshData, setCurrentPage, globalPrices }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [tablePage, setTablePage] = useState(1);
    const itemsPerPage = 20;

    const wasteTypes = React.useMemo(() => {
        return globalPrices && globalPrices.length > 0
            ? globalPrices.map(p => p.type)
            : [];
    }, [globalPrices])

    React.useEffect(() => {
        setTablePage(1);
    }, [selectedCategory, searchTerm]);

    // 🌟 1. ดึงเฉพาะเดือนนี้ และมัดรวมข้อมูลตาม "หมวด_บ้านเลขที่_ชื่อสมาชิก"
    const aggregatedTx = React.useMemo(() => {
        const now = new Date();
        const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const currentMonthStr = ThaiMonths[now.getMonth()];
        const currentYearStr = String(now.getFullYear() + 543);

        const map = new Map();

        (transactions || []).forEach(tx => {
            if (!tx.date) return;

            // กรองเอาเฉพาะเดือนปัจจุบัน
            const isCurrentMonth = tx.date.includes(currentMonthStr) && tx.date.includes(currentYearStr);
            if (!isCurrentMonth) return;

            const category = tx.category || 'ทั่วไป';
            const houseNo = tx.houseNo || 'ไม่ระบุ';
            const personName = tx.personName || 'ไม่ระบุชื่อ';

            // สร้างกุญแจมัดรวม: ถ้า 3 อย่างนี้เหมือนกัน ถือว่าเป็นคนเดียวกัน
            const key = `${category}_${houseNo}_${personName}`;

            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    rawIds: [tx.id], // 🗝️ แอบเก็บ ID ดิบทุกอันไว้ เพื่อให้รู้ว่าถือกดลบแถวนี้ ต้องไปลบกี่บิล
                    category: category,
                    houseNo: houseNo,
                    personName: personName,
                    totalBalance: Number(tx.addedBalance) || 0,
                    totalCredit: Number(tx.creditAdded) || 0,
                    wasteData: { ...(tx.wasteData || {}) },
                    latestDate: tx.date,
                    latestTime: tx.time
                });
            } else {
                // ถ้ามีชื่อนี้ในตารางแล้ว ให้บวกยอดทบเข้าไป
                const existing = map.get(key);
                existing.rawIds.push(tx.id);
                existing.totalBalance += (Number(tx.addedBalance) || 0);
                existing.totalCredit += (Number(tx.creditAdded) || 0);

                Object.entries(tx.wasteData || {}).forEach(([wType, wWeight]) => {
                    existing.wasteData[wType] = (Number(existing.wasteData[wType]) || 0) + (Number(wWeight) || 0);
                });

                // อัปเดตเวลาล่าสุดที่มาฝาก
                existing.latestDate = tx.date;
                existing.latestTime = tx.time;
            }
        });

        return Array.from(map.values());
    }, [transactions]);

    // 🌟 2. นำข้อมูลที่มัดรวมแล้ว (aggregatedTx) มาค้นหา/กรอง/เรียงลำดับ
    const filteredTx = React.useMemo(() => {
        let filtered = aggregatedTx.filter(tx => {
            const matchCategory = selectedCategory === 'all' || String(tx.category).trim() === String(selectedCategory).trim();
            const matchSearch = String(tx.houseNo).includes(searchTerm.trim()) ||
                String(tx.personName).toLowerCase().includes(searchTerm.toLowerCase().trim());
            return matchCategory && matchSearch;
        });

        filtered.sort((a, b) => {
            const numA = parseInt(String(a.category).match(/\d+/) || [999]);
            const numB = parseInt(String(b.category).match(/\d+/) || [999]);
            if (numA !== numB) return numA - numB;
            return String(a.houseNo).localeCompare(String(b.houseNo), undefined, { numeric: true });
        });

        return filtered;
    }, [aggregatedTx, selectedCategory, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredTx.length / itemsPerPage));
    const currentTx = filteredTx.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage);

    //  3. สรุปผลรวมให้ตาราง
    const totals = React.useMemo(() => {
        let money = 0, carbon = 0, weight = 0;
        const wastes = {};
        wasteTypes.forEach(t => wastes[t] = 0); // ดัก Error toFixed
        filteredTx.forEach(tx => {
            money += tx.totalBalance;
            carbon += tx.totalCredit;
            wasteTypes.forEach(type => {
                const w = Number(tx.wasteData?.[type]) || 0;
                wastes[type] += w;
                weight += w;
            });
        });
        return { money, carbon, weight, wastes };
    }, [filteredTx]);

    const handleExportExcel = () => {
        const headers = ['อัปเดตล่าสุด', 'หมวดหมู่', 'บ้านเลขที่', 'ชื่อสมาชิก', ...wasteTypes, 'รวมน้ำหนัก (กก.)', 'ยอดเงิน (บาท)', 'คาร์บอน (kgCO2e)'];
        const dataRows = filteredTx.map(tx => {
            let rowWeight = 0;
            const wasteDataRow = wasteTypes.map(type => {
                const w = Number(tx.wasteData?.[type]) || 0;
                rowWeight += w;
                return w > 0 ? w : '';
            });

            return [
                tx.category, tx.houseNo, tx.personName, `${tx.latestDate} ${tx.latestTime}`,
                ...wasteDataRow,
                rowWeight.toFixed(2),
                tx.totalBalance.toFixed(2),
                tx.totalCredit.toFixed(4)
            ];
        });

        const totalRow = [
            'รวมยอดทั้งหมด (เดือนนี้)', '', '', '',
            ...wasteTypes.map(type => totals.wastes[type] > 0 ? totals.wastes[type].toFixed(2) : ''),
            totals.weight.toFixed(2),
            totals.money.toFixed(2),
            totals.carbon.toFixed(4)
        ];

        const rows = [headers, ...dataRows, totalRow];
        const csvContent = "\uFEFF" + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ประวัติฝากขยะรายเดือน_${selectedCategory}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    // 🌟 4. แก้ให้การลบข้อมูล ลบจากบิลดิบทั้งหมดที่แอบเก็บไว้
    const handleClearHistory = async () => {
        if (!confirm(`⚠️ ยืนยันการ "ล้างประวัติการฝาก" ของเดือนนี้ออกจากฐานข้อมูล?\n\n(แนะนำให้กดปุ่ม Export Excel เพื่อเก็บรายงานเข้าเครื่องคอมพิวเตอร์ไว้ก่อนลบข้อมูล)`)) return;

        try {
            for (const txGroup of filteredTx) {
                for (const rawId of txGroup.rawIds) {
                    await deleteDoc(doc(db, "waste_transactions", String(rawId)));
                }
            }
            alert("🗑️ ล้างประวัติของเดือนปัจจุบันออกจากระบบสำเร็จ");
            if (typeof refreshData === 'function') refreshData();
        } catch (error) {
            console.error("Error clearing DB:", error);
            alert("❌ เกิดข้อผิดพลาดในการลบข้อมูล");
        }
    };
    // 🌟 ดึงชื่อเดือนและปีปัจจุบันมาแสดงผล
    const now = new Date();
    const fullThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const currentMonthDisplay = `${fullThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
    return (
        <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col p-4">

            {/* Header ควบคุมและปุ่มคำสั่ง */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center shrink-0 flex-wrap gap-4">
                <div>
                    <h2 className="font-black text-2xl text-slate-800 tracking-tight">ตารางประวัติฝาก (เดือน{currentMonthDisplay})</h2>
                    <p className="text-sm text-slate-500 font-bold mt-1">แสดงประวัติการบันทึกขยะแยกตามรายรายการธุรกรรมจริง</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {setCurrentPage && <button onClick={() => setCurrentPage('admin')} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap">← ย้อนกลับ</button>}
                    {filteredTx.length > 0 && (
                        <>
                            <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition whitespace-nowrap flex items-center justify-center gap-2">
                                <Download size={16} /> Export CSV
                            </button>
                            <button onClick={handleClearHistory} className="bg-rose-50 text-rose-600 border border-rose-200 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-600 hover:text-white transition whitespace-nowrap flex items-center justify-center gap-2">
                                <Trash2 size={16} /> ล้างข้อมูลเดือนนี้
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* แถบตัวกรองการแสดงผลตาราง */}
            <div className="flex gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center shrink-0 flex-wrap">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-3 rounded-xl border border-slate-200 text-sm font-bold w-full sm:w-48 bg-slate-50 cursor-pointer outline-none">
                    <option value="all">ทุกหมวดหมู่</option>
                    {villages?.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
                <input placeholder="ค้นหาชื่อ หรือ บ้านเลขที่..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-3 rounded-xl border border-slate-200 text-sm flex-1 font-bold outline-none w-full" />
            </div>

            {/* โครงสร้างพื้นที่ตารางแสดงผลหลัก */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-slate-100 text-[11px] uppercase font-black text-slate-600 sticky top-0 z-20">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">หมวด / บ้าน / ชื่อ</th>
                                <th className="p-4 text-right">นน.รวม</th>
                                <th className="p-4 text-right">ยอดเงิน</th>
                                <th className="p-4 text-right">คาร์บอน</th>
                                {wasteTypes.map(t => <th key={t} className="p-4 text-center">{t}</th>)}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {currentTx.length > 0 ? currentTx.map((tx, i) => {
                                let rowWeight = 0;
                                wasteTypes.forEach(t => rowWeight += Number(tx.wasteData?.[t]) || 0);

                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4 sticky left-0 bg-white border-r border-slate-50 min-w-[240px] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                            <div className="font-black text-purple-700 text-[10px] bg-purple-50 w-fit px-2 py-0.5 rounded border border-purple-100 mb-1">{tx.category || 'ทั่วไป'}</div>
                                            <div className="font-black text-slate-800 text-base">บ้าน {tx.houseNo}</div>
                                            <div className="text-slate-600 text-sm mt-0.5 truncate max-w-[200px]">{tx.personName || 'ไม่ระบุชื่อ'}</div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1">🕒 {tx.date} {tx.time}</div>
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-700 bg-blue-50/30">
                                            {rowWeight > 0 ? rowWeight.toFixed(2) : '-'}
                                        </td>
                                        <td className="p-4 text-right font-black text-amber-700 bg-amber-50/30">{Number(tx.addedBalance) > 0 ? `฿${Number(tx.addedBalance).toFixed(2)}` : '-'}</td>
                                        <td className="p-4 text-right font-black text-emerald-700 bg-emerald-50/30">{Number(tx.creditAdded) > 0 ? `+${Number(tx.creditAdded).toFixed(4)}` : '-'}</td>
                                        {wasteTypes.map(t => (
                                            <td key={t} className={`p-4 text-center font-bold ${Number(tx.wasteData?.[t]) > 0 ? 'text-blue-700 bg-blue-50/50' : 'text-slate-300'}`}>
                                                {Number(tx.wasteData?.[t]) > 0 ? Number(tx.wasteData?.[t]).toFixed(2) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={wasteTypes.length + 4} className="py-20 text-center text-slate-400 font-bold bg-slate-50/50 text-base">
                                        ไม่พบข้อมูลประวัติฝากขยะในเดือนนี้
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {currentTx.length > 0 && (
                            <tfoot className="bg-slate-800 text-white font-black text-sm sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td className="p-4 sticky left-0 bg-slate-800 z-30">สรุปยอด (หมวดที่แสดง)</td>
                                    <td className="p-4 text-right text-blue-300">{totals.weight.toFixed(2)}</td>
                                    <td className="p-4 text-right text-amber-400">฿{totals.money.toFixed(2)}</td>
                                    <td className="p-4 text-right text-emerald-400">{totals.carbon.toFixed(4)}</td>
                                    {wasteTypes.map(t => (
                                        <td key={t} className={`p-4 text-center ${totals.wastes[t] > 0 ? 'text-white' : 'text-slate-500'}`}>
                                            {totals.wastes[t] > 0 ? totals.wastes[t].toFixed(2) : '-'}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {filteredTx.length > itemsPerPage && (
                    <div className="bg-white border-t border-slate-100 p-3 flex items-center justify-between shrink-0">
                        <span className="text-xs font-bold text-slate-400 ml-2 hidden sm:block">แสดงผล {currentTx.length} จาก {filteredTx.length} รายการ</span>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                            <button onClick={() => setTablePage(prev => Math.max(prev - 1, 1))} disabled={tablePage === 1} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors">◀ ก่อนหน้า</button>
                            <span className="font-black text-slate-600 text-xs px-3">หน้า {tablePage} / {totalPages}</span>
                            <button onClick={() => setTablePage(prev => Math.min(prev + 1, totalPages))} disabled={tablePage === totalPages} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors">ถัดไป ▶</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MemberSummaryView = ({ members, villages, setCurrentPage, globalPrices }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [tablePage, setTablePage] = useState(1);
    const itemsPerPage = 20;

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSelectedCategories, setExportSelectedCategories] = useState(['all']);

    const wasteTypes = React.useMemo(() => {
        return globalPrices && globalPrices.length > 0
            ? globalPrices.map(p => p.type)
            : [];
    }, [globalPrices]);

    // สั่งให้เด้งกลับไปหน้า 1 ทันทีเมื่อมีการเปลี่ยนหมวดหมู่ หรือพิมพ์ค้นหาชื่อ
    React.useEffect(() => {
        setTablePage(1);
    }, [selectedCategory, searchTerm]);

    const allAvailableCategories = React.useMemo(() => {
        return villages?.map(v => v.name) || [];
    }, [villages]);

    const flatMembers = React.useMemo(() => {
        let list = [];
        (members || []).forEach(house => {
            const cat = (house.category && house.category !== '0') ? String(house.category).trim() : 'ทั่วไป';
            (house.familyMembers || []).forEach(person => {
                list.push({
                    ...person,
                    houseNo: house.houseNo,
                    category: cat,
                    wasteData: person.wasteData || {}
                });
            });
        });
        return list;
    }, [members]);

    const filteredMembers = React.useMemo(() => {
        return flatMembers.filter(m => {
            const matchCategory = selectedCategory === 'all' || m.category === selectedCategory.trim();
            const matchSearch = String(m.houseNo).includes(searchTerm.trim()) || String(m.name || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
            return matchCategory && matchSearch;
        }).sort((a, b) => {
            const numA = parseInt(String(a.category).match(/\d+/) || [999]);
            const numB = parseInt(String(b.category).match(/\d+/) || [999]);
            if (numA !== numB) return numA - numB;
            return String(a.houseNo).localeCompare(String(b.houseNo), undefined, { numeric: true });
        });
    }, [flatMembers, selectedCategory, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
    const currentMembers = filteredMembers.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage);

    const totals = React.useMemo(() => {
        let money = 0, credit = 0, weight = 0;
        const wasteTotals = {};
        filteredMembers.forEach(m => {
            money += Number(m.balance || 0);
            credit += Number(m.credit || 0);
            wasteTypes.forEach(t => {
                const w = Number(m.wasteData?.[t] || 0);
                wasteTotals[t] = (wasteTotals[t] || 0) + w;
                weight += w;
            });
        });
        return { money, credit, weight, wasteTotals };
    }, [filteredMembers]);

    const handleExport = () => {
        const dataToExport = flatMembers.filter(m => {
            if (exportSelectedCategories.includes('all')) return true;
            return exportSelectedCategories.includes(m.category);
        }).sort((a, b) => {
            const numA = parseInt(String(a.category).match(/\d+/) || [999]);
            const numB = parseInt(String(b.category).match(/\d+/) || [999]);
            if (numA !== numB) return numA - numB;
            return String(a.houseNo).localeCompare(String(b.houseNo), undefined, { numeric: true });
        });

        if (dataToExport.length === 0) {
            alert("ไม่พบข้อมูลในหมวดหมู่ที่เลือก");
            return;
        }

        // 🌟 1. เพิ่ม 'สิทธิ์สวัสดิการ' เข้าไปในหัวตาราง
        const headers = ['หมวดหมู่', 'บ้านเลขที่', 'ชื่อสมาชิก', 'การคัดแยก', 'สิทธิ์สวัสดิการ', ...wasteTypes, 'นน.รวม', 'ยอดเงิน', 'คาร์บอน'];

        const rows = dataToExport.map(m => {
            let rowW = 0;
            const wCols = wasteTypes.map(t => {
                const v = Number(m.wasteData?.[t] || 0);
                rowW += v;
                return v;
            });

            return [
                m.category,
                `="${m.houseNo}"`, // 🌟 2. ใช้สูตร ="..." บังคับให้ Excel มองเป็นข้อความ ห้ามแปลงเป็นวันที่
                m.name,
                m.isSorted ? '✅ แยก' : '❌ ไม่แยก',
                m.hasWelfare ? '🎁 มี' : '❌ ไม่มี', // 🌟 3. ดึงข้อมูลสวัสดิการมาแสดงผล
                ...wCols,
                rowW.toFixed(2),
                m.balance,
                m.credit
            ];
        });

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `สรุปยอดสมาชิก_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();

        setShowExportModal(false);
    };
    const toggleExportCategory = (category) => {
        setExportSelectedCategories(prev => {
            if (category === 'all') return ['all'];
            let newSelection = prev.filter(c => c !== 'all');
            if (newSelection.includes(category)) {
                newSelection = newSelection.filter(c => c !== category);
            } else {
                newSelection.push(category);
            }
            if (newSelection.length === 0) return ['all'];
            return newSelection;
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col p-4 relative">

            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-lg text-slate-800">เลือกหมวดหมู่ที่ต้องการ Export</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">สามารถเลือกได้หลายหมวดหมู่พร้อมกัน</p>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 max-h-[50vh] overflow-y-auto flex flex-col gap-2">
                            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-slate-50">
                                <input type="checkbox" checked={exportSelectedCategories.includes('all')} onChange={() => toggleExportCategory('all')} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                                <span className="font-black text-slate-800 text-sm">ดาวน์โหลดทั้งหมดทุกหมวดหมู่</span>
                            </label>
                            <div className="h-px bg-slate-100 my-2"></div>
                            {allAvailableCategories.map(cat => (
                                <label key={cat} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-slate-50">
                                    <input type="checkbox" checked={exportSelectedCategories.includes(cat) && !exportSelectedCategories.includes('all')} onChange={() => toggleExportCategory(cat)} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="font-bold text-slate-700 text-sm">{cat}</span>
                                </label>
                            ))}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setShowExportModal(false)} className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 transition">ยกเลิก</button>
                            <button onClick={handleExport} className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-xl font-black text-sm hover:bg-emerald-700 transition shadow-[0_4px_10px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2">
                                <Download size={18} /> ยืนยันดาวน์โหลด
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center shrink-0 flex-wrap gap-4">
                <div>
                    <h2 className="font-black text-2xl text-slate-800">สรุปยอดสมาชิกปัจจุบัน</h2>
                    <p className="text-sm text-slate-500 font-bold mt-1">แสดงข้อมูลรายบุคคล - รองรับการ Export รายหมวด</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => setCurrentPage('admin')} className="flex-1 sm:flex-none bg-slate-100 text-slate-600 hover:bg-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap">← ย้อนกลับ</button>
                    <button onClick={() => setShowExportModal(true)} className="flex-1 sm:flex-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition whitespace-nowrap flex items-center justify-center gap-2">
                        <Download size={16} /> Export CSV
                    </button>
                </div>
            </div>

            <div className="flex gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center shrink-0 flex-wrap">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-3 rounded-xl border border-slate-200 text-sm font-bold w-full sm:w-48 bg-slate-50 cursor-pointer outline-none">
                    <option value="all">ทุกหมวดหมู่</option>
                    {villages?.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
                <input placeholder="ค้นหาชื่อ หรือ บ้านเลขที่..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-3 rounded-xl border border-slate-200 text-sm flex-1 font-bold outline-none w-full" />
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-slate-100 text-[11px] uppercase font-black text-slate-600 sticky top-0 z-20">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">หมวด / บ้าน / ชื่อ</th>
                                <th className="p-4 text-right">นน.รวม</th>
                                <th className="p-4 text-right">ยอดเงิน</th>
                                <th className="p-4 text-right">คาร์บอน</th>
                                {wasteTypes.map(t => <th key={t} className="p-4 text-center">{t}</th>)}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {currentMembers.length > 0 ? currentMembers.map((m, i) => (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4 sticky left-0 bg-white border-r border-slate-50 min-w-[240px] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                        <div className="font-black text-purple-700 text-[10px] bg-purple-50 w-fit px-2 py-0.5 rounded border border-purple-100 mb-1">{m.category}</div>
                                        <div className="font-black text-slate-800 text-base">บ้าน {m.houseNo}</div>
                                        <div className="text-slate-600 text-sm mt-0.5 truncate max-w-[200px]">{m.name}</div>
                                    </td>
                                    <td className="p-4 text-right font-black text-slate-700 bg-blue-50/30">
                                        {wasteTypes.reduce((acc, t) => acc + (Number(m.wasteData?.[t]) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-right font-black text-amber-700 bg-amber-50/30">฿{Number(m.balance).toFixed(2)}</td>
                                    <td className="p-4 text-right font-black text-emerald-700 bg-emerald-50/30">+{Number(m.credit).toFixed(4)}</td>
                                    {wasteTypes.map(t => (
                                        <td key={t} className={`p-4 text-center font-bold ${Number(m.wasteData?.[t]) > 0 ? 'text-blue-700 bg-blue-50/50' : 'text-slate-300'}`}>
                                            {Number(m.wasteData?.[t]) > 0 ? Number(m.wasteData?.[t]).toFixed(2) : '-'}
                                        </td>
                                    ))}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={wasteTypes.length + 4} className="py-20 text-center text-slate-400 font-bold bg-slate-50/50">
                                        ไม่พบข้อมูลสมาชิก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {currentMembers.length > 0 && (
                            <tfoot className="bg-slate-800 text-white font-black text-sm sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td className="p-4 sticky left-0 bg-slate-800 z-30">สรุปยอด (หมวดที่แสดง)</td>
                                    <td className="p-4 text-right text-blue-300">{totals.weight.toFixed(2)}</td>
                                    <td className="p-4 text-right text-amber-400">฿{totals.money.toFixed(2)}</td>
                                    <td className="p-4 text-right text-emerald-400">{totals.credit.toFixed(4)}</td>
                                    {wasteTypes.map(t => (
                                        <td key={t} className={`p-4 text-center ${totals.wasteTotals[t] > 0 ? 'text-white' : 'text-slate-500'}`}>
                                            {totals.wasteTotals[t] > 0 ? totals.wasteTotals[t].toFixed(2) : '-'}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {filteredMembers.length > itemsPerPage && (
                    <div className="bg-white border-t border-slate-100 p-3 flex items-center justify-between shrink-0">
                        <span className="text-xs font-bold text-slate-400 ml-2 hidden sm:block">แสดงผล {currentMembers.length} จาก {filteredMembers.length} รายการ</span>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                            <button onClick={() => setTablePage(prev => Math.max(prev - 1, 1))} disabled={tablePage === 1} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors">◀ ก่อนหน้า</button>
                            <span className="font-black text-slate-600 text-xs px-3">หน้า {tablePage} / {totalPages}</span>
                            <button onClick={() => setTablePage(prev => Math.min(prev + 1, totalPages))} disabled={tablePage === totalPages} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors">ถัดไป ▶</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ทำหน้าที่ตรวจสอบ Username และ Password เพื่อให้สิทธิ์ในการเข้าถึงระบบจัดการ (Admin Panel)
// === หน้าจอเข้าสู่ระบบสำหรับเจ้าหน้าที่ (LoginView) ===
// ทำหน้าที่ตรวจสอบ Email และ Password ผ่าน Firebase Auth ของจริง
const LoginView = ({ setIsLoggedIn, staffs, setCurrentUser, logAdminAction }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // ป้องกันแอดมินกดปุ่มรัวๆ

    // ฟังก์ชันตรวจสอบการเข้าสู่ระบบของจริง
    const handleLogin = async () => {
        if (!email || !password) {
            setError('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            // 🌟 1. ยิงตรวจสอบรหัสผ่านกับฐานข้อมูลรักษาความปลอดภัยระดับโลกของ Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 🌟 2. ลูกเล่นดึงชื่อแอดมินเดิม: ตัดคำหน้า @ มาเทียบกับ username ในระบบเก่า
            // เช่น "admin@umong.com" -> ตัดเหลือแค่ "admin" แล้วไปหาใน staffs
            const emailPrefix = email.split('@')[0];
            const foundStaff = staffs.find(s => s.email === email || s.username === emailPrefix);

            // ถ้าเจอในระบบเก่าให้ใช้ชื่อนั้น ถ้าไม่เจอให้ใช้ชื่อเริ่มต้น
            const adminProfile = foundStaff ? { ...foundStaff, email: user.email } : {
                name: 'เจ้าหน้าที่ (ผู้ดูแลระบบ)',
                email: user.email
            };

            // 🌟 3. บันทึกข้อมูลและอนุญาตให้เข้าใช้งาน
            setIsLoggedIn(true);
            localStorage.setItem('is_logged_in', 'true');
            setCurrentUser(adminProfile);
            localStorage.setItem('current_user', JSON.stringify(adminProfile));

            if (typeof logAdminAction === 'function') {
                logAdminAction(`เข้าสู่ระบบจัดการธนาคารขยะสำเร็จ`);
            }

        } catch (err) {
            console.error("Login Error:", err.code);
            // แปลงรหัส Error ฝรั่งให้เป็นภาษาไทยเข้าใจง่าย
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            } else if (err.code === 'auth/invalid-email') {
                setError('รูปแบบอีเมลไม่ถูกต้อง (เช่น admin@umong.com)');
            } else {
                setError('เข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง');
            }
        } finally {
            setIsLoading(false);
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
                <p className="text-slate-500 text-sm mt-1">เข้าสู่ระบบความปลอดภัย Firebase Auth</p>
            </div>

            {/* ส่วนกรอกข้อมูล */}
            <div className="space-y-4">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center font-bold border border-red-100">{error}</div>}

                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-600">อีเมลเจ้าหน้าที่</label>
                    <input
                        type="email"
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 focus:border-emerald-400 focus:bg-white outline-none transition-all font-medium text-slate-700"
                        placeholder="ตัวอย่าง: admin@umong.com"
                        value={email}
                        onKeyDown={(e) => {
                            if (e.key === ' ') e.preventDefault();
                            if (e.key === 'Enter') handleLogin();
                        }}
                        onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1 text-slate-600">รหัสผ่าน</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="w-full border-2 border-slate-100 rounded-xl pl-4 pr-12 py-3 bg-slate-50 focus:border-emerald-400 focus:bg-white outline-none transition-all font-medium text-slate-700"
                            placeholder="••••••••"
                            value={password}
                            onKeyDown={(e) => {
                                if (e.key === ' ') e.preventDefault();
                                if (e.key === 'Enter') handleLogin();
                            }}
                            onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
                        />
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
                        disabled={isLoading}
                        className={`w-full py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] ${isLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                        {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
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
    setIsPriceEditing, fetchHistoryData, fetchAdminLogsData, fetchSummaryData
}) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* กล่อง Header แอดมิน */}
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden border border-emerald-400/30">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/20">
                            <ShieldCheck className="text-emerald-50" size={24} />
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">ระบบจัดการธนาคารขยะ</h2>
                    </div>
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent my-4"></div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-100/80 mb-1">ผู้ใช้งานปัจจุบัน</p>
                            <p className="text-base sm:text-xl font-bold text-white">{currentUser ? currentUser.name : 'เจ้าหน้าที่'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] sm:text-xs font-bold text-emerald-100/80 mb-1 uppercase tracking-widest">สถานะระบบ</p>
                            <span className="inline-flex items-center gap-1.5 bg-white/20 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-white/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span> ONLINE
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ปุ่มเมนูการจัดการ 8 กล่อง */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <button onClick={() => { if (typeof setTempLocation === 'function') { setTempLocation(currentLocation); setIsAddMemberOpen(true); } }} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-blue-100 text-blue-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><MapPin className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ลงทะเบียนสมาชิก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ปักหมุดบ้านและบันทึกข้อมูลสมาชิกใหม่</p>
                </button>
                <button onClick={() => setCurrentPage('record_waste')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-emerald-100 text-emerald-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">บันทึกการทิ้งขยะ</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">บันทึกประเภท น้ำหนัก และเงินฝากเพิ่ม</p>
                </button>
                <button onClick={() => setCurrentPage('members')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-indigo-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-indigo-100 text-indigo-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><Users className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">จัดการรายชื่อสมาชิก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">เพิ่ม/ลบ หรือแก้ไขข้อมูลบ้านสมาชิก</p>
                </button>
                <button onClick={() => { setCurrentPage('prices'); if (typeof setIsPriceEditing === 'function') { setIsPriceEditing(true); } }} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-amber-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-amber-100 text-amber-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><Tags className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">แก้ไขราคารับซื้อ</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ปรับเปลี่ยนมูลค่าราคากลางรายเดือน</p>
                </button>
                <button onClick={() => setCurrentPage('manageBalance')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-rose-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-rose-100 text-rose-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><Wallet className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">จัดการยอดเงิน</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">แก้ไข หรือ หักเงินสมาชิกแบบกลุ่ม</p>
                </button>
                <button onClick={async () => {
                    await fetchHistoryData();
                    setCurrentPage('history');
                }} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-purple-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-purple-100 text-purple-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><History className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ตารางประวัติการฝาก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ดูสถิติและข้อมูลประจำเดือน</p>
                </button>
                <button onClick={async () => {
                    await fetchAdminLogsData();
                    setCurrentPage('admin_logs');
                }} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-slate-600 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-slate-100 text-slate-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0"><ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">ประวัติการทำงานเจ้าหน้าที่</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ตรวจสอบบันทึกการทำงานในระบบ</p>
                </button>
                <button
                    onClick={async () => {
                        await fetchSummaryData();
                    }}
                    className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-sky-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group"
                >
                    <div className="bg-sky-100 text-sky-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <LayoutList className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">สรุปยอดสมาชิก</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">ดูตารางยอดปัจจุบันแยกรายบุคคล</p>
                </button>
                <button onClick={() => setCurrentPage('import_excel')} className="bg-white p-4 sm:p-6 rounded-2xl border-2 border-transparent hover:border-cyan-500 transition-all shadow-sm flex flex-col items-center sm:items-start text-center sm:text-left group">
                    <div className="bg-cyan-100 text-cyan-600 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition shrink-0">
                        <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <h3 className="font-bold text-xs sm:text-lg text-slate-800">นำเข้าข้อมูล</h3>
                    <p className="text-sm text-slate-500 hidden sm:block mt-1">อัปโหลดรายชื่อจากไฟล์ CSV</p>
                </button>
            </div>

            {isAddMemberOpen && tempLocation && (
                <AddMemberModal lat={tempLocation.lat} lng={tempLocation.lng} villageData={villageData} onClose={() => setIsAddMemberOpen(false)}
                    onSave={async (newMem) => {
                        setMembers([...members, newMem]);
                        await setDoc(doc(db, "members", String(newMem.id)), newMem);
                        setIsAddMemberOpen(false); alert("📍 บันทึกข้อมูลสมาชิกสำเร็จ!");
                    }}
                />
            )}
        </div>
    );
};
// =========================================================================
// 📊 หน้าต่างแสดงรายละเอียดเชิงลึกของแต่ละหมวด (VillageDetailsModal)
// =========================================================================
const VillageDetailsModal = ({ village, onClose, villages, members }) => {
    if (!village) return null;
    const [searchTerm, setSearchTerm] = useState('');
    const latestVillage = villages?.find(v => Number(v.id) === Number(village?.id)) || village;

    const allPersonsInVillage = useMemo(() => {
        const persons = [];
        const vMembers = members ? members.filter(m => Number(m.villageId) === Number(latestVillage.id) || String(m.villageId) === String(latestVillage.id)) : [];

        vMembers.forEach(m => {
            (m.familyMembers || []).forEach((p, idx) => {
                const pName = typeof p === 'string' ? p : p?.name;
                if (pName && pName.trim() !== '') {
                    persons.push({
                        houseNo: m.houseNo,
                        personId: p.id || String(idx),
                        name: pName,
                        balance: Number(p.balance) || 0,
                        credit: Number(p.credit) || 0,
                        wasteData: p.wasteData || {},
                        hasWelfare: p.hasWelfare || false,
                        isSorted: p.isSorted || false
                    });
                }
            });
        });
        return persons.sort((a, b) => String(a.houseNo).localeCompare(String(b.houseNo)));
    }, [members, latestVillage.id]);

    const filteredPersons = allPersonsInVillage.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.houseNo).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const aggregatedWaste = allPersonsInVillage.reduce((acc, p) => {
        const data = p.wasteData || {};
        Object.keys(data).forEach(type => {
            acc[type] = (acc[type] || 0) + Number(data[type] || 0);
        });
        return acc;
    }, {});

    const totalVillageBalance = allPersonsInVillage.reduce((sum, p) => sum + p.balance, 0);
    const totalVillageCarbon = allPersonsInVillage.reduce((sum, p) => sum + p.credit, 0);
    const uniqueHousesCount = new Set(allPersonsInVillage.map(p => p.houseNo)).size;

    // 🌟 ดึงเฉพาะขยะที่มีน้ำหนักมากกว่า 0 มาแสดงผล
    const activeWasteTypes = Object.entries(aggregatedWaste).filter(([type, weight]) => Number(weight) > 0);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">

                <div className="p-6 bg-emerald-600 text-white flex justify-between items-center shrink-0 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
                        <TrendingUp size={120} className="-mt-4 -mr-4" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="font-black text-2xl drop-shadow-md">🏠 {latestVillage.name}</h3>
                        <p className="text-emerald-100 text-sm font-medium mt-1 flex items-center gap-2">
                            <Users size={14} /> สมาชิก: {allPersonsInVillage.length} คน (จาก {uniqueHousesCount} หลังคาเรือน)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition relative z-10 text-white"><X size={20} /></button>
                </div>

                <div className="p-6 sm:p-8 overflow-y-auto scrollbar-thin flex-1 bg-slate-50/50">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Database size={18} className="text-emerald-500" /> ปริมาณขยะสะสมในหมวดนี้ (กก.)
                        </h4>
                        {activeWasteTypes.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {activeWasteTypes.map(([type, weight]) => (
                                    <div key={type} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center hover:border-emerald-200 transition-all">
                                        <p className="text-[10px] text-slate-500 font-bold mb-1 truncate">{type}</p>
                                        <span className="text-lg font-black text-emerald-700">{Number(weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sm font-bold text-slate-400 py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">ยังไม่มีการนำฝากขยะในหมวดนี้</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-3xl border border-emerald-200/60 text-center shadow-sm">
                            <span className="font-bold text-emerald-600 text-xs mb-1 flex items-center justify-center gap-1.5"><Leaf size={14} /> คาร์บอนรวมของหมวด</span>
                            <span className="text-2xl font-black text-emerald-700 font-mono">{totalVillageCarbon.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase ml-1">kgCO2e</span>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-3xl border border-amber-200/60 text-center shadow-sm relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10"><Wallet size={80} className="text-amber-500" /></div>
                            <span className="font-bold text-amber-700 text-xs mb-1 flex items-center justify-center gap-1.5 relative z-10"><Wallet size={14} /> ยอดเงินออมรวมของหมวด</span>
                            <span className="text-3xl font-black text-amber-600 font-mono relative z-10">฿{totalVillageBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2"><Users size={16} className="text-slate-400" /> บัญชีรายชื่อบุคคล</h4>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                            <input type="text" placeholder="ค้นหาชื่อ หรือ บ้านเลขที่..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 w-full sm:w-56 shadow-sm" />
                        </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                        {filteredPersons.length > 0 ? (
                            filteredPersons.map((p, idx) => (
                                <div key={`${p.houseNo}-${p.personId}`} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-100 text-slate-500 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">🏠 บ้านเลขที่ {p.houseNo}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 self-end sm:self-auto border-t sm:border-0 pt-2 sm:pt-0 border-slate-50 w-full sm:w-auto">
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">🌱 {p.credit.toFixed(4)}</span>
                                        <span className="text-sm font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">฿{p.balance.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200"><p className="text-xs text-slate-400 font-bold">ไม่พบข้อมูลบุคคลที่ค้นหา</p></div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 text-center shrink-0">
                    <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition shadow-lg active:scale-[0.98]">ปิดหน้าต่างสถิติ</button>
                </div>
            </div>
        </div>
    );
};
// === หน้าจอรายการหมวดทั้ง 9 (VillagesView) ===
// แสดงการ์ดสรุปข้อมูลของแต่ละหมวด เช่น น้ำหนักขยะรวม, ค่าการลดคาร์บอน และยอดเงิน
const VillagesView = ({ villageData, members, setSelectedVillage, setCurrentPage, isLoggedIn, setEditingVillage }) => {
    // สูตรคำนวณคาร์บอน (Factor อ้างอิงจาก อบก.)
    const calculateCarbon = (wasteData) => {
        const FACTORS = {
            'พลาสติก': 1.0310,
            'กระดาษ': 5.6735,
            'แก้ว': 0.2760,
            'อลูมิเนียม': 9.1270,
            'โลหะผสม': 4.3910,
            'เหล็ก': 1.8320
        };
        return Object.entries(wasteData || {}).reduce((total, [type, weight]) => {
            return total + (Number(weight) * (FACTORS[type] || 0));
        }, 0);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {villageData.map((v) => {
                //  1. ดึงข้อมูลและคำนวณสดๆ จาก members ในระบบ ป้องกันค่าเพี้ยน 100%
                const vMembers = members ? members.filter(m => Number(m.villageId) === Number(v.id)) : [];

                let totalPersons = 0;
                let realTotalWaste = 0;
                let realTotalBalance = 0;
                const realWasteData = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 };

                vMembers.forEach(m => {
                    // นับจำนวนสมาชิกรายบุคคล
                    const validPersons = (m.familyMembers || []).filter(p => {
                        const name = typeof p === 'string' ? p : p?.name;
                        return name && name.trim() !== '';
                    });
                    totalPersons += validPersons.length;

                    // รวมยอดเงิน
                    realTotalBalance += (Number(m.balance) || 0);

                    // รวมน้ำหนักขยะแยกประเภท เพื่อเอาไปคิดคาร์บอน
                    Object.entries(m.wasteData || {}).forEach(([type, weight]) => {
                        const w = Number(weight) || 0;
                        if (realWasteData[type] !== undefined) {
                            realWasteData[type] += w;
                            realTotalWaste += w;
                        }
                    });
                });

                const carbonReduced = calculateCarbon(realWasteData);

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
                            {/* ฝั่งซ้าย: ชื่อหมวด + ปุ่มแก้ไข และ คำโปรย */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-2xl text-slate-800">{v.name}</h3>
                                    {isLoggedIn && (
                                        <button
                                            onClick={() => setEditingVillage(v)}
                                            className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">หมู่ 6 ต.อุโมงค์</p>
                            </div>

                            {/* ป้าย ECO ACTIVE  */}
                            <div className="bg-emerald-50 text-emerald-600 text-[10px] px-3 py-1.5 rounded-full font-black flex items-center gap-1.5 border border-emerald-100 shrink-0">
                                <Leaf size={12} /> ECO ACTIVE
                            </div>
                        </div>

                        {/* ส่วนข้อมูล (Data Rows) */}
                        <div className="space-y-4 mb-6 relative z-10 flex-grow text-sm">

                            {/* 1. น้ำหนักขยะรวม */}
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="font-bold text-slate-500">น้ำหนักขยะรวม:</span>
                                <div className="text-right">
                                    <span className="font-black text-slate-700 text-lg">{realTotalWaste.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    <span className="text-xs font-bold text-slate-400 ml-1">กก.</span>
                                </div>
                            </div>

                            {/*  2. จำนวนสมาชิก (แทรกแถวใหม่ตามที่ต้องการ) */}
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="font-bold text-blue-500 flex items-center gap-1.5">
                                    <Users size={14} /> จำนวนสมาชิก:
                                </span>
                                <div className="text-right">
                                    <span className="font-black text-blue-600 text-lg">{totalPersons.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-blue-400 ml-1">คน</span>
                                </div>
                            </div>

                            {/* 3. ลดคาร์บอนได้ */}
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

                            {/* 4. ยอดเงินรวม */}
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-bold text-amber-600 flex items-center gap-1.5">
                                    <Wallet size={14} /> ยอดเงินรวม:
                                </span>
                                <div className="text-right flex items-center gap-1.5">
                                    <span className="font-black text-amber-500 text-lg">
                                        {realTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="bg-amber-100 text-amber-600 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                                        ฿
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ส่วนปุ่มกดด้านล่าง */}
                        <div className="flex flex-col gap-2 relative z-10 mt-auto">
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

// =========================================================================
// 📝 หน้าต่างแก้ไขข้อมูลหมวด (EditVillageModal) โฉมใหม่ (แก้เฉพาะชื่อ)
// =========================================================================
const EditVillageModal = ({ village, onClose, onSave }) => {
    const [editName, setEditName] = useState(village.name);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800">แก้ไขข้อมูลหมวด</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400"><X size={20} /></button>
                </div>
                <div className="p-6">
                    <label className="block text-xs font-bold text-emerald-600 mb-2 uppercase tracking-wide">ชื่อหมู่บ้าน / ชุมชน</label>
                    <input
                        type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base font-bold focus:border-emerald-500 outline-none transition-all shadow-sm mb-4"
                    />
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-[11px] text-amber-700 font-medium mb-6">
                        💡 หมายเหตุ: น้ำหนักขยะ ยอดเงิน และคาร์บอนของหมวด จะถูกระบบคำนวณ "อัตโนมัติ" จากสมาชิกลูกบ้านทั้งหมดในหมวดนี้ เพื่อป้องกันข้อมูลคลาดเคลื่อน แอดมินจึงไม่สามารถแก้ไขตัวเลขขยะรวมจากหน้านี้ได้
                    </div>
                    <button onClick={() => onSave({ ...village, name: editName })} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-colors">💾 บันทึกการแก้ไข</button>
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// 📍 หน้าลงทะเบียนครัวเรือนใหม่ (AddMemberModal) - True Full Page UX/UI
// =========================================================================
const AddMemberModal = ({ initialLat, initialLng, villageData, onSave, onClose, globalPrices }) => {
    const [newMember, setNewMember] = useState({
        id: Date.now(),
        houseNo: '',
        villageId: villageData[0]?.id || 1,
        category: villageData[0]?.name || 'หมวดที่ 1',
        familyMembers: [{
            id: Date.now().toString(),
            name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false
        }],
        lat: initialLat,
        lng: initialLng
    });

    const [expandedWasteIndex, setExpandedWasteIndex] = useState(null);
    const [selectedWasteId, setSelectedWasteId] = useState(globalPrices && globalPrices.length > 0 ? globalPrices[0].id : '');
    const [inputWeight, setInputWeight] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const CARBON_MULTIPLIERS = { 'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910, 'เหล็ก': 1.8320 };

    const addMemberField = () => setNewMember({ ...newMember, familyMembers: [...newMember.familyMembers, { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }] });
    const updateMemberField = (index, field, value) => { const updatedFamily = [...newMember.familyMembers]; updatedFamily[index] = { ...updatedFamily[index], [field]: value }; setNewMember({ ...newMember, familyMembers: updatedFamily }); };
    const removeMemberField = (index) => { const updatedFamily = newMember.familyMembers.filter((_, i) => i !== index); setNewMember({ ...newMember, familyMembers: updatedFamily.length > 0 ? updatedFamily : [{ id: Date.now().toString(), name: '', balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }] }); };

    const handleAddInitialWaste = (personIndex) => {
        if (!selectedWasteId || !inputWeight || Number(inputWeight) <= 0) return alert("⚠️ กรุณาระบุน้ำหนักให้ถูกต้อง");
        const wasteInfo = globalPrices.find(p => String(p.id) === String(selectedWasteId));
        if (!wasteInfo) return;

        const weight = Number(inputWeight);
        const updatedFamily = [...newMember.familyMembers];
        const person = updatedFamily[personIndex];

        person.wasteData = { ...(person.wasteData || {}), [wasteInfo.type]: (Number(person.wasteData[wasteInfo.type]) || 0) + weight };
        person.balance = (Number(person.balance) || 0) + (weight * Number(wasteInfo.price));
        person.credit = (Number(person.credit) || 0) + (weight * (CARBON_MULTIPLIERS[wasteInfo.type] || 0));
        person.isSorted = true;

        setNewMember({ ...newMember, familyMembers: updatedFamily }); setInputWeight('');
    };

    const handleRemoveWasteItem = (personIndex, typeToRemove) => {
        const updatedFamily = [...newMember.familyMembers];
        const person = updatedFamily[personIndex];
        const wasteInfo = globalPrices.find(p => p.type === typeToRemove);
        const weightToRemove = Number(person.wasteData[typeToRemove]) || 0;

        if (wasteInfo) {
            person.balance = Math.max(0, (Number(person.balance) || 0) - (weightToRemove * Number(wasteInfo.price)));
            person.credit = Math.max(0, (Number(person.credit) || 0) - (weightToRemove * (CARBON_MULTIPLIERS[wasteInfo.type] || 0)));
        }

        const newWasteData = { ...person.wasteData }; delete newWasteData[typeToRemove];
        person.wasteData = newWasteData; setNewMember({ ...newMember, familyMembers: updatedFamily });
    };
    // 🌟 1. สร้างตู้เซฟเก็บตัวแปรแผนที่
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    // 🌟 2. ฟังก์ชันดึงพิกัดแบบ React สไตล์
    const handleFindLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;

                // 2.1 อัปเดตพิกัดลงตัวแปรหลัก
                setNewMember(prev => ({ ...prev, lat: latitude, lng: longitude }));

                // 2.2 สั่งเลื่อนแผนที่และหมุด (โดยเรียกใช้จากตู้เซฟ useRef)
                if (mapRef.current && markerRef.current) {
                    mapRef.current.setView([latitude, longitude], 17);
                    markerRef.current.setLatLng([latitude, longitude]);
                }
            });
        } else {
            alert("อุปกรณ์ของคุณไม่รองรับการระบุพิกัด GPS");
        }
    };
    useEffect(() => {
        const L = window.L;
        const container = document.getElementById('add-member-map');
        if (!L || !container) return;
        if (container._leaflet_id) { container._leaflet_id = null; }

        const miniMap = L.map('add-member-map').setView([newMember.lat, newMember.lng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(miniMap);
        const marker = L.marker([newMember.lat, newMember.lng], { draggable: true }).addTo(miniMap);
        marker.bindPopup("<b>🏠 ตำแหน่งบ้าน</b><br>ลากหมุดเพื่อปรับพิกัด").openPopup();

        marker.on('dragend', () => {
            const position = marker.getLatLng();
            setNewMember(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
        });

        // 🌟 3. ฝากตัวแปรแผนที่ลงตู้เซฟ เพื่อให้ฟังก์ชันอื่นดึงไปใช้ได้
        mapRef.current = miniMap;
        markerRef.current = marker;

        const timeout = setTimeout(() => miniMap.invalidateSize(), 300);
        return () => { clearTimeout(timeout); miniMap.remove(); };
    }, []);

    const totalHouseBalance = newMember.familyMembers.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
    const totalHouseCredit = newMember.familyMembers.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);

    const handlePreSave = () => {
        if (!newMember.houseNo.trim()) return alert("❌ กรุณากรอกบ้านเลขที่");
        if (!newMember.familyMembers[0].name.trim()) return alert("❌ กรุณากรอกชื่อสมาชิกอย่างน้อย 1 คน");
        setShowConfirm(true);
    };

    const executeSave = () => {
        const aggregatedWaste = {};
        let finalHouseIsSorted = false;
        newMember.familyMembers.forEach(p => {
            if (p.isSorted) finalHouseIsSorted = true;
            Object.entries(p.wasteData || {}).forEach(([type, weight]) => { aggregatedWaste[type] = (aggregatedWaste[type] || 0) + (Number(weight) || 0); });
        });
        onSave({ ...newMember, balance: totalHouseBalance, credit: totalHouseCredit, isSorted: finalHouseIsSorted, wasteData: aggregatedWaste });
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            {/* 🌟 1. Sticky Header */}
            <header className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0 z-50">
                <div>
                    <h3 className="font-black text-xl flex items-center gap-2"><UserPlus size={24} /> ลงทะเบียนครัวเรือนใหม่</h3>
                    <p className="text-sm text-blue-200 mt-0.5 opacity-90 hidden sm:block">บันทึกข้อมูลที่ตั้งและสมาชิกภายในบ้าน</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition bg-white/10 flex items-center gap-2 font-bold text-sm">
                    <X size={20} /> <span className="hidden sm:inline">ปิด</span>
                </button>
            </header>

            {/* 🌟 2. Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* คอลัมน์ซ้าย: ข้อมูลบ้าน & แผนที่ */}
                    <div className="w-full lg:w-[35%] flex flex-col gap-6">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2"><MapPin className="text-blue-500" /> ข้อมูลครัวเรือน</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1.5 text-slate-600">🏠 บ้านเลขที่</label>
                                    <input type="text" className="w-full border-2 border-slate-100 p-3.5 rounded-xl outline-none bg-slate-50 font-black text-slate-800 focus:border-blue-500 focus:bg-white transition text-lg" value={newMember.houseNo} onChange={e => setNewMember({ ...newMember, houseNo: e.target.value })} placeholder="เช่น 123/4" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1.5 text-slate-600">📂 หมวดที่สังกัด</label>
                                    <select className="w-full border-2 border-slate-100 p-3.5 rounded-xl outline-none bg-slate-50 font-bold text-slate-800 focus:border-blue-500 cursor-pointer transition text-base" value={newMember.villageId} onChange={e => {
                                        const v = villageData.find(item => item.id === parseInt(e.target.value));
                                        if (v) setNewMember({ ...newMember, villageId: v.id, category: v.name });
                                    }}>
                                        {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold text-slate-700">🗺️ พิกัดบ้าน (ลากหมุดได้)</label>
                                <button type="button" onClick={handleFindLocation} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1 transition">
                                    <Navigation size={14} /> ดึงพิกัด
                                </button>
                            </div>
                            <div id="add-member-map" className="h-48 sm:h-64 w-full rounded-2xl border-2 border-slate-100 z-0 overflow-hidden"></div>
                        </div>
                    </div>

                    {/* คอลัมน์ขวา: รายชื่อบุคคล */}
                    <div className="w-full lg:w-[65%] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">👥 ข้อมูลบุคคลภายในบ้าน</h4>
                            <button type="button" onClick={addMemberField} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 flex items-center gap-2 transition shadow-md">
                                <PlusCircle size={16} /> <span className="hidden sm:inline">เพิ่มบุคคล</span>
                            </button>
                        </div>

                        <div className="space-y-4 pb-10">
                            {newMember.familyMembers.map((person, index) => (
                                <div key={person.id} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-400 transition-colors flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="flex items-center gap-3 w-full sm:w-1/2">
                                            <span className="bg-slate-100 text-slate-500 w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0">{index + 1}</span>
                                            <input type="text" placeholder="ชื่อ-นามสกุล" value={person.name} onChange={(e) => updateMemberField(index, 'name', e.target.value)} className="w-full border-b-2 border-slate-200 px-2 py-2 outline-none font-bold text-slate-800 focus:border-blue-500 transition bg-transparent text-lg" />
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-1/2 justify-end">
                                            <div className="relative w-full">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    placeholder="0"
                                                    value={person.balance ?? ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        updateMemberField(index, 'balance', Math.max(0, val));
                                                    }} className="w-full border-2 border-slate-100 pl-10 pr-4 py-2.5 rounded-xl outline-none font-black text-amber-600 focus:border-amber-400 bg-slate-50 transition text-right text-lg" />
                                            </div>
                                            {newMember.familyMembers.length > 1 && (
                                                <button type="button" onClick={() => removeMemberField(index)} className="p-3 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition shrink-0 bg-slate-50">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => updateMemberField(index, 'isSorted', !person.isSorted)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${person.isSorted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {person.isSorted ? '✅ คัดแยกขยะแล้ว' : '⚪ ไม่คัดแยก'}
                                        </button>
                                        <button type="button" onClick={() => updateMemberField(index, 'hasWelfare', !person.hasWelfare)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${person.hasWelfare ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {person.hasWelfare ? '🎁 มีสวัสดิการ' : '❌ ไม่มีสิทธิ'}
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden mt-2">
                                        <button type="button" onClick={() => { setExpandedWasteIndex(expandedWasteIndex === index ? null : index); setSelectedWasteId(globalPrices?.[0]?.id || ''); setInputWeight(''); }} className="w-full p-3.5 text-sm font-bold text-slate-600 flex justify-between items-center hover:bg-slate-100 transition">
                                            <div className="flex items-center gap-2"><PackageOpen size={18} className="text-blue-500" /> ระบุขยะตั้งต้น (เพื่อให้ระบบคิดเงินอัตโนมัติ)</div>
                                            <span className="bg-white px-2 py-1 rounded-md shadow-sm text-xs border border-slate-200">{expandedWasteIndex === index ? 'ปิด ▲' : 'เปิด ▼'}</span>
                                        </button>

                                        {expandedWasteIndex === index && (
                                            <div className="p-4 bg-white border-t border-slate-200">
                                                <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                                    <select value={selectedWasteId} onChange={e => setSelectedWasteId(e.target.value)} className="w-full sm:flex-1 bg-white border border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none">
                                                        <option value="" disabled>-- เลือกขยะ --</option>
                                                        {globalPrices && globalPrices.map(p => <option key={p.id} value={p.id}>{p.type} (฿{p.price})</option>)}
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <div className="relative w-full sm:w-28">
                                                            <input type="number" step="any" placeholder="น้ำหนัก" value={inputWeight} onChange={e => setInputWeight(e.target.value)} className="w-full bg-white border border-slate-200 pl-3 pr-8 py-2.5 rounded-lg text-sm font-black text-slate-700 outline-none text-right" />
                                                            <span className="absolute right-3 top-3 text-[10px] text-slate-400 font-bold">กก.</span>
                                                        </div>
                                                        <button type="button" onClick={() => handleAddInitialWaste(index)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm transition shrink-0">เพิ่ม</button>
                                                    </div>
                                                </div>

                                                {Object.keys(person.wasteData || {}).length > 0 ? (
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                        <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">ขยะที่ระบุแล้ว</div>
                                                        <div className="divide-y divide-slate-100">
                                                            {Object.entries(person.wasteData).map(([wType, wWeight]) => (
                                                                <div key={wType} className="px-4 py-2.5 flex justify-between items-center text-sm">
                                                                    <span className="font-bold text-slate-700">{wType} <span className="text-slate-400">({wWeight} กก.)</span></span>
                                                                    <button type="button" onClick={() => handleRemoveWasteItem(index, wType)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md transition"><Trash2 size={16} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : <p className="text-center text-xs font-bold text-slate-400 py-2">ยังไม่มีรายการขยะตั้งต้น</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* 🌟 3. Sticky Footer */}
            <footer className="bg-white border-t border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex gap-4 items-center w-full sm:w-auto bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <div>
                        <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">เงินสะสมรวมทั้งบ้าน</span>
                        <span className="text-3xl font-black text-amber-600 font-mono">฿{totalHouseBalance.toLocaleString()}</span>
                    </div>
                    <div className="h-12 w-px bg-slate-200"></div>
                    <div>
                        <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">คาร์บอนเครดิต</span>
                        <span className="text-3xl font-black text-emerald-600 font-mono">{totalHouseCredit.toFixed(4)}</span>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-3.5 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition">ยกเลิก</button>
                    <button type="button" onClick={handlePreSave} className="flex-[2] sm:flex-none px-10 py-3.5 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 transition flex justify-center items-center gap-2">
                        <Save size={20} /> บันทึกข้อมูล
                    </button>
                </div>
            </footer>
            {/* ป๊อปอัพยืนยันก่อนบันทึก */}
            {showConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><Save size={32} /></div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">ยืนยันการลงทะเบียน?</h3>
                        <p className="text-sm text-slate-500 mb-6">ตรวจสอบความถูกต้องก่อนบันทึกข้อมูลเข้าสู่ระบบ</p>

                        <div className="w-full bg-slate-50 rounded-2xl p-4 space-y-3 mb-6 border border-slate-100 text-left">
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">บ้านเลขที่</span><span className="text-sm font-black text-slate-700">{newMember.houseNo}</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">หมวดหมู่</span><span className="text-sm font-bold text-slate-700">{newMember.category}</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">สมาชิก</span><span className="text-sm font-black text-blue-600">{newMember.familyMembers.length} คน</span></div>
                            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs font-bold text-slate-400">เงินตั้งต้น</span><span className="text-sm font-black text-amber-600">฿{totalHouseBalance.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-xs font-bold text-slate-400">คาร์บอน</span><span className="text-sm font-black text-emerald-600">{totalHouseCredit.toFixed(4)}</span></div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">กลับไปแก้ไข</button>
                            <button onClick={executeSave} className="flex-[2] py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md transition">✅ ยืนยันบันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// =========================================================================
// ♻️ หน้าต่างบันทึกการทิ้งขยะประจำวัน โฉมใหม่ (ระบบตะกร้าสินค้า + คำนวณเงินออโต้)
// =========================================================================
const RecordWasteView = ({ members, villages, setMembers, setVillages, db, logAdminAction, setCurrentPage, refreshData, currentUser, globalPrices }) => {
    const [selectedVillageId, setSelectedVillageId] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPageNum, setCurrentPageNum] = useState(1);
    const itemsPerPage = 10;

    const [activePersonKey, setActivePersonKey] = useState(null);

    // 🌟 1. State สำหรับระบบตะกร้าสินค้า
    const [selectedWasteId, setSelectedWasteId] = useState(globalPrices && globalPrices.length > 0 ? globalPrices[0].id : '');
    const [inputWeight, setInputWeight] = useState('');
    const [currentBasket, setCurrentBasket] = useState([]);

    // ค่าคาร์บอน (เฉพาะ 6 ประเภทเดิมที่มีผล)
    const CARBON_MULTIPLIERS = {
        'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760, 'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910, 'เหล็ก': 1.8320
    };

    // 🌟 2. สรุปยอดเงินและคาร์บอนอัตโนมัติจากตะกร้า
    const currentTurnMoney = useMemo(() => currentBasket.reduce((sum, item) => sum + item.totalMoney, 0), [currentBasket]);
    const currentTurnCarbon = useMemo(() => currentBasket.reduce((sum, item) => sum + item.totalCarbon, 0), [currentBasket]);

    const filteredMembers = useMemo(() => {
        let result = members;
        if (selectedVillageId !== 'all') {
            result = result.filter(m =>
                // 🌟 ดักจับให้เทียบได้ทั้งเลข ไอดีอักษร และชื่อหมวดหมู่ ป้องกันบั๊กหาไม่เจอ
                Number(m.villageId) === Number(selectedVillageId) ||
                String(m.villageId).trim() === String(selectedVillageId).trim() ||
                String(m.category).trim() === String(selectedVillageId).trim()
            );
        }
        if (searchTerm.trim() !== '') {
            result = result.filter(m => String(m.houseNo).includes(searchTerm.trim()));
        }
        return result;
    }, [members, selectedVillageId, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
    const currentMembers = filteredMembers.slice((currentPageNum - 1) * itemsPerPage, currentPageNum * itemsPerPage);

    useEffect(() => {
        setCurrentPageNum(1);
        setActivePersonKey(null);
        setCurrentBasket([]); // ล้างตะกร้าเมื่อเปลี่ยนหน้า
    }, [selectedVillageId, searchTerm]);

    // 🌟 3. ฟังก์ชันเพิ่มขยะลงตะกร้า
    const handleAddToBasket = () => {
        if (!selectedWasteId || !inputWeight || Number(inputWeight) <= 0) {
            return alert("⚠️ กรุณาระบุน้ำหนักให้ถูกต้อง (มากกว่า 0)");
        }

        const wasteInfo = globalPrices.find(p => String(p.id) === String(selectedWasteId));
        if (!wasteInfo) return;

        const weight = Number(inputWeight);
        const money = weight * Number(wasteInfo.price);
        const carbonMultiplier = CARBON_MULTIPLIERS[wasteInfo.type] || 0; // ถ้าเป็นขยะใหม่จะได้ 0 อัตโนมัติ
        const carbon = weight * carbonMultiplier;

        setCurrentBasket(prev => [...prev, {
            rowId: Date.now(), // รหัสอ้างอิงในตะกร้า
            wasteId: wasteInfo.id,
            type: wasteInfo.type,
            weight: weight,
            pricePerKg: wasteInfo.price,
            totalMoney: money,
            totalCarbon: carbon
        }]);

        setInputWeight(''); // ล้างช่องน้ำหนักหลังกดเพิ่ม
    };

    // 🌟 4. ฟังก์ชันลบขยะออกจากตะกร้า
    const handleRemoveFromBasket = (rowId) => {
        setCurrentBasket(prev => prev.filter(item => item.rowId !== rowId));
    };

    // 💾 ฟังก์ชันบันทึกข้อมูล
    const handleSaveWaste = async (houseMember, personId, personName) => {
        if (currentBasket.length === 0) {
            return alert("❌ กรุณาเพิ่มรายการขยะลงตะกร้าก่อนกดยืนยันบันทึก");
        }

        try {
            // รวมขยะจากตะกร้าให้เป็นก้อนเดียวกัน (เผื่อใส่พลาสติกซ้ำ 2 รอบ)
            const basketSummary = {};
            currentBasket.forEach(item => {
                basketSummary[item.type] = (basketSummary[item.type] || 0) + item.weight;
            });

            const finalBalanceToAdd = currentTurnMoney;
            const finalCreditToAdd = Number(currentTurnCarbon.toFixed(4));

            // 1. อัปเดตข้อมูลรายบุคคล
            const updatedFamily = (houseMember.familyMembers || []).map((p, idx) => {
                const pId = p.id || String(idx);
                if (String(pId) === String(personId)) {
                    const pObj = typeof p === 'string'
                        ? { id: pId, name: p, balance: 0, credit: 0, wasteData: {}, hasWelfare: false, isSorted: false }
                        : { ...p };

                    pObj.balance = (Number(pObj.balance) || 0) + finalBalanceToAdd;
                    pObj.credit = (Number(pObj.credit) || 0) + finalCreditToAdd;
                    pObj.isSorted = true;

                    const pWaste = { ...(pObj.wasteData || {}) };
                    Object.keys(basketSummary).forEach(type => {
                        pWaste[type] = (Number(pWaste[type]) || 0) + basketSummary[type];
                    });
                    pObj.wasteData = pWaste;
                    return pObj;
                }
                return p;
            });

            // 2. อัปเดตข้อมูลรวมระดับบ้าน (รวมขยะแบบไดนามิก รองรับขยะไม่อั้น)
            const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
            const newHouseCredit = updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);
            const aggregatedWaste = {};
            updatedFamily.forEach(person => {
                Object.entries(person.wasteData || {}).forEach(([type, weight]) => {
                    aggregatedWaste[type] = (aggregatedWaste[type] || 0) + (Number(weight) || 0);
                });
            });

            const updatedMemberObj = {
                ...houseMember,
                wasteData: aggregatedWaste,
                familyMembers: updatedFamily,
                credit: newHouseCredit,
                balance: newHouseBalance,
                isSorted: true
            };

            // 3. เซฟขึ้น Cloud (Members)
            await setDoc(doc(db, "members", String(houseMember.id)), updatedMemberObj);

            // 4. บันทึกประวัติ (Transactions)
            const now = new Date();
            const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const newTx = {
                houseNo: houseMember.houseNo,
                personName: personName,
                villageId: houseMember.villageId,
                category: houseMember.category,
                wasteData: basketSummary, // เก็บเฉพาะขยะที่ฝากในรอบนี้
                creditAdded: finalCreditToAdd,
                addedBalance: finalBalanceToAdd,
                date: `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`,
                time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`,
                operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
                timestamp: serverTimestamp()
            };
            await addDoc(collection(db, "waste_transactions"), newTx);

            // 6. รีเฟรชหน้าจอ
            setActivePersonKey(null);
            setCurrentBasket([]);
            if (typeof refreshData === 'function') await refreshData();

            alert(`✅ บันทึกรายการฝากของ ${personName} เรียบร้อย! (+฿${finalBalanceToAdd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`);

        } catch (err) {
            console.error(err);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-emerald-800 flex items-center gap-2">
                        <PlusCircle className="text-emerald-500" /> บันทึกรับฝากขยะและเงิน
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">เลือกลูกบ้านและเพิ่มขยะลงตะกร้า ระบบจะคำนวณเงินออโต้</p>
                </div>
                <button onClick={() => setCurrentPage('admin')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm">
                    ← ย้อนกลับ
                </button>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 flex items-center px-3 gap-2">
                    <span className="text-sm font-bold text-slate-500 hidden sm:block">📂 หมวด:</span>
                    <select value={selectedVillageId} onChange={(e) => setSelectedVillageId(e.target.value)} className="bg-slate-50 border px-3 py-2 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 flex-1 cursor-pointer">
                        <option value="all">-- ทุกหมวดหมู่ --</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex-1 flex items-center px-3">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <input type="text" placeholder="ค้นหาบ้านเลขที่..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-sm font-bold outline-none w-full bg-transparent" />
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="divide-y divide-slate-50 flex-grow">
                    {currentMembers.length > 0 ? currentMembers.map(m => (
                        <div key={m.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 md:items-start border-b">
                            {/* ฝั่งซ้าย: บ้านเลขที่ */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-blue-50 text-blue-700 font-black px-3 py-1 rounded-lg text-sm border border-blue-100">🏠 บ้านเลขที่ {m.houseNo}</span>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold">{m.category}</span>
                                </div>
                            </div>

                            {/* ฝั่งขวา: รายชื่อคนในบ้าน */}
                            <div className="w-full md:w-2/3 flex flex-col gap-2 border-l-0 md:border-l border-slate-100 md:pl-4">
                                {(m.familyMembers || []).map((person, idx) => {
                                    const pId = person.id || String(idx);
                                    const pName = typeof person === 'string' ? person : person?.name;
                                    if (!pName) return null;
                                    const isEditing = activePersonKey === `${m.id}|${pId}`;

                                    return (
                                        <div key={pId} className={`border rounded-2xl overflow-hidden transition-all ${isEditing ? 'border-emerald-300 shadow-md ring-2 ring-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                                            {/* แถบรายชื่อ (กดเพื่อเปิดปิดฟอร์ม) */}
                                            <div onClick={() => {
                                                setActivePersonKey(isEditing ? null : `${m.id}|${pId}`);
                                                setCurrentBasket([]); // ล้างตะกร้าใหม่เสมอ
                                            }} className="p-3 sm:p-4 flex items-center justify-between cursor-pointer select-none group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">{idx + 1}</div>
                                                    <span className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{pName}</span>
                                                </div>
                                                <button className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors border ${isEditing ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                    {isEditing ? 'ยกเลิก' : '+ ฝากขยะให้คนนี้'}
                                                </button>
                                            </div>

                                            {/* 🌟 ฟอร์มตะกร้าสินค้า (เปิดเมื่อคลิกรายชื่อ) */}
                                            {isEditing && (
                                                <div className="bg-slate-50 p-4 sm:p-5 border-t border-emerald-100 animate-in slide-in-from-top-2 duration-200">

                                                    {/* ส่วนที่ 1: แผงควบคุมเพิ่มขยะ */}
                                                    <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                        <select
                                                            value={selectedWasteId}
                                                            onChange={e => setSelectedWasteId(e.target.value)}
                                                            className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
                                                        >
                                                            <option value="" disabled>-- เลือกประเภทขยะ --</option>
                                                            {globalPrices && globalPrices.map(p => (
                                                                <option key={p.id} value={p.id}>{p.type} (฿{p.price}/กก.)</option>
                                                            ))}
                                                        </select>

                                                        <div className="relative w-full sm:w-32">
                                                            <input
                                                                type="number" min="0" step="any" placeholder="น้ำหนัก"
                                                                value={inputWeight}
                                                                onChange={e => setInputWeight(e.target.value)}
                                                                className="w-full bg-slate-50 border border-slate-200 pl-3 pr-8 py-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 text-right"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleAddToBasket()}
                                                            />
                                                            <span className="absolute right-2 top-3 text-[10px] text-slate-400 font-bold">กก.</span>
                                                        </div>

                                                        <button
                                                            onClick={handleAddToBasket}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
                                                        >
                                                            <PlusCircle size={16} /> เพิ่มลงตะกร้า
                                                        </button>
                                                    </div>

                                                    {/* ส่วนที่ 2: รายการในตะกร้า */}
                                                    {currentBasket.length > 0 && (
                                                        <div className="mb-4 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                                            <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between">
                                                                <span>รายการขยะในตะกร้า</span>
                                                                <span>ยอดเงิน</span>
                                                            </div>
                                                            <div className="divide-y divide-slate-100">
                                                                {currentBasket.map((item, index) => (
                                                                    <div key={item.rowId} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-slate-800 text-sm">{index + 1}. {item.type}</span>
                                                                            <span className="text-[11px] text-slate-500 font-medium">{item.weight} กก. × ฿{item.pricePerKg}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="font-black text-amber-600">฿{item.totalMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                            <button onClick={() => handleRemoveFromBasket(item.rowId)} className="text-slate-300 hover:text-red-500 transition">
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ส่วนที่ 3: สรุปยอดเงินและปุ่มบันทึก */}
                                                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-emerald-100 p-2 rounded-lg">
                                                                <ShoppingCart size={24} className="text-emerald-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">ยอดเงินสุทธิที่จะเข้าบัญชี</p>
                                                                <p className="font-mono text-2xl font-black text-emerald-700">฿{currentTurnMoney.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleSaveWaste(m, pId, pName)}
                                                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Save size={18} /> ยืนยันบันทึกเข้าระบบ
                                                        </button>
                                                    </div>

                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )) : (
                        <div className="p-10 text-center text-slate-400 font-bold flex flex-col items-center justify-center h-full">
                            <Database size={48} className="mb-4 text-slate-200" />ไม่พบข้อมูลครัวเรือน
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredMembers.length > itemsPerPage && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between">
                        <button onClick={() => setCurrentPageNum(prev => Math.max(prev - 1, 1))} disabled={currentPageNum === 1} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm text-slate-600 disabled:opacity-50">ก่อนหน้า</button>
                        <span className="font-bold text-slate-500 text-sm">หน้า {currentPageNum}/{totalPages}</span>
                        <button onClick={() => setCurrentPageNum(prev => Math.min(prev + 1, totalPages))} disabled={currentPageNum === totalPages} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm text-slate-600 disabled:opacity-50">ถัดไป</button>
                    </div>
                )}
            </div>
        </div>
    );
};
// =========================================================================
// 📥 หน้าจอระบบนำเข้าข้อมูลสมาชิกจากไฟล์ Excel/CSV (ImportDataView) - Premium Native Page
// =========================================================================
const ImportDataView = ({ db, members = [], villages, refreshData, setCurrentPage, logAdminAction, globalPrices }) => {
    const [step, setStep] = useState(1); // 1 = อัปโหลด, 2 = รีเช็ค Preview, 3 = โหลดบันทึก
    const [previewHouses, setPreviewHouses] = useState([]);
    const [previewPage, setPreviewPage] = useState(1);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [summary, setSummary] = useState({ houses: 0, persons: 0, money: 0 });
    const [importedFileName, setImportedFileName] = useState("");
    const ThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const now = new Date();
    const [importMonth, setImportMonth] = useState(ThaiMonths[now.getMonth()]);
    const [importYear, setImportYear] = useState(String(now.getFullYear() + 543));
    const [monthlySummaryPayload, setMonthlySummaryPayload] = useState(null);
    const [importMode, setImportMode] = useState('increment'); // 'increment' (บวกทบ) หรือ 'overwrite' (ทับข้อมูลเดิม)
    const [isDuplicateMonth, setIsDuplicateMonth] = useState(false); // เช็กว่าเดือนนี้เคยนำเข้าหรือยัง
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [processPendingFile, setProcessPendingFile] = useState(null);

    // Effect คอยวิ่งไปถาม DB อัตโนมัติว่า เดือน/ปี ที่เลือกนี้ เคยถูก Import บิลสรุปไปหรือยัง?
    React.useEffect(() => {
        const checkDuplicate = async () => {
            try {
                const docId = `${importYear}_${importMonth}`;
                const snap = await getDoc(doc(db, "monthly_summaries", docId));
                setIsDuplicateMonth(snap.exists());
            } catch (e) {
                console.error("เช็กเดือนซ้ำล้มเหลว:", e);
            }
        };
        checkDuplicate();
    }, [importMonth, importYear, db]);

    const itemsPerPage = 10;

    const CARBON_MULTIPLIERS = {
        'พลาสติก': 1.0310, 'กระดาษ': 5.6735, 'แก้ว': 0.2760,
        'อลูมิเนียม': 9.1270, 'โลหะผสม': 4.3910, 'เหล็ก': 1.8320
    };

    const wasteTypes = React.useMemo(() => {
        return globalPrices && globalPrices.length > 0
            ? globalPrices.map(p => p.type)
            : [];
    }, [globalPrices]);

    // ฟังก์ชันสร้างและดาวน์โหลดไฟล์ Template CSV
    const handleDownloadTemplate = () => {
        const headers = ['บ้านเลขที่', 'หมวดหมู่', 'ชื่อสมาชิก', 'การคัดแยก', 'สิทธิ์สวัสดิการ', 'ยอดเงินตั้งต้น', ...wasteTypes];

        // สร้างข้อมูลตัวอย่าง (บ้านเลขที่, หมวด, ชื่อ, แยก, สวัสดิการ, เงิน)
        const exampleRow = ['123/1', 'หมวดที่ 1', 'ชื่อ - นามสกุล', 'มี', 'ไม่มี', '150'];

        // ใส่ตัวเลขจำลองให้ขยะ 2 ชนิดแรก (ถ้ามี) ที่เหลือปล่อยเป็นช่องว่าง
        if (wasteTypes.length > 0) exampleRow.push('2.5');
        if (wasteTypes.length > 1) exampleRow.push('1.0');
        for (let i = 2; i < wasteTypes.length; i++) {
            exampleRow.push('');
        }

        const csvContent = "\uFEFF" + headers.join(',') + "\n" + exampleRow.join(',');

        const BOM = "\uFEFF";
        const blob = new Blob([BOM, csvContent], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "template_import_members.csv";
        link.click();
    };

    // ฟังก์ชันอ่านไฟล์ CSV
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // ฟังก์ชันอ่านไฟล์จริง (เก็บไว้เรียกใช้ทีหลังได้)
        const executeFileReader = () => {
            setImportedFileName(file.name);
            const reader = new FileReader();
            reader.onload = function (event) {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length <= 1) return alert("❌ ไฟล์ว่างเปล่า หรือไม่มีข้อมูล");

                let headerIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('บ้านเลขที่')) {
                        headerIndex = i; break;
                    }
                }

                const delimiter = lines[headerIndex].includes(';') ? ';' : ',';
                const headers = lines[headerIndex].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
                const rowsData = [];

                for (let i = headerIndex + 1; i < lines.length; i++) {
                    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
                    if (values.length < 3) continue;

                    const rowObj = {};
                    headers.forEach((header, index) => {
                        rowObj[header] = values[index] || '';
                    });
                    rowsData.push(rowObj);
                }

                if (rowsData.length === 0) return alert("❌ ไม่พบข้อมูลสมาชิกในไฟล์");
                processImportData(rowsData);
            };
            reader.readAsText(file, 'UTF-8');
        };

        // 🌟 ถ้าเดือนซ้ำ ให้เด้งป๊อปอัปถามก่อน!
        if (isDuplicateMonth) {
            setProcessPendingFile(() => executeFileReader);
            setShowDuplicateModal(true);
            e.target.value = null; // ล้างค่า input ให้กดเลือกไฟล์เดิมได้
        } else {
            executeFileReader(); // ถ้าไม่ซ้ำ ลุยอ่านไฟล์เลย
            e.target.value = null;
        }
    };

    // 🌟 2. ฟังก์ชันประมวลผล (อัปเกรด: ค้นหาคนเดิมแล้วบวกยอดเพิ่ม)
    const processImportData = (data) => {
        // ดึงข้อมูลบ้านทั้งหมดที่มีในระบบมาเป็นฐานก่อน
        const houseMap = {};
        if (members && members.length > 0) {
            members.forEach(m => {
                houseMap[m.houseNo] = JSON.parse(JSON.stringify(m)); // Deep copy ป้องกันกระทบข้อมูลจริง
            });
        }

        let totalPersons = 0;
        let totalMoney = 0;

        data.forEach((row, index) => {
            const houseNo = row['บ้านเลขที่'];
            const category = row['หมวดหมู่'] || 'หมวดที่ 1';
            const name = row['ชื่อสมาชิก'];

            if (!houseNo || !name) return;

            const isSorted = row['การคัดแยก'] === 'มี' || row['การคัดแยก'] === 'ใช่';
            const hasWelfare = row['สิทธิ์สวัสดิการ'] === 'มี' || row['สิทธิ์สวัสดิการ'] === 'ใช่';
            const balanceToAdd = Number(row['ยอดเงินตั้งต้น']) || 0;

            const wasteToAdd = {};
            let carbonToAdd = 0;
            wasteTypes.forEach(type => {
                const weight = Number(row[type]) || 0;
                if (weight > 0) {
                    wasteToAdd[type] = weight;
                    if (CARBON_MULTIPLIERS[type]) carbonToAdd += weight * CARBON_MULTIPLIERS[type];
                }
            });

            // ถ้าไม่มีบ้านเลขที่นี้ในระบบ ให้สร้างบ้านหลังใหม่
            if (!houseMap[houseNo]) {
                const vMatch = category.match(/\d+/);
                houseMap[houseNo] = {
                    id: String(Date.now() + index),
                    houseNo: houseNo,
                    villageId: vMatch ? Number(vMatch[0]) : 1,
                    category: category,
                    lat: 18.5244 + (Math.random() - 0.5) * 0.002,
                    lng: 99.0435 + (Math.random() - 0.5) * 0.002,
                    familyMembers: [], wasteData: {}, balance: 0, credit: 0, isSorted: false
                };
            }

            const targetHouse = houseMap[houseNo];
            let existingPerson = targetHouse.familyMembers.find(p => p.name === name);
            if (existingPerson) {
                // 🌟 เก็บยอดเดิมไว้โชว์หน้า UI ก่อนถูกคำนวณทับ
                existingPerson.oldBalance = Number(existingPerson.balance) || 0;

                // 🌟 กลไกที่ 2: สวิตช์แยกว่าจะ "บวกทบ" หรือ "ล้างไพ่ทับของเดิม"
                if (importMode === 'increment') {
                    existingPerson.balance = existingPerson.oldBalance + balanceToAdd;
                    existingPerson.credit = (Number(existingPerson.credit) || 0) + Number(carbonToAdd.toFixed(4));
                    existingPerson.hasWelfare = existingPerson.hasWelfare || hasWelfare;
                    existingPerson.isSorted = existingPerson.isSorted || isSorted;

                    if (!existingPerson.wasteData) existingPerson.wasteData = {};
                    Object.keys(wasteToAdd).forEach(wType => {
                        existingPerson.wasteData[wType] = (Number(existingPerson.wasteData[wType]) || 0) + wasteToAdd[wType];
                    });
                } else {
                    existingPerson.balance = balanceToAdd;
                    existingPerson.credit = Number(carbonToAdd.toFixed(4));
                    existingPerson.hasWelfare = hasWelfare;
                    existingPerson.isSorted = isSorted;
                    existingPerson.wasteData = { ...wasteToAdd };
                }
            } else {
                // 🔵 กรณีไม่มีคนชื่อนี้ -> เพิ่มเป็นสมาชิกคนใหม่เข้าบ้านไปเลย
                targetHouse.familyMembers.push({
                    id: String(Date.now() + index + '_p'),
                    name: name,
                    oldBalance: 0, // 🌟 คนใหม่ยอดเดิมคือ 0 เสมอ
                    balance: balanceToAdd,
                    credit: Number(carbonToAdd.toFixed(4)),
                    wasteData: wasteToAdd,
                    hasWelfare: hasWelfare,
                    isSorted: isSorted
                });
            }

            totalPersons += 1;
            totalMoney += balanceToAdd;
        });

        // คำนวณยอดรวมของบ้านใหม่ทั้งหมด
        const finalHouses = Object.values(houseMap).map(house => {
            let houseBalance = 0;
            let houseCredit = 0;
            let houseSorted = false;
            const houseWasteAgg = {};

            house.familyMembers.forEach(p => {
                houseBalance += (Number(p.balance) || 0);
                houseCredit += (Number(p.credit) || 0);
                if (p.isSorted) houseSorted = true;

                Object.entries(p.wasteData || {}).forEach(([type, weight]) => {
                    houseWasteAgg[type] = (houseWasteAgg[type] || 0) + weight;
                });
            });

            return {
                ...house,
                balance: houseBalance,
                credit: Number(houseCredit.toFixed(4)),
                isSorted: houseSorted,
                wasteData: houseWasteAgg
            };
        });

        // 🌟 กรองเอาเฉพาะ "บ้านที่มีการเคลื่อนไหว/อัปเดต" ในไฟล์รอบนี้มาแสดงเท่านั้น
        const updatedHousesOnly = finalHouses.filter(h => data.some(r => r['บ้านเลขที่'] === h.houseNo));
        let sumWaste = 0;
        let sumCarbon = 0;
        let sortedCount = 0;
        let unsortedCount = 0;
        const wasteAgg = {};
        const villageAgg = {};

        data.forEach(row => {
            const category = row['หมวดหมู่'] || 'หมวดที่ 1';
            const isSorted = row['การคัดแยก'] === 'มี' || row['การคัดแยก'] === 'ใช่';
            if (isSorted) sortedCount++; else unsortedCount++;

            if (!villageAgg[category]) villageAgg[category] = { id: category, name: category, realBalance: 0 };
            villageAgg[category].realBalance += (Number(row['ยอดเงินตั้งต้น']) || 0);

            wasteTypes.forEach(type => {
                const w = Number(row[type]) || 0;
                if (w > 0) {
                    wasteAgg[type] = (wasteAgg[type] || 0) + w;
                    sumWaste += w;
                    if (CARBON_MULTIPLIERS[type]) sumCarbon += w * CARBON_MULTIPLIERS[type];
                }
            });
        });

        setMonthlySummaryPayload({
            topWasteType: Object.entries(wasteAgg).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
            totalWaste: sumWaste,
            totalBalance: totalMoney,
            totalHouses: updatedHousesOnly.length,
            totalPersons: totalPersons,
            totalCarbon: sumCarbon,
            sortedPersons: sortedCount,
            unsortedPersons: unsortedCount,
            wasteData: wasteAgg,
            villageData: Object.values(villageAgg)
        });
        setPreviewHouses(updatedHousesOnly);
        setSummary({ houses: updatedHousesOnly.length, persons: totalPersons, money: totalMoney });
        setStep(2);
    };
    const handleConfirmImport = async () => {
        if (previewHouses.length === 0) return;
        setStep(3);
        setUploadProgress(1);

        try {
            const chunkSize = 25;
            for (let i = 0; i < previewHouses.length; i += chunkSize) {
                const chunk = previewHouses.slice(i, i + chunkSize);
                // ใช้ setDoc เพื่อบันทึก/อัปเดตข้อมูลบ้านทั้งหลัง
                await Promise.all(chunk.map(house => setDoc(doc(db, "members", String(house.id)), house)));
                const progress = Math.round(((i + chunk.length) / previewHouses.length) * 100);
                setUploadProgress(progress);
            }

            // 🌟 3. (แทรกเพิ่มตรงนี้) บันทึกข้อมูลสรุปรายเดือนลงคอลเลกชัน monthly_summaries ทันทีที่อัปโหลดไฟล์เสร็จ
            if (monthlySummaryPayload) {
                const docId = `${importYear}_${importMonth}`;
                await setDoc(doc(db, "monthly_summaries", docId), monthlySummaryPayload);
            }

            if (typeof logAdminAction === 'function') {
                logAdminAction(`นำเข้าข้อมูลจากไฟล์ ${importedFileName} : ${summary.houses} หลัง (${summary.persons} คน)`);
            }
            alert(`🎉 นำเข้าข้อมูล จาก "${importedFileName}" สำเร็จเรียบร้อยแล้วทั้งสิ้น ${summary.houses} หลัง`);

            if (typeof refreshData === 'function') refreshData();
            setCurrentPage('members'); // กลับไปหน้าสมาชิก
        } catch (err) {
            console.error(err);
            alert("❌ เกิดข้อผิดพลาดระหว่างอัปโหลด กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต");
            setStep(2);
        }
    };
    const totalPages = Math.max(1, Math.ceil(previewHouses.length / itemsPerPage));
    const currentViewHouses = previewHouses.slice((previewPage - 1) * itemsPerPage, previewPage * itemsPerPage);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-slate-700">

            {/* 🌟 Header หลักของหน้าเพจ */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-[0.02] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <Database size={200} />
                </div>
                <div className="relative z-10">
                    <h2 className="text-2xl md:text-3xl font-black text-blue-700 flex items-center gap-3 tracking-tight">
                        <div className="bg-blue-100 p-2.5 rounded-2xl text-blue-600 shadow-sm"><FileSpreadsheet size={28} /></div>
                        ระบบนำเข้าข้อมูลสมาชิก (Excel)
                    </h2>
                    <p className="text-slate-500 font-medium mt-2 ml-14">สร้างฐานข้อมูลสมาชิกรวดเร็ว อัปโหลดไฟล์ .csv เข้าระบบโดยตรง</p>
                </div>
                {step !== 3 && (
                    <button onClick={() => setCurrentPage('admin')} className="relative z-10 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold transition-all text-sm border border-slate-200 shadow-sm flex items-center gap-2">
                        ← ย้อนกลับ
                    </button>
                )}
            </div>

            {/* 🌟 โครงสร้างใหม่: วาง Layout แถบเครื่องมือ (ซ้าย) และ พื้นที่ทำงาน (ขวา) */}
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">

                {/* 🛠️ แถบเครื่องมือซ้าย (Tools Panel) */}
                <div className="w-full lg:w-[320px] flex flex-col gap-4 shrink-0">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col h-full">
                        <h4 className="font-black text-slate-800 mb-6 text-sm tracking-widest uppercase border-b border-slate-100 pb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> เครื่องมือช่วยเหลือ
                        </h4>

                        <div className="flex flex-col gap-4">
                            {/* ปุ่มดาวน์โหลด Template */}
                            <button
                                onClick={handleDownloadTemplate}
                                className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-300 p-5 rounded-[20px] flex flex-col items-start gap-3 transition-all duration-300 shadow-sm hover:shadow-md text-left"
                            >
                                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                    <Download size={80} />
                                </div>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors relative z-10 text-blue-600">
                                    <Download size={22} />
                                </div>
                                <div className="relative z-10">
                                    <span className="block font-black text-blue-900 text-base mb-1 group-hover:text-blue-700 transition-colors">โหลด Template .csv</span>
                                    <span className="block text-xs text-blue-600/70 font-bold leading-relaxed">ไฟล์ต้นแบบคอลัมน์มาตรฐาน พร้อมโครงสร้างข้อมูลตัวอย่าง</span>
                                </div>
                            </button>

                            {/* ปุ่ม Export (จำลองฟังก์ชันไว้ก่อน) 
                            <button
                                className="group bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 p-5 rounded-[20px] flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-md text-left"
                            >
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-slate-500">
                                    <Database size={20} />
                                </div>
                                <div>
                                    <span className="block font-black text-slate-700 text-sm group-hover:text-emerald-700 transition-colors">ส่งออกข้อมูลสมาชิก</span>
                                    <span className="block text-[10px] text-slate-400 font-bold mt-0.5">ระบบ Export ไปยัง Excel</span>
                                </div>
                            </button>
*/}
                            {/* กล่องคำแนะนำ */}
                            <div className="mt-auto pt-6 border-t border-slate-100">
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-[16px]">
                                    <div className="flex items-center gap-2 text-amber-700 font-black text-xs mb-2">
                                        <AlertTriangle size={14} /> ข้อควรระวัง
                                    </div>
                                    <p className="text-[11px] text-amber-600/80 font-bold leading-relaxed">
                                        ระบบจะนำเข้าข้อมูลโดยสร้างรหัสสมาชิกใหม่อัตโนมัติ โปรดตรวจสอบความถูกต้องในหน้า Preview ก่อนกดยืนยันเสมอ
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🖥️ พื้นที่ทำงานหลัก (Main Workspace) */}
                <div className="flex-1 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] min-h-[600px] flex flex-col relative overflow-hidden">

                    {/* STEP 1: ลากไฟล์อัปโหลด */}
                    {step === 1 && (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-blue-200 p-8 sm:p-14 text-center my-auto transition-colors hover:bg-blue-50/30 hover:border-blue-300 group">
                            <div className="bg-white text-blue-500 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-sm border border-blue-100 group-hover:-translate-y-2 transition-transform duration-300">
                                <FileSpreadsheet size={48} />
                            </div>
                            <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">ลากไฟล์มาวาง หรือ เลือกไฟล์</h3>
                            <p className="text-base text-slate-500 max-w-md mb-8 leading-relaxed font-medium">
                                อัปโหลดไฟล์รายชื่อสกุล <span className="font-bold text-blue-600 bg-blue-100/50 px-2 py-1 rounded-md">.csv</span> ระบบจะทำการจัดกลุ่มลูกบ้านและคำนวณคาร์บอนให้อัตโนมัติ
                            </p>
                            {/* 🌟 แสดงคำเตือนถ้าเดือนนี้เคยนำเข้าข้อมูลไปแล้ว (สกัดดาวรุ่ง) */}
                            {isDuplicateMonth && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-2xl mb-6 w-full max-w-lg mx-auto flex items-start gap-3 text-left animate-in zoom-in duration-300 shadow-sm">
                                    <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black text-sm">⚠️ ระบบเคยสรุปบิลของเดือน {importMonth} {importYear} ไปแล้ว!</p>
                                        <p className="text-xs font-bold mt-1 opacity-80">หากนำเข้าแบบ "บวกทบ" ยอดเงินเดือนนี้จะเบิ้ล 2 เท่า กรุณาตรวจสอบให้แน่ใจ</p>
                                    </div>
                                </div>
                            )}

                            {/* 🌟 สวิตช์สลับโหมดนำเข้า */}
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-lg mx-auto mb-6 relative z-10">
                                <button
                                    onClick={() => setImportMode('increment')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${importMode === 'increment' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <PlusCircle size={16} /> โหมดบวก (ยอดรวมเพิ่มขึ้น)
                                </button>
                                <button
                                    onClick={() => setImportMode('overwrite')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${importMode === 'overwrite' ? 'bg-rose-500 text-white shadow-sm border border-rose-600' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <Database size={16} /> โหมดแทนที่ (ข้อมูลใหม่แทนที่ข้อมูลเดิมทั้งหมด)
                                </button>
                            </div>
                            {/* 🌟 4. เพิ่ม Dropdown ระบุเดือนและปีของไฟล์ที่จะนำเข้า */}
                            <div className="flex gap-3 mb-8 w-full max-w-sm mx-auto justify-center z-10 relative">
                                <select
                                    value={importMonth}
                                    onChange={e => setImportMonth(e.target.value)}
                                    className="flex-1 bg-white border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center"
                                >
                                    <option value="มกราคม">มกราคม</option>
                                    <option value="กุมภาพันธ์">กุมภาพันธ์</option>
                                    <option value="มีนาคม">มีนาคม</option>
                                    <option value="เมษายน">เมษายน</option>
                                    <option value="พฤษภาคม">พฤษภาคม</option>
                                    <option value="มิถุนายน">มิถุนายน</option>
                                    <option value="กรกฎาคม">กรกฎาคม</option>
                                    <option value="สิงหาคม">สิงหาคม</option>
                                    <option value="กันยายน">กันยายน</option>
                                    <option value="ตุลาคม">ตุลาคม</option>
                                    <option value="พฤศจิกายน">พฤศจิกายน</option>
                                    <option value="ธันวาคม">ธันวาคม</option>
                                </select>
                                <select
                                    value={importYear}
                                    onChange={e => setImportYear(e.target.value)}
                                    className="w-32 bg-white border-2 border-slate-200 px-4 py-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center"
                                >
                                    {Array.from({ length: new Date().getFullYear() + 543 - 2567 + 1 }, (_, i) => 2567 + i)
                                        .reverse()
                                        .map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <label className="bg-blue-600 hover:bg-blue-700 text-white font-black px-10 py-5 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.25)] transition-all active:scale-[0.98] hover:-translate-y-1 cursor-pointer text-lg flex items-center gap-3">
                                <PlusCircle size={24} /> ค้นหาไฟล์จากเครื่อง
                                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                            </label>
                        </div>
                    )}

                    {/* STEP 2: รีเช็กข้อมูลก่อนยืนยัน (โฉมใหม่ มี Before-After) */}
                    {step === 2 && (
                        <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">

                            {/* แผงควบคุมและสรุปตัวเลขบนตาราง */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 pb-6 border-b border-slate-100">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-3">
                                        <Eye size={24} className="text-blue-500" /> ตรวจสอบข้อมูลก่อนนำเข้า
                                    </h3>

                                    <div className="mb-4">
                                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black border shadow-sm ${importMode === 'increment' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {importMode === 'increment' ? <PlusCircle size={16} /> : <Database size={16} />}
                                            {importMode === 'increment' ? 'โหมดนำเข้า: บวกทบยอดเพิ่มจากของเดิม' : 'โหมดนำเข้า: เขียนทับข้อมูลเดิมทั้งหมด (ล้างไพ่)'}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                                            <Home size={16} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-500">อัปเดตบ้าน</span>
                                            <span className="text-lg font-black text-slate-700 ml-1">{summary.houses}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                                            <Users size={16} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-500">อัปเดตประชากร</span>
                                            <span className="text-lg font-black text-slate-700 ml-1">{summary.persons}</span>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                                            <Wallet size={16} className="text-amber-500" />
                                            <span className="text-xs font-bold text-amber-700">ยอดเงินในไฟล์รอบนี้</span>
                                            <span className="text-lg font-black text-amber-600 font-mono ml-1">฿{summary.money.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { setStep(1); setPreviewHouses([]); }} className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition-all text-sm border border-slate-200 shadow-sm shrink-0 flex items-center gap-2">
                                    <X size={16} /> ยกเลิกนำเข้า
                                </button>
                            </div>

                            {/* ตารางรายการ (โชว์ ยอดเดิม ➔ ยอดใหม่) */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6 scrollbar-thin">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    {currentViewHouses.map((house) => (
                                        <div key={house.houseNo} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-colors group">
                                            <div className="bg-slate-100/80 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                                                <div>
                                                    <span className="font-black text-slate-800 text-base flex items-center gap-2">
                                                        <Home size={16} className="text-slate-400" /> บ้านเลขที่ {house.houseNo}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-500 mt-1 block">{house.category}</span>
                                                </div>
                                                <span className="font-black text-slate-700 text-sm font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                    สรุปยอดบ้าน: ฿{house.balance.toLocaleString()}
                                                </span>
                                            </div>

                                            <div className="p-2 divide-y divide-slate-100">
                                                {house.familyMembers.map((p, pIdx) => (
                                                    <div key={pIdx} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 rounded-xl transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-emerald-100">{pIdx + 1}</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                                                                {p.isSorted && <span className="text-[9px] font-bold text-emerald-500 mt-0.5">✅ แยกขยะ</span>}
                                                            </div>
                                                        </div>

                                                        {/*  ตรงนี้คือส่วนโชว์ Before ➔ After */}
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-2 font-mono">
                                                                <span className="text-xs text-slate-400 line-through decoration-slate-300 opacity-80">
                                                                    ฿{p.oldBalance?.toLocaleString() || 0}
                                                                </span>
                                                                <span className="text-slate-300 text-xs">➔</span>
                                                                <span className={`font-black text-base ${importMode === 'increment' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                                    ฿{p.balance.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                                {importMode === 'increment'
                                                                    ? `(+฿${(p.balance - (p.oldBalance || 0)).toLocaleString()})`
                                                                    : '(ทับยอดเดิม)'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* แถบควบคุมด้านล่างของพื้นที่ทำงาน */}
                            <div className="mt-auto bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_-4px_15px_rgba(0,0,0,0.02)]">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-500 text-sm hidden md:block">แสดงผลลัพธ์</span>
                                    <div className="flex border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                                        <button onClick={() => setPreviewPage(p => Math.max(p - 1, 1))} disabled={previewPage === 1} className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold disabled:opacity-30 border-r border-slate-200 text-sm transition-colors">◀</button>
                                        <span className="px-4 py-2 bg-slate-50 font-black text-slate-700 text-sm border-r border-slate-200 min-w-[4rem] text-center">หน้า {previewPage} / {totalPages}</span>
                                        <button onClick={() => setPreviewPage(p => Math.min(p + 1, totalPages))} disabled={previewPage === totalPages} className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold disabled:opacity-30 text-sm transition-colors">▶</button>
                                    </div>
                                </div>
                                <button onClick={handleConfirmImport} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black shadow-[0_4px_14px_rgba(37,99,235,0.3)] hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm">
                                    <Save size={18} /> ยืนยันเขียนข้อมูลลงระบบ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: กำลังอัปโหลด */}
                    {step === 3 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
                            <div className="w-32 h-32 rounded-full border-[8px] border-slate-100 border-t-blue-600 animate-spin mb-8 flex items-center justify-center font-black text-blue-600 text-3xl shadow-inner relative">
                                <span className="absolute animate-pulse text-xl font-bold opacity-80">{uploadProgress}%</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">กำลังเขียนข้อมูลลงฐานข้อมูล...</h3>
                            <p className="text-base text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                                กรุณาห้ามปิดหน้าต่างหรือรีเฟรชหน้าเว็บ <br />จนกว่าระบบจะดำเนินการเสร็จสิ้น 100%
                            </p>
                            <div className="w-full max-w-md bg-slate-100 h-4 rounded-full overflow-hidden mt-10 border border-slate-200 shadow-inner">
                                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 relative" style={{ width: `${uploadProgress}%` }}>
                                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* 🚨 ป๊อปอัปสีแดงแจ้งเตือนนำเข้าซ้ำ */}
                    {showDuplicateModal && (
                        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                <div className="bg-rose-500 p-6 flex flex-col items-center text-center text-white">
                                    <div className="bg-white/20 p-3 rounded-full mb-3 shadow-inner">
                                        <AlertTriangle size={48} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight">แจ้งเตือนข้อมูลซ้ำซ้อน!</h3>
                                </div>
                                <div className="p-6 text-center">
                                    <p className="text-slate-600 font-bold text-base mb-2">
                                        ระบบตรวจสอบพบว่าเคยมีการสรุปบิลของเดือน <br />
                                        <span className="text-rose-600 text-lg">"{importMonth} {importYear}"</span> ไปแล้ว
                                    </p>
                                    <div className="bg-rose-50 p-4 rounded-xl text-rose-700 text-sm font-medium border border-rose-100 text-left my-4">
                                        <span className="block font-black mb-1">สิ่งที่จะเกิดขึ้นหากดำเนินการต่อ:</span>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>หากอยู่ใน <b>"โหมดบวกทบ"</b> ยอดเงินเดือนนี้จะถูก <span className="font-black underline">เพิมเป็น 2 เท่า</span></li>
                                            <li>หากอยู่ใน <b>"โหมดแทนที่"</b> ยอดเงินเก่าทั้งหมดจะถูก <span className="font-black underline">ลบและทับใหม่</span> ทันที</li>
                                        </ul>
                                    </div>
                                    <div className="flex gap-3 w-full mt-6">
                                        <button onClick={() => { setShowDuplicateModal(false); setProcessPendingFile(null); }} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                                            ยกเลิก
                                        </button>
                                        <button onClick={() => { setShowDuplicateModal(false); if (processPendingFile) processPendingFile(); }} className="flex-[2] py-3.5 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 shadow-[0_4px_12px_rgba(225,29,72,0.3)] transition-all">
                                            ฉันเข้าใจแล้ว, ดำเนินการต่อ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
const App = () => {
    // --- DATABASE: ส่วนเก็บข้อมูลหลักของแอปพลิเคชัน ---
    // ฟังก์ชันแกนกลางสำหรับโหลดข้อมูลจาก DB (เรียกใช้เมื่อเปิดเว็บ หรือหลังกดเซฟ)
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
            let villagesData = villageSnap.docs.map(doc => doc.data());

            // 🌟 โค้ดกู้คืนข้อมูล! (ถ้าหมวดใน Cloud มีไม่ถึง 9 ให้สร้างใหม่ให้ครบ)
            if (villagesData.length < 9) {
                const defaultVillages = Array.from({ length: 9 }, (_, i) => ({
                    id: i + 1,
                    name: `หมวดที่ ${i + 1}`,
                    goal: 1000,
                    wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 },
                    credit: 0
                }));

                // เอาข้อมูลหมวดที่น้าอุตส่าห์แก้ชื่อไปแล้วมาทับค่าเริ่มต้น จะได้ไม่ต้องพิมพ์ใหม่
                villagesData.forEach(v => {
                    const index = defaultVillages.findIndex(dv => Number(dv.id) === Number(v.id));
                    if (index !== -1) defaultVillages[index] = { ...defaultVillages[index], ...v };
                });

                villagesData = defaultVillages;

                // บังคับดันข้อมูลทั้ง 9 หมวดขึ้น Cloud ทันที เพื่อให้ระบบมีข้อมูลครบถ้วนตลอดไป
                for (const v of villagesData) {
                    await setDoc(doc(db, "villages", String(v.id)), v, { merge: true });
                }
                console.log("✅ กู้คืนและซิงค์ข้อมูล 9 หมวดขึ้น Cloud สำเร็จ!");
            }

            setVillages(villagesData);
            localStorage.setItem('village_data', JSON.stringify(villagesData));

            // 3. โหลดประวัติแอดมิน (เอาแค่ 200 รายการล่าสุด จะได้ไม่หนัก)
            const logsSnap = await getDocs(query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(200)));
            setAdminLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            /// 🌟 5. โหลดราคากลางจาก Firestore
            try {
                const priceSnap = await getDoc(doc(db, "settings", "waste_prices"));

                if (priceSnap.exists()) {
                    setGlobalPrices(priceSnap.data().items || []);
                } else {
                    // ถ้ายังไม่มี DB ให้ใช้ค่า Default 30 ตัว แล้วโยนขึ้น DB ครั้งแรก
                    const defaultPrices = [
                        { id: 1, type: 'พลาสติก', price: 4.5, icon: '📦', color: 'bg-blue-50 text-blue-600' },
                        { id: 2, type: 'กระดาษ', price: 1.9, icon: '📄', color: 'bg-amber-50 text-amber-600' },
                        { id: 3, type: 'แก้ว', price: 0.5, icon: '🍾', color: 'bg-emerald-50 text-emerald-600' },
                        { id: 4, type: 'อลูมิเนียม', price: 35.0, icon: '🥤', color: 'bg-purple-50 text-purple-600' },
                        { id: 5, type: 'โลหะผสม', price: 8.0, icon: '⚙️', color: 'bg-rose-50 text-rose-600' },
                        { id: 6, type: 'เหล็ก', price: 5.0, icon: '🔩', color: 'bg-slate-100 text-slate-700' },
                        { id: 7, type: 'สังกะสีกระป๋อง', price: 3.0, icon: '🥫', color: 'bg-slate-100 text-slate-700' },
                        { id: 8, type: 'สังกะสีแผ่น', price: 2.7, icon: '🏚️', color: 'bg-slate-100 text-slate-700' },
                        { id: 9, type: 'PVC สีฟ้า', price: 1.8, icon: '🧪', color: 'bg-blue-50 text-blue-600' },
                        { id: 10, type: 'พลาสติกใส', price: 5.0, icon: '✨', color: 'bg-blue-50 text-blue-600' },
                        { id: 11, type: 'PVC สีเทา', price: 0.5, icon: '🧪', color: 'bg-blue-50 text-blue-600' },
                        { id: 12, type: 'พลาสติกสกรีน', price: 3.0, icon: '🎨', color: 'bg-blue-50 text-blue-600' },
                        { id: 13, type: 'มอเตอร์', price: 10.0, icon: '⚙️', color: 'bg-rose-50 text-rose-600' },
                        { id: 14, type: 'กระดาษลัง', price: 2.5, icon: '📄', color: 'bg-amber-50 text-amber-600' },
                        { id: 15, type: 'พัดลมใหญ่', price: 15.0, icon: '🌪️', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 16, type: 'พัดลมเล็ก', price: 10.0, icon: '🌪️', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 17, type: 'ลังเหล้า', price: 8.0, icon: '📦', color: 'bg-amber-100 text-amber-800' },
                        { id: 18, type: 'โทรทัศน์', price: 50.0, icon: '📺', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 19, type: 'ลังเบียร์ช้าง', price: 8.0, icon: '📦', color: 'bg-amber-100 text-amber-800' },
                        { id: 20, type: 'เครื่องซักผ้า', price: 100.0, icon: '🧺', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 21, type: 'ลังเบียร์สิงห์/ลีโอ', price: 3.5, icon: '📦', color: 'bg-amber-100 text-amber-800' },
                        { id: 22, type: 'ตู้เย็น', price: 100.0, icon: '❄️', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 23, type: 'อลูมิเนียมป้อง', price: 46.0, icon: '🥤', color: 'bg-purple-50 text-purple-600' },
                        { id: 24, type: 'แบตเตอรี่ใหญ่', price: 15.0, icon: '🔋', color: 'bg-yellow-50 text-yellow-600' },
                        { id: 25, type: 'อลูมิเนียมบาง', price: 43.0, icon: '🥤', color: 'bg-purple-50 text-purple-600' },
                        { id: 26, type: 'แบตเตอรี่เล็ก', price: 5.0, icon: '🔋', color: 'bg-yellow-50 text-yellow-600' },
                        { id: 27, type: 'ทองเหลือง', price: 100.0, icon: '🌟', color: 'bg-yellow-100 text-yellow-700' },
                        { id: 28, type: 'แผ่น CD', price: 2.0, icon: '💿', color: 'bg-zinc-100 text-zinc-700' },
                        { id: 29, type: 'ทองแดง', price: 200.0, icon: '✨', color: 'bg-orange-100 text-orange-700' },
                        { id: 30, type: 'มุ้งลวด', price: 15.0, icon: '🕸️', color: 'bg-slate-100 text-slate-700' },
                    ];

                    // 1. นำข้อมูลไปใช้ในระบบทันที
                    setGlobalPrices(defaultPrices);

                    // 2. สร้างโครงสร้างใน Firebase ให้โดยอัตโนมัติ 
                    await setDoc(doc(db, "settings", "waste_prices"), { items: defaultPrices }, { merge: true });
                    console.log("สร้างราคากลางตั้งต้นบน Firebase สำเร็จ!");
                }
            } catch (error) {
                console.error("ดึงข้อมูลราคากลางผิดพลาด:", error);
            }
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

    // ☁️ ฟังก์ชันสำหรับบันทึกน้ำหนักขยะและยอดเงิน พุ่งขึ้น Firebase (รองรับระดับบุคคล ป้องกันข้อมูลชนกัน)
    const handleSaveWasteRecord = async (memberId, personId, turnWasteData, turnCredit, addedBalance) => {
        try {
            const finalBalanceToAdd = Number(addedBalance) || 0;
            const finalCreditToAdd = Number(turnCredit) || 0;

            const memberRef = doc(db, "members", String(memberId));

            let updatedMemberObj = null;
            let finalPersonName = 'สมาชิก';

            // 🌟 พระเอกของเรา: runTransaction บังคับให้ระบบดึงข้อมูล "ล่าสุดจริงๆ" ก่อนเซฟเสมอ
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(memberRef);
                if (!sfDoc.exists()) throw new Error("ไม่พบข้อมูลบ้านเลขที่นี้ในระบบ");

                const latestCloudData = sfDoc.data();

                // หาชื่อคนฝาก
                const originalPerson = (latestCloudData.familyMembers || []).find(p => String(p.id || '') === String(personId));
                if (originalPerson) {
                    finalPersonName = typeof originalPerson === 'string' ? originalPerson : (originalPerson.name || 'สมาชิก');
                }

                // คำนวณบวกทบรายบุคคล
                const updatedFamily = (latestCloudData.familyMembers || []).map((p, idx) => {
                    const pId = p.id || String(idx);
                    if (String(pId) === String(personId)) {
                        const pObj = typeof p === 'string'
                            ? { id: pId, name: p, balance: 0, credit: 0, wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 }, hasWelfare: false, isSorted: false }
                            : { ...p };

                        pObj.balance = (Number(pObj.balance) || 0) + finalBalanceToAdd;
                        pObj.credit = (Number(pObj.credit) || 0) + finalCreditToAdd;
                        pObj.isSorted = true;

                        const pWaste = { ...(pObj.wasteData || {}) };
                        Object.keys(turnWasteData).forEach(type => {
                            pWaste[type] = (Number(pWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                        });
                        pObj.wasteData = pWaste;
                        return pObj;
                    }
                    return p;
                });

                // คำนวณระดับบ้าน
                const newHouseBalance = updatedFamily.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
                const newHouseCredit = updatedFamily.reduce((sum, p) => sum + (Number(p.credit) || 0), 0);

                const aggregatedWaste = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 };
                updatedFamily.forEach(person => {
                    Object.entries(person.wasteData || {}).forEach(([type, weight]) => {
                        aggregatedWaste[type] = (aggregatedWaste[type] || 0) + (Number(weight) || 0);
                    });
                });

                updatedMemberObj = {
                    ...latestCloudData,
                    wasteData: aggregatedWaste,
                    familyMembers: updatedFamily,
                    credit: newHouseCredit,
                    balance: newHouseBalance,
                    isSorted: true
                };

                // สั่งเซฟข้อมูลที่ผ่านการคำนวณอย่างปลอดภัยแล้ว
                transaction.update(memberRef, updatedMemberObj);
            });

            // --- ส่วนที่เหลือ (อัปเดตหน้าจอ, สร้าง Log, สร้างประวัติ) ทำเหมือนเดิม ---

            // อัปเดต State จอ
            const nextMembers = members.map(m => String(m.id) === String(memberId) ? updatedMemberObj : m);
            setMembers(nextMembers);
            localStorage.setItem('local_members_data', JSON.stringify(nextMembers));

            // อัปเดตข้อมูลหมู่บ้านบนจอ
            setVillages(prevVillages => {
                const updatedVillages = prevVillages.map(v => {
                    if (v.id === updatedMemberObj.villageId) {
                        const nextVillageWaste = { ...v.wasteData };
                        Object.keys(turnWasteData).forEach(type => {
                            nextVillageWaste[type] = (Number(nextVillageWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                        });
                        return {
                            ...v,
                            wasteData: nextVillageWaste,
                            credit: (Number(v.credit) || 0) + finalCreditToAdd,
                            totalBalance: (Number(v.totalBalance) || 0) + finalBalanceToAdd
                        };
                    }
                    return v;
                });
                localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                return updatedVillages;
            });

            // สร้างใบเสร็จ (History) ลง DB
            const now = new Date();
            const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const newTx = {
                houseNo: updatedMemberObj.houseNo,
                personName: finalPersonName,
                villageId: updatedMemberObj.villageId,
                category: updatedMemberObj.category,
                wasteData: turnWasteData,
                creditAdded: finalCreditToAdd,
                addedBalance: finalBalanceToAdd,
                date: `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`,
                time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`,
                operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
                timestamp: serverTimestamp()
            };
            await addDoc(collection(db, "waste_transactions"), newTx);
            // รีเฟรชและเคลียร์จอ
            setActivePersonKey(null);
            setCurrentBasket([]);
            if (typeof refreshData === 'function') await refreshData();

            alert(`✅ บันทึกรายการฝากของ ${finalPersonName} เรียบร้อย! (+฿${finalBalanceToAdd.toLocaleString()})`);

        } catch (err) {
            console.error("Save Waste Error:", err);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่");
        }
    };

    const [expandedMemberId, setExpandedMemberId] = React.useState(null); // บันทึกว่ากล่องของบ้านหลังไหนกำลังถูกคลิกเปิดดูรายชื่อ
    // สถานะหน้าจอและเมนู
    const [currentPage, setCurrentPage] = useState('dashboard'); // ควบคุมว่าตอนนี้อยู่หน้าไหน

    // เปลี่ยนการจำสถานะล็อกอิน ให้จำชื่อแอดมินด้วย
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
    const [selectedPeriod, setSelectedPeriod] = useState({ month: 'current', year: 'current' });
    const [historicalSummary, setHistoricalSummary] = useState(null);
    const [summaryCache, setSummaryCache] = useState({});
    const [prevMonthWaste, setPrevMonthWaste] = useState(null);


    useEffect(() => {
        const fetchPrevMonthWaste = async () => {
            const now = new Date();
            const ThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

            let prevMonthIdx = now.getMonth() - 1;
            let prevYear = now.getFullYear() + 543;

            if (prevMonthIdx < 0) {
                prevMonthIdx = 11;
                prevYear -= 1;
            }

            try {
                const docId = `${prevYear}_${ThaiMonths[prevMonthIdx]}`;
                const docSnap = await getDoc(doc(db, "monthly_summaries", docId));
                if (docSnap.exists()) {
                    setPrevMonthWaste(docSnap.data().totalWaste || 0);
                } else {
                    setPrevMonthWaste(0);
                }
            } catch (error) {
                setPrevMonthWaste(0);
            }
        };
        fetchPrevMonthWaste();
    }, []);
    // ข้อมูลสมาชิกและตำแหน่ง
    const [members, setMembers] = useState([]);
    const [allMembers, setAllMembers] = useState([]);
    const [currentLocation, setCurrentLocation] = useState({ lat: 18.5244, lng: 99.0435 }); // จุดกึ่งกลางแผนที่ (อุโมงค์)
    // ข้อมูลแอดมินที่ล็อกอินอยู่

    // ข้อมูลสำหรับการแก้ไขและแจ้งเตือน
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [editingVillage, setEditingVillage] = useState(null);
    const [showValidationAlert, setShowValidationAlert] = useState(false);
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
    const logAdminAction = async (actionText) => {
        const now = new Date();
        const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        const newLog = {
            operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
            action: actionText,
            time: timeString,
            date: dateString,
            timestamp: now // ใช้ timestamp ของจริง
        };

        try {
            // มันจะสร้างรหัสเอกสารอัตโนมัติให้เราโดยอัตโนมัติ
            await addDoc(collection(db, "admin_logs"), newLog);
            console.log("บันทึกประวัติการทำงานลง Cloud สำเร็จ");

            // อัปเดตหน้าจอทันที
            await refreshData();
        } catch (err) {
            console.error("บันทึกประวัติลง Cloud ไม่สำเร็จ:", err);
        }
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
                'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0
            },
            credit: 0
        }));

    });
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [tempLocation, setTempLocation] = useState(null); // ไว้เก็บพิกัดชั่วคราวก่อนกดเซฟ
    // state staffs ให้เป็นค่าว่างตอนเริ่มต้น
    const [staffs, setStaffs] = useState([]);
    //เพิ่ม State สำหรับเก็บราคากลาง
    const [globalPrices, setGlobalPrices] = useState([]);

    // ดึงข้อมูลแอดมินจาก Firebase (ใส่ไว้ใน useEffect เดียวกับที่ดึง refreshData)
    useEffect(() => {
        const fetchStaffs = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "staffs"));
                const staffsList = querySnapshot.docs.map(doc => doc.data());
                setStaffs(staffsList);
            } catch (err) {
                console.error("ดึงข้อมูลแอดมินจาก Firebase พลาด:", err);
            }
        };
        fetchStaffs();
    }, []);
    const [currentStaff, setCurrentStaff] = useState(null);

    // ประวัติการทิ้งขยะ (เชื่อมโยงกับกราฟแท่ง)
    const [transactions, setTransactions] = useState([]);

    //ลบสมาชิกออกจากระบบ
    const handleDeleteMember = (memberId) => {
        const targetMem = members.find(m => m.id === memberId);
        if (window.confirm("คุณแน่ใจใช่ไหมที่จะลบสมาชิกคนนี้? ข้อมูลทั้งหมดจะหายไปทันที")) {
            if (targetMem) {
                logAdminAction(`ได้ลบข้อมูลครัวเรือน "บ้านเลขที่ ${targetMem.houseNo}" ออกจากฐานข้อมู`);
            }
            setMembers(prev => prev.filter(m => m.id !== memberId));
        }
    };
    // 🌟 ขั้นตอนที่ 2: ฟังก์ชัน Lazy Loading ดึงข้อมูลสรุปรายเดือนย้อนหลัง (มีระบบ Memory Cache)
    useEffect(() => {
        const fetchHistoricalSummary = async () => {
            // ถ้าเลือกเป็น "เดือนปัจจุบัน" ให้ล้างค่าประวัติเก่าออก เพื่อกลับไปใช้ระบบคำนวณสดปกติ
            if (selectedPeriod.month === 'current') {
                setHistoricalSummary(null);
                return;
            }

            // สร้างรหัสเอกสาร (Document ID) เช่น "2569_พฤษภาคม"
            const docId = `${selectedPeriod.year}_${selectedPeriod.month}`;

            // 🛑 กลไก Memory Cache: เช็กก่อนว่าในกระเป๋ามีข้อมูลของเดือนนี้หรือยัง?
            if (summaryCache[docId]) {
                console.log(`✅ ดึงข้อมูล ${docId} จาก Cache ในเครื่อง (เสีย 0 Read)`);
                setHistoricalSummary(summaryCache[docId]);
                return; // จบการทำงานตรงนี้เลย ไม่ต้องวิ่งไปหา Firebase
            }

            // เปิดป๊อปอัปโหลดสีเขียวกลางหน้าจอ
            setIsLoadingData(true);

            try {
                console.log(`☁️ วิ่งไปดึงข้อมูล ${docId} จาก Firebase (เสีย 1 Read)`);
                const summaryRef = doc(db, "monthly_summaries", docId);
                const docSnap = await getDoc(summaryRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // ถ้าเจอข้อมูลในคลาวด์ ให้เอามาเก็บไว้ใน State
                    setHistoricalSummary(data);

                    // 📥 ดึงเสร็จแล้ว เอาไปเก็บใส่กระเป๋า Cache ไว้ใช้คราวหน้าด้วย!
                    setSummaryCache(prev => ({ ...prev, [docId]: data }));
                } else {
                    // ถ้าไม่เจอข้อมูล
                    setHistoricalSummary(null);
                    alert(`📂 ไม่พบข้อมูลสรุปสถิติของเดือน ${selectedPeriod.month} ${selectedPeriod.year} บนระบบ Cloud`);
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการโหลดสถิตีย้อนหลัง:", error);
                alert("❌ ไม่สามารถดึงข้อมูลย้อนหลังได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
                setHistoricalSummary(null);
            } finally {
                // ปิดป๊อปอัปโหลดสีเขียวเมื่อทำงานเสร็จ
                setIsLoadingData(false);
            }
        };

        fetchHistoricalSummary();
    }, [selectedPeriod, db]); // ไม่ต้องเอา summaryCache ใส่ในวงเล็บนี้ ป้องกันการโหลดซ้ำซ้อน

    // --- ฟังก์ชัน: ค้นหาตำแหน่งปัจจุบันผ่าน GPS ---
    const findMyLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentLocation({ lat: latitude, lng: longitude });
                    alert("พบตำแหน่งของคุณแล้ว!");
                },
                () => alert("โปรดเปิด GPS หรืออนุญาตให้เข้าถึงตำแหน่งใน Browser")
            );
        }
    };
    // --- ฟังก์ชัน: อัปเดตข้อมูลหมวดขยะและบันทึกลง LocalStorage ---
    const handleUpdateVillage = async (updatedVillage) => {
        try {
            // 1. สร้างก้อนข้อมูลที่ "สะอาด" ส่งไปแค่ข้อมูลพื้นฐาน ห้ามเอาตัวเลขที่คำนวณได้ไปเซฟทับใน DB
            const pureVillageData = {
                id: updatedVillage.id,
                name: updatedVillage.name,
                goal: updatedVillage.goal || 1000
                // สังเกตว่าเราไม่ใส่ wasteData, totalBalance หรือ credit เข้ามาเลย
            };

            // ปรับปรุงแค่ข้อมูลที่สะอาดลง Cloud
            await setDoc(doc(db, "villages", String(updatedVillage.id)), pureVillageData, { merge: true });

            // 2. อัปเดตหน้าจอทันทีโดยเปลี่ยนแค่ "ชื่อ" เท่านั้น
            setVillages(prevVillages => {
                const newVillages = prevVillages.map(v =>
                    v.id === updatedVillage.id ? { ...v, name: updatedVillage.name } : v
                );
                localStorage.setItem('village_data', JSON.stringify(newVillages));
                return newVillages;
            });

            setEditingVillage(null);
            setSelectedVillage(null);
        } catch (error) {
            console.error("อัปเดตข้อมูลหมู่บ้านล้มเหลว:", error);
            alert("❌ อัปเดตหมวดหมู่ลง Cloud ไม่สำเร็จ!");
        }
    };

    // --- 4. คำนวณค่าการลดการปล่อยคาร์บอน (Carbon Stats) ---
    const carbonStats = useMemo(() => {
        // 1. เปลี่ยนจาก members เป็น allMembers เพื่อให้อิงจากข้อมูลทั้งหมดเสมอ
        if (!allMembers || allMembers.length === 0) return 0;

        const FACTORS = {
            'พลาสติก': 1.0310,
            'กระดาษ': 5.6735,
            'แก้ว': 0.2760,
            'อลูมิเนียม': 9.1270,
            'โลหะผสม': 4.3910,
            'เหล็ก': 1.8320
        };

        let totalCarbon = 0;

        // 2. เปลี่ยนมาลูปผ่าน allMembers
        allMembers.forEach(house => {
            const persons = house.familyMembers || [];

            if (persons.length > 0) {
                // ถ้าระบบใหม่ (มีข้อมูลระดับบุคคล) ให้คำนวณจากขยะของทุกคนรวมกัน
                persons.forEach(person => {
                    Object.entries(person.wasteData || {}).forEach(([type, weight]) => {
                        // เพิ่มการดักจับ: คำนวณเฉพาะประเภทขยะที่มีใน FACTORS เท่านั้น (ป้องกันเลขเพี้ยน)
                        if (FACTORS[type] !== undefined) {
                            totalCarbon += (Number(weight) || 0) * FACTORS[type];
                        }
                    });
                });
            } else {
                // เผื่อไว้รองรับโครงสร้างบ้านแบบเก่า
                Object.entries(house.wasteData || {}).forEach(([type, weight]) => {
                    if (FACTORS[type] !== undefined) {
                        totalCarbon += (Number(weight) || 0) * FACTORS[type];
                    }
                });
            }
        });

        return totalCarbon;
    }, [allMembers]);

    // --- 5. สรุปสถิติ 5 กล่องหลักสำหรับหน้า Dashboard ---
    const stats = useMemo(() => {
        // 1. กำหนดประเภทขยะหลัก เพื่อป้องกันการดึง Key ประหลาด (เช่น ตัวเลข 1, 2, 3) มาแสดงผล
        const validWasteTypes = ['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม', 'เหล็ก'];

        let totalWeight = 0;
        let typeTotals = { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 };
        let totalBalance = 0;
        let totalIndividuals = 0; // เพิ่มการนับรายบุคคล

        // 2. วนลูปก้อนเดียวจบ เพื่อดึงข้อมูลจากสมาชิกทุกคนแบบแม่นยำ
        allMembers.forEach(m => {
            // รวมยอดเงิน
            totalBalance += (Number(m.balance) || 0);

            // นับจำนวนสมาชิกระดับ "รายบุคคล" (ข้ามคนที่เป็นค่าว่าง)
            const validPersons = (m.familyMembers || []).filter(p => {
                const name = typeof p === 'string' ? p : p?.name;
                return name && name.trim() !== '';
            });
            totalIndividuals += validPersons.length;

            // รวมน้ำหนักขยะ (กรองเอาเฉพาะประเภทที่ถูกต้องเท่านั้น)
            if (m.wasteData) {
                Object.entries(m.wasteData).forEach(([type, weight]) => {
                    if (validWasteTypes.includes(type)) {
                        const numWeight = Number(weight) || 0;
                        typeTotals[type] += numWeight;
                        totalWeight += numWeight;
                    }
                });
            }
        });

        // 3. หาประเภทขยะมากที่สุด (ตอนนี้จะไม่มีเลข 2 โผล่มาแล้ว เพราะเราดักไว้ข้างบนแล้ว)
        const sortedTypes = Object.entries(typeTotals).sort((a, b) => b[1] - a[1]);
        const topType = sortedTypes[0]; // ดึงตัวที่มากที่สุดมา
        const topLabel = (topType && topType[1] > 0) ? topType[0] : 'รอดำเนินการ';

        return [
            {
                label: 'ประเภทขยะมากที่สุด',
                value: topLabel,
                icon: <Database size={28} className="text-yellow-500" />
            },
            {
                label: 'ขยะรวมเดือนล่าสุด',
                value: `${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} กก.`,
                icon: <TrendingUp size={28} className="text-yellow-500" />
            },
            {
                label: 'ยอดเงินออมรวมทั้งโครงการ',
                value: `฿${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                icon: <Wallet size={28} className="text-yellow-500" />
            },
            {
                // ปรับให้โชว์ทั้ง "จำนวนบ้าน" และ "จำนวนคน"
                label: 'จำนวนครัวเรือน / สมาชิก',
                value: `${allMembers.length} หลัง / ${totalIndividuals} คน`,
                icon: <Users size={28} className="text-yellow-500" />
            },
            {
                label: 'ลดการปล่อยคาร์บอน', // ย้ายหน่วยมาไว้ที่ Label แทน
                value: (
                    <>
                        {Number(carbonStats || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1
                        })}
                        <span className="text-xs font-bold text-slate-400 ml-1">kgCO₂e</span>
                    </>
                ),
                icon: <Leaf size={28} className="text-emerald-500" />,
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

            // 2. คำนวณยอดเงินรวม (balance) จากสมาชิกในหมวดนี้ แทนเครดิตเก่า
            const totalVillageBalance = vMembers.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);

            const aggregatedWaste = vMembers.reduce((acc, m) => {
                const data = m.wasteData || {};
                Object.keys(data).forEach(type => {
                    acc[type] = (acc[type] || 0) + Number(data[type] || 0);
                });
                return acc;
            }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0, 'เหล็ก': 0 });
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
        const types = ['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม', 'เหล็ก'];

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
    // 🌟 1. State ควบคุม Loading และเช็กว่าโหลดแล้วหรือยัง
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState({ history: false, logs: false, summary: false });

    // 🌟 2. ฟังก์ชันแยกโหลดประวัติขยะ (Lazy Load)
    const fetchHistoryData = async () => {
        if (isDataLoaded.history) return; // ถ้าเคยโหลดแล้ว ให้ข้ามเลย ประหยัด DB
        setIsLoadingData(true);
        try {
            const txSnap = await getDocs(query(collection(db, "waste_transactions"), orderBy("timestamp", "desc")));
            setTransactions(txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsDataLoaded(prev => ({ ...prev, history: true }));
        } catch (error) { console.error("โหลดประวัติขยะพลาด:", error); }
        setIsLoadingData(false);
    };

    // 🌟 3. ฟังก์ชันแยกโหลดประวัติแอดมิน (Lazy Load)
    const fetchAdminLogsData = async () => {
        if (isDataLoaded.logs) return;
        setIsLoadingData(true);
        try {
            const logsSnap = await getDocs(query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(200)));
            setAdminLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsDataLoaded(prev => ({ ...prev, logs: true }));
        } catch (error) { console.error("โหลดประวัติแอดมินพลาด:", error); }
        setIsLoadingData(false);
    };
    const fetchSummaryData = async () => {
        if (isDataLoaded.summary) {
            setCurrentPage('summary');
            return;
        }
        setIsLoadingData(true);
        try {
            const memberSnap = await getDocs(collection(db, "members"));
            const membersData = memberSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMembers(membersData);
            setAllMembers(membersData);
            setIsDataLoaded(prev => ({ ...prev, summary: true }));
            setCurrentPage('summary');
        } catch (error) {
            console.error("โหลดข้อมูลสรุปสมาชิกพลาด:", error);
        }
        setIsLoadingData(false);
    };
    // 🌟 2. คำนวณน้ำหนักขยะรวม Real-time ของเดือนนี้จาก RAM (เอาไว้ก่อน renderContent)
    const currentMonthWaste = allMembers.reduce((sum, m) => {
        return sum + Object.values(m.wasteData || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    }, 0);

    const wasteDiffPercent = prevMonthWaste && prevMonthWaste > 0
        ? ((currentMonthWaste - prevMonthWaste) / prevMonthWaste) * 100
        : 0;
    //* --- renderContent: ฟังก์ชันสำหรับตัดสินใจว่าจะแสดงหน้าจอไหน-- -
    //* ทำหน้าที่เหมือนสวิตช์ไฟ(Switch Case) ตามค่าของตัวแปร currentPage
    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard': {
                // 🌟 1. เช็กว่าตอนนี้แอดมินกำลังดูเดือนเก่าอยู่ใช่ไหม? (ถ้า month ไม่ใช่ 'current' แปลว่าดูย้อนหลัง)
                const isHistorical = selectedPeriod.month !== 'current';
                const histData = historicalSummary || {}; // ดัก Error เผื่อไม่มีข้อมูลเดือนนั้น

                // 🌟 2. สับรางกล่องสถิติ 5 กล่องด้านบน
                const displayStats = isHistorical ? [
                    { label: 'ประเภทขยะมากที่สุด', value: histData.topWasteType || '-', icon: <Database size={28} className="text-yellow-500" /> },
                    { label: 'ขยะรวมเดือนที่เลือก', value: `${(histData.totalWaste || 0).toLocaleString()} กก.`, icon: <TrendingUp size={28} className="text-yellow-500" /> },
                    { label: 'ยอดเงินออมรวม', value: `฿${(histData.totalBalance || 0).toLocaleString()}`, icon: <Wallet size={28} className="text-yellow-500" /> },
                    { label: 'จำนวนครัวเรือน / สมาชิก', value: `${histData.totalHouses || 0} หลัง / ${histData.totalPersons || 0} คน`, icon: <Users size={28} className="text-yellow-500" /> },
                    { label: 'ลดการปล่อยคาร์บอน', value: <>{Number(histData.totalCarbon || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span className="text-xs font-bold text-slate-400 ml-1">kgCO₂e</span></>, icon: <Leaf size={28} className="text-emerald-500" />, hasTooltip: true }
                ] : stats;

                // 🌟 3. สับรางข้อมูลตารางอันดับหมวด
                const displayVillageData = isHistorical ? (histData.villageData || []) : villageData;

                // 🌟 4. สับรางข้อมูลกราฟแท่งแยกประเภทขยะ
                const displayWasteTypeData = isHistorical
                    ? Object.entries(histData.wasteData || {}).map(([name, amount]) => ({ name, amount }))
                    : wasteTypeData;

                // 🌟 5. ส่งตัวแปรที่ผ่านการสับรางแล้วออกไปโชว์ที่หน้าจอ
                return (
                    <MemoizedDashboardView
                        stats={displayStats}            // 👈 เปลี่ยนจาก stats เป็น displayStats
                        villageData={displayVillageData}  // 👈 เปลี่ยนจาก villageData เป็น displayVillageData
                        wasteTypeData={displayWasteTypeData} // 👈 เปลี่ยนจาก wasteTypeData เป็น displayWasteTypeData
                        members={allMembers}
                        setCurrentPage={setCurrentPage}
                        selectedPeriod={selectedPeriod}
                        setSelectedPeriod={setSelectedPeriod}
                        historicalSummary={historicalSummary}
                    />
                );
            } // 👈 สิ้นสุดเคส dashboard ตรงปีกกานี้
            case 'villages':
                return <VillagesView villageData={villageData} members={allMembers} setSelectedVillage={setSelectedVillage} setCurrentPage={setCurrentPage} isLoggedIn={isLoggedIn} setEditingVillage={setEditingVillage} />;

            case 'prices':
                return (
                    <PriceView
                        isLoggedIn={isLoggedIn}
                        isEditing={isPriceEditing}
                        setIsEditing={setIsPriceEditing}
                        setCurrentPage={setCurrentPage}
                        globalPrices={globalPrices}
                        refreshData={refreshData}
                        db={db}
                        logAdminAction={logAdminAction}
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
                    refreshData={refreshData}
                    setCurrentPage={setCurrentPage}
                    globalPrices={globalPrices} />;

            case 'history':
                return <HistoryView transactions={transactions} villages={villages} db={db} refreshData={refreshData} setCurrentPage={setCurrentPage} globalPrices={globalPrices} />;

            case 'admin_logs':
                return <AdminLogsView adminLogs={adminLogs} db={db} refreshData={refreshData} setCurrentPage={setCurrentPage} />;
            case 'manageBalance':
                return (
                    <ManageBalanceView
                        members={members}
                        villages={villages}
                        setMembers={setMembers}
                        db={db}
                        logAdminAction={logAdminAction}
                        setCurrentPage={setCurrentPage}
                        refreshData={refreshData}
                    />
                );
            case 'record_waste':
                return (
                    <RecordWasteView
                        members={members}
                        villages={villages}
                        setMembers={setMembers}
                        db={db}
                        logAdminAction={logAdminAction}
                        setCurrentPage={setCurrentPage}
                        refreshData={refreshData}
                        currentUser={currentUser}
                        globalPrices={globalPrices}
                    />
                );
            case 'import_excel':
                return (
                    <ImportDataView
                        db={db}
                        members={members}
                        villages={villages}
                        refreshData={refreshData}
                        setCurrentPage={setCurrentPage}
                        logAdminAction={logAdminAction}
                        globalPrices={globalPrices}
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
            case 'summary':
                return <MemberSummaryView
                    members={members}
                    villages={villages}
                    setCurrentPage={setCurrentPage}
                    globalPrices={globalPrices}
                />;
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
                        fetchHistoryData={fetchHistoryData}
                        fetchAdminLogsData={fetchAdminLogsData}
                        fetchSummaryData={fetchSummaryData}
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
            {/* 🌟 เพิ่มป๊อปอัป Loading Overlay ตรงนี้ */}
            {isLoadingData && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shadow-lg"></div>
                    <p className="text-white font-black mt-4 animate-pulse text-lg drop-shadow-md">กำลังซิงค์ข้อมูลจาก Cloud...</p>
                </div>
            )}
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

                {/*  ส่วนท้าย Sidebar: ข้อมูลแอดมิน & เวอร์ชั่นระบบ */}
                <div className="mt-auto pt-6">

                    {/* ข้อมูลแอดมิน (โชว์เฉพาะตอนล็อกอิน) */}
                    {isLoggedIn && currentUser && (
                        <div className="bg-white/10 border border-white/20 p-4 rounded-2xl flex items-center gap-3 mb-4 backdrop-blur-md hover:bg-white/20 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-default">
                            {/* รูปโปรไฟล์จำลอง (ค้นหาตัวเลขในชื่อมาโชว์ ถ้าไม่มีให้ดึงอักษรตัวแรก) */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-300 to-orange-400 flex items-center justify-center text-emerald-900 font-black text-lg shrink-0 shadow-inner">
                                {currentUser.name
                                    ? (currentUser.name.match(/\d+/) ? currentUser.name.match(/\d+/)[0] : currentUser.name.charAt(0))
                                    : '👤'
                                }
                            </div>
                            <div className="flex flex-col overflow-hidden w-full">
                                <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest opacity-80">ผู้ดูแลระบบ</span>
                                <span className="font-black text-white text-sm truncate drop-shadow-sm mt-0.5">
                                    {currentUser.name}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ข้อมูลเวอร์ชั่น (โชว์ให้ทุกคนเห็น ไม่ว่าจะล็อกอินหรือไม่) */}
                    <div className="flex flex-col items-center text-center text-emerald-100/60 border-t border-emerald-500/50 pt-4">
                        <span className="text-[10px] font-bold tracking-widest uppercase">Smart City Waste Management</span>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50"></span>
                            <span className="text-[15px] font-medium tracking-wide">Version 1.1.5</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50"></span>
                        </div>
                    </div>
                </div>
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

                    </h2>
                    <div>
                        {!isLoggedIn ? (
                            <button onClick={() => setCurrentPage('admin')} className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                                <LogIn size={14} /> <span>เข้าสู่ระบบ</span>
                            </button>
                        ) : (
                            <button
                                onClick={async () => {
                                    try {
                                        await signOut(auth); // 🌟 สั่งให้ Firebase เตะออกจากเซิร์ฟเวอร์
                                        setIsLoggedIn(false);
                                        setCurrentUser(null);
                                        localStorage.removeItem('is_logged_in');
                                        localStorage.removeItem('current_user');
                                        setCurrentPage('dashboard');
                                    } catch (error) {
                                        console.error("ออกจากระบบล้มเหลว:", error);
                                    }
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
                            onClick={async () => {
                                if (isLoggedIn) {
                                    try {
                                        await signOut(auth); // 🌟 สั่งให้ Firebase เตะออกจากเซิร์ฟเวอร์
                                        setIsLoggedIn(false);
                                        setCurrentUser(null);
                                        localStorage.removeItem('is_logged_in');
                                        localStorage.removeItem('current_user');
                                        setCurrentPage('dashboard');
                                    } catch (error) {
                                        console.error("ออกจากระบบล้มเหลว:", error);
                                    }
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
                {/* ──  Footer ระบบเปรียบเทียบสถิติขยะ MoM (Month-over-Month) ── */}
                <footer className="bg-white border-t border-slate-100 py-6 mt-auto z-10 relative"></footer>
                <footer className="bg-white border-t border-slate-100 py-6 mt-auto z-10 relative">
                    <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                        <div className="flex flex-wrap justify-center items-center gap-6 mb-4">

                            {/* ส่วนเปรียบเทียบยอดขยะ (คำนวณเปรียบเทียบอัตโนมัติ) */}
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-400">แนวโน้มขยะเดือนนี้:</span>
                                <span className={`font-mono px-3 py-1.5 rounded-lg font-black shadow-sm flex items-center gap-1 ${wasteDiffPercent >= 0
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' // ขยะเพิ่มขึ้น (ใช้สีแดงเตือน)
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100' // ขยะลดลง (ใช้สีเขียวชมเชย)
                                    }`}>
                                    {currentMonthWaste.toLocaleString(undefined, { maximumFractionDigits: 1 })} กก.
                                    ({wasteDiffPercent >= 0 ? `↑` : `↓`} {Math.abs(wasteDiffPercent).toFixed(1)}%)
                                </span>
                            </div>

                            {/* สถานะข้อมูลออนไลน์ */}
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-400">สถานะข้อมูล:</span>
                                <span className="font-mono bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-emerald-700 font-bold shadow-sm flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH')}
                                </span>
                            </div>
                        </div>
                        <p className="font-medium text-slate-400">© {new Date().getFullYear() + 543} กองสาธารณสุขและสิ่งแวดล้อมเทศบาลตำบลอุโมงค์</p>
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
                    globalPrices={globalPrices} onSave={async (newMemberData) => {
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