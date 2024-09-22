import React, { useState } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import styles from "./NetworkPage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { addNetwork, updateNetwork, deleteNetwork, updateSite, deleteSite } from "../../redux/network/slice";
import { deleteNetworkSummary } from "../../redux/networks/slice";
import { Layout, Button, Space, Typography, Modal} from "antd";
import { NetworkInitTree } from "./NetworkInitTree";
import { NetworksTree } from "../../components/networkstree";
import { NetworkForm } from "./NetworkForm";
import { SiteForm } from "./SiteForm";
import { NetworkInitPanel } from "./NetworkInitPanel";
import { NetworkMgmtPanel } from "./NetworkMgmtPanel";

const { Sider, Content } = Layout;
const { Title } = Typography;

export const NetworkPage: React.FC = () => {
  const dispatch = useAppDispatch();

  const [showExistingNetworks, setShowExistingNetworks] = useState(true);
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false); // 控制创建模式
  const [isModifyingNetwork, setIsModifyingNetwork] = useState(false); // 控制修改模式
  const [networkToModify, setNetworkToModify] = useState<any | null>(null); // 存储要修改的网络信息
  const [editingSite, setEditingSite] = useState<any | null>(null);  // 控制站点编辑
  const [siteFormVisible, setSiteFormVisible] = useState(false);  // 控制 SiteForm 可见性

  // 存储选中的网络名称与 ID
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);

  // 从 Redux store 中获取网络数据
  const networksStats = useSelector((state) => state.networks.data);
  console.log("Networks Stats:", networksStats);
  const networkItems = networksStats?.networks || [];
  console.log("Networks Items:", networkItems);

  // 当用户点击 NetworkInitTree 中的网络时触发
  const handleSelectNetwork = (network_id: string, network_name: string) => {
    setSelectedNetwork(network_id);
    setSelectedNetworkName(network_name);
    console.log(`Selected network: ${network_id}, name: ${network_name}`);
  };
  
  // 提交新建或修改的网络
  const handleSubmitNetwork = (networkData: any) => {
    
    console.log("Form submitted with data:", networkData); // 打印提交时的网络数据
    
    // 如果是编辑模式，直接调用 newSites
    if (isModifyingNetwork) {
      dispatch(updateNetwork(networkData));  // 确保 updateNetwork 能处理 `sites` 字段
    } else {
      dispatch(addNetwork(networkData));  // 新增网络
    }
  
    setIsCreatingNetwork(false);
    setIsModifyingNetwork(false);
  };

  // 修改网络名称或添加新站点
  const handleEditNetwork = (network_id: string, newName: string) => {
    console.log("Edit network triggered for:", network_id); // 打印编辑时的网络信息
    console.log("New Name:", newName); // 打印新网络名

    // 创建 networkData 对象
    const networkData = {
      network_id,
      network_name: newName,
    };  
    setNetworkToModify(networkData); // 将选中的网络数据设置为要修改的内容
    setIsModifyingNetwork(true);
  };

  // 关闭 NetworkForm 的方法
  const closeNetworkForm = () => {
    setIsCreatingNetwork(false);
    setIsModifyingNetwork(false);
    setNetworkToModify(null); // 清除编辑状态
    console.log("Network form closed, reset state.");
  };

  // 删除网络的方法
  const handleDeleteNetwork = (network_id: string) => {
    const networkToDelete = networkItems.find((network) => network.network_id === network_id);

    Modal.confirm({
      title: "Are you sure you want to delete this network?",
      content: `Network Name: ${networkToDelete?.network_name}`,
      okText: "Confirm",
      cancelText: "Cancel",
      onOk: async () => {
        await dispatch(deleteNetwork(network_id));
        await dispatch(deleteNetworkSummary(network_id));
      },
      onCancel: () => {
        console.log("Delete action cancelled");
      }
    });
  };

  const handleSiteFormSubmit = (siteData: any) => {
    const { network_id, site_id } = editingSite;
    console.log(`Updating site with site_id: ${site_id}`, siteData);
    
    //这里触发 Redux action 来更新站点信息
    dispatch(updateSite({ site_id, network_id: siteData.network_id, site_name: siteData.site_name, site_location: siteData.site_location }));

    setSiteFormVisible(false);  // 关闭表单
  };

  // 处理编辑站点的逻辑
  const handleEditSite = (site_id: string, site_name: string, site_location: { latitude: string; longitude: string }) => {
    setEditingSite({ site_id, site_name, site_location });
    setSiteFormVisible(true);
  };

  // 删除站点的逻辑，只需要传递 site_id 和 site_name
  const handleDeleteSite = (site_id: string, site_name: string) => {
    Modal.confirm({
      title: `Are you sure you want to delete the site "${site_name}"?`,
      okText: "Yes",
      cancelText: "No",
      onOk: () => {
        dispatch(deleteSite({ site_id })); // 只传递 site_id
      },
    });
  };

  return (
    <MainLayout>
      <Layout className={styles.container}>
        <Sider className={styles.sidebar} width={"auto"}>
          <Title level={5} className={styles.sidebarTitle}>
            Networks Control Panel
          </Title>
          <Space className={styles.sidebarButton}>
            {/* 切换状态显示 NetworkInitTree 或 NetworksTree */}
            <Button
              type={!showExistingNetworks ? "primary" : "default"}
              onClick={() => setShowExistingNetworks(false)} 
            >
              Edit
            </Button>
            <Button
              type={showExistingNetworks ? "primary" : "default"}
              onClick={() => setShowExistingNetworks(true)} 
            >
              Management
            </Button>
          </Space> 
          {/* 根据状态显示不同的 Tree 组件 */}
          <Content className={styles.content}>
            <NetworkInitTree
              networkItems={networkItems} 
              onSelectNetwork={handleSelectNetwork}
              onAddNetwork={() => setIsCreatingNetwork(true)}  // 调用此方法以开始创建网络
              onEditNetwork={handleEditNetwork} 
              onDeleteNetwork={handleDeleteNetwork} 
              onEditSite={handleEditSite}
              onDeleteSite={handleDeleteSite}
            />
          </Content>
        </Sider> 
        <Content className={styles.content}>
          {selectedNetwork ? (
            <NetworkInitPanel
              networkName={selectedNetworkName || "Unnamed Network"}
              networkId= {selectedNetwork}
              onFinalize={() => console.log("Network finalized")}
              onUpdate={() => console.log("Network updated")}
            />
            ) : (
              <div className={styles.placeholder}>
                <Title level={4}>Please select a network for initialization</Title>
              </div>
            )}
            <div className={styles.placeholder}>
              <Title level={4}>
                {showExistingNetworks
                  ? "Please select an existing network for management"
                  : "Please select a network for initialization"}
              </Title>
            </div>
        </Content>
      </Layout>

      {/* 渲染独立的 NetworkForm */}
      <NetworkForm
        onClose={closeNetworkForm}
        onSubmit={handleSubmitNetwork}
        initialValues={networkToModify}  // 编辑模式时，传递初始值
        visible={isCreatingNetwork || isModifyingNetwork}
      />

      {/* 渲染 SiteForm 表单 */}
      <SiteForm
        visible={siteFormVisible}
        onClose={() => setSiteFormVisible(false)}
        onSubmit={handleSiteFormSubmit}
        initialValues={editingSite}
      />
    </MainLayout>
  );
};