import React, { useState, useEffect } from "react";
import styles from "./NetworkSummary.module.css";

interface Network {
  name: string;
  siteCount: number;
  neCount: number;
}

export const NetworkSummary: React.FC = () => {
  const [networks, setNetworks] = useState<Network[]>([
    { name: "Network A", siteCount: 10, neCount: 100 },
    { name: "Network B", siteCount: 15, neCount: 120 },
    { name: "Network C", siteCount: 8, neCount: 80 },
    { name: "Network D", siteCount: 20, neCount: 150 },
  ]);

  return (
    <div className={styles.outer}>
      <div className={styles.inner}>
        {networks.map((network, index) => (
          <div key={index} className={styles.item}>
            <div className={styles.networkName}>{network.name}</div>
            <div className={styles.networkDetail}>Sites: {network.siteCount}</div>
            <div className={styles.networkDetail}>NEs: {network.neCount}</div>
          </div>
        ))}
      </div>
    </div>
  );
};