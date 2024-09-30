import React, { useState, useMemo } from "react";
import { Typography, Space, Button } from "antd";
import { useSelector } from "../../redux/hooks"; 
import { TopoView } from "../../components/topoView"; 
import { PerfQueryModal } from "../../components/perfQuery/PerfQueryModal";
import { SettingOutlined, ReloadOutlined, AlertOutlined } from "@ant-design/icons";
import styles from "./DevicePerfPanel.module.css";

const { Title } = Typography;

interface DevicePerfPanelProps {
  networkName: string;
  networkId: string;
}

export const DevicePerfPanel: React.FC<DevicePerfPanelProps> = ({
  networkName,
  networkId,
}) => {

  // Get the network data from Redux
  const networkStats = useSelector((state) => state.network.networkDetails);

  // Retrieve the network topology for the given networkId
  const currentTopology = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.topology : null;
  }, [networkId, networkStats]);

  // Get current network devices
  const currentDevices = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.elements : {}; // Ensure it's a valid object
  }, [networkId, networkStats]);

  const [selectedDevice, setSelectedDevice] = useState<any | null>(null); // 当前选中的设备
  const [modalVisible, setModalVisible] = useState(false); // 控制弹出框显示

  // Handle configuration button click (for device config)
  const handleConfigureDevice = () => {
    console.log("Device configuration clicked");
  };

  // Handle reload button click (to refresh topology)
  const handleReloadNetwork = () => {
    console.log("Reload network clicked");
  };

  // Handle alert button click (to check for issues)
  const handleAlertCheck = () => {
    console.log("Alert check clicked");
  };

   // 处理点击设备
   const handleDeviceClick = (device: any) => {
    setSelectedDevice(device); // 传递完整的设备信息
    setModalVisible(true);
  };

  // 关闭弹出框
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedDevice(null);
  };

  return (
    <div className={styles.panel}>
      <Title level={4}>{networkName} Management</Title>
      
      <Space className={styles.buttonSpace}>
        <Button icon={<SettingOutlined />} onClick={handleConfigureDevice}>Configure Device</Button>
        <Button icon={<ReloadOutlined />} onClick={handleReloadNetwork}>Reload</Button>
        <Button icon={<AlertOutlined />} onClick={handleAlertCheck}>Check Alerts</Button>
      </Space>

      {/* Topology View */}
      <div className={styles.topoViewContainer}>
        {currentTopology ? (
          <TopoView 
            topology={currentTopology} 
            elements={currentDevices} 
            onDeviceClick={handleDeviceClick}  // 改为正确传递设备对象
          />
        ) : (
          <div>No topology data available</div>
        )}
      </div>

      {/* 配置弹出框 */}
      {selectedDevice && (
          <PerfQueryModal
            visible={modalVisible}
            selectedDevice={selectedDevice}
            networkName={networkName}
            onClose={handleCloseModal}
          />
        )}
    </div>
  );
};