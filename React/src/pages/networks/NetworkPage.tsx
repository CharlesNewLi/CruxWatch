import React, { useState } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import styles from "./NetworkPage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { addNetwork, updateNetwork, deleteNetwork, updateSite, deleteSite, moveDeviceToSite, toggleNetworkLock } from "../../redux/network/slice";
import { deleteNetworkSummary } from "../../redux/networks/slice";
import { Layout, Button, Space, Typography, Modal, Select } from "antd";
import { NetworksTree } from "../../components/networkstree";
import { NetworkInitTree } from "./NetworkInitTree";
import { NetworkForm } from "./NetworkForm";
import { SiteForm } from "./SiteForm";
import { NetworkMgmtPanel } from "./NetworkMgmtPanel";
import { NetworkInitPanel } from "./NetworkInitPanel";

const { Sider, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export const NetworkPage: React.FC = () => {
  const dispatch = useAppDispatch();

  const [showExistingNetworks, setShowExistingNetworks] = useState(true);
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false); // 控制创建模式
  const [isModifyingNetwork, setIsModifyingNetwork] = useState(false); // 控制修改模式
  const [networkToModify, setNetworkToModify] = useState<any | null>(null); // 存储要修改的网络信息
  const [editingSite, setEditingSite] = useState<any | null>(null);  // 控制站点编辑
  const [siteFormVisible, setSiteFormVisible] = useState(false);  // 控制 SiteForm 可见性
  const [modalVisible, setModalVisible] = useState(false); // 控制站点选择框的显示

  // 存储选中的网络名称与 ID
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [selectedNetworkName, setSelectedNetworkName] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null); // 存储选中的设备
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null); // 存储当前站点 ID
  const [targetSiteId, setTargetSiteId] = useState<string | null>(null); // 目标站点
  const [availableSites, setAvailableSites] = useState<any[]>([]); // 存储可用站点

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

  // 切换网络的锁定状态
  const handleLockToggle = (network_id: string) => {
    dispatch(toggleNetworkLock(network_id)); // 只传递 network_id, isLocked 由 Redux 管理
  };

  // 当用户点击 NetworkInitTree 中的网络时触发
  const handleSelectNetwork = (network_id: string, network_name: string) => {
    setSelectedNetwork(network_id);
    setSelectedNetworkName(network_name);
    console.log(`Selected network: ${network_id}, name: ${network_name}`);
  };

  // 提交新建或修改的网络
  const handleSubmitNetwork = (networkData: any) => {
    console.log("Form submitted with data:", networkData); // 打印提交时的网络数据

    if (isModifyingNetwork) {
      dispatch(updateNetwork(networkData)); // 确保 updateNetwork 能处理 `sites` 字段
    } else {
      dispatch(addNetwork(networkData)); // 新增网络
    }

    setIsCreatingNetwork(false);
    setIsModifyingNetwork(false);
  };

  // 修改网络名称或添加新站点
  const handleEditNetwork = (network_id: string, newName: string) => {
    console.log("Edit network triggered for:", network_id); // 打印编辑时的网络信息
    console.log("New Name:", newName); // 打印新网络名

    const networkData = {
      network_id,
      network_name: newName,
    };  
    setNetworkToModify(networkData); // 设置为修改模式
    setIsModifyingNetwork(true);
  };

  const closeNetworkForm = () => {
    setIsCreatingNetwork(false);
    setIsModifyingNetwork(false);
    setNetworkToModify(null); // 重置表单状态
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

  // 处理设备移动的选择逻辑
  const handleSelectDevice = (device: any, networkSites: any[], current_site_id: string | null = null) => {  
    console.log("handleSelectDevice called with device:", device); // 打印设备信息
    console.log("Available network sites:", networkSites); // 打印站点信息
    
    const updatedDevice = {
      ...device,
      network_id: selectedNetwork,  // 从当前选中的网络中获取 network_id
    };

    setSelectedDevice(updatedDevice); // 存储选中的设备
    setAvailableSites(networkSites);
    setCurrentSiteId(current_site_id);
    setModalVisible(true); // 显示站点选择弹窗
  };

  const handleMoveDevice = () => {
    if (selectedDevice && targetSiteId !== undefined) {
      if (!selectedDevice.network_id) {
        console.error("Error: selectedDevice is missing network_id");
        return;
      }

      console.log("Moving device to site with the following data:", {
        network_id: selectedDevice.network_id,
        ne_name: selectedDevice.ne_name,
        current_site_id: currentSiteId || null,
        target_site_id: targetSiteId,
      });

      dispatch(
        moveDeviceToSite({
          network_id: selectedDevice.network_id,
          ne_name: selectedDevice.ne_name,
          current_site_id: currentSiteId || null,
          target_site_id: targetSiteId,
        })
      );

      setModalVisible(false); // 隐藏弹窗
    } else {
      console.warn("Device or target site not selected, move action aborted.");
    }
  };

  return (
    <MainLayout>
      <Layout className={styles.container}>
        <Sider className={styles.sidebar} width={"auto"}>
          <Title level={5} className={styles.sidebarTitle}>
            Networks Control Panel
          </Title>
          <Space className={styles.sidebarButton}>
            <Button
              type={!showExistingNetworks ? "primary" : "default"}
              onClick={() => setShowExistingNetworks(false)} // 切换到 Edit 模式
            >
              Edit
            </Button>
            <Button
              type={showExistingNetworks ? "primary" : "default"}
              onClick={() => setShowExistingNetworks(true)} // 切换到 Management 模式
            >
              Management
            </Button>
          </Space>

          {/* 切换 NetworkInitTree 和 NetworksTree */}
          <div className={styles.networkTree}>
            {showExistingNetworks ? (
              <NetworksTree
                networkItems={networkItems}
                onSelectNetwork={handleSelectNetwork}
                lockedNetworks={lockedNetworks}
              />
            ) : (
              <NetworkInitTree
                networkItems={networkItems}
                onSelectNetwork={handleSelectNetwork}
                onAddNetwork={() => setIsCreatingNetwork(true)}  // 开始创建网络
                onEditNetwork={handleEditNetwork} 
                onDeleteNetwork={handleDeleteNetwork} 
                onEditSite={handleEditSite}
                onDeleteSite={handleDeleteSite}
                onDeviceMove={handleSelectDevice} // 设备移动
                onLockToggle={handleLockToggle} // 锁定/解锁处理函数
                lockedNetworks={lockedNetworks}
              />
            )}
          </div>
        </Sider> 

        <Content className={styles.content}>
          {/* 根据模式显示不同的 Panel */}
          {showExistingNetworks ? (
            selectedNetwork ? (
              <NetworkMgmtPanel
                networkName={selectedNetworkName || "Unnamed Network"}
                networkId={selectedNetwork}
              />
            ) : (
              <div className={styles.placeholder}>
                <Title level={4}>This network is locked or no network selected.</Title>
              </div>
            )
          ) : (
            selectedNetwork ? ( 
              ! isNetworkLocked ? (
              <NetworkInitPanel
                networkName={selectedNetworkName || "Unnamed Network"}
                networkId={selectedNetwork}
                onFinalize={() => console.log("Network finalized")}
                onUpdate={() => console.log("Network updated")}
              />
            ) : (
              <div className={styles.placeholder}>
                <Title level={4}>This network is locked or no network selected.</Title>
              </div>
            )
          ) : (
            <div className={styles.placeholder}>
              <Title level={4}>No network selected.</Title>
            </div>
          )
        )}
        </Content>
      </Layout>

      {/* 渲染独立的 NetworkForm */}
      <NetworkForm
        onClose={closeNetworkForm}
        onSubmit={handleSubmitNetwork}
        initialValues={networkToModify}  // 编辑模式时传递初始值
        visible={isCreatingNetwork || isModifyingNetwork}
      />

      {/* 渲染 SiteForm 表单 */}
      <SiteForm
        visible={siteFormVisible}
        onClose={() => setSiteFormVisible(false)}
        onSubmit={handleSiteFormSubmit}
        initialValues={editingSite}
      />

      <Modal
        title="Move Device to Site"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleMoveDevice} // 点击确认时移动设备
      >
        {/* 显示当前站点 */}
        <Select
          placeholder="Current site"
          value={currentSiteId || undefined}  // 预填当前站点（如果存在）
          style={{ width: "100%", marginBottom: "16px" }} // 增加 marginBottom 以分隔两个选择框
          disabled // 当前站点框只显示，无法选择
        >
          {currentSiteId && (
            <Option key={currentSiteId} value={currentSiteId}>
              {availableSites.find((site) => site.site_id === currentSiteId)?.site_name || "Unassigned"}
            </Option>
          )}
        </Select>

        {/* 选择目标站点 */}
        <Select
          placeholder="Select a target site"
          onChange={(value) => setTargetSiteId(value)} // 选择站点
          value={targetSiteId !== null ? targetSiteId : undefined}  // 选择的目标站点
          style={{ width: "100%" }}
        >
          <Option value={null}>Move to network</Option>
          {availableSites.map((site) => (
            <Option key={site.site_id} value={site.site_id}>
              {site.site_name}
            </Option>
          ))}
        </Select>
      </Modal>
    </MainLayout>
  );
};
