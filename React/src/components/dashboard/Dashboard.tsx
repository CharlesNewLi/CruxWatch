import React, { useEffect } from "react";
import { useSelector, useAppDispatch } from "../../redux/hooks"; 
import { getNetworks } from "../../redux/networks/slice"; 
import styles from "./Dashboard.module.css";
import { ProfileImage } from "./ProfileImage";

export const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();

  // 从 Redux store 中获取状态
  const loading = useSelector((state) => state.networks.loading);
  const error = useSelector((state) => state.networks.error);
  const networks = useSelector((state) => state.networks.data);

  // 在组件挂载时发起网络请求
  useEffect(() => {
    dispatch(getNetworks());
  }, [dispatch]);

  if (loading) {
    return <div>Loading...</div>; // 显示加载状态
  }

  if (error) {
    return <div>Error: {error}</div>; // 显示错误信息
  }
   
  return (
    <div className={styles.outer}>
      <div className={styles.inner_large}>
        <ProfileImage 
          title="Network Management" 
          icon="cluster" 
          isLarge={true} 
          link={`/networks`} 
        />
      </div>
      <div className={styles.small_container}>
        <div className={styles.inner_small}>
          <ProfileImage 
            title="Configuration Management" 
            icon="setting" 
            link="/configuration" 
          />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage 
            title="Performance Monitor" 
            icon="dashboard" 
            link="/performance" 
          />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage 
            title="Fault Monitor" 
            icon="warning" 
            link="/fault" 
          />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage 
            title="Security Monitor" 
            icon="safety" 
            link="/security" 
          />
        </div>
      </div>
    </div>
  );
};