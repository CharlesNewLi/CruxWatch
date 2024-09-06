import React, { useState } from "react";
import { Button, Typography, Space } from "antd";
import { TopoView } from "../../components"; // 确保正确导入 TopoView 组件
import styles from "./NetworkPage.module.css";

const { Title } = Typography;

interface NetworkInitializationPanelProps {
  networkName: string;
  onFinalize: () => void;
  onUpdate: () => void;
}

// NE 表单组件
interface NetworkFormProps {
  onSubmit: (neName: string) => void;
}

export const NetworkForm: React.FC<NetworkFormProps> = ({ onSubmit }) => {
  const [neName, setNeName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (neName.trim()) {
      onSubmit(neName);
      setNeName(""); // 提交后清空输入框
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.networkForm}>
      <label>
        NE Name:
        <input
          type="text"
          value={neName}
          onChange={(e) => setNeName(e.target.value)}
          required
        />
      </label>
      <Button type="primary" htmlType="submit" className={styles.addNeButton}>
        Add NE
      </Button>
    </form>
  );
};

export const NetworkInitializationPanel: React.FC<NetworkInitializationPanelProps> = ({
  networkName,
  onFinalize,
  onUpdate,
}) => {
  const [neList, setNeList] = useState<string[]>([]); // 存储添加的 NE 列表

  const handleAddNe = (neName: string) => {
    setNeList([...neList, neName]); // 添加新的 NE 到列表
  };

  return (
    <div className={styles.panel}>
      <Title level={4}>Initialize {networkName}</Title>
      <Space direction="vertical" size="large" className={styles.panelSpace}>
        {/* 添加 NE 表单 */}
        <NetworkForm onSubmit={handleAddNe} />

        {/* 显示已添加的 NE 列表 */}
        <div className={styles.neList}>
          <Title level={5}>Added NEs:</Title>
          <ul>
            {neList.map((ne, index) => (
              <li key={index}>{ne}</li>
            ))}
          </ul>
        </div>

        {/* 操作按钮 */}
        <Space size="middle" className={styles.buttonSpace}>
          <Button type="default" className={styles.button} onClick={onUpdate}>
            Update
          </Button>
          <Button type="primary" className={styles.button} onClick={onFinalize}>
            OK
          </Button>
        </Space>

        {/* 添加 TopoView 组件 */}
        <div className={styles.topoViewContainer}>
          <TopoView />
        </div>
      </Space>
    </div>
  );
};

// 主页面 NetworkPage 的实现
export const NetworkPage: React.FC = () => {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [isCreatingNetwork, setIsCreatingNetwork] = useState<boolean>(false);

  const handleAddNetwork = () => {
    setIsCreatingNetwork(true); // 显示表单
  };

  const handleFinalizeNetwork = () => {
    console.log("Network finalized: ", selectedNetwork);
    setIsCreatingNetwork(false); // 停止创建流程
  };

  const handleUpdateNetwork = () => {
    console.log("Network updated: ", selectedNetwork);
  };

  return (
    <div className={styles.container}>
      <Space direction="vertical" className={styles.addNetwork}>
        <Button type="primary" onClick={handleAddNetwork}>
          Add Network
        </Button>
        {isCreatingNetwork ? (
          <NetworkForm onSubmit={() => handleFinalizeNetwork()} />
        ) : (
          <NetworkInitializationPanel
            networkName={selectedNetwork || "Unnamed Network"}
            onFinalize={handleFinalizeNetwork}
            onUpdate={handleUpdateNetwork} 
          />
        )}
      </Space>
    </div>
  );
};