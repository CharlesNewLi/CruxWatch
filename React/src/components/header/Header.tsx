import React, { useState, useEffect } from "react";
import styles from "./Header.module.css";
import shield from "../../assets/shield.png";
import star from "../../assets/star.png";
import { Typography } from "antd";
import { WifiOutlined, EnvironmentOutlined, GlobalOutlined, BellOutlined, 
         QuestionCircleOutlined, SettingOutlined, FileTextOutlined } from "@ant-design/icons";

export const Header: React.FC = () => {
  const stats = {
    networks: 0,
    sites: 0,
    devices: 0
  };

  const [visibleDropdown, setVisibleDropdown] = useState<string | null>(null);
  const [location, setLocation] = useState<string>("Unknown Location");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(`Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`);
        },
        (error) => {
          console.error("Error fetching location:", error);
        }
      );
    }
  }, []);

  const handleIconClick = (type: string) => {
    setVisibleDropdown(visibleDropdown === type ? null : type);
  };

  const renderDropdown = (type: string, items: string[]) => {
    return visibleDropdown === type && (
      <div className={styles["menu-list"]}>
        {items.map((item, index) => (
          <a href="#" className={styles["dropdown-item"]} key={index}>
            {item}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className={styles["app-header"]}>
      <div className={styles["logo-header"]}>
        <div className={styles["logo-pattern"]}>
          <img src={shield} alt="shield" className={styles["shield-logo"]} />
          <img src={star} alt="star1" className={`${styles["star-logo"]} ${styles["star1"]}`} />
          <img src={star} alt="star2" className={`${styles["star-logo"]} ${styles["star2"]}`} />
          <img src={star} alt="star3" className={`${styles["star-logo"]} ${styles["star3"]}`} />
          <img src={star} alt="star4" className={`${styles["star-logo"]} ${styles["star4"]}`} />
        </div>
        <div className={styles["logo-tile"]}>
          <Typography.Title level={3} className={styles.title}>
            CruxWatch
          </Typography.Title>
          <Typography.Text className={styles.slogan}>
            Network Patron Saint
          </Typography.Text>
        </div>
      </div>
      <div className={styles["stats-header"]}>
        <div className={styles["stats-item"]}>
          <div className={styles["stats-number"]}>{stats.networks}</div>
          <div className={styles["stats-label"]}>Network(s)</div>
        </div>
        <div className={styles["stats-item"]}>
          <div className={styles["stats-number"]}>{stats.sites}</div>
          <div className={styles["stats-label"]}>Site(s)</div>
        </div>
        <div className={styles["stats-item"]}>
          <div className={styles["stats-number"]}>{stats.devices}</div>
          <div className={styles["stats-label"]}>Device(s)</div>
        </div>
      </div>
      <div className={styles["top-header"]}>
        <div className={styles["top-button"]} onClick={() => handleIconClick("network")}>
          <WifiOutlined className={styles["button-icon"]}/>
          {renderDropdown("network", [
            "IP: 192.168.1.1",
            "Status: Connected",
            "Port: 8080",
          ])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("location")}>
          <EnvironmentOutlined className={styles["button-icon"]}/>
          {renderDropdown("location", [location])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("settings")}>
          <SettingOutlined className={styles["button-icon"]}/>
          {renderDropdown("settings", [
            "Modules",
            "Map"
          ])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("logs")}>
          <FileTextOutlined className={styles["button-icon"]}/>
          {renderDropdown("logs", [
            "Recent Logs",
            "Download"
          ])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("notifications")}>
          <BellOutlined className={styles["button-icon"]}/>
          {renderDropdown("notifications", [
            "No new notifications"
          ])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("help")}>
          <QuestionCircleOutlined className={styles["button-icon"]}/>
          {renderDropdown("help", [
            "User Guide",
            "Support"
          ])}
        </div>
        <div className={styles["top-button"]} onClick={() => handleIconClick("language")}>
          <GlobalOutlined className={styles["button-icon"]}/>
          {renderDropdown("language", ["English", "中文"])}
        </div>
      </div>
    </div>
  );
};