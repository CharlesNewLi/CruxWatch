import React from "react";
import { Row, Col, Typography, Spin, Button } from "antd";
import styles from "./HomePage.module.css";
import { MainLayout } from "../../layout/mainLayout";


export const HomePage: React.FC = () =>  {

  return (
    <MainLayout>
      <div className={styles["page-content"]}>
        <Row>
          <Typography>Dashboad</Typography>
          <Col span={8}>
            <Row></Row>
          </Col>
          <Col span={8}>
            <Row></Row>
            <Row></Row>
          </Col>
          <Col span={8}>
            <Row></Row>
            <Row></Row>
          </Col>
        </Row>
        <Row>
          <Col span={12}>
            <Typography>Network Summary</Typography>
            <Row></Row>
          </Col>
          <Col span={12}>
            <Typography>Map</Typography>
            <Row></Row>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
}

