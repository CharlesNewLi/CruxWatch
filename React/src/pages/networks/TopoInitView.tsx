import React from "react";
import { Typography } from "antd";
import styles from "./NetworkInitPanel.module.css";

// 引入设备图标作为 React 组件
import { ReactComponent as RouterIcon } from "../../assets/topoicon/net_icons/Router-2D-Gen-White-S.svg";
import { ReactComponent as SwitchIcon } from "../../assets/topoicon/net_icons/Switch-2D-L3-Generic-S.svg";
import { ReactComponent as FirewallIcon } from "../../assets/topoicon/icons/Firewall-2D-Generic-S.svg";

const { Title } = Typography;

interface TopoInitViewProps {
  topology: {
    nodes: Array<[string, any]>; // 节点信息
    edges: Array<[string, string, any]>; // 边信息，表示链路
  };
}

// 定义设备名称与图标的映射关系
const deviceIcons: { [key: string]: React.FC } = {
  Router: RouterIcon,
  Switch: SwitchIcon,
  Firewall: FirewallIcon,
};

// 设备的坐标数据，简单示例
const nodePositions: { [key: string]: { x: number; y: number } } = {
  HR1: { x: 100, y: 100 },
  HR2: { x: 300, y: 100 },
  CE1: { x: 100, y: 300 },
  CR1: { x: 300, y: 300 },
  CR2: { x: 500, y: 200 },
};

export const TopoInitView: React.FC<TopoInitViewProps> = ({ topology }) => {
  return (
    <div className={styles.topology}>
      <Title level={4}>Network Topology View</Title>
      <svg width="600" height="400" className={styles.topologyPlaceholder}>
        {/* 渲染链路 */}
        {topology.edges.map(([src, dst], index) => (
          <line
            key={index}
            x1={nodePositions[src].x}
            y1={nodePositions[src].y}
            x2={nodePositions[dst].x}
            y2={nodePositions[dst].y}
            stroke="black"
            strokeWidth="2"
            markerEnd="url(#arrow)" // 可以添加箭头
          />
        ))}

        {/* 渲染节点 */}
        {topology.nodes.map(([nodeName, nodeData], index) => (
          <g key={index} transform={`translate(${nodePositions[nodeName].x}, ${nodePositions[nodeName].y})`}>
            {deviceIcons[nodeName] && (
              <foreignObject width="30" height="30">
                {React.createElement(deviceIcons[nodeName])}
              </foreignObject>
            )}
            <text x="35" y="20" fill="black">
              {nodeName}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};