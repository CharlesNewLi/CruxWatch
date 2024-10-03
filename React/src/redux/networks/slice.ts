import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { NetworksState, NetworkSummary } from "../interface";
import { saveNetworkData } from "../network/slice";
import axios from "axios";

const initialState: NetworksState = {
  loading: true,
  error: null,
  data: {
    networks: [], // 初始化为空数组
    total_nes: 0,
    total_networks: 0,
    total_sites: 0,
  },
};

// 获取所有网络
export const getNetworks = createAsyncThunk(
  "networks/getNetworks",
  async (_, thunkAPI) => {
    const state: any = thunkAPI.getState();

    // 获取缓存中的网络数据
    const cachedNetworks = state.networks?.data?.networks || [];

    // 发起后端请求以获取最新网络数据
    try {
      const { data } = await axios.get(`http://127.0.0.1:8888/networks/`);
      console.log('API response for getNetworks:', data);

      // 将后端获取的数据与缓存中的数据进行对比，根据 network_id 进行增量更新
      const updatedNetworks = cachedNetworks.map((cachedNetwork: any) => {
        const latestNetwork = data.networks.find(
          (network: any) => network.network_id === cachedNetwork.network_id
        );
        return latestNetwork ? latestNetwork : cachedNetwork; // 如果后端返回的数据有相同的 network_id，则替换
      });

      // 找出后端新增的网络并添加到更新后的数组中
      const newNetworks = data.networks.filter(
        (network: any) =>
          !cachedNetworks.some(
            (cachedNetwork: any) => cachedNetwork.network_id === network.network_id
          )
      );

      const finalNetworks = [...updatedNetworks, ...newNetworks];

      // 返回最终更新的网络数据
      return {
        networks: finalNetworks,
        total_nes: data.total_nes,
        total_networks: data.total_networks,
        total_sites: data.total_sites,
      };
    } catch (error: any) {
      console.error('Failed to fetch networks:', error);
      throw error;  // 抛出错误以便 Redux Thunk 捕获处理
    }
  }
);

// 新增的同步函数，用于对比 networkDetails 和 networksStats，并增量更新 networks
export const syncNetworkStats = createAsyncThunk(
  "networks/syncNetworkStats",
  async (_, { getState, dispatch }) => {
    const state: any = getState();
    const networksStats = state.networks.data.networks;
    const networkDetails = state.network.networkDetails;

    console.log("Starting syncNetworkStats...");
    console.log("networksStats:", networksStats);
    console.log("networkDetails:", networkDetails);
    
    const newOrUpdatedNetworks: NetworkSummary[] = [];

    // 对比 networkDetails 和 networksStats，找出新增或需要更新的网络
    networkDetails.forEach((network: any) => {
      const existingNetwork = networksStats.find((n: any) => n.network_id === network.network_id);

      const neCountFromElements = network.elements ? Object.keys(network.elements).length : 0;

      if (!existingNetwork) {
        console.log(`New network found: ${network.network_name}`);
        newOrUpdatedNetworks.push({
          network_id: network.network_id,
          network_name: network.network_name,
          ne_count: neCountFromElements || network.sites.length, // 修正这里，使用设备数量
          site_count: network.sites.length,
        });
      } else {
        if (
          existingNetwork.network_name !== network.network_name ||
          existingNetwork.ne_count !== neCountFromElements ||
          existingNetwork.site_count !== network.sites.length
        ) {
          console.log(`Updated network found: ${network.network_name}`);
          newOrUpdatedNetworks.push({
            ...existingNetwork,
            network_name: network.network_name,
            ne_count: neCountFromElements || network.sites.length, // 修正这里，使用设备数量
            site_count: network.sites.length,
          });
        }
      }
    });

    // 打印新发现的或更新的网络
    console.log("New or updated networks to sync:", newOrUpdatedNetworks);

    if (newOrUpdatedNetworks.length > 0) {
      console.log("Dispatching updateNetworksSummary...");
      // 调用 updateNetworksSummary 来更新 networksStats
      dispatch(updateNetworksSummary({ newNetwork: newOrUpdatedNetworks }));
    }
  }
);

