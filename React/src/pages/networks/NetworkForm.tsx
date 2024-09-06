import React, { useState, useEffect } from "react";
import { Button, Input, Form, Space } from "antd";

interface NetworkFormProps {
  onSubmit: (network: any) => void;
  initialValues?: any; // 接收初始值进行修改
}

export const NetworkForm: React.FC<NetworkFormProps> = ({ onSubmit, initialValues }) => {
  const [networkName, setNetworkName] = useState<string>("");
  const [sites, setSites] = useState<string[]>([""]);

  useEffect(() => {
    if (initialValues) {
      setNetworkName(initialValues.title || "");
      setSites(initialValues.children.map((child: any) => child.title) || [""]);
    }
  }, [initialValues]);

  const addSiteField = () => {
    setSites([...sites, ""]);
  };

  const handleSubmit = () => {
    const networkData = {
      title: networkName,
      key: `network-${Math.random()}`,
      children: sites.map((site, index) => ({
        title: site || `Site ${index + 1}`,
        key: `site-${index + 1}`,
      })),
    };
    onSubmit(networkData);
    setNetworkName("");
    setSites([""]);
  };

  return (
    <Form>
      <Form.Item label="Network Name" required>
        <Input
          value={networkName}
          onChange={(e) => setNetworkName(e.target.value)}
          placeholder="Enter network name"
        />
      </Form.Item>
      {sites.map((site, index) => (
        <Form.Item key={index} label={`Site ${index + 1}`}>
          <Input
            value={site}
            onChange={(e) => {
              const updatedSites = [...sites];
              updatedSites[index] = e.target.value;
              setSites(updatedSites);
            }}
            placeholder="Enter site name (optional)"
          />
        </Form.Item>
      ))}
      <Button onClick={addSiteField}>Add Another Site</Button>
      <Space style={{ marginTop: 20 }}>
        <Button type="primary" onClick={handleSubmit}>
          Submit
        </Button>
      </Space>
    </Form>
  );
};