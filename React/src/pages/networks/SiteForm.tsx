import React, { useState, useEffect } from "react";
import { useSelector } from "../../redux/hooks"; 
import { Modal, Input, Button, Form, Space } from "antd";

interface SiteFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (siteData: any) => void;
  initialValues?: {
    site_id: string; // 添加 site_id 以便查找所属的 network
    site_name: string;
    site_location?: { latitude: string; longitude: string };
  };
}

export const SiteForm: React.FC<SiteFormProps> = ({ visible, onClose, onSubmit, initialValues }) => {
  const [siteName, setSiteName] = useState(initialValues?.site_name || "");
  const [siteLocation, setSiteLocation] = useState<{ latitude: string; longitude: string }>({
    latitude: initialValues?.site_location?.latitude || "",
    longitude: initialValues?.site_location?.longitude || "",
  });
  const [networkId, setNetworkId] = useState<string | null>(null); // 新增 networkId 状态

  // 从 Redux store 中获取网络数据
  const networkStats = useSelector((state) => state.network.networkDetails);

  // 查找与当前 site_id 相关联的 network_id
  useEffect(() => {
    if (initialValues?.site_id && networkStats?.length > 0) {
      for (const network of networkStats) {
        const site = network.sites?.find((s) => s.site_id === initialValues.site_id);
        if (site) {
          setNetworkId(network.network_id); // 找到相关的 network_id
          break;
        }
      }
    }
  }, [initialValues?.site_id, networkStats]);

  // 初始化表单数据
  useEffect(() => {
    if (initialValues) {
      setSiteName(initialValues.site_name || "");
      setSiteLocation({
        latitude: initialValues?.site_location?.latitude || "",
        longitude: initialValues?.site_location?.longitude || "",
      });
    }
  }, [initialValues]);

  const handleSubmit = () => {
    const siteData = {
      site_name: siteName,
      site_location: siteLocation,
      network_id: networkId, // 将找到的 network_id 传递给后端
      site_id: initialValues?.site_id // 确保传递 site_id
    };
    onSubmit(siteData); // 提交包含 network_id 的数据
  };

  return (
    <Modal
      title="Edit Site"
      visible={visible}
      onCancel={onClose}
      footer={null}
    >
      <Form layout="vertical">
        <Form.Item label="Site Name" required>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Enter site name"
          />
        </Form.Item>

        <Form.Item label="Latitude (Optional)">
          <Input
            value={siteLocation.latitude}
            onChange={(e) => setSiteLocation({ ...siteLocation, latitude: e.target.value })}
            placeholder="Enter latitude"
          />
        </Form.Item>

        <Form.Item label="Longitude (Optional)">
          <Input
            value={siteLocation.longitude}
            onChange={(e) => setSiteLocation({ ...siteLocation, longitude: e.target.value })}
            placeholder="Enter longitude"
          />
        </Form.Item>

        <Space style={{ marginTop: 20 }}>
          <Button type="primary" onClick={handleSubmit}>
            Submit
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Space>
      </Form>
    </Modal>
  );
};