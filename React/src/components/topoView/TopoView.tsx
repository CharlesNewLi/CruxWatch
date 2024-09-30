import React, { useEffect, useRef } from "react";
import { DataSet, Network, Edge, Node } from "vis-network/standalone";
import styles from "./TopoView.module.css";

interface TopoViewProps {
  topology: {
    nodes: Array<[string, any]>; // Node information (name and properties)
    edges: Array<[string, string, any]>; // Edge information (links)
  };
  elements: { [key: string]: any }; // Device information including types, etc.
  onDeviceClick: (device: any) => void; // Callback when device is clicked
}

// Define device type to icon mapping
const deviceIcons: { [key: string]: string } = {
  Router: require("../../assets/topoicon/net_icons/Router-2D-Gen-White-S.svg").default,
  Switch: require("../../assets/topoicon/net_icons/Switch-2D-L3-Generic-S.svg").default,
  Firewall: require("../../assets/topoicon/icons/Firewall-2D-Generic-S.svg").default,
};

// Fallback for devices without a specific icon
const defaultIcon = require("../../assets/topoicon/icons/Router-2D-Gen-Dark-S.svg").default;

export const TopoView: React.FC<TopoViewProps> = ({ topology, elements, onDeviceClick }) => {
  const visJsRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (visJsRef.current) {
      // Destroy previous network instance
      if (networkRef.current) {
        networkRef.current.destroy();
      }

      // Create nodes and edges datasets
      const nodesDataSet = new DataSet<Node>();
      const edgesDataSet = new DataSet<Edge>();

      // Add nodes to DataSet
      topology.nodes.forEach(([nodeName, nodeData]) => {
        const element = elements[nodeName];
        const deviceIcon = element ? (deviceIcons[element.ne_type] || defaultIcon) : defaultIcon;

        // Avoid adding duplicate nodes
        if (!nodesDataSet.get(nodeName)) {
          nodesDataSet.add({
            id: nodeName,
            label: nodeName,
            shape: "image",
            image: deviceIcon,
          });
        }
      });

      // Add edges to DataSet
      topology.edges.forEach(([src, dst]) => {
        const edgeId = `${src}-${dst}`;

        // Avoid adding duplicate edges
        if (!edgesDataSet.get(edgeId)) {
          edgesDataSet.add({
            id: edgeId,
            from: src,
            to: dst,
            arrows: "to",
          });
        }
      });

      // Initialize vis-network with nodes and edges
      const network = new Network(visJsRef.current, { nodes: nodesDataSet, edges: edgesDataSet }, {
        layout: {
          hierarchical: false, // No hierarchy, free to drag
        },
        interaction: {
          dragNodes: true,
          zoomView: true,
        },
        physics: {
          enabled: true, // Enable physics for auto layout
        },
      });

      networkRef.current = network;

      // Handle device node click
      network.on("click", function (params) {
        if (params.nodes.length > 0) {
          const clickedNode = params.nodes[0];
          const clickedDevice = elements[clickedNode];  // 从 elements 中获取设备信息
          if (clickedDevice) {
            onDeviceClick(clickedDevice);  // 传递完整的设备对象而不是名称
          }
        }
      });
    }

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [topology, elements, onDeviceClick]);

  return (
    <div className={styles.topology}>
      <div ref={visJsRef} className={styles.topologyPlaceholder} style={{ height: "500px" }}></div>
    </div>
  );
};