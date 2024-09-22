import React from "react";
import { useSelector } from "../../redux/hooks"; 
import styles from "./NetworkSummary.module.css";
import Sider from "antd/lib/layout/Sider";

interface NetworkSummaryProps {
  onNetworkSelect: (network: any) => void;
}

export const NetworkSummary: React.FC<NetworkSummaryProps> = ({ onNetworkSelect }) => {


  // 从 Redux store 中获取状态
  const networksStats = useSelector((state) => state.networks.data);
  const networksLoading = useSelector((state) => state.networks.loading);
  const networksError = useSelector((state) => state.networks.error);

  // 加载状态处理
  if (networksLoading) return <div>Loading...</div>;
  if (networksError) return <div>Error: {networksError}</div>;

  // 如果没有数据
  if (!networksStats?.networks?.length) {
    return <div>No networks available</div>;
  }

  return (
    <div className={styles.outer}>
      {networksStats.networks.map((network) => (
        <Sider width={"auto"} className={styles.inner} key={network.network_id}
          onClick={() => {
            onNetworkSelect(network); }} 
        >
          <div className={styles.item}>
            <div className={styles.networkName}>{network.network_name}</div>
            <div className={styles.networkDetail}>
              <span className={styles.label}>Sites:</span>
              <span className={styles.data}>{network.site_count}</span>
            </div>
            <div className={styles.networkDetail}>
              <span className={styles.label}>NEs:</span>
              <span className={styles.data}>{network.ne_count}</span>
            </div>
          </div>
        </Sider>
      ))}
    </div>
  );
};