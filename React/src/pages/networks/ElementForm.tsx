import React, { useState } from "react";
import { Button, Input, Select, Form, Space, Typography } from "antd";
import styles from "./NetworkInitPanel.module.css"; // 定义样式

const { Option } = Select;
const { Title } = Typography;

interface ElementFormProps {
  onSSHSubmit: (neData: any) => Promise<any>; // 返回 Promise 以等待后端响应
  onSNMPSubmit: (neData: any) => Promise<any>;
  onDiscoverNeighbors: (neData: any) => Promise<any>; // 可选的发现邻居按钮处理函数
}

export const ElementForm: React.FC<ElementFormProps> = ({ onSSHSubmit, onSNMPSubmit, onDiscoverNeighbors }) => {
  const [neData, setNeData] = useState({
    neName: "",
    neType: "",
    neMake: "",
    neIpAddress: "",
    sshUsername: "",
    sshPassword: "",
    sshSecret: "",
    snmpUsername: "",
    snmpAuthPassword: "",
    snmpAuthProtocol: "",
    snmpPrivPassword: "",
    snmpPrivProtocol: ""
  });

  const [isDeviceAdded, setIsDeviceAdded] = useState(false);
  const [isSNMPConfigured, setIsSNMPConfigured] = useState(false); // 用于跟踪 SNMP 配置状态
  const [successMessage, setSuccessMessage] = useState<string>(""); // 用于显示成功消息
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 处理 SSH 提交
  const handleSSHSubmit = async () => {
    console.log("Form data being submitted: ", neData); // 打印当前表单数据

    if (neData.neName && neData.neIpAddress) {
      try {
        const response = await onSSHSubmit(neData); // 等待后端响应
        console.log("Response from backend: ", response); // 打印后端响应

        // 检查返回的数据是否包含有效设备信息
        if (response && response.ne_name) {
          setIsDeviceAdded(true); // 设备成功添加
          setSuccessMessage("SSH connection successful."); // 设置成功消息
          setErrorMessage(""); // 清除错误消息
        } else {
          setErrorMessage("Device addition failed."); // 如果没有返回有效设备信息，显示错误消息
        }
      } catch (error: any) {
        console.error("Error during SSH submission:", error);
        setErrorMessage("An error occurred while adding the device."); // 捕获异常并显示错误消息
      }
    } else {
      setErrorMessage("Please fill in all required fields."); // 显示字段未填写错误
    }
  };

  // 处理 SNMP 提交
  const handleSNMPSubmit = async () => {
    console.log("SNMP Configuration Submitted: ", neData);

    try {
      const response = await onSNMPSubmit(neData); // 传递完整的 neData 进行 SNMP 配置
      console.log("Response from backend with SNMP: ", response); // 打印后端响应
      
      if (response && response.status === 'success') {
        setIsSNMPConfigured(true); // 标记 SNMP 配置成功
        setSuccessMessage("SNMP setup successful.");
        setErrorMessage(""); // 清除之前的错误信息
      } else {
        setErrorMessage(response.message || "SNMP setup failed.");
      }
    } catch (error: any) {
      console.error("Error during SNMP setup: ", error);
      setErrorMessage("An error occurred during SNMP setup.");
    }
  };

  // 处理 Discover Neighbor 按钮
  const handleDiscoverNeighbors = async () => {
    if (onDiscoverNeighbors && isSNMPConfigured) {
      try {
        // 打印传递给 onDiscoverNeighbors 的数据
        console.log("Sending data to neighbor discovery:", neData);
        
        const response = await onDiscoverNeighbors(neData); // 将所有的 neData 传递给邻居发现函数
        
        // 打印从 onDiscoverNeighbors 返回的响应
        console.log("Discover neighbors response:", response);

        // 检查后端返回的状态
        if (response && response.status === "success") {
          setSuccessMessage("Neighbor discovery successful.");
          setErrorMessage(""); // 清除错误信息

          // 进一步打印返回的数据结构
          console.log("Discovered devices:", response.elements);
          console.log("Updated topology:", response.topology);
        } else {
          // 打印出错误信息，帮助了解问题原因
          console.error("Neighbor discovery failed. Response:", response);
          setErrorMessage(response?.message || "Failed to discover neighbors.");
        }
      } catch (error) {
        console.error("Error during neighbor discovery:", error);
        setErrorMessage("Neighbor discovery failed.");
      }
    } else {
      setErrorMessage("SNMP is not configured yet.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNeData({ ...neData, [name]: value });
  };

  const handleSelectChange = (value: string, fieldName: string) => {
    setNeData({ ...neData, [fieldName]: value });
  };

  return (
    <>
      {/* Add NE Form */}
      <Form onFinish={handleSSHSubmit} className={styles.ElementForm}>
        <Title level={4}>Add GNE</Title>
        <Space size="large" className={styles.fullWidthSpace}>
          <Form.Item
            name="neName"
            rules={[{ required: true, message: "Please input NE Name!" }]}
          >
            <Input
              name="neName"
              placeholder="NE Name"
              value={neData.neName}
              onChange={handleInputChange}
            />
          </Form.Item>
          <Form.Item
            name="neType"
            rules={[{ required: true, message: "Please select NE Type!" }]}
          >
            <Select
              placeholder="NE Type"
              onChange={(value) => handleSelectChange(value, "neType")}
            >
              <Option value="Router">Router</Option>
              <Option value="Switch">Switch</Option>
              <Option value="Firewall">Firewall</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="neMake"
            rules={[{ required: true, message: "Please input NE Make!" }]}
          >
            <Input
              name="neMake"
              placeholder="NE Make"
              value={neData.neMake}
              onChange={handleInputChange}
            />
          </Form.Item>
          <Form.Item
            name="neIpAddress"
            rules={[{ required: true, message: "Please input NE IP Address!" }]}
          >
            <Input
              name="neIpAddress"
              placeholder="NE IP Address"
              value={neData.neIpAddress}
              onChange={handleInputChange}
            />
          </Form.Item>
          <Form.Item
            name="sshUsername"
            rules={[{ required: true, message: "Please input SSH User Name!" }]}
          >
            <Input
              name="sshUsername"
              placeholder="SSH User Name"
              value={neData.sshUsername}
              onChange={handleInputChange}
            />
          </Form.Item>
          <Form.Item
            name="sshPassword"
            rules={[{ required: true, message: "Please input SSH Password!" }]}
          >
            <Input.Password
              name="sshPassword"
              placeholder="SSH Password"
              value={neData.sshPassword}
              onChange={handleInputChange}
            />
          </Form.Item>
          <Form.Item name="sshSecret">
            <Input.Password
              name="sshSecret"
              placeholder="SSH Secret (Optional)"
              value={neData.sshSecret}
              onChange={handleInputChange}
            />
          </Form.Item>
          {/* Add NE 按钮 */}
          <Button type="primary" htmlType="submit">
            Add NE
          </Button>
        </Space>
      </Form>

      {isDeviceAdded && (
        <>
          {/* SNMP 配置表单 */}
          <Title level={4}>Configure SNMP</Title>
          <Space size="large" className={styles.fullWidthSpace}>
            <Form.Item
              name="snmpUsername"
              rules={[{ required: true, message: "Please input SNMP Username!" }]}
            >
              <Input
                name="snmpUsername"
                value={neData.snmpUsername}
                onChange={handleInputChange}
                placeholder="SNMP Username"
              />
            </Form.Item>
            <Form.Item
              name="snmpAuthProtocol"
              rules={[{ required: true, message: "Please select SNMP Auth Protocol!" }]}
            >
              <Select
                value={neData.snmpAuthProtocol}
                onChange={(value) => handleSelectChange(value, "snmpAuthProtocol")}
                placeholder="SNMP Auth Protocol"
              >
                <Option value="MD5">MD5</Option>
                <Option value="SHA">SHA</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="snmpAuthPassword"
              rules={[{ required: true, message: "Please input SNMP Auth Password!" }]}
            >
              <Input.Password
                name="snmpAuthPassword"
                value={neData.snmpAuthPassword}
                onChange={handleInputChange}
                placeholder="SNMP Auth Password"
              />
            </Form.Item>
            <Form.Item
              name="snmpPrivProtocol"
              rules={[{ required: true, message: "Please select SNMP Priv Protocol!" }]}
            >
              <Select
                value={neData.snmpPrivProtocol}
                onChange={(value) => handleSelectChange(value, "snmpPrivProtocol")}
                placeholder="SNMP Priv Protocol"
              >
                <Option value="AES128">AES</Option>
                <Option value="DES56">DES</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="snmpPrivPassword"
              rules={[{ required: true, message: "Please input SNMP Priv Password!" }]}
            >
              <Input.Password
                name="snmpPrivPassword"
                value={neData.snmpPrivPassword}
                onChange={handleInputChange}
                placeholder="SNMP Priv Password"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" onClick={handleSNMPSubmit}>
              Submit SNMP
            </Button>
          </Space>
          {isSNMPConfigured && (
            <Button type="default" onClick={handleDiscoverNeighbors}>
              Discover Neighbor
            </Button>
          )}
        </>
      )}

      {/* 显示成功或错误消息 */}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
    </>
  );
};