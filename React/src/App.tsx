import React from "react";
import styles from "./App.module.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage, NetworkPage, ConfMgmt, PerfMon, FaultMgmt, SecMgmt } from "./pages";

function App() {
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
