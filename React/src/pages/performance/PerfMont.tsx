import React, { useState } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import styles from "./PerfMont.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Layout, Button, Space, Typography, Modal, Select } from "antd";
import { NetworksTree } from "../../components/networkstree";
import { DevicePerfPanel } from "./DevicePerfPanel";

const { Sider, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export const PerfMont: React.FC = () => {
  const dispatch = useAppDispatch();

  const [showExistingNetworks, setShowExistingNetworks] = useState(true);

  // 存储选中的网络名称与 ID
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);


  // 从 Redux store 中获取网络数据
  const networksStats = useSelector((state) => state.networks.data);
  console.log("Networks Stats:", networksStats);
  const networkItems = networksStats?.networks || [];
  console.log("Networks Items:", networkItems);

  // 获取选中的网络的锁定状态（从 Redux store 中获取 isLocked）
  const selectedNetworkObj = networkItems.find(network => network.network_id === selectedNetwork);
  const isNetworkLocked = selectedNetworkObj?.isLocked || false;

   // 构建每个网络的锁定状态映射表，键是 `network_id`，值是 `isLocked`
   const lockedNetworks = networkItems.reduce((acc, network) => {
    acc[network.network_id] = network.isLocked || false;
    return acc;
  }, {} as { [key: string]: boolean });


  // 当用户点击 NetworkTree 中的网络时触发
  const handleSelectNetwork = (network_id: string, network_name: string) => {
    setSelectedNetwork(network_id);
    setSelectedNetworkName(network_name);
    console.log(`Selected network: ${network_id}, name: ${network_name}`);
  };

  return (
    <MainLayout>
      <Layout className={styles.container}>
        <Sider className={styles.sidebar} width={"auto"}>
          <Title level={5} className={styles.sidebarTitle}>
            Networks Control Panel
          </Title>
          <div className={styles.networkTree}>
              <NetworksTree
                networkItems={networkItems}
                onSelectNetwork={handleSelectNetwork}
                lockedNetworks={lockedNetworks}
              />
          </div>
        </Sider> 

        <Content className={styles.content}>
            <DevicePerfPanel
            networkName={selectedNetworkName || "Unnamed Network"}
            networkId={selectedNetwork || " "}
            />
            <div className={styles.placeholder}>
                <Title level={4}>No network selected.</Title>
            </div>
        </Content>
      </Layout>    
    </MainLayout>
  );
};
