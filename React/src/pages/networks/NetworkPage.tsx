import React, { useState } from "react";
import styles from "./NetworkPage.module.css";
import { MainLayout } from "../../layout/mainLayout";
import { Layout, Tree, Button, Modal, Input, Space, Typography } from "antd";
import { TopoView } from "../../components";
import { NetworkInitializationPanel } from "./NetworkInitializationPanel";
import { NetworkManagementPanel } from "./NetworkManagementPanel";
import { NetworkForm } from "./NetworkForm";
import { mockNetworks } from "./mockup";

const { Sider, Content } = Layout;
const { Title } = Typography;
const { confirm } = Modal;

export const NetworkPage: React.FC = () => {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [editingNetworks, setEditingNetworks] = useState<any[]>(mockNetworks); // 使用 mock 数据初始化编辑中的网络
  const [networks, setNetworks] = useState<any[]>([]); // 已有网络
  const [showExistingNetworks, setShowExistingNetworks] = useState(true); // 默认显示已有网络
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);
  const [isModifyingNetwork, setIsModifyingNetwork] = useState(false); // 新增修改模式
  const [networkToModify, setNetworkToModify] = useState<any | null>(null); // 存储要修改的网络信息
  const [finalizedNetwork, setFinalizedNetwork] = useState<string | null>(null); // 存储已完成的网络名称
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Helper function to get the network title from the key
  const getNetworkTitle = (networkKey: string | null, networks: any[]) => {
    if (!networkKey) return null;
    const network = networks.find((n) => n.key === networkKey);
    return network ? network.title : null;
    };

  // 添加调试信息：当选择网络时记录selectedNetwork值
  console.log("Selected Network:", selectedNetwork);
  console.log("Finalized Network:", finalizedNetwork);

  // 添加网络
  const handleAddNetwork = () => {
    setIsCreatingNetwork(true); // 显示表单
  };

  // 修改网络名称
  const handleEditNetwork = (networkKey: string, newName: string, newSites: any[]) => {
    setEditingNetworks(
      editingNetworks.map((network) =>
        network.key === networkKey ? { ...network, title: newName, children: newSites } : network
      )
    );
    setIsModifyingNetwork(false); // 退出修改模式
    setNetworkToModify(null);
  };

  // 点击 Modify 按钮，填充表单
  const openModifyForm = (networkKey: string) => {
    const network = editingNetworks.find((n) => n.key === networkKey);
    if (network) {
      setNetworkToModify(network); // 设置要修改的网络信息
      setIsModifyingNetwork(true); // 进入修改模式
    }
  };

  // 提交新建或修改的网络
  const handleSubmitNetwork = (networkData: any) => {
    if (isModifyingNetwork && networkToModify) {
      handleEditNetwork(networkToModify.key, networkData.title, networkData.children);
    } else {
      setEditingNetworks([...editingNetworks, networkData]);
    }
    setIsCreatingNetwork(false);
    setIsModifyingNetwork(false);
  };

  // 删除网络：从 editingNetworks 和 networks 中同时删除
  const handleDeleteNetwork = (networkKey: string) => {
    confirm({
      title: "Are you sure you want to delete this network?",
      content: "This action cannot be undone. Please confirm your decision.",
      okText: "Yes",
      cancelText: "No",
      onOk() {
        // 执行删除操作
        setEditingNetworks(editingNetworks.filter((n) => n.key !== networkKey));
        setNetworks(networks.filter((n) => n.key !== networkKey)); // 同时从 networks 中删除
        console.log(`Network with key ${networkKey} has been deleted`);
      },
      onCancel() {
        console.log("Deletion cancelled");
      },
    });
  };

  // 锁定/解锁网络
  const handleToggleLock = (networkKey: string) => {
    setEditingNetworks(
      editingNetworks.map((network) =>
        network.key === networkKey
          ? { ...network, isLocked: !network.isLocked }
          : network
      )
    );
  };

  // 选择网络
  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length) {
      console.log("Network selected from Tree:", selectedKeys[0]);
      setSelectedNetwork(selectedKeys[0] as string); // 传递选中的网络key
      setIsCreatingNetwork(false);
    }
  };

  // 完成网络创建并将网络移入已有网络
  const handleFinalizeNetwork = (networkKey: string) => {
    const network = editingNetworks.find((n) => n.key === networkKey);
    if (network) {
      console.log("Finalizing network:", networkKey);
  
      // 检查网络是否已存在于 networks 中
      const existsInNetworks = networks.some((n) => n.key === networkKey);
  
      if (!existsInNetworks) {
        setEditingNetworks(
          editingNetworks.map((n) =>
            n.key === networkKey ? { ...n, isLocked: true } : n
          )
        );
        setNetworks([...networks, { ...network, isLocked: true, showLock: false }]);
        setFinalizedNetwork(networkKey); // 更新已完成的网络 key
      } else {
        console.log(`Network with key ${networkKey} already exists in Networks.`);
      }
    }
  };

  // 更新网络修改同步到已有网络
  const handleUpdateNetwork = (networkKey: string) => {
    const network = editingNetworks.find((n) => n.key === networkKey);
    if (network) {
      console.log("Updating network:", networkKey);
  
      // 检查网络是否已存在于 networks 中
      const existsInNetworks = networks.some((n) => n.key === networkKey);
  
      if (existsInNetworks) {
        // 更新已存在的网络
        setNetworks(
          networks.map((n) =>
            n.key === networkKey ? { ...n, ...network } : n
          )
        );
      } else {
        // 如果网络不存在，则添加
        setNetworks([...networks, { ...network, isLocked: true, showLock: false }]);
      }
      setFinalizedNetwork(networkKey); // 更新已完成的网络 key
    }
  };

  // 搜索逻辑
  const handleSearch = () => {
    console.log("Search for", searchTerm);
  };

  return (
    <MainLayout>
      <Layout className={styles.container}>
        <Sider className={styles.sidebar} width={"auto"}>
          <Title level={5} className={styles.sidebarTitle}>
            Network Control Panel
          </Title>
          <Space>
            <Button
              type={!showExistingNetworks ? "primary" : "default"}
              onClick={() => {
                setShowExistingNetworks(false);
                setSelectedNetwork(null); // 清空选择的网络
                console.log("Switched to Edit Network view.");
              }}
            >
              Edit Network
            </Button>
            <Button
              type={showExistingNetworks ? "primary" : "default"}
              onClick={() => {
                setShowExistingNetworks(true);
                setSelectedNetwork(null); // 清空选择的网络
                setIsCreatingNetwork(false);
                setIsModifyingNetwork(false);
                console.log("Switched to Networks view.");
              }}
            >
              Networks
            </Button>
          </Space>

          {/* 只有在 Edit Network 模式下才显示 Add Network 和 Search */}
          {!showExistingNetworks && (
            <div style={{ marginTop: "20px" }}>
              {/* Add Network 按钮 */}
              <Button
                type="primary"
                onClick={handleAddNetwork}
                block
                style={{ marginBottom: "10px" }}
              >
                Add Network
              </Button>

              {/* 搜索栏和搜索按钮 */}
              <Space style={{ display: "flex", marginBottom: "20px" }}>
                <Input
                  placeholder="Search by network, site, or NE"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button type="default" onClick={handleSearch}>
                  Search
                </Button>
              </Space>
            </div>
          )}

          {/* 根据选择显示不同的树形结构 */}
          <Tree
            className={styles.networkTree}
            treeData={showExistingNetworks ? networks : editingNetworks}
            onSelect={handleSelect}
            titleRender={(nodeData) => (
              <div className={styles.treeNode}>
                <span>{nodeData.title}</span>
                {!nodeData.isLocked && !showExistingNetworks && (
                  <>
                    <Button
                      size="small"
                      onClick={() => openModifyForm(nodeData.key)} // 打开修改表单
                    >
                      Modify
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleDeleteNetwork(nodeData.key)}
                    >
                      Delete
                    </Button>
                  </>
                )}
                {!showExistingNetworks && (
                  <Button
                    size="small"
                    onClick={() => handleToggleLock(nodeData.key)}
                  >
                    {nodeData.isLocked ? "Unlock" : "Lock"}
                  </Button>
                )}
              </div>
            )}
          />
        </Sider>

        <Content className={styles.content}>
          {isCreatingNetwork || isModifyingNetwork ? (
            <NetworkForm
            onSubmit={handleSubmitNetwork}
            initialValues={networkToModify} // 如果在修改模式下，传递初始值
          />
        ) : selectedNetwork ? (
          !showExistingNetworks ? (
            <NetworkInitializationPanel
                networkName={getNetworkTitle(selectedNetwork, editingNetworks) || ""}
                onFinalize={() => handleFinalizeNetwork(selectedNetwork)}
                onUpdate={() => handleUpdateNetwork(selectedNetwork)} // 将同步逻辑连接到 Update 按钮
            />
            ) : (
              <>
                <NetworkManagementPanel
                  networkName={
                    getNetworkTitle(finalizedNetwork, networks) ||
                    getNetworkTitle(selectedNetwork, editingNetworks)
                  } // 使用网络名称而非key
                />
                <TopoView />
              </>
            )
          ) : (
            <div className={styles.placeholder}>
              <Title level={4}>
                {showExistingNetworks
                  ? "Please select an existing network for management"
                  : "Please select a network for initialization"}
              </Title>
            </div>
          )}
        </Content>
      </Layout>
    </MainLayout>
  );
};