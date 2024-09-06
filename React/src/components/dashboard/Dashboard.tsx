import React from "react";
import styles from "./Dashboard.module.css";
import { ProfileImage } from "./ProfileImage";

export const Dashboard: React.FC = () => {
  return (
    <div className={styles.outer}>
      <div className={styles.inner_large}>
        <ProfileImage 
          title="Network Management" 
          icon="cluster" 
          isLarge={true} 
          link="/networks" 
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
            title="Fault Management" 
            icon="warning" 
            link="/fault" 
          />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage 
            title="Security Management" 
            icon="safety" 
            link="/security" 
          />
        </div>
      </div>
    </div>
  );
};