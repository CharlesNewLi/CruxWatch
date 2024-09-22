import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "../../redux/hooks"; 
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./Map.module.css";

// 使用 Leaflet 的默认图标替换图片路径
import markerIcon from 'leaflet/dist/images/marker-icon.png'; // 静态资源路径
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

interface MapProps {
  selectedNetwork: any; // 根据实际数据结构定义类型
}

export const Map: React.FC<MapProps> = ({ selectedNetwork }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null); // 使用 ref 来存储 map 实例
  const [position, setPosition] = useState<[number, number] | null>(null); // 用来存储当前位置

  // 从 Redux store 中获取网络数据
  const networkStats = useSelector((state) => state.network.networkDetails);

  // 获取用户当前位置
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting the location: ", error);
        }
      );
    }
  }, []);

  // 初始化地图
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current && position) {
      const leafletMap = L.map(mapRef.current).setView(position, 13); // 使用当前位置作为中心点
      mapInstanceRef.current = leafletMap; // 只在第一次加载时初始化地图

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(leafletMap);
    }
  }, [position]); // 仅在 position 更新时初始化地图

  // 自定义图标
  const customIcon = L.icon({
    iconUrl: markerIcon, // 图标的 URL
    iconRetinaUrl: markerIconRetina, // Retina 显示支持
    shadowUrl: markerShadow, // 图标阴影
    iconSize: [25, 41], // 图标大小
    iconAnchor: [12, 41], // 图标锚点
    popupAnchor: [1, -34], // 弹窗位置
    shadowSize: [41, 41], // 阴影大小
  });

  // 当 selectedNetwork 改变时更新地图上的站点位置
  useEffect(() => {
    if (mapInstanceRef.current && selectedNetwork?.network_id) {
      const map = mapInstanceRef.current;

      // 根据传递过来的 selectedNetwork.network_id 在 networkStats 中查找对应网络
      const network = networkStats.find(
        (network: any) => network.network_id === selectedNetwork.network_id
      );

      if (network?.sites?.length) {
        console.log("Found network with sites:", network.sites);

        // 清除现有标记
        map.eachLayer((layer: L.Layer) => {
          if (layer instanceof L.Marker) {
            layer.remove(); // 删除所有现有站点标记
          }
        });

        // 过滤并添加有位置信息的站点
        network.sites.forEach((site: any) => {
          if (site.site_location?.latitude && site.site_location?.longitude) {
            const position: [number, number] = [
              parseFloat(site.site_location.latitude),
              parseFloat(site.site_location.longitude),
            ];
            console.log(`Adding marker for site: ${site.site_name} at position: ${position}`);

            // 使用自定义图标
            L.marker(position, { icon: customIcon }).addTo(map).bindPopup(site.site_name);
          }
        });
      } else {
        console.log("No sites found or no valid site locations for selected network.");
      }
    }
  }, [selectedNetwork, networkStats]);

  return (
    <div className={styles.mapContainer}>
      {!position ? (
        <p>Loading map...</p> // 如果位置尚未确定，显示加载提示
      ) : (
        <div ref={mapRef} className={styles.map}></div> // 一旦位置确定，显示地图
      )}
    </div>
  );
};