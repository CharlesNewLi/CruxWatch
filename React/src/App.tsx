import React, { useEffect } from "react";
import { useAppDispatch, useSelector } from "./redux/hooks"; 
import { getNetworks, syncNetworkStats } from "./redux/networks/slice"; 
import styles from "./App.module.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage, NetworkPage, ConfMgmt, PerfMon, FaultMgmt, SecMgmt } from "./pages";

function App() {
   
  const dispatch = useAppDispatch();

   // 在组件挂载时发起网络请求，并同步 networkDetails
  useEffect(() => {
    const fetchAndSyncNetworks = async () => {
      // 1. 获取 networks 数据
      await dispatch(getNetworks());

      // 2. 进行增量同步
      await dispatch(syncNetworkStats());
    };

    fetchAndSyncNetworks();
  }, [dispatch]);


  return (
    <div className={styles.App}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/networks" element={<NetworkPage />} />
          <Route path="/configuration" element={<ConfMgmt />} />
          <Route path="/performance" element={<PerfMon />} />
          <Route path="/fault" element={<FaultMgmt />} />
          <Route path="/security" element={<SecMgmt />} />
          <Route path="*" element = {<h1>404 not found Welcome to Mars</h1>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
