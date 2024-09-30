import React, { useState } from "react";
import { useSelector } from "../../redux/hooks"; 
import styles from "./FaultMgmt.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Layout, Typography } from "antd";
import { NetworksTree } from "../../components/networkstree";
import { DeviceAlarmPanel } from "./DeviceAlarmPanel";

const { Sider, Content } = Layout;
const { Title } = Typography;

interface FaultMgmtProps {
  trapData: any[];  // 接收 trapData 作为 props
}

export const FaultMgmt: React.FC<FaultMgmtProps> = ({ trapData }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);

  // 从 Redux store 中获取网络数据
  const networksStats = useSelector((state) => state.networks.data);
  const networkItems = networksStats?.networks || [];

  // 获取选中的网络的锁定状态
  const selectedNetworkObj = networkItems.find(network => network.network_id === selectedNetwork);
  const isNetworkLocked = selectedNetworkObj?.isLocked || false;

  // 构建锁定状态映射表
  const lockedNetworks = networkItems.reduce((acc, network) => {
    acc[network.network_id] = network.isLocked || false;
    return acc;
  }, {} as { [key: string]: boolean });

  const handleSelectNetwork = (network_id: string, network_name: string) => {
    setSelectedNetwork(network_id);
    setSelectedNetworkName(network_name);
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
          {selectedNetwork ? (
            <DeviceAlarmPanel
              networkName={selectedNetworkName || "Unnamed Network"}
              networkId={selectedNetwork || ""}
              trapData={trapData}  // 将 trapData 传递给 DeviceAlarmPanel
            />
          ) : (
            <div className={styles.placeholder}>
              <Title level={4}>No network selected.</Title>
            </div>
          )}
        </Content>
      </Layout>
    </MainLayout>
  );
};