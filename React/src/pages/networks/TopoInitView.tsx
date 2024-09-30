import React, { useEffect, useRef } from "react";
import { DataSet, Network, Edge, Node } from "vis-network/standalone";
import { Typography } from "antd";
import styles from "./NetworkInitPanel.module.css";

const { Title } = Typography;

interface TopoInitViewProps {
  topology: {
    nodes: Array<[string, any]>; // 节点信息
    edges: Array<[string, string, any]>; // 边信息，表示链路
  };
  elements: { [key: string]: any }; // 包含设备信息（包括 ne_type 等）
  onDeviceClick: (deviceName: string) => void; // 点击设备图标时的处理函数
}

// 定义设备名称与图标的映射关系
const deviceIcons: { [key: string]: string } = {
  Router: require("../../assets/topoicon/net_icons/Router-2D-Gen-White-S.svg").default,
  Switch: require("../../assets/topoicon/net_icons/Switch-2D-L3-Generic-S.svg").default,
  Firewall: require("../../assets/topoicon/icons/Firewall-2D-Generic-S.svg").default,
};

// 定义默认图标
const defaultIcon = require("../../assets/topoicon/icons/Router-2D-Gen-Dark-S.svg").default;

export const TopoInitView: React.FC<TopoInitViewProps> = ({ topology, elements, onDeviceClick }) => {
  const visJsRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (visJsRef.current) {
      // 清除上一次的 Network 实例
      if (networkRef.current) {
        networkRef.current.destroy();
      }

      // 初始化 DataSet 的 nodes 和 edges
      const nodesDataSet = new DataSet<Node>();
      const edgesDataSet = new DataSet<Edge>();

      // 处理节点，避免重复添加
      topology.nodes.forEach(([nodeName, nodeData]) => {
        const element = elements[nodeName];
        const deviceIcon = element ? (deviceIcons[element.ne_type] || defaultIcon) : defaultIcon;
        if (!nodesDataSet.get(nodeName)) { // 检查是否已有相同 ID 的节点
          nodesDataSet.add({
            id: nodeName,
            label: nodeName,
            shape: "image", // 使用 image 形状
            image: deviceIcon, // 动态选择图标或使用默认图标
          });
        } else {
          // 如果节点已存在，更新信息
          nodesDataSet.update({
            id: nodeName,
            label: nodeName,
            shape: "image",
            image: deviceIcon,
          });
        }
      });

      // 处理边，避免重复添加
      topology.edges.forEach(([src, dst], index) => {
        // 构造唯一边 ID（可以基于 src 和 dst）
        const edgeId = `${src}-${dst}`;
        
        // 检查是否已有相同 src 和 dst 的边
        if (!edgesDataSet.get(edgeId)) {
          edgesDataSet.add({
            id: edgeId, // 使用 src 和 dst 生成唯一 ID
            from: src,
            to: dst,
            arrows: "to", // 可选：链路箭头
          });
        }
      });

      // 初始化 vis-network 拓扑
      const network = new Network(visJsRef.current, { nodes: nodesDataSet, edges: edgesDataSet }, {
        layout: {
          hierarchical: false, // 允许自由拖动
        },
        interaction: {
          dragNodes: true, // 节点可以拖动
          zoomView: true,  // 允许缩放
        },
        physics: {
          enabled: true, // 物理引擎模拟节点自动布局
        },
      });

      networkRef.current = network; // 保存当前的 Network 实例

      // 点击设备节点时，触发 onDeviceClick
      network.on("click", function (params) {
        if (params.nodes.length > 0) {
          const clickedNode = params.nodes[0]; // 获取点击的节点 ID
          onDeviceClick(clickedNode); // 触发点击事件
        }
      });
    }

    // 在组件卸载时或 topology 变化时，清除网络实例
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [topology, elements,  onDeviceClick]);

  return (
    <div className={styles.topology}>
      <div ref={visJsRef} className={styles.topologyPlaceholder} style={{ height: "500px" }}></div>
    </div>
  );
};