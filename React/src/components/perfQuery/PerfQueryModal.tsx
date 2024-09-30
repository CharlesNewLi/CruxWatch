import React, { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Form, Table, Card } from 'antd';
import { Bar } from '@ant-design/charts'; // 使用ant-design-charts进行数据可视化
import axios from 'axios'; // 用于发起异步请求

const { TextArea } = Input;
const { Option } = Select;

interface PerfQueryModalProps {
  visible: boolean;
  selectedDevice: any;  // 传递整个设备对象
  networkName: string;
  onClose: () => void;
}

export const PerfQueryModal: React.FC<PerfQueryModalProps> = ({ visible, selectedDevice, networkName, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [snmpData, setSnmpData] = useState<any>(null); // 存储 SNMP 性能数据

  useEffect(() => {
    if (visible && selectedDevice) {
      form.setFieldsValue({
        ne_ip: selectedDevice.ne_ip || '',
        snmp_username: selectedDevice.snmp_username || '',
        snmp_auth_protocol: selectedDevice.snmp_auth_protocol || '',
        snmp_auth_password: selectedDevice.snmp_auth_password || '',
        snmp_priv_protocol: selectedDevice.snmp_priv_protocol || '',
        snmp_priv_password: selectedDevice.snmp_priv_password || ''
      });

      // 打印表单的初始值
      console.log('Initial Form Values:', form.getFieldsValue());
    }
  }, [visible, selectedDevice, form]);

  // 发起 SNMP 性能数据查询的异步请求
  const fetchSnmpData = async () => {
    const snmpCredentials = form.getFieldsValue(); // 获取所有表单值

    // 打印即将发送的 SNMP 凭证
    console.log('SNMP Query Params:', snmpCredentials);

    setLoading(true); // 开始加载状态
    try {
      const response = await axios.post(`http://127.0.0.1:8888/performance/${selectedDevice.ne_name}/Info`, snmpCredentials);
      
      // 打印返回的数据
      console.log('SNMP Data Response:', response.data);

      setSnmpData(response.data.device_perf_info); // 更新 SNMP 数据
    } catch (error) {
      console.error("Failed to fetch SNMP data", error);
    } finally {
      setLoading(false); // 结束加载状态
    }
  };

  // 表格列定义
const columns = [
  {
    title: 'Interface Index',
    dataIndex: 'Index',
    key: 'Index',
  },
  {
    title: 'Description',
    dataIndex: 'Description',
    key: 'Description',
  },
  {
    title: 'Status',
    dataIndex: 'Status',
    key: 'Status',
    render: (status: string) => {
      // 将状态值 1 映射为 UP，2 映射为 DOWN
      return status === '1' ? 'UP' : status === '2' ? 'DOWN' : 'Unknown';
    },
  },
  {
    title: 'IP Address',
    dataIndex: 'IP Address',
    key: 'IP Address',
  },
  {
    title: 'Utilization (In/Out)',
    dataIndex: 'InOctets',  // 需要从 InOctets 和 OutOctets 渲染
    key: 'Utilization',
    render: (text: string, record: any) => {
      // 检查是否有 InOctets 和 OutOctets 数据并进行渲染
      const inOctets = record.InOctets || '0';
      const outOctets = record.OutOctets || '0';
      
      // 渲染显示的格式为: In: X bytes / Out: X bytes
      return `In: ${inOctets} bytes / Out: ${outOctets} bytes`;
    },
  }
];

  // CPU 利用率条形图
  const cpuData = snmpData?.cpu_metrics ? [{ metric: 'CPU', value: snmpData.cpu_metrics }] : [];
  const storageData = snmpData?.storage_metrics ? [{ metric: 'Storage', value: snmpData.storage_metrics }] : [];

  // 打印 CPU 和存储的数据，用于可视化的输入
  console.log('CPU Data for Chart:', cpuData);
  console.log('Storage Data for Chart:', storageData);

  const cpuConfig = {
    data: cpuData,
    xField: 'value',
    yField: 'metric',
    color: '#3b82f6',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    height: 150,
  };

  const storageConfig = {
    data: storageData,
    xField: 'value',
    yField: 'metric',
    color: '#34d399',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    height: 150,
  };

  return (
    <Modal
      title={`Query SNMP Data for ${selectedDevice.ne_name}`}
      visible={visible}
      onCancel={onClose}
      footer={null} // 去掉底部按钮
      width={1000} // Set width to match the form and configuration area
    >
      <Form
        form={form}
        layout="inline"
        initialValues={{ ne_type: 'Router', snmp_username: 'admin', snmp_auth_password: 'password123' }}
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <Form.Item name="ne_ip" label="NE IP">
          <Input placeholder="NE IP" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="snmp_username" label="SNMP Username">
          <Input placeholder="SNMP Username" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="snmp_auth_protocol" label="SNMP Auth Protocol">
          <Select onChange={(value) => form.setFieldsValue({ snmp_auth_protocol: value })} style={{ width: 150 }}>
            <Option value="MD5">MD5</Option>
            <Option value="SHA">SHA</Option>
          </Select>
        </Form.Item>
        <Form.Item name="snmp_auth_password" label="SNMP Auth Password">
          <Input.Password placeholder="SNMP Auth Password" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="snmp_priv_protocol" label="SNMP Priv Protocol">
          <Select onChange={(value) => form.setFieldsValue({ snmp_priv_protocol: value })} style={{ width: 150 }}>
            <Option value="DES">DES</Option>
            <Option value="AES128">AES128</Option>
          </Select>
        </Form.Item>
        <Form.Item name="snmp_priv_password" label="SNMP Priv Password">
          <Input.Password placeholder="SNMP Priv Password" style={{ width: 150 }} />
        </Form.Item>
        <Button type="primary" onClick={fetchSnmpData} loading={loading}>
          Fetch SNMP Data
        </Button>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20 }}>
        {/* 使用图表展示 CPU 和存储利用率 */}
        <Card title="CPU Utilization" bordered={false} style={{ width: 300 }}>
          <Bar {...cpuConfig} />
        </Card>
        <Card title="Storage Utilization" bordered={false} style={{ width: 300 }}>
          <Bar {...storageConfig} />
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4>Interface Details</h4>
        {/* 表格展示接口信息 */}
        <Table columns={columns} dataSource={snmpData?.interfaces || []} rowKey="Index" pagination={false} />
      </div>
    </Modal>
  );
};