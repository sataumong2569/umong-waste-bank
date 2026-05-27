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

    const displayedMembers = useMemo(() => {
        if (filterId === 'all') return members;
        return members.filter(m => String(m.villageId) === String(filterId));
    }, [members, filterId]);

    // 1. Initial Map Setup (สร้างแมพครั้งเดียว)
    useEffect(() => {
        const L = window.L;
        if (!L || mapRef.current) return;

        mapRef.current = L.map('map-container', {
            maxBounds: [[17.5, 98.6], [18.8, 99.3]],
            maxBoundsViscosity: 1.0
        }).setView([currentLocation.lat, currentLocation.lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    }, []);

    // 2. วาดหมุดสมาชิก (เฉพาะตอนเปลี่ยน Filter)
    useEffect(() => {
        const L = window.L;
        if (!L || !mapRef.current) return;

        if (clusterGroupRef.current) clusterGroupRef.current.clearLayers();
        else clusterGroupRef.current = L.markerClusterGroup({ chunkedLoading: true });

        displayedMembers.filter(m => m.lat && m.lng).forEach(m => {
            const popupContent = `
                <div style="font-family: sans-serif; text-align: left;">
                    <h4 style="margin:0; color:#1e3a8a;">🏠 บ้านเลขที่ ${m.houseNo}</h4>
                    <p style="margin:2px 0;">หมวด: ${m.category || 'ไม่ระบุ'}</p>
                    <b style="color:#d97706;">🪙 เครดิต: ${(m.credit || 0).toLocaleString()}</b>
                </div>
            `;
            const marker = L.marker([m.lat, m.lng]).bindPopup(popupContent);
            clusterGroupRef.current.addLayer(marker);
        });
        mapRef.current.addLayer(clusterGroupRef.current);
    }, [displayedMembers]);

    // 3. หมุดตัวเอง (ตามตำแหน่งจริง)
    useEffect(() => {
        const L = window.L;
        if (!L || !mapRef.current) return;

        if (myMarkerRef.current) mapRef.current.removeLayer(myMarkerRef.current);

        const myIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            iconSize: [25, 41], iconAnchor: [12, 41]
        });

        myMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: myIcon })
            .addTo(mapRef.current).bindPopup("<b>คุณอยู่ที่นี่</b>");
    }, [currentLocation]);

    return (
        <div className="flex flex-col gap-4">
            <div className="relative h-[600px] w-full rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                <div id="map-container" className="h-full w-full z-0"></div>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        findMyLocation();
                        mapRef.current?.flyTo([currentLocation.lat, currentLocation.lng], 16);
                    }}
                    className="absolute top-6 right-6 z-[1000] bg-white p-4 rounded-2xl shadow-lg text-blue-600"
                >
                    <Navigation size={24} />
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200">
                <label className="block text-sm font-bold text-slate-500 mb-2">เลือกหมวดหมู่เพื่อดูสมาชิก:</label>
                <select onChange={(e) => setFilterId(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-slate-100 outline-none">
                    <option value="all">🌐 แสดงทุกหมวดหมู่ (รวม {displayedMembers.length} หลัง)</option>
                    {villages?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </div>
        </div>
    );
};
export default MapView;