// 更新网络摘要的Action，支持添加网元和新网络的更新
export const updateNetworksSummary = createAsyncThunk(
  "networks/updateNetworksSummary",
  async ({ newNetwork, network_name, ne_count, isLocked }: 
         { newNetwork?: NetworkSummary[], network_name?: string, ne_count?: number, isLocked?: boolean }, 
         thunkAPI) => {
    const state: any = thunkAPI.getState();
    const existingNetworks = state.networks?.data?.networks || [];

    // 打印输入的数据，确保 newNetwork 或 network_name 被正确传递
    console.log("Received data for update:", { newNetwork, network_name, ne_count, isLocked });

    // 初始化一个用于存放更新后的 networks 的数组
    let updatedNetworks = [...existingNetworks];

    // 如果传入了 newNetwork，则更新现有网络摘要
    if (newNetwork && newNetwork.length > 0) {
      updatedNetworks = existingNetworks.map((network: any) => {
        const updatedNetwork = newNetwork.find((n) => n.network_id === network.network_id);
        if (updatedNetwork) {
          console.log(`Updating existing network with id: ${updatedNetwork.network_id}`);
          return {
            ...network,
            network_name: updatedNetwork.network_name, // 更新网络名称
            ne_count: updatedNetwork.ne_count,         // 更新NE数量
            site_count: updatedNetwork.site_count,     // 更新站点数量
            isLocked: typeof updatedNetwork.isLocked === "boolean" ? updatedNetwork.isLocked : network.isLocked,  // 更新 isLocked 状态
          };
        }
        return network; // 没有匹配的返回原来的对象
      });

      // 添加 newNetwork 中新网络到 updatedNetworks 中
      newNetwork.forEach((newNetworkItem) => {
        const exists = updatedNetworks.find((n) => n.network_id === newNetworkItem.network_id);
        if (!exists) {
          console.log(`Adding new network with id: ${newNetworkItem.network_id}`);
          updatedNetworks.push(newNetworkItem);
        }
      });
    }

    // 如果传入了 network_name、ne_count 或 isLocked，更新相关字段
    if (network_name && typeof ne_count === "number") {
      updatedNetworks = updatedNetworks.map((network: any) => {
        if (network.network_name === network_name) {
          console.log(`Updating ne_count for network: ${network_name} to ${ne_count}`);
          return {
            ...network,
            ne_count: ne_count, // 更新NE数量
            isLocked: typeof isLocked === "boolean" ? isLocked : network.isLocked, // 更新 isLocked 状态（如果传递了）
          };
        }
        return network;
      });
    }

    // 更新统计数据
    const total_nes = updatedNetworks.reduce((acc: number, network: any) => acc + network.ne_count, 0);
    const total_sites = updatedNetworks.reduce((acc: number, network: any) => acc + network.site_count, 0);
    const total_networks = updatedNetworks.length;

    console.log("Updated totals:", {
      total_nes,
      total_sites,
      total_networks,
    });

    // 返回更新后的数据
    return {
      networks: updatedNetworks, // 返回新的 networks 数组
      total_nes,
      total_networks,
      total_sites,
    };
  }
);

// 删除网络的 async thunk action
export const deleteNetworkSummary = createAsyncThunk(
  "networks/deleteNetworkSummary",
  async (network_id: string, thunkAPI) => {
    const state: any = thunkAPI.getState();
    const networks = state.networks.data.networks || [];

    // 找到并删除指定的网络
    const updatedNetworks = networks.filter((network: any) => network.network_id !== network_id);

    if (networks.length === updatedNetworks.length) {
      const message = "Network not found";
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 返回更新后的 networksSummary
    return { updatedNetworks, status: 200 };
  }
);

// Slice
export const networksSlice = createSlice({
  name: "networks",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getNetworks.pending, (state) => {
        state.loading = true;
      })
      .addCase(getNetworks.fulfilled, (state, action) => {
        const networksWithLockStatus = action.payload.networks.map((network: any) => ({
          ...network,
          isLocked: network.isLocked || false, // 初始化 isLocked 为 false
        }));
        
        state.data.networks = action.payload.networks;
        state.data.total_nes = action.payload.total_nes;
        state.data.total_networks = action.payload.total_networks;
        state.data.total_sites = action.payload.total_sites;

        state.loading = false;
        state.error = null;
      })
      .addCase(getNetworks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })

      .addCase(updateNetworksSummary.fulfilled, (state, action: PayloadAction<any>) => {
        console.log("Update Networks Summary fulfilled", action.payload);
        state.data.networks = action.payload.networks;
        state.data.total_nes = action.payload.total_nes;
        state.data.total_networks = action.payload.total_networks;
        state.data.total_sites = action.payload.total_sites;
      })

      // 处理删除网络的请求
      .addCase(deleteNetworkSummary.fulfilled, (state, action) => {
        const { updatedNetworks } = action.payload;
        state.data.networks = updatedNetworks;
        state.loading = false;
        state.error = null;
      })
      .addCase(deleteNetworkSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      });
  },
});

export default networksSlice.reducer;