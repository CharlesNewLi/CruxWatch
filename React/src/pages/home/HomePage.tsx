import React, {useState} from "react";
import { Row, Col, Typography, Spin, Button } from "antd";
import styles from "./HomePage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Dashboard, NetworkSummary, Map } from "../../components";

export const HomePage: React.FC = () =>  {
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null); // 保存选中的网络

  // 处理选中的网络
  const handleNetworkSelect = (network: any) => {
    setSelectedNetwork(network);
  };

  return (
    <MainLayout>
      <Typography.Title level={3} type="success" className={styles["section-title"]} style={{ marginTop: 30 }}>
        Dashboard
      </Typography.Title>
      <Dashboard/>
      <Row>
        <Col span={12}>
          <Typography.Title level={3} type="success" className={styles["section-title"]}>
            Network Summary
          </Typography.Title>
          <NetworkSummary onNetworkSelect={handleNetworkSelect}/>          
        </Col>
        <Col span={12}>
          <Typography.Title level={3} type="success" className={styles["section-title"]}>
            Map
          </Typography.Title>
          <Map selectedNetwork={selectedNetwork}/>
        </Col>
      </Row>
    </MainLayout>
  );
}

