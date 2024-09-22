import React, { useState } from "react";
import { Button, Input, Select, Form, Space, Modal, Typography } from "antd";
import styles from "./NetworkInitPanel.module.css"; // 定义样式

const { Option } = Select;
const { Title } = Typography;

interface ElementFormProps {
  onSubmit: (neData: any) => Promise<any>; // 返回 Promise 以等待后端响应
}

export const ElementForm: React.FC<ElementFormProps> = ({ onSubmit }) => {
  const [neData, setNeData] = useState({
    neName: "",
    neType: "",
    neMake: "",
    neIpAddress: "",
    sshUsername: "",
    sshPassword: "",
    sshSecret: "",
  });

  const [isSnmpConfigVisible, setIsSnmpConfigVisible] = useState(false);
  const [isDeviceAdded, setIsDeviceAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(""); // 添加错误消息的状态

  const handleSubmit = async () => {
    console.log("Form data being submitted: ", neData); // 打印当前表单数据
  
    if (neData.neName && neData.neIpAddress) {
      try {
        const response = await onSubmit(neData); // 等待后端响应
        if (response.status === 'success') {
          setIsDeviceAdded(true); // 模拟设备添加成功
          setIsSnmpConfigVisible(true); // 如果成功，显示SNMP配置弹窗
          setErrorMessage(""); // 清除之前的错误信息
        } else {
          setErrorMessage(response.error || "Device addition failed."); // 显示错误信息
        }
      } catch (error: any) {
        // 捕获异常，并设置错误消息
        if (error.response && error.response.data && error.response.data.error) {
          setErrorMessage(error.response.data.error); // 使用后端返回的错误信息
        } else {
          setErrorMessage("An error occurred while adding the device.");
        }
      }
    } else {
      setErrorMessage("Please fill in all required fields.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNeData({ ...neData, [name]: value });
  };

  const handleSelectChange = (value: string, fieldName: string) => {
    setNeData({ ...neData, [fieldName]: value });
  };

  const handleSnmpSubmit = (values: any) => {
    console.log("SNMP Configuration Submitted: ", values);
    setIsSnmpConfigVisible(false); // 关闭SNMP配置表单
  };

  const handleSnmpCancel = () => {
    setIsSnmpConfigVisible(false); // 关闭SNMP配置表单
  };

  return (
    <>
      <Form onFinish={handleSubmit} className={styles.ElementForm}>
        <Title level={4}>Add GNE</Title>
        <Space direction="vertical" size="large" className={styles.space}>
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
          {errorMessage && (
            <div className={styles.error}>
              <Typography.Text type="danger">{errorMessage}</Typography.Text>
            </div>
          )}

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

          <Button type="primary" htmlType="submit">
            Add NE
          </Button>
        </Space>
      </Form>

      {isDeviceAdded && (
        <div className={styles.deviceAdded}>
          <Title level={5}>Device Added Successfully!</Title>
          <p>
            <strong>NE Name:</strong> {neData.neName}
          </p>
          <p>
            <strong>IP Address:</strong> {neData.neIpAddress}
          </p>
        </div>
      )}

      {/* SNMP 配置表单 */}
      <Modal
        title="Configure SNMP"
        visible={isSnmpConfigVisible}
        onCancel={handleSnmpCancel}
        footer={null}
      >
        <Form onFinish={handleSnmpSubmit}>
          <Form.Item
            name="snmpUsername"
            label="SNMP Username"
            rules={[{ required: true, message: "Please input SNMP Username!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="snmpAuthProtocol"
            label="SNMP Auth Protocol"
            rules={[
              { required: true, message: "Please select SNMP Auth Protocol!" },
            ]}
          >
            <Select>
              <Option value="MD5">MD5</Option>
              <Option value="SHA">SHA</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="snmpAuthPassword"
            label="SNMP Auth Password"
            rules={[
              { required: true, message: "Please input SNMP Auth Password!" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="snmpPrivProtocol"
            label="SNMP Priv Protocol"
            rules={[
              { required: true, message: "Please select SNMP Priv Protocol!" },
            ]}
          >
            <Select>
              <Option value="DES">DES</Option>
              <Option value="AES">AES</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="snmpPrivPassword"
            label="SNMP Priv Password"
            rules={[
              { required: true, message: "Please input SNMP Priv Password!" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
            <Button onClick={handleSnmpCancel}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};