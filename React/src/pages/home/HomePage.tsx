import React from "react";
import { Row, Col, Typography, Spin, Button } from "antd";
import styles from "./HomePage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Dashboard, NetworkSummary, Map } from "../../components";

export const HomePage: React.FC = () =>  {

  return (
    <MainLayout>
      <div className={styles["page-content"]}>
        <div style={{ marginTop: 30 }}>
          <Typography.Title level={3} type="success" className={styles["section-title"]}>
            Dashboard
          </Typography.Title>
        </div>
        <Dashboard />
        <Row>
          <Col span={12}>
            <div style={{ marginTop: 30 }}>
              <Typography.Title level={3} type="success" className={styles["section-title"]}>
                Network Summary
              </Typography.Title>
            </div>
            <NetworkSummary />          
          </Col>
          <Col span={12}>
            <div style={{ marginTop: 30 }}>
              <Typography.Title level={3} type="success" className={styles["section-title"]}>
                Map
              </Typography.Title>
            </div>
            <Map />
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
}

