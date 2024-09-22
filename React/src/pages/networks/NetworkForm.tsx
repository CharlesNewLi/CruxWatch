import React, { useState, useEffect } from "react";
import { useSelector } from "../../redux/hooks"; 
import { Modal, Button, Input, Form, Space } from "antd";
import { v4 as uuidv4 } from 'uuid'; // 引入 uuid 生成器
import { MinusCircleOutlined } from "@ant-design/icons"; // 引入删除图标

interface NetworkFormProps {
  onClose: () => void;
  onSubmit: (network: any) => void;
  initialValues?: any;
  visible: boolean; 
}

export const NetworkForm: React.FC<NetworkFormProps> = ({ onClose, onSubmit, initialValues, visible }) => {
  // 初始的 networkName 和 sites 可能来自编辑场景的 initialValues
  const [networkName, setNetworkName] = useState<string>(initialValues?.network_name || "");
  const [sites, setSites] = useState<{ site_id: string; site_name: string }[]>(
    initialValues?.sites || []
  );
  const [error, setError] = useState<string>("");
  
  // 从 Redux store 中获取网络数据
  const networksStats = useSelector((state) => state.networks.data);
  const networkItems = networksStats?.networks || [];

  // 初始化编辑时的数据
  useEffect(() => {
    console.log("Initial values received:", initialValues);
    console.log("Form state - networkName:", networkName);
    console.log("Form state - sites:", sites);
    
    if (initialValues) {
      setNetworkName(initialValues.network_name || "");
      // 编辑时，站点初始化为空数组，用户手动添加站点
      setSites(initialValues.sites || []);
    }
  }, [initialValues]);
  
  // 新增站点
  const addSiteField = () => {
    setSites([...sites, { site_id: uuidv4(), site_name: "" }]);
  };

  // 删除站点
  const removeSiteField = (index: number) => {
    const updatedSites = sites.filter((_, i) => i !== index);
    setSites(updatedSites);
  };

  // 重置表单的函数
  const resetForm = () => {
    setNetworkName("");
    setSites([]);  // 重置时同样保持站点为空数组
    setError("");
  };

  // 提交表单并进行网络名和站点名的重复性检查
  const handleSubmit = () => {
    // 打印提交时的表单状态
    console.log("Submitting form - networkName:", networkName);
    console.log("Submitting form - sites:", sites);
    
    // 检查网络名称是否为空
    if (!networkName.trim()) {
      setError("Network name is required.");
      return;
    }
  
    // 在新增模式下，检查网络名称是否重复
    if (!initialValues) {
      const isDuplicateName = networkItems.some((network) => network.network_name === networkName.trim());
      if (isDuplicateName) {
        setError("Network name already exists.");
        return;
      }
    }

    // 在新增和编辑模式下，都检查站点名称
    const siteNames = sites.map((site) => site.site_name.trim());

    // 检查站点名称是否为空或仅为空格
    const hasEmptySiteNames = siteNames.some((siteName) => siteName === "");
    if (hasEmptySiteNames) {
      setError("Site names cannot be empty or just spaces.");
      return;
    }

    // 检查站点名称是否重复
    const hasDuplicateSiteNames = new Set(siteNames).size !== siteNames.length;
    if (hasDuplicateSiteNames) {
      setError("Site names must be unique.");
      return;
    }
  
    // 构建网络和站点数据
    const networkData = {
      network_id: initialValues?.network_id || uuidv4(), // 编辑时保留 network_id，新增时生成新的 ID
      network_name: networkName,
      sites: sites.map((site) => ({
        site_id: site.site_id || uuidv4(), // 保留现有 site_id 或生成新的
        site_name: site.site_name
      })),
    };
  
    setError(""); // 清除错误信息
    onSubmit(networkData); // 提交数据
    handleClose(); // 调用 handleClose 函数来关闭表单并清空表单
  };

  // 关闭表单并重置表单
  const handleClose = () => {
    resetForm(); // 清空表单
    onClose(); // 调用父组件传入的关闭函数
  };

  return (
    <Modal 
      title={initialValues ? "Edit Network" : "Add New Network"} 
      visible={visible}
      footer={null} 
      onCancel={handleClose}
    >
      <Form>
        <Form.Item label="Network Name" required>
          <Input
            value={networkName}
            onChange={(e) => setNetworkName(e.target.value)}
            placeholder="Enter network name"
          />
        </Form.Item>

        {sites.map((site, index) => (
          <Form.Item key={site.site_id} label={`Site ${index + 1}`}>
            <Space>
              <Input
                value={site.site_name}
                onChange={(e) => {
                  const updatedSites = [...sites];
                  updatedSites[index].site_name = e.target.value;
                  setSites(updatedSites);
                }}
                placeholder="Enter site name (optional)"
              />
              <Button
                type="dashed"
                icon={<MinusCircleOutlined />}
                onClick={() => removeSiteField(index)} // 点击删除按钮时调用 removeSiteField
              >
                Delete
              </Button>
            </Space>
          </Form.Item>
        ))}

        {error && <div style={{ color: 'red' }}>{error}</div>}

        <Button onClick={addSiteField}>Add Another Site</Button>
        <Space style={{ marginTop: 20 }}>
          <Button type="primary" onClick={handleSubmit}>
            Submit
          </Button>
        </Space>
      </Form>
    </Modal>
  );
};