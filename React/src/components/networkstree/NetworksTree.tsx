import React, { useState } from "react";
import styles from "./NetworksTree.module.css";
import { Tree } from "antd";

interface NetworksProps {
  networkItems: any[];
}

export const NetworksTree: React.FC<NetworksProps> = ({ networkItems }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const selectedKey = selectedKeys[0] as string;
      const selected = findDeviceById(selectedKey, networkItems);
      setSelectedDevice(selected);
    }
  };

  // 递归查找设备信息
  const findDeviceById = (id: string, networks: any[]): any | null => {
    for (const site of networks || []) {
      const device = site.devices?.find((device: any) => device.ne_id === id);
      if (device) return device;
    }
    return null;
  };

  return (
    <>
      <h2>{networkItems}</h2> {/* 显示网络名称 */}
      <Tree
        className={styles.networkTree}
        treeData={[
          {
            //title: networkNames, // 使用 networkName 作为根节点
            key: "network_root",
            children: networkItems.map(site => ({
              key: site.site_id,
              title: site.site_name,
              children: site.devices.map(device => ({
                key: device.ne_id,
                title: `${device.device_name} (${device.device_type})`,
              })),
            })),
          },
        ]}
        expandedKeys={expandedKeys}
        //onExpand={setExpandedKeys}
        onSelect={handleSelect}
      />
      {selectedDevice && (
        <div>
          <h3>Device Information</h3>
          <p><strong>Device Name:</strong> {selectedDevice.device_name}</p>
          <p><strong>Device ID:</strong> {selectedDevice.ne_id}</p>
          <p><strong>Device Type:</strong> {selectedDevice.device_type}</p>
          <p><strong>IP Address:</strong> {selectedDevice.ip}</p>
          {/* 这里可以展示其他设备信息 */}
        </div>
      )}
    </>
  );
};