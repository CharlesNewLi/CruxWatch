import React, { useState, useEffect } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { getNetwork } from "../../redux/network/slice"; 
import { Tree } from "antd";

interface NetworksTreeProps {
  networkItems: any[]; // 传入的所有网络数据
  onSelectNetwork: (network_id: string, network_name: string) => void; // 点击网络时触发
  lockedNetworks: Record<string, boolean>; // 传入的锁定状态，格式为 { network_id: true/false }
}

export const NetworksTree: React.FC<NetworksTreeProps> = ({ networkItems, onSelectNetwork, lockedNetworks }) => {
  
  const dispatch = useAppDispatch();

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<any[]>([]); // 存储动态更新的树结构

  // 获取网络详情的状态数据
  const networkStats = useSelector((state) => state.network.networkDetails);
  console.log("networkStats:", networkStats);

  // 根据 selectedNetwork 在 networkStats 中找到对应的网络详情
  const selectedNetworkObj = networkStats?.find((network) => network.network_id === selectedNetwork);

  // 获取选中网络的 sites 和 devices，如果没有找到对应的网络则返回空数组
  const networkSites = selectedNetworkObj?.sites || [];
  const networkDevices = selectedNetworkObj?.elements || {}; // devices 是字典

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

  // 只获取锁定的网络，并更新树结构，渲染锁定的网络及其子节点
  useEffect(() => {
    if ((networkSites.length > 0 || Object.keys(networkDevices).length > 0) && selectedNetwork) {
      // 重新计算 treeData 来更新锁定网络下的站点和设备
      const updatedTreeData = treeData.map((network) => {
        if (network.key === selectedNetwork) {
          // 处理网络下的站点
          const siteChildren = (networkSites || []).map((site) => ({
            title: <span>{site.site_name}</span>, // 没有按钮
            key: site.site_id,
            children: (site.elements || []).map((device) => ({
              title: <span>{device.ne_name}</span>, // 没有按钮
              key: device.ne_id,
            })),
          }));
  
          // 处理直接属于网络的设备
          const unassignedDevices = Object.keys(networkDevices).filter(
            (deviceName) => !networkSites.some(site => site.elements && site.elements.find(d => d.ne_name === deviceName))
          );
  
          const deviceChildren = unassignedDevices.map((deviceName) => {
            const device = networkDevices[deviceName];
            return {
              title: <span>{device.ne_name}</span>, // 没有按钮
              key: device.ne_id,
            };
          });
  
          return {
            ...network,
            children: [...siteChildren, ...deviceChildren], // 只显示站点和设备
          };
        }
        return network;
      });
  
      // 更新树结构
      if (JSON.stringify(updatedTreeData) !== JSON.stringify(treeData)) {
        setTreeData(updatedTreeData);
      }
    }
  }, [networkSites, networkDevices, selectedNetwork]);

  // 初始化树节点，构建锁定的网络名称为根节点
  useEffect(() => {
    // 只显示锁定的网络
    const filteredNetworks = networkItems.filter(
      (network) => lockedNetworks[network.network_id] // 只筛选被锁定的网络
    );
    
    const initialTreeData = (filteredNetworks || []).map((network) => ({
      title: <span>{network.network_name}</span>, // 没有按钮
      key: network.network_id,
      children: [], // 初始化为空，获取到 `networkSites` 和 `networkDevices` 后再更新
    }));
    
    setTreeData(initialTreeData);
    console.log("Initialized treeData with locked networks:", initialTreeData);
  }, [networkItems, lockedNetworks]); // 当锁定网络或网络列表变化时更新

  return (
    <Tree
      defaultExpandAll
      treeData={[
        {
          title: <span>Networks</span>, // 没有添加网络的按钮
          key: "network_root", // 确保有唯一的根节点 key
          children: treeData.length > 0 ? treeData : [], // 仅在 treeData 存在时展示
        },
      ]}
      onSelect={handleSelect}
      expandedKeys={expandedKeys}
      onExpand={(keys) => setExpandedKeys(keys as string[])}
    />
  );
};