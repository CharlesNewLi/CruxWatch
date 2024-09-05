import React from "react";
import styles from "./Dashboard.module.css";
import { ProfileImage } from "./ProfileImage";

export const Dashboard: React.FC = () => {
  return (
    <div className={styles.outer}>
      <div className={styles.inner_large}>
        <ProfileImage title="Network Management" icon="cluster" isLarge={true} />
      </div>
      <div className={styles.small_container}>
        <div className={styles.inner_small}>
          <ProfileImage title="Configuration Management" icon="setting" />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage title="Performance Monitor" icon="dashboard" />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage title="Fault Management" icon="warning" />
        </div>
        <div className={styles.inner_small}>
          <ProfileImage title="Security Management" icon="safety" />
        </div>
      </div>
    </div>
  );
};