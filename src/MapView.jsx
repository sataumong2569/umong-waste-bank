import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Navigation, MapPin } from 'lucide-react';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

const MapView = ({ currentLocation, members, findMyLocation, onPinLocation, isLoggedIn, villages }) => {
    const mapRef = useRef(null);
    const clusterGroupRef = useRef(null);
    const myMarkerRef = useRef(null);
    const [filterId, setFilterId] = useState('all');

    // กรองสมาชิกตามหมวดหมู่
    const displayedMembers = useMemo(() => {
        if (!members) return [];
        if (filterId === 'all') return members;
        return members.filter(m => String(m.villageId) === String(filterId) || String(m.category) === String(filterId));
    }, [members, filterId]);

    // 1. Setup Map แบบเซฟ Memory (วาดครั้งเดียวตอนกดเปิด)
    useEffect(() => {
        const L = window.L;
        const mapContainer = document.getElementById('map-container');

        if (!L || !mapContainer || mapRef.current) return;

        // สร้างแผนที่ (ดึงพิกัด currentLocation จาก App.jsx มาใช้อัตโนมัติ)
        mapRef.current = L.map('map-container', {
            maxBounds: [[17.5, 98.6], [18.8, 99.3]], // ล็อกโซนลำพูน-เชียงใหม่
            maxBoundsViscosity: 1.0,
            minZoom: 12 // กันผู้ใช้ซูมออกไปดูทั้งโลก (ลดการโหลดรูปแผนที่)
        }).setView([currentLocation?.lat || 18.653733, currentLocation?.lng || 99.038667], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap',
            keepBuffer: 2 // เก็บ Cache รูปไว้ในเครื่อง จะได้ไม่โหลดซ้ำ
        }).addTo(mapRef.current);

        // สร้างกลุ่มหมุด (Cluster) เพื่อลดภาระเครื่องเวลามีบ้านหลายร้อยหลัง
        clusterGroupRef.current = L.markerClusterGroup({
            chunkedLoading: true, // ทยอยโหลดหมุด ไม่โหลดตู้มเดียว
            spiderfyOnMaxZoom: true
        });
        mapRef.current.addLayer(clusterGroupRef.current);

        // แก้อาการแผนที่เทา (โหลดไม่เต็มกรอบ)
        setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
        }, 300);

        // ทำลายแผนที่ทิ้งและคืน Memory ให้คอมพิวเตอร์ตอนกดปิด/เปลี่ยนหน้า
        return () => {
            if (mapRef.current) {
                mapRef.current.off();
                mapRef.current.remove();
                mapRef.current = null;
                clusterGroupRef.current = null;
                myMarkerRef.current = null;
            }
        };
    }, []); // ทำงานรอบเดียวตอนเปิดหน้าแผนที่

    // 2. วาดหมุดและอัปเดตเมื่อเปลี่ยนหมวด
    useEffect(() => {
        if (!mapRef.current || !clusterGroupRef.current) return;

        const L = window.L;
        clusterGroupRef.current.clearLayers(); // ล้างหมุดเก่าออกก่อนวาดใหม่

        const markers = displayedMembers
            .filter(m => m.lat && m.lng)
            .map(m => {
                const formattedBalance = Number(m.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                const marker = L.marker([m.lat, m.lng]);

                // ออกแบบหน้าต่าง Popup ให้สวยงามและอ่านง่ายขึ้น
                marker.bindPopup(
                    `<div class="text-center font-sans">
                        <b class="text-blue-700 text-sm">🏠 บ้านเลขที่ ${m.houseNo}</b><br>
                        <span class="text-xs text-slate-500">${m.category || 'ไม่ระบุหมวด'}</span><br>
                        <div class="mt-2 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-200">
                            <b>💰 ฿${formattedBalance}</b>
                        </div>
                    </div>`
                );
                return marker;
            });

        clusterGroupRef.current.addLayers(markers);
    }, [displayedMembers]);

    // 3. ปักหมุดตำแหน่งปัจจุบันของตัวเรา
    useEffect(() => {
        if (!mapRef.current || !currentLocation || currentLocation.lat === 0) return;

        const L = window.L;
        const latLng = [currentLocation.lat, currentLocation.lng];

        if (!myMarkerRef.current) {
            const myIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            });
            myMarkerRef.current = L.marker(latLng, { icon: myIcon, zIndexOffset: 1000 })
                .addTo(mapRef.current)
                .bindPopup("<b class='text-emerald-700'>📍 คุณอยู่ที่นี่</b>");
        } else {
            myMarkerRef.current.setLatLng(latLng);
        }
    }, [currentLocation]);

    return (
        <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-300">
            {/* แถบตัวกรอง */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center">
                <span className="font-bold text-slate-600 whitespace-nowrap"><MapPin size={18} className="inline mr-1 text-blue-500" /> ดูแผนที่สมาชิก:</span>
                <select
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    className="w-full sm:flex-1 p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 outline-none focus:border-blue-500 text-sm cursor-pointer"
                >
                    <option value="all">🌐 แสดงทั้งหมด (รวม {members?.length || 0} หลัง)</option>
                    {villages?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </div>

            {/* แผนที่ */}
            <div className="relative h-[500px] sm:h-[600px] w-full rounded-3xl overflow-hidden border border-slate-200 shadow-md">
                <div id="map-container" className="h-full w-full z-0 bg-slate-100"></div>

                {/* ปุ่มดึงพิกัด GPS กลับมาที่ตัวเรา */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        if (typeof findMyLocation === 'function') findMyLocation();
                        if (mapRef.current && currentLocation) {
                            mapRef.current.flyTo([currentLocation.lat, currentLocation.lng], 17, { animate: true, duration: 1.5 });
                        }
                    }}
                    className="absolute top-4 right-4 z-[1000] bg-white p-3.5 rounded-2xl shadow-lg text-blue-600 hover:bg-blue-50 hover:scale-105 transition-all border border-slate-100 group"
                    title="เลื่อนมาตำแหน่งของฉัน"
                >
                    <Navigation size={22} className="group-hover:rotate-45 transition-transform duration-300" />
                </button>
            </div>

            {/* ปุ่มลงทะเบียน (แสดงเฉพาะตอนล็อกอินเป็นแอดมิน) */}
            {isLoggedIn && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        if (typeof onPinLocation === 'function') onPinLocation(currentLocation);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-black shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2"
                >
                    <MapPin size={20} /> ยืนยันพิกัด และลงทะเบียนบ้านใหม่ที่นี่
                </button>
            )}
        </div>
    );
};

export default MapView;