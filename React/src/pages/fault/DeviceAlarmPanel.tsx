import React, { useState, useMemo } from "react";
import { Typography, Space, Button } from "antd";
import { useSelector } from "../../redux/hooks"; 
import { useNavigate } from "react-router-dom";
import { TopoView } from "../../components/topoView"; 
import { AlarmCollectionPanel } from "../../components/alarmCollection/AlarmCollectionPanel"; 
import { ClusterOutlined, SettingOutlined, LineChartOutlined, SafetyOutlined } from "@ant-design/icons";
import styles from "./DeviceAlarmPanel.module.css";

const { Title } = Typography;

interface DeviceAlarmPanelProps {
  networkName: string;
  networkId: string;
  trapData: any[]; // 接收 trapData 作为 props
}

export const DeviceAlarmPanel: React.FC<DeviceAlarmPanelProps> = ({
  networkName,
  networkId,
  trapData,
}) => {
  const networkStats = useSelector((state) => state.network.networkDetails);

  const currentTopology = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.topology : null;
  }, [networkId, networkStats]);

  const currentDevices = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.elements : {};
  }, [networkId, networkStats]);

  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const navigate = useNavigate();

  const handleDeviceClick = (device: any) => {
    setSelectedDevice(device);
  };

  return (
    <div className={styles.panel}>
      {/* Center the title */}
      <div style={{ textAlign: "center" }}>
        <Title level={4}>{networkName} Fault Monitor</Title>
      </div>
      
      <Space className={styles.buttonSpace}>
        <Button icon={<ClusterOutlined />} onClick={() => navigate("/networks")}></Button>
        <Button icon={<SettingOutlined />} onClick={() => navigate("/configuration")}></Button>
        <Button icon={<LineChartOutlined />} onClick={() => navigate("/performance")}></Button>
        <Button icon={<SafetyOutlined />} onClick={() => navigate("/security")}></Button>
      </Space>
      
      {/* 告警面板接收 trapData */}
      <AlarmCollectionPanel trapData={trapData} />

      {/* 拓扑视图 */}
      <div className={styles.topoViewContainer}>
        {currentTopology ? (
          <TopoView 
            topology={currentTopology} 
            elements={currentDevices} 
            onDeviceClick={handleDeviceClick}
          />
        ) : (
          <div>No topology data available</div>
        )}
      </div>
    </div>
  );
};