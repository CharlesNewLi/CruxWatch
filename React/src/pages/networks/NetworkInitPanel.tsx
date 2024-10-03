import React, { useState, useMemo } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { addNetworkElement, setElementSNMP, NeighborDiscover } from "../../redux/element/slice";
import { Button, Typography, Space } from "antd";
import { TopoInitView } from "./TopoInitView"; 
import { ElementForm } from "./ElementForm"; 
import { DeviceConfigModal } from "../../components/deviceConfig/DeviceConfigModal";
import styles from "./NetworkInitPanel.module.css";

const { Title } = Typography;

interface NetworkInitPanelProps {
  networkName: string;
  networkId: string;
  onFinalize: () => void;
  onUpdate: () => void;
}

export const NetworkInitPanel: React.FC<NetworkInitPanelProps> = ({
  networkName,
  networkId,
  onFinalize,
  onUpdate,
}) => {
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
   
  const [neList, setNeList] = useState<string[]>([]); // 存储添加的 NE 列表

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null); // 当前选中的设备
  const [modalVisible, setModalVisible] = useState(false); // 控制弹出框显示
  
  const dispatch = useAppDispatch();

  // 从 Redux store 中获取网络数据
  const networkStats = useSelector((state) => state.network.networkDetails);

  // 根据传入的 networkId 找到相应的网络拓扑信息
  const currentTopology = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.topology : null;
  }, [networkId, networkStats]);

  // 根据传入的 networkId 找到相应的设备信息
  const currentDevices = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    // 打印设备信息
    console.log("currentDevices:", selectedNetwork ? selectedNetwork.elements : {});
    return selectedNetwork ? selectedNetwork.elements : {}; // 返回 devices 对象，默认为空对象
  }, [networkId, networkStats]);

  // 处理提交逻辑
  const handleAddNe = async (neData: any): Promise<any> => {
    const elementData = {
      ne_name: neData.neName,
      ne_type: neData.neType,
      ne_make: neData.neMake,
      ne_ip: neData.neIpAddress,
      ssh_username: neData.sshUsername,
      ssh_password: neData.sshPassword,
      ssh_secret: neData.sshSecret,
      network_name: networkName
    };

    console.log("Payload being dispatched: ", elementData); // 打印正在提交的表单数据

    try {
      // 调用 Redux action 发送请求并等待响应
      const response = await dispatch(addNetworkElement(elementData)).unwrap();
      
      console.log("Response from backend: ", response); // 打印后端返回的响应
  
      // 检查返回状态并根据响应决定后续步骤
      if (response.status === "success" && response.device) {
        console.log("Device added successfully", response.device);
        setNeList([...neList, neData.neName]); // 添加到已添加设备列表
  
        return response.device; // 返回设备对象
      } else {
        console.error("Failed to add device or update topology:", response.message);
        throw new Error(response.message || "Failed to add device or update topology.");
      }
    } catch (error) {
      console.error("Error occurred while adding device:", error);
      throw new Error("Error occurred while adding device.");
    }
  };

  // SNMP 提交逻辑
  const handleSetSNMP = async (neData: any): Promise<any> => {
    const snmpPayload = {
      ne_name: neData.neName,
      ne_ip: neData.neIpAddress,
      snmp_username: neData.snmpUsername,
      snmp_auth_protocol: neData.snmpAuthProtocol,
      snmp_auth_password: neData.snmpAuthPassword,
      snmp_priv_protocol: neData.snmpPrivProtocol,
      snmp_priv_password: neData.snmpPrivPassword,
      network_name: networkName
    };
    
    // 打印 SNMP 提交数据
    console.log("SNMP Payload being submitted: ", snmpPayload);

    try {
      const response = await dispatch(setElementSNMP(snmpPayload)).unwrap();
      console.log("SNMP setup response: ", response); // 打印 SNMP 配置成功返回的数据
      return response;  // 返回处理后的结果
    } catch (error) {
      console.error("Error during SNMP setup: ", error);
      throw new Error("SNMP setup failed.");
    }
  };

  // 处理邻居发现的函数
  const handleNeighborDisc = async (neData: any) => {
    const neighborPayload = {
      ne_name: neData.neName,
      ne_ip: neData.neIpAddress,
      ne_make: neData.neMake,
      snmp_username: neData.snmpUsername,
      snmp_auth_protocol: neData.snmpAuthProtocol,
      snmp_auth_password: neData.snmpAuthPassword,
      snmp_priv_protocol: neData.snmpPrivProtocol,
      snmp_priv_password: neData.snmpPrivPassword,
      network_name: networkName,
    };
    console.log("Discovering neighbors with: ", neighborPayload);

    try {
      // 发起 NeighborDiscover 请求，不再处理 neighbors 字段
      const response = await dispatch(NeighborDiscover(neighborPayload)).unwrap();
      
        // 检查是否收到了正确的响应
      if (!response) {
        console.error("No response received from NeighborDiscover.");
        setErrorMessage("No response received from backend.");
        return;
      }
      
      console.log("Neighbor discovery response: ", response);

      // 如果发现成功
      if (response.status === "success") {
        setSuccessMessage(response.message || "Neighbor discovery successful.");
        setErrorMessage("");
        // 此处可以根据 response.devices 和 response.topology 来做进一步处理或更新状态
        console.log("Discovered devices:", response.devices);
        console.log("Updated topology:", response.topology);
      } else {
        setErrorMessage(response?.message || "Failed to discover neighbors.");
      }

       // 在这里返回响应
      return response;
      
    } catch (error) {
      console.error("Error during neighbor discovery:", error);
      setErrorMessage("Neighbor discovery failed.");
    }
  };
  
  <ElementForm onSSHSubmit={handleAddNe} onSNMPSubmit={handleSetSNMP} onDiscoverNeighbors={handleNeighborDisc}  />
  

  // 处理点击设备名称
  const handleDeviceClick = (deviceName: string) => {
    const selectedDeviceData = currentDevices[deviceName]; // 从 currentDevices 中获取设备信息
    setSelectedDevice(selectedDeviceData); // 传递设备信息而非名称
    setModalVisible(true);
  };

  // 关闭弹出框
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedDevice(null);
  };
        
  return (
    <div className={styles.panel}>
      <Title level={4}>Initialize {networkName}</Title>
      <Space direction="vertical" size="large">
        
        {/* 操作按钮 */}
        <Space size="middle" className={styles.buttonSpace}>
          <Button type="default" className={styles.button} onClick={onUpdate}>
            Update
          </Button>
          <Button type="primary" className={styles.button} onClick={onFinalize}>
            OK
          </Button>
        </Space>

        {/* 添加 NE 表单 */}
        <div>
          <ElementForm 
            onSSHSubmit={handleAddNe} 
            onSNMPSubmit={handleSetSNMP}
            onDiscoverNeighbors={handleNeighborDisc}
          />
        </div>

        {/* 拓扑图 */}
        <div>
          {currentTopology ? (
            <TopoInitView 
            topology={currentTopology} 
            elements={currentDevices}
            onDeviceClick={handleDeviceClick}
            />
          ) : (
            <div>No topology data available</div>
          )}
        </div>

        {/* 配置弹出框 */}
        {selectedDevice && (
          <DeviceConfigModal
            visible={modalVisible}
            selectedDevice={selectedDevice}
            networkName={networkName}
            onClose={handleCloseModal}
          />
        )}
      </Space>
    </div>
  );
};