import React from "react";
import styles from "./Header.module.css";
import shield from "../../assets/shield.png";
import star from "../../assets/star.png";
import { Typography, Menu, Dropdown } from "antd";
import { GlobalOutlined } from "@ant-design/icons";

export const Header: React.FC = () => {
  return (
    <div className={styles["app-header"]}>
      <div className={styles["logo-header"]}>
        <div className={styles["logo-container"]}>
          <img src={shield} alt="shield" className={styles["shield-logo"]} />
          <img src={star} alt="star1" className={`${styles["star-logo"]} ${styles["star1"]}`} />
          <img src={star} alt="star2" className={`${styles["star-logo"]} ${styles["star2"]}`} />
          <img src={star} alt="star3" className={`${styles["star-logo"]} ${styles["star3"]}`} />
          <img src={star} alt="star4" className={`${styles["star-logo"]} ${styles["star4"]}`} />
        </div>
        <Typography.Title level={3} className={styles.title}>
          CruxWatch
        </Typography.Title>
      </div>
      <div className={styles["main-header"]}>
        <div className={styles["top-header"]}>
          <Typography.Text className={styles.slogan}>
            Network Patron Saint
          </Typography.Text>
          <Dropdown.Button
            className={styles["button-language"]}
            overlay={
              <Menu
                items={[
                  { key: "1", label: "English" },
                  { key: "2", label: "中文" },
                ]}
              />
            }
            icon={<GlobalOutlined />}
          >
            Language
          </Dropdown.Button>
        </div>
        <Menu mode="horizontal" className={styles["main-menu"]}>
          <Menu.Item key="1">TopDisc</Menu.Item>
          <Menu.Item key="2">NEList</Menu.Item>
          <Menu.Item key="3">CfgMgmt</Menu.Item>
          <Menu.Item key="4">PerfMon</Menu.Item>
          <Menu.Item key="5">RelDet</Menu.Item>
          <Menu.Item key="6">SecTst</Menu.Item>
        </Menu>
      </div>
    </div>
  );
};