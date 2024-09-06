import React from "react";
import { Row, Col, Typography, Spin, Button } from "antd";
import styles from "./HomePage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Dashboard, NetworkSummary, Map } from "../../components";

export const HomePage: React.FC = () =>  {

  return (
    <MainLayout>
      <Typography.Title level={3} type="success" className={styles["section-title"]} style={{ marginTop: 30 }}>
        Dashboard
      </Typography.Title>
      <Dashboard />
      <Row>
        <Col span={12}>
          <Typography.Title level={3} type="success" className={styles["section-title"]}>
            Network Summary
          </Typography.Title>
          <NetworkSummary />          
        </Col>
        <Col span={12}>
          <Typography.Title level={3} type="success" className={styles["section-title"]}>
            Map
          </Typography.Title>
          <Map />
        </Col>
      </Row>
    </MainLayout>
  );
}

