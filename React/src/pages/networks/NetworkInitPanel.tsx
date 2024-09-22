import React, { useState, useMemo } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { addNetworkElement } from "../../redux/network/slice";
import { Button, Typography, Space } from "antd";
import { TopoInitView } from "./TopoInitView"; 
import { ElementForm } from "./ElementForm"; 
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
  const dispatch = useAppDispatch();

  const [neList, setNeList] = useState<string[]>([]); // 存储添加的 NE 列表

  // 从 Redux store 中获取网络数据
  const networkStats = useSelector((state) => state.network.networkDetails);

  // 根据传入的 networkId 找到相应的网络拓扑信息
  const currentTopology = useMemo(() => {
    const selectedNetwork = networkStats.find(network => network.network_id === networkId);
    return selectedNetwork ? selectedNetwork.topology : null;
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
      const response = await dispatch(addNetworkElement(elementData)).unwrap(); // 使用 unwrap 解析 thunk action 的结果

      // 检查返回状态并根据响应决定后续步骤
      if (response.status === "success") {
        console.log("Device added successfully", response);
        setNeList([...neList, neData.neName]); // 添加到已添加设备列表

        // 返回成功结果给调用者
        return response;
      } else {
        console.error("Failed to add device:", response.message);
        throw new Error(response.message || "Failed to add device");
      }
    } catch (error) {
      console.error("Error occurred while adding device:", error);
      throw new Error("Error occurred while adding device");
    }
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
        <div className={styles.formContainer}>
          <ElementForm onSubmit={handleAddNe} />
        </div>

        {/* 拓扑图 */}
        <div className={styles.topoViewContainer}>
          {currentTopology ? (
            <TopoInitView topology={currentTopology} />
          ) : (
            <div>No topology data available</div>
          )}
        </div>
      </Space>
    </div>
  );
};