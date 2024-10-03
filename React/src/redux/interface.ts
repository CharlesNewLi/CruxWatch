import { NetworkSummary } from "../components";

// 定义设备接口
export interface Element {
    ne_name: string;
    ne_make: string;
    ne_type: string;
    gne?: string; // Gateway Network Element (GNE) IP address
    ne_ip: string;
    ne_id: string;
    site_id?: string;
    site_name?: string;
    snmp_username?: string;
    snmp_auth_password?: string | null;
    snmp_auth_protocol?: string | null;
    snmp_priv_password?: string | null;
    snmp_priv_protocol?: string | null;
    ssh_password?: string;
    ssh_username?: string;
    ssh_secret?: string;
    session_log?: string;
    verbose?: boolean;
    global_delay_factor?: string;
    status?: string;
    network_name?: string;
    others?: Record<string, any>;
  }

export interface ElementsDict {
    [key: string]: Element;
  }
  
  // 定义站点接口
  export interface Site {
    ne_count?: number; // 网络元数量
    ne_ids?: string[]; // 网络元ID列表
    ne_names?: string[]; // 网络元名称列表
    online_ne_count?: number; // 在线网络元数量
    site_id?: string; // 站点ID
    site_name: string; // 站点名称
    site_location?: {
      latitude: string; 
      longitude: string
    };
    elements?: Element[]; // 该站点中的设备列表
  }
  
  // 定义网络接口
  export interface Network {
    network_id?: string; // 网络标识符
    network_name: string; // 网络名称
    isLocked?: boolean;   // 表示网络是否被锁定
    ne_count?: number; // 网络中的网络元数量
    online_ne_count?: number; // 在线的网络元数量
    total_online_nes?: number; // 在线的网络元总数
    online_site_count?: number; // 在线站点数量
    site_count?: number; // 网络中的站点数量
    sites?: Site[]; // 网络中的站点列表
    total_sites?: number; // 总的站点数量
    others?: Record<string, any>;
    elements?: { [key: string]: Element };
    topology?: { [key: string]: any };
  }
  
  // 定义拓扑接口
  export interface Topology {
    nodes: [
      string,
      {
        ip: string;
        label: string;
      }
    ][];
    edges: [string, string, {}][];
  }
  
  // 定义网络数据接口
export interface Networks {
  networks?: any[]; // 所有网络的列表
  networkSummary?: NetworkSummary; // 单个网络概述
  total_nes?: number; // 总的网络元数量
  total_networks?: number; // 网络总数
  total_online_nes?: number; // 在线的网络元总数
  total_online_networks?: number; // 在线网络总数
  total_online_sites?: number; // 在线站点总数
  total_sites?: number; // 总的站点数量
  topology?: Topology; // 可选的拓扑数据
}

// 定义 NetworkSummary 的接口
export interface NetworkSummary {
  network_id: string;
  network_name: string;
  isLocked?: boolean; // 可选：表示网络是否被锁定
  site_count: number;
  ne_count: number;
}

// 定义 NetworksState 接口
export interface NetworksState {
  loading: boolean;
  error: string | null;
  data: {
    networks: any[]; // 所有网络的列表
    total_nes: number; // 总的网络元数量
    total_networks: number; // 网络总数
    total_sites: number; // 总的站点数量
  };
}
  
  export interface NetworkState {
    loading: boolean;
    error: string | null;
    networkDetails: any[]; 
  }

  export interface SiteState {
    loading: boolean;
    error: string | null;
    data: Network | null;
  }

  export interface ElementState {
    loading: boolean;
    error: string | null;
  }