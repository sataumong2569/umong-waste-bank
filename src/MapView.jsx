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
    const [isMapReady, setIsMapReady] = useState(false); // เพิ่มสถานะนี้เพื่อคุมการวาดหมุด

    const displayedMembers = useMemo(() => {
        if (filterId === 'all') return members;
        return members.filter(m => String(m.villageId) === String(filterId));
    }, [members, filterId]);

    // 1. Setup Map
    useEffect(() => {
        const L = window.L;
        if (!L || mapRef.current || currentLocation.lat === 0) return;

        mapRef.current = L.map('map-container', {
            maxBounds: [[17.5, 98.6], [18.8, 99.3]],
            maxBoundsViscosity: 1.0,
            minZoom: 10
        }).setView([currentLocation.lat, currentLocation.lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, keepBuffer: 2
        }).addTo(mapRef.current);

        // ให้เวลาแมพโหลดขนาดเสร็จแล้วค่อยบอกว่าพร้อม
        const timer = setTimeout(() => {
            if (mapRef.current) {
                mapRef.current.invalidateSize();
                setIsMapReady(true);
            }
        }, 500);

        // โค้ดทำลายแผนที่จะทำงานแค่ตอน "ปิดหน้าต่าง/ย้ายหน้าเว็บ" เท่านั้น
        return () => {
            clearTimeout(timer);
            if (mapRef.current) {
                mapRef.current.off();
                mapRef.current.remove();
                mapRef.current = null;
                setIsMapReady(false);
            }
        };
    }, []); // 🌟 จุดสำคัญ: ต้องแก้กลับเป็นวงเล็บว่าง [] เท่านั้นครับ!

    // 2. วาดหมุดสมาชิก (รอให้ isMapReady เป็น true)
    useEffect(() => {
        if (!isMapReady || !mapRef.current || currentLocation.lat === 0) return;

        console.log("กำลังวาดหมุดสมาชิก จำนวน:", displayedMembers.length);

        if (!clusterGroupRef.current) {
            clusterGroupRef.current = L.markerClusterGroup({ chunkedLoading: true });
            mapRef.current.addLayer(clusterGroupRef.current);
        }
        clusterGroupRef.current.clearLayers();

        displayedMembers.filter(m => m.lat && m.lng).forEach(m => {
            // แปลงตัวเลขให้มีลูกน้ำและทศนิยม 2 ตำแหน่ง
            const formattedBalance = Number(m.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const marker = L.marker([m.lat, m.lng]).bindPopup(
                `<b>🏠 บ้านเลขที่ ${m.houseNo}</b><br>
                 หมวด: ${m.category || 'ไม่ระบุ'}<br>
                 <b>💰 ยอดเงินคงเหลือ: ฿${formattedBalance}</b>`
            );
            clusterGroupRef.current.addLayer(marker);
        })
    }, [displayedMembers, isMapReady]);

    // 3. ปักหมุดตัวเรา (รอให้ isMapReady เป็น true)
    useEffect(() => {
        // เพิ่มเช็คพิกัดจริง
        if (!isMapReady || !mapRef.current || currentLocation.lat === 0) return;

        const L = window.L;
        const latLng = [currentLocation.lat, currentLocation.lng];

        if (!myMarkerRef.current) {
            // สร้างครั้งแรก
            const myIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
            });
            myMarkerRef.current = L.marker(latLng, { icon: myIcon }).addTo(mapRef.current).bindPopup("<b>คุณอยู่ที่นี่</b>");
        } else {
            // อัปเดตตำแหน่งหมุดตัวเราทุกครั้งที่ currentLocation เปลี่ยน
            myMarkerRef.current.setLatLng(latLng);
        }
        mapRef.current.setView(latLng, 16);
    }, [currentLocation, isMapReady]);


    return (
        <div className="flex flex-col gap-4">
            <div className="relative h-[600px] w-full rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                <div id="map-container" className="h-full w-full z-0"></div>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        findMyLocation(); // ดึงพิกัดใหม่

                        // อัปเดตตำแหน่งหมุดและเลื่อนแมพเฉพาะตอนที่กดปุ่มเท่านั้น
                        if (myMarkerRef.current) {
                            myMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
                        }
                        mapRef.current?.flyTo([currentLocation.lat, currentLocation.lng], 16, { animate: true });
                    }}
                    className="absolute top-6 right-6 z-[1000] bg-white p-4 rounded-2xl shadow-lg text-blue-600"
                >
                    <Navigation size={24} />
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200">
                <label className="block text-sm font-bold text-slate-500 mb-2">เลือกหมวดหมู่เพื่อดูสมาชิก:</label>
                <select onChange={(e) => setFilterId(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-slate-100 outline-none">
                    <option value="all">🌐 แสดงทุกหมวดหมู่ (รวม {displayedMembers.length} หลัง)</option>
                    {villages?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </div>

            {isLoggedIn && (
                <button onClick={(e) => { e.preventDefault(); onPinLocation(currentLocation); }} className="w-full bg-green-600 text-white p-4 rounded-2xl font-bold shadow-lg">
                    <MapPin className="inline mr-2" /> ปักหมุดลงทะเบียนบ้านนี้
                </button>
            )}
        </div>
    );
};
export default MapView;