import React, { useState, useMemo } from "react";
import { Typography, Space, Button } from "antd";
import { useSelector } from "../../redux/hooks"; 
import { useNavigate } from "react-router-dom";
import { TopoView } from "../../components/topoView"; 
import { DeviceQueryModal } from "../../components/deviceQuery/DeviceQueryModal";
import { SettingOutlined, LineChartOutlined, AlertOutlined, SafetyOutlined } from "@ant-design/icons";
import styles from "./NetworkMgmtPanel.module.css";

const { Title } = Typography;

interface NetworkMgmtPanelProps {
  networkName: string;
  networkId: string;
}

export const NetworkMgmtPanel: React.FC<NetworkMgmtPanelProps> = ({
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
  const navigate = useNavigate();


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
        <Button icon={<SettingOutlined />} onClick={() => navigate("/configuration")}></Button>
        <Button icon={<LineChartOutlined />} onClick={() => navigate("/performance")}></Button>
        <Button icon={<AlertOutlined />} onClick={() => navigate("/fault")}></Button>
        <Button icon={<SafetyOutlined />} onClick={() => navigate("/security")}></Button>
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
          <DeviceQueryModal
            visible={modalVisible}
            selectedDevice={selectedDevice}
            networkName={networkName}
            onClose={handleCloseModal}
          />
        )}
    </div>
  );
};