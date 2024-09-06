import React from "react";
import styles from "./Dashboard.module.css";
import { Typography } from "antd";
import { Link } from "react-router-dom";

// 从 @ant-design/icons 单独引入每个图标
import { ClusterOutlined, SettingOutlined, DashboardOutlined, WarningOutlined, SafetyOutlined } from '@ant-design/icons';

// 定义 PropsType 接口
interface PropsType {
  title: string;     // 标题
  icon: string;      // 图标名称
  isLarge?: boolean; // 是否为大组件，默认为 false
  link: string;      // 路由路径
}

// 根据传入的 icon 名称，选择相应的图标组件
const getIconComponent = (icon: string, className: string) => {
  switch (icon) {
    case "cluster":
      return <ClusterOutlined className={className} />;
    case "setting":
      return <SettingOutlined className={className} />;
    case "dashboard":
      return <DashboardOutlined className={className} />;
    case "warning":
      return <WarningOutlined className={className} />;
    case "safety":
      return <SafetyOutlined className={className} />;
    default:
      return null;
  }
};

export const ProfileImage: React.FC<PropsType> = ({ title, icon, isLarge = false, link }) => {
  // 使用不同的图标大小样式类
  const iconClassName = isLarge ? styles.iconLarge : styles.iconSmall;
  
  return (
    <Link to={link} className={styles.profileImageContainer}> {/* 使用 link 进行跳转 */}
      <div className={styles.iconBackground}>
        {getIconComponent(icon, iconClassName)} {/* 使用选择的图标组件 */}
      </div>
      <div className={styles.textOverlay}>
        <Typography.Text className={styles.text}>
          {title}  {/* 显示标题 */}
        </Typography.Text>
      </div>
    </Link>
  );
};