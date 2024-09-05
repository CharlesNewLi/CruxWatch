import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./Map.module.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export const Map: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null); 
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {

    navigator.geolocation.getCurrentPosition(
      (location) => {
        setPosition([location.coords.latitude, location.coords.longitude]);
      },
      (error) => {
        console.error("Error getting the location: ", error);
      }
    );
  }, []);

  useEffect(() => {
    if (mapRef.current && position && !map) {

      const leafletMap = L.map(mapRef.current).setView(position, 10);
      setMap(leafletMap);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(leafletMap);

      L.marker(position).addTo(leafletMap);
    }

    return () => {
      map?.remove();
    };
  }, [position, map]);

  return (
    <div className={styles.mapContainer}>
      {position ? (
        <div ref={mapRef} className={styles.map}></div>
      ) : (
        <p>Loading map...</p>
      )}
    </div>
  );
};