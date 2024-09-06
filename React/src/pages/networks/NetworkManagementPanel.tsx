import React from "react";
import { Typography, Space, Button } from "antd";
import { SettingOutlined, ReloadOutlined, AlertOutlined } from '@ant-design/icons';
import styles from "./NetworkPage.module.css";

const { Title } = Typography;

interface NetworkManagementPanelProps {
  networkName: string;
}

export const NetworkManagementPanel: React.FC<NetworkManagementPanelProps> = ({
  networkName,
}) => {
  return (
    <div className={styles.panel}>
      <Title level={4}>{networkName} Management</Title>
      <Space>
        <Button icon={<SettingOutlined />} />
        <Button icon={<ReloadOutlined />} />
        <Button icon={<AlertOutlined />} />
      </Space>
    </div>
  );
};