import React, { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Form, Table } from 'antd';
import axios from 'axios'; // 用于发起异步请求

const { Option } = Select;

interface SecQueryModalProps {
  visible: boolean;
  selectedDevice: any;  // 传递整个设备对象
  networkName: string;
  onClose: () => void;
}

export const SecQueryModal: React.FC<SecQueryModalProps> = ({ visible, selectedDevice, networkName, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scanData, setScanData] = useState<any>(null); // 存储 Nmap 端口扫描数据

  useEffect(() => {
    if (visible && selectedDevice) {
      form.setFieldsValue({
        ne_type: selectedDevice.ne_type || 'Router',
        ne_name: selectedDevice.ne_name || '', // 添加设备名称
        ne_ip: selectedDevice.ne_ip || '',
        port_range: '1-1024', // 预设端口范围
      });

      console.log('Initial Form Values:', form.getFieldsValue());
    }
  }, [visible, selectedDevice, form]);

  // 发起端口扫描请求的异步函数
  const fetchPortScanData = async () => {
    const scanParams = form.getFieldsValue(); // 获取所有表单值
    console.log('Port Scan Params:', scanParams);

    setLoading(true); // 开始加载状态
    try {
      const response = await axios.post(`http://127.0.0.1:8888/security/${selectedDevice.ne_name}/Scan`, scanParams);
      console.log('Port Scan Data Response:', response.data);
      setScanData(response.data.scan_results); // 更新扫描结果数据
    } catch (error) {
      console.error("Failed to fetch port scan data", error);
    } finally {
      setLoading(false); // 结束加载状态
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'Port',
      dataIndex: 'port',
      key: 'port',
    },
    {
      title: 'Protocol',
      dataIndex: 'protocol',
      key: 'protocol',
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
    },
  ];

  return (
    <Modal
      title={`Port Scan for ${selectedDevice.ne_name}`}
      visible={visible}
      onCancel={onClose}
      footer={null} // 去掉底部按钮
      width={1000} // Set width to match the form and configuration area
    >
      <Form
        form={form}
        layout="inline"
        initialValues={{ ne_type: 'Router' }}
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <Form.Item name="ne_type" label="NE Type">
          <Select onChange={(value) => form.setFieldsValue({ ne_type: value })} style={{ width: 150 }}>
            <Option value="Router">Router</Option>
            <Option value="Switch">Switch</Option>
            <Option value="Firewall">Firewall</Option>
          </Select>
        </Form.Item>
        <Form.Item name="ne_name" label="NE Name">
          <Input placeholder="NE Name" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="ne_ip" label="NE IP">
          <Input placeholder="NE IP" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="port_range" label="Port Range">
          <Input placeholder="Port Range" style={{ width: 150 }} />
        </Form.Item>
        <Button type="primary" onClick={fetchPortScanData} loading={loading}>
          Fetch Port Scan Data
        </Button>
      </Form>

      <div style={{ marginTop: 20 }}>
        <h4>Port Scan Results</h4>
        {/* 表格展示端口扫描结果 */}
        <Table columns={columns} dataSource={scanData || []} rowKey="port" pagination={false} />
      </div>
    </Modal>
  );
};