import React from "react";
import { Layout, Typography } from "antd";

export const Footer: React.FC = () => {
    return (
      <Layout.Footer>
          <Typography.Title
            level={3}
            style={{
              textAlign: "center",
              height: "5px",
              display: "flex",
              alignItems: "center", // 垂直居中
              justifyContent: "center", // 水平居中
            }}
          >
          Copyright © CruxWatch
        </Typography.Title>
      </Layout.Footer>
    );
}