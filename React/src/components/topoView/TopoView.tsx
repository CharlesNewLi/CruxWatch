import React from "react";
import { Typography } from "antd";
import styles from "./TopoView.module.css";

const { Title } = Typography;

export const TopoView: React.FC = () => {
  return (
    <div className={styles.topology}>
      <Title level={4}>Network Topology View</Title>
      <div className={styles.topologyPlaceholder}>
        <p>The topology diagram will be displayed here</p>
      </div>
    </div>
  );
};