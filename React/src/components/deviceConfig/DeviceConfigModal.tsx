import React, { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Form } from 'antd';
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { RootState } from '../../redux/store'; 
import { fetchCurrentConfig } from '../../redux/element/slice'; 
import TerminalModal from '../terminal/TerminalModal';

const { TextArea } = Input;
const { Option } = Select;

interface DeviceConfigModalProps {
  visible: boolean;
  selectedDevice: any;
  networkName: string;
  onClose: () => void;
}

export const DeviceConfigModal: React.FC<DeviceConfigModalProps> = ({ visible, selectedDevice, networkName, onClose }) => {
  const dispatch = useAppDispatch();
  const [isTerminalVisible, setTerminalVisible] = useState(false); // 控制 TerminalModal 的显示状态
  
  // 从 Redux 状态中获取设备配置输出和加载状态
  const { configOutput, loading } = useSelector((state: RootState) => state.element);
  
  // Form state management
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && selectedDevice) {
      form.setFieldsValue({
        ne_type: selectedDevice.ne_type || 'Router',
        ne_make: selectedDevice.ne_make || '',
        ne_ip: selectedDevice.ne_ip || '',
        gne: selectedDevice.gne || '',
        ssh_username: selectedDevice.ssh_username || '',
        ssh_password: selectedDevice.ssh_password || '',
        ssh_secret: selectedDevice.ssh_secret || ''
      });
    }
  }, [visible, selectedDevice, form]);

  // 请求设备当前配置，并获取用户修改后的值
  const handleFetchCurrentConfig = () => {
    const sshCredentials = form.getFieldsValue();  // 获取表单中用户修改过的所有值

    // 使用 Redux Thunk 发起异步请求
    dispatch(fetchCurrentConfig({
      networkName,
      deviceName: selectedDevice.ne_name,
      sshCredentials
    }));
  };

  // 控制 TerminalModal 的显示，并获取用户修改后的值
  const handleOpenTerminal = () => {
    const sshCredentials = form.getFieldsValue();  // 获取表单中用户修改过的所有值
    setTerminalVisible(true);
  };

  const handleCloseTerminal = () => {
    setTerminalVisible(false);
  };

  return (
    <>
      <Modal
        title={`Configure Device ${selectedDevice.ne_name}`}
        visible={visible}
        onCancel={onClose}
        footer={null} // 去掉底部按钮
        width={900} // Set width to match the form and configuration area
      >
        <Form
          form={form}
          layout="inline"
          initialValues={{ ne_type: 'Router', ssh_username: 'admin', ssh_password: 'password123' }}
          style={{ display: 'flex', justifyContent: 'space-between' }}
        >
          <Form.Item name="ne_type" label="NE Type">
            <Select onChange={(value) => form.setFieldsValue({ ne_type: value })} style={{ width: 150 }}>
              <Option value="Router">Router</Option>
              <Option value="Switch">Switch</Option>
              <Option value="Firewall">Firewall</Option>
            </Select>
          </Form.Item>
          <Form.Item name="ne_make" label="NE Make">
            <Input placeholder="NE Make" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="ne_ip" label="NE IP">
            <Input placeholder="NE IP" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="gne" label="GNE IP">
            <Input placeholder="GNE IP" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="ssh_username" label="SSH Username">
            <Input placeholder="SSH Username" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="ssh_password" label="SSH Password">
            <Input.Password placeholder="SSH Password" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="ssh_secret" label="SSH Secret (Optional)">
            <Input.Password placeholder="SSH Secret (Optional)" style={{ width: 150 }} />
          </Form.Item>
          <Button type="primary" onClick={handleFetchCurrentConfig} loading={loading}>
            Fetch Current Config
          </Button>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <div style={{ width: '45%' }}>
            <h4>Current Configuration</h4>
            {/* 使用 Redux 状态中的 configOutput 显示配置 */}
            <TextArea value={configOutput} readOnly rows={15} />
          </div>
          <div style={{ width: '45%' }}>
            <h4>Command Line Interface</h4>
            {/* 点击按钮以打开独立的 TerminalModal */}
            <Button type="primary" onClick={handleOpenTerminal}>Open Terminal</Button>
          </div>
        </div>
      </Modal>

      {/* 独立的 TerminalModal */}
      <TerminalModal
        visible={isTerminalVisible}
        onClose={handleCloseTerminal}
        sshDetails={{
          neMake: form.getFieldValue('ne_make'),  // 从表单中获取最新的值
          neIp: form.getFieldValue('ne_ip'),      // 从表单中获取最新的值
          gneIp: form.getFieldValue('gne'),       // 从表单中获取最新的值
          sshUsername: form.getFieldValue('ssh_username'),  // 从表单中获取最新的值
          sshPassword: form.getFieldValue('ssh_password'),  // 从表单中获取最新的值
          sshSecret: form.getFieldValue('ssh_secret'),      // 从表单中获取最新的值
        }}
      />
    </>
  );
};