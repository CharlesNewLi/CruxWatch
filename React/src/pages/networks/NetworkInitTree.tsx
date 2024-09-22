import React, { useState, useEffect } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { getNetwork } from "../../redux/network/slice"; 
import { Tree, Button, Space } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UserAddOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import styles from "./NetworkPage.module.css";

interface EditNetworkProps {
  networkItems: any[];
  onSelectNetwork: (network_id: string, network_name: string) => void;
  onAddNetwork?: (networkData: any) => void;
  onEditNetwork?: (network_id: string, newName: string) => void;
  onDeleteNetwork?: (network_id: string) => void; 
  onEditSite?: (
    site_id: string,
    site_name: string,
    site_location: { latitude: string; longitude: string }) => void;
  onDeleteSite?: (site_id: string, site_name: string) => void; 
}

export const NetworkInitTree: React.FC<EditNetworkProps> = ({ networkItems, onSelectNetwork, onAddNetwork, onEditNetwork, onDeleteNetwork, onEditSite, onDeleteSite }) => {
  
  const dispatch = useAppDispatch();

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<any[]>([]); // 存储动态更新的树结构

  const networkStats = useSelector((state) => state.network.networkDetails);
  console.log("networkStats:", networkStats);

  // 根据 selectedNetwork 在 networkStats 中找到对应的网络
  const selectedNetworkObj = networkStats?.find((network) => network.network_id === selectedNetwork);

  // 获取选中网络的 sites 和 devices，如果没有找到对应的网络则返回空数组
  const networkSites = selectedNetworkObj?.sites || [];
  const networkDevices = selectedNetworkObj?.devices || {}; // devices 是字典

  // 点击网络节点，触发获取详细信息的 dispatch 动作
  const handleSelect = (selectedKeys: React.Key[]) => {
    const selectedNetworkId = selectedKeys.length > 0 ? (selectedKeys[0] as string) : null;
    if (selectedNetworkId && selectedNetworkId !== selectedNetwork) {
      setSelectedNetwork(selectedNetworkId);
      const selectedNetworkObj = networkItems.find(
        (network) => network.network_id === selectedNetworkId
      );
      if (selectedNetworkObj) {
        onSelectNetwork(selectedNetworkObj.network_id, selectedNetworkObj.network_name);
      }
      dispatch(getNetwork({ network_id: selectedNetworkId }));
    }
  };

  // 当获取到 networkSites 和 networkDevices 时，更新树结构，保留网络名称作为根节点
  useEffect(() => {
    if ((networkSites.length > 0 || Object.keys(networkDevices).length > 0) && selectedNetwork) {
      console.log("networkSites:", networkSites);
      console.log("networkDevices:", networkDevices);

      setTreeData((prevTreeData) => {
        const updatedTreeData = prevTreeData.map((network) => {
          if (network.key === selectedNetwork) {
            // 处理网络下的站点和设备
            const siteChildren = (networkSites || []).map((site) => ({
              title: (
                <span>
                  {site.site_name}{" "}
                  <Button size="small" icon={<EditOutlined />} 
                    onClick={() => {
                      console.log(`Edit site button clicked for site_id: ${site.site_id}`);
                      onEditSite?.(site.site_id, site.site_name, site.site_location || { latitude: "", longitude: "" });
                    }}
                  />
                  <Button size="small" icon={<DeleteOutlined />}
                    onClick={() => onDeleteSite?.(site.site_id, site.site_name)}
                  />
                </span>
              ),
              key: site.site_id,
              children: (site.devices || []).map((device) => ({
                title: (
                  <span>
                    {device.device_name}{" "}
                    <Button size="small" icon={<UserAddOutlined />} /> {/* JOIN NE按钮 */}
                    <Button size="small" icon={<SwapOutlined />} /> {/* MOV NE按钮 */}
                    <Button size="small" icon={<DeleteOutlined />} /> {/* DEL NE按钮 */}
                  </span>
                ),
                key: device.ne_id,
              })),
            }));

            // 处理直接属于网络的设备
            const deviceChildren = Object.keys(networkDevices).map((deviceName) => {
              const device = networkDevices[deviceName];
              return {
                title: (
                  <span>
                    {device.device_name}{" "}
                    <Button size="small" icon={<UserAddOutlined />} /> {/* JOIN NE按钮 */}
                    <Button size="small" icon={<SwapOutlined />} /> {/* MOV NE按钮 */}
                    <Button size="small" icon={<DeleteOutlined />} /> {/* DEL NE按钮 */}
                  </span>
                ),
                key: device.ne_id,
              };
            });

            return {
              ...network,
              children: [...siteChildren, ...deviceChildren], // 合并站点和设备
            };
          }
          return network;
        });

        return updatedTreeData;
      });
    }
  }, [networkSites, networkDevices, selectedNetwork]);

  // 初始化树节点，构建网络名称为根节点
  useEffect(() => {
    const initialTreeData = (networkItems || []).map((network) => ({
      title: (
        <span>
          {network.network_name}
          <Button size="small" icon={<EditOutlined />} 
            onClick={() => {
              onEditNetwork?.(network.network_id, network.network_name);
            }} /> 
          <Button size="small" icon={<DeleteOutlined />} 
            onClick={() => {
              onDeleteNetwork?.(network.network_id); // 触发删除操作
            }} />
          <Button size="small" icon={<LockOutlined />} /> {/* LOCK 网络按钮 */}
        </span>
      ),
      key: network.network_id,
      children: [], // 初始化为空，获取到 `networkSites` 和 `networkDevices` 后再更新
    }));
    setTreeData(initialTreeData);
    console.log("Initialized treeData:", initialTreeData);
  }, [networkItems]);

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Tree
        className={styles.networkTree}
        defaultExpandAll
        treeData={[
          {
            title: (
              <span>
                Networks <Button size="small" icon={<PlusOutlined />} onClick={onAddNetwork} /> {/* ADD 按钮 */}
              </span>
            ),
            key: "network_root", // 确保有唯一的根节点 key
            children: treeData.length > 0 ? treeData : [], // 仅在 treeData 存在时展示
          },
        ]}
        onSelect={handleSelect}
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys as string[])}
      />
    </Space>
  );
};