import React, { useState, useEffect } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks";
import { getNetwork } from "../../redux/network/slice";
import { Tree, Button } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  SwapOutlined,
} from "@ant-design/icons";

interface EditNetworkProps {
  networkItems: any[];
  onSelectNetwork: (network_id: string, network_name: string) => void;
  onAddNetwork?: (networkData: any) => void;
  onEditNetwork?: (network_id: string, newName: string) => void;
  onDeleteNetwork?: (network_id: string) => void;
  onEditSite?: (
    site_id: string,
    site_name: string,
    site_location: { latitude: string; longitude: string }
  ) => void;
  onDeleteSite?: (site_id: string, site_name: string) => void;
  onDeviceMove: (
    device: any,
    networkSites: any[],
    current_site_id: string | null
  ) => void;
  onLockToggle: (network_id: string) => void;
  lockedNetworks: Record<string, boolean>; // 修改为从外部传入锁定状态
}

export const NetworkInitTree: React.FC<EditNetworkProps> = ({
  networkItems,
  onSelectNetwork,
  onAddNetwork,
  onEditNetwork,
  onDeleteNetwork,
  onEditSite,
  onDeleteSite,
  onDeviceMove,
  onLockToggle,
  lockedNetworks, // 从父组件传入
}) => {
  const dispatch = useAppDispatch();

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<any[]>([]); // 存储动态更新的树结构

  const networkStats = useSelector((state) => state.network.networkDetails);
  console.log("networkStats:", networkStats);

  // 根据 selectedNetwork 在 networkStats 中找到对应的网络
  const selectedNetworkObj = networkStats?.find(
    (network) => network.network_id === selectedNetwork
  );

  // 获取选中网络的 sites 和 elements，如果没有找到对应的网络则返回空数组
  const networkSites = selectedNetworkObj?.sites || [];
  const networkDevices = selectedNetworkObj?.elements || {}; // devices 是字典

  // 点击网络节点，触发获取详细信息的 dispatch 动作
  const handleSelect = (selectedKeys: React.Key[]) => {
    const selectedNetworkId =
      selectedKeys.length > 0 ? (selectedKeys[0] as string) : null;
    if (selectedNetworkId && selectedNetworkId !== selectedNetwork) {
      setSelectedNetwork(selectedNetworkId);
      const selectedNetworkObj = networkItems.find(
        (network) => network.network_id === selectedNetworkId
      );
      if (selectedNetworkObj) {
        onSelectNetwork(
          selectedNetworkObj.network_id,
          selectedNetworkObj.network_name
        );
      }
      dispatch(getNetwork({ network_id: selectedNetworkId }));
    }
  };

  // 根据传入的 lockedNetworks 更新每个网络的锁定状态并渲染相应的图标
  const getLockStatus = (network_id: string) => {
    return lockedNetworks[network_id] || false;
  };

  // 当获取到 networkSites 和 networkDevices 时，更新树结构，保留网络名称作为根节点
  useEffect(() => {
    if (
      (networkSites.length > 0 || Object.keys(networkDevices).length > 0) &&
      selectedNetwork
    ) {
      const updatedTreeData = treeData.map((network) => {
        const isLocked = getLockStatus(network.key);
        if (network.key === selectedNetwork) {
          // 处理网络下的站点
          const siteChildren = (networkSites || []).map((site) => ({
            title: (
              <span>
                {site.site_name}{" "}
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() =>
                    onEditSite?.(site.site_id, site.site_name, site.site_location)
                  }
                  disabled={isLocked} // 锁定时禁用编辑按钮
                />
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => onDeleteSite?.(site.site_id, site.site_name)}
                  disabled={isLocked} // 锁定时禁用删除按钮
                />
              </span>
            ),
            key: site.site_id,
            children: (site.elements || []).map((device) => ({
              title: (
                <span>
                  {device.ne_name}{" "}
                  <Button
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() =>
                      onDeviceMove?.(device, networkSites, site.site_id)
                    }
                    disabled={isLocked} // 锁定时禁用设备移动
                  />
                </span>
              ),
              key: device.ne_id,
            })),
          }));

          // 处理直接属于网络的设备
          const unassignedDevices = Object.keys(networkDevices).filter(
            (deviceName) =>
              !networkSites.some((site) =>
                site.elements?.find((d) => d.ne_name === deviceName)
              )
          );

          const deviceChildren = unassignedDevices.map((deviceName) => {
            const device = networkDevices[deviceName];
            return {
              title: (
                <span>
                  {device.ne_name}{" "}
                  <Button
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => onDeviceMove?.(device, networkSites, null)}
                    disabled={isLocked} // 锁定时禁用设备移动
                  />
                </span>
              ),
              key: device.ne_id,
            };
          });

          return {
            ...network,
            children: !isLocked ? [...siteChildren, ...deviceChildren] : [], // 锁定时不显示子节点
          };
        }
        return network;
      });

      if (JSON.stringify(updatedTreeData) !== JSON.stringify(treeData)) {
        setTreeData(updatedTreeData);
      }
    }
  }, [networkSites, networkDevices, selectedNetwork, lockedNetworks]);

  // 初始化树节点，构建网络名称为根节点
  useEffect(() => {
    const initialTreeData = (networkItems || []).map((network) => {
      const isLocked = getLockStatus(network.network_id); // 根据 network_id 获取锁定状态
      return {
        title: (
          <span>
            {network.network_name}
            <Button
              size="small"
              icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => onLockToggle?.(network.network_id)} // 锁定/解锁按钮
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                onEditNetwork?.(network.network_id, network.network_name);
              }}
              disabled={isLocked} // 锁定时禁用编辑按钮
            />
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                onDeleteNetwork?.(network.network_id);
              }}
              disabled={isLocked} // 锁定时禁用删除按钮
            />
          </span>
        ),
        key: network.network_id,
        children: [], // 初始化为空，获取到 `networkSites` 和 `networkDevices` 后再更新
      };
    });
    setTreeData(initialTreeData);
    console.log("Initialized treeData:", initialTreeData);
  }, [networkItems, lockedNetworks]);

  return (
    <Tree
      defaultExpandAll
      treeData={[
        {
          title: (
            <span>
              Networks{" "}
              <Button size="small" icon={<PlusOutlined />} onClick={onAddNetwork} /> {/* ADD 按钮 */}
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
  );
};