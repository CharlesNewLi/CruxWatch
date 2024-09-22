import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { NetworkState, NetworkSummary } from "../interface";
import { updateNetworksSummary } from "../networks/slice";
import { v4 as uuidv4 } from 'uuid'; // 引入 uuid 生成器
import axios from "axios";

const initialState: NetworkState = {
  loading: true,
  error: null,
  networkDetails: [] // 用于存储本地创建和后端获取的所有网络
};

// 新增 getNetwork 请求：支持从本地或后端获取数据
export const getNetwork = createAsyncThunk(
  "network/getNetwork",
  async ({ network_id }: { network_id: string }, { getState, dispatch }) => {
    const state: any = getState(); // 获取当前 Redux store 的 state

    // 1. 遍历 networks 中的 networkSummary，查找是否存在该 network_id
    const networkSummary = state.networks?.data?.networks || [];
    const summaryEntry = networkSummary.find(
      (network: any) => network.network_id === network_id
    );

    // 2. 如果在 networkSummary 中没有找到，发起警告
    if (!summaryEntry) {
      console.warn(`No network summary found for id: ${network_id}`);
    }

    // 3. 在缓存中查找 networkDetails 是否已有该网络的详细数据
    const localNetworkDetail = state.network?.networkDetails?.find(
      (network: any) => network.network_id === network_id
    );

    // 如果在缓存中找到该网络的详细信息，直接返回
    if (localNetworkDetail) {
      console.log(`Found local network details with id: ${network_id}`, localNetworkDetail);
      return localNetworkDetail; // 返回缓存中的网络详情数据
    }

    // 4. 如果缓存中没有找到，则发起异步请求获取网络数据
    try {
      const { data } = await axios.get(`http://127.0.0.1:8888/networks/${network_id}`);
      console.log(`Fetched network details from server with id: ${network_id}`, data);

      // 5. 更新到缓存中
      const newNetworkDetail = { ...data, network_id };

      // 触发 action 更新 networkDetails 缓存
      dispatch(updateNetworkDetails({ newNetwork: newNetworkDetail }));

      // 返回从服务器获取的网络数据
      return newNetworkDetail;
    } catch (error) {
      console.error(`Failed to fetch network details from server with id: ${network_id}`, error);
      throw error; // 抛出错误，以便在 thunk 中处理
    }
  }
);

// 新增网络
export const addNetwork = createAsyncThunk(
  "network/addNetwork",
  async ({ network_id, network_name, sites }: { network_id: string, network_name: string, sites: any[] }, { dispatch }) => {
    console.log("Successfully created network:", network_id);
    
    // 创建 networkSummary 对象
    const networkSummary: NetworkSummary = {
      network_id,
      network_name,
      ne_count: 0,  // 新增设备计数
      site_count: sites.length, // 假设站点数等于站点数组长度
    };

    // 模拟一个网络创建过程或实际向后端发送创建请求
    const networkData = {
      network_id,
      network_name,
      ne_count: 0,  // 新增设备计数
      online_ne_count: 0,  // 初始化为 0
      sites: sites.map(site => ({
        site_id: site.site_id,
        site_name: site.site_name,
        devices: []
      })),
    };

    // 触发 networks/slice 中的更新操作
    dispatch(updateNetworksSummary({ newNetwork: [networkSummary] }));

    // 返回创建的网络数据
    return networkData;
  }
);

// 更新网络和站点的函数
export const updateNetwork = createAsyncThunk(
  "network/updateNetwork",
  async (
    { network_id, network_name, sites }: 
    { network_id: string, network_name: string, sites?: { site_id: string, site_name: string }[] },
    thunkAPI
  ) => {
    const state: any = thunkAPI.getState();
    const networkDetails = state.network.networkDetails || [];
    let error = "";

    console.log("Initial state of networkDetails:", networkDetails);
    console.log("Submitted newSites:", sites);

    // 找到目标网络
    const existingNetwork = networkDetails.find((network: any) => network.network_id === network_id);
    if (!existingNetwork) {
      const message = "Network not found";
      console.warn(message);
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    let isUpdated = false;
    let updatedNetwork = { ...existingNetwork };

    // 1. 检查并更新网络名称
    if (existingNetwork.network_name !== network_name) {
      console.log(`Updating network name from ${existingNetwork.network_name} to ${network_name}`);
      updatedNetwork.network_name = network_name;
      isUpdated = true;
    }

    // 2. 检查站点名称是否合法
    if (sites && sites.length > 0) {
      const siteNames = sites.map((site) => site.site_name.trim());
      const hasEmptySiteNames = siteNames.some((siteName) => siteName === "");

      if (hasEmptySiteNames) {
        error = "存在不合法的站点名称";
        console.warn(error);
        return thunkAPI.rejectWithValue({ status: 400, message: error });
      }

      const existingSiteNames = existingNetwork.sites.map((site: any) => site.site_name.trim());
      const duplicateSiteNames = siteNames.filter((siteName) => existingSiteNames.includes(siteName));

      if (duplicateSiteNames.length > 0) {
        error = `${duplicateSiteNames.join(", ")}站点已存在`;
        console.warn(error);
        return thunkAPI.rejectWithValue({ status: 400, message: error });
      }

      const newSiteEntries = sites.filter(
        (site) => !existingNetwork.sites.some((existingSite: any) => existingSite.site_id === site.site_id)
      );

      if (newSiteEntries.length > 0) {
        console.log("Adding new sites to the network...", newSiteEntries);
        updatedNetwork.sites = [
          ...updatedNetwork.sites,
          ...newSiteEntries.map(site => ({
            site_id: site.site_id || uuidv4(),
            site_name: site.site_name.trim()
          }))
        ];
        updatedNetwork.site_count += newSiteEntries.length;
        isUpdated = true;
      }
    } else {
      console.log("No new sites provided, skipping site update.");
    }

    if (isUpdated) {
      updatedNetwork.site_count = updatedNetwork.sites.length;

      const updatedNetworkSummary = {
        network_id: updatedNetwork.network_id,
        network_name: updatedNetwork.network_name,
        ne_count: updatedNetwork.ne_count,
        site_count: updatedNetwork.site_count,
      };

      thunkAPI.dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));

      return { data: updatedNetwork, status: 200 };
    }

    console.log("No changes detected");
    return { data: existingNetwork, status: 304 }; // 未修改状态码
  }
);

// 删除网络的 async thunk action
export const deleteNetwork = createAsyncThunk(
  "network/deleteNetwork",
  async (network_id: string, thunkAPI) => {
    const state: any = thunkAPI.getState();
    const networkDetails = state.network.networkDetails || [];

    // 找到并删除指定的网络
    const updatedNetworkDetails = networkDetails.filter((network: any) => network.network_id !== network_id);

    if (networkDetails.length === updatedNetworkDetails.length) {
      const message = "Network not found";
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 返回更新后的 networkDetails
    return { updatedNetworkDetails, status: 200 };
  }
);

// 更新站点信息的函数
export const updateSite = createAsyncThunk(
  "network/updateSite",
  async (
    { network_id, site_id, site_name, site_location }: 
    { network_id: string; site_id: string; site_name: string; site_location: { latitude: string; longitude: string } },
    thunkAPI
  ) => {
    const state: any = thunkAPI.getState();
    const networkDetails = state.network.networkDetails || [];

    console.log("Initial networkDetails:", networkDetails);

    console.log("Provided network_id:", network_id);
    console.log("NetworkDetails:", networkDetails);
    networkDetails.forEach((network: any) => {
      console.log("Checking network_id in networkDetails:", network.network_id);
    });

    // 找到目标网络
    const existingNetwork = networkDetails.find((network: any) => network.network_id === network_id);
    if (!existingNetwork) {
      const message = "Network not found";
      console.warn(message);
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 找到目标站点
    const existingSite = existingNetwork.sites.find((site: any) => site.site_id === site_id);
    if (!existingSite) {
      const message = "Site not found";
      console.warn(message);
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 更新站点名称和位置信息
    let isUpdated = false;
    let updatedSite = { ...existingSite };

    // 更新站点名称
    if (existingSite.site_name !== site_name) {
      console.log(`Updating site name from ${existingSite.site_name} to ${site_name}`);
      updatedSite.site_name = site_name.trim();
      isUpdated = true;
    }

    // 更新站点位置信息
    if (existingSite.site_location?.latitude !== site_location.latitude || 
        existingSite.site_location?.longitude !== site_location.longitude) {
      console.log("Updating site location to", site_location);
      updatedSite.site_location = { ...site_location };
      isUpdated = true;
    }

    if (!isUpdated) {
      console.log("No changes detected");
      return { data: existingSite, status: 304 }; // 未修改状态码
    }

    // 替换已更新的站点信息
    const updatedSites = existingNetwork.sites.map((site: any) =>
      site.site_id === site_id ? updatedSite : site
    );

    // 更新后的网络
    const updatedNetwork = { 
      ...existingNetwork, 
      sites: updatedSites 
    };

    console.log("Updated network with new site details:", updatedNetwork);

    // 更新 networkDetails 缓存
    thunkAPI.dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 返回更新后的站点数据
    return { data: updatedSite, status: 200 };
  }
);

// 删除站点的 async thunk action
export const deleteSite = createAsyncThunk(
  "network/deleteSite",
  async ({ site_id }: { site_id: string }, thunkAPI) => {
    const state: any = thunkAPI.getState();
    const networkDetails = state.network.networkDetails || [];

    // 通过 site_id 查找包含此站点的网络
    const existingNetwork = networkDetails.find((network: any) => 
      network.sites.some((site: any) => site.site_id === site_id)
    );
    
    if (!existingNetwork) {
      const message = "Network not found for the given site";
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 找到并删除指定站点
    const updatedSites = existingNetwork.sites.filter((site: any) => site.site_id !== site_id);

    if (updatedSites.length === existingNetwork.sites.length) {
      const message = "Site not found";
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 更新后的网络
    const updatedNetwork = { 
      ...existingNetwork, 
      sites: updatedSites,
      site_count: updatedSites.length,  // 更新站点数量
    };

    // 更新 networkDetails
    thunkAPI.dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 更新 networkSummary 中的站点数量
    const updatedNetworkSummary = {
      network_id: updatedNetwork.network_id,
      network_name: updatedNetwork.network_name,
      ne_count: updatedNetwork.ne_count,
      site_count: updatedSites.length,  // 更新站点数量
    };

    // 调用 updateNetworksSummary 来同步更新 networkSummary 中的数据
    thunkAPI.dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));

    // 返回更新后的网络
    return { updatedNetwork, status: 200 };
  }
);

// 更新 networkDetails 的 action（用于更新缓存）
export const updateNetworkDetails = createAsyncThunk(
  "network/updateNetworkDetails",
  async ({ newNetwork }: { newNetwork: any }, { getState }) => {
    const state: any = getState();
    const networkDetails = state.network.networkDetails || [];

    // 查找是否存在相同的 network_id
    const existingNetworkIndex = networkDetails.findIndex(
      (network: any) => network.network_id === newNetwork.network_id
    );

    if (existingNetworkIndex !== -1) {
      // 更新已有的网络详细信息
      console.log("Updating existing network in cache:", newNetwork);
      const updatedNetworkDetails = [...networkDetails];
      updatedNetworkDetails[existingNetworkIndex] = newNetwork;
      return updatedNetworkDetails; // 返回更新后的 networkDetails
    } else {
      // 如果 networkDetails 中没有该网络，则添加进去
      console.log("Adding new network to cache:", newNetwork);
      return [...networkDetails, newNetwork]; // 返回更新后的 networkDetails
    }
  }
);

// 新增网元
export const addNetworkElement = createAsyncThunk(
  "network/addNetworkElement",
  async (elementData: any, { dispatch, getState, rejectWithValue }) => {
    try {
      console.log("Sending request with data: ", elementData);

      // 发送 POST 请求到后端以添加设备
      const response = await axios.post(`http://127.0.0.1:8888/${elementData.network_name}/elements/add`, elementData);

      if (response.status === 201) {
        console.log("Response received: ", response.data);

        const { device, topology } = response.data;

        // Dispatch 更新缓存和统计信息
        dispatch(updateNetworkWithDevice({ device, topology }));

        return response.data; // 返回后端数据
      } else {
        return rejectWithValue(response.data); // 失败时返回后端响应的错误数据
      }
    } catch (error: any) {
      console.error("Error adding network element:", error);

      if (error.response) {
        return rejectWithValue(error.response.data);
      } else if (error instanceof Error) {
        return rejectWithValue(error.message);
      } else {
        return rejectWithValue("An unknown error occurred");
      }
    }
  }
);

// 更新 networkDetails 和 networkSummary 中的设备信息
export const updateNetworkWithDevice = createAsyncThunk(
  "network/updateNetworkWithDevice",
  async ({ device, topology }: { device: any; topology: any }, { dispatch, getState }) => {
    const state: any = getState();
    const networkDetails = state.network.networkDetails || [];
    const networks = state.networks?.data?.networks || [];

    // 找到目标网络
    const networkIndex = networkDetails.findIndex((network: any) => network.network_name === device.network_name);
    if (networkIndex === -1) {
      console.error("Network not found in cache:", device.network_name);
      return;
    }

    // 更新 networkDetails 中的设备和拓扑信息
    const updatedNetwork = { ...networkDetails[networkIndex] };
    updatedNetwork.topology = topology; // 更新拓扑

    // 为设备生成新的 ne_id，使用 uuidv4
    const generatedNeId = uuidv4();
    const updatedDevice = {
      ...device,
      ne_id: generatedNeId, // 给设备分配生成的 ne_id
    };

    // 以 device_name 作为键更新设备
    if (!updatedNetwork.devices) {
      updatedNetwork.devices = {};
    }
    updatedNetwork.devices[device.device_name] = updatedDevice; // 使用 device_name 作为键并添加设备

    // 更新缓存中的 networkDetails
    const updatedNetworkDetails = [...networkDetails];
    updatedNetworkDetails[networkIndex] = updatedNetwork;

    // Dispatch 更新 networkDetails 和 networks 的统计信息
    dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 更新 networkSummary 中的 ne_count 和 total_nes
    dispatch(updateNetworksSummary({ 
      newNetwork: [{
        network_id: updatedNetwork.network_id,
        network_name: updatedNetwork.network_name,
        ne_count: Object.keys(updatedNetwork.devices).length, // 设备数量
        site_count: updatedNetwork.site_count
      }]
    }));

    return updatedDevice; // 返回带有新的 ne_id 的设备
  }
);

export const networkSlice = createSlice({
  name: "network",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // 处理 getNetwork 请求
      .addCase(getNetwork.pending, (state) => {
        state.loading = true;
      })
      .addCase(getNetwork.fulfilled, (state, action: PayloadAction<any>) => {
        console.log("Successfully fetched network data:", action.payload);

        // 确保 networkDetails 初始化为空数组
        if (!state.networkDetails) {
          state.networkDetails = [];
        }

        // 检查网络是否已经存在，存在则更新，否则添加
        const existingNetworkIndex = state.networkDetails.findIndex((network: any) => network.network_id === action.payload.network_id);

        if (existingNetworkIndex !== -1) {
          // 更新已存在的网络
          state.networkDetails[existingNetworkIndex] = action.payload;
        } else {
          // 新增网络
          state.networkDetails.push(action.payload);
        }

        state.loading = false;
        state.error = null;
      })
      .addCase(getNetwork.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        console.error("Failed to fetch network data:", action.error.message);
      })

      // 处理 updateNetworkDetails 的缓存更新
      .addCase(updateNetworkDetails.fulfilled, (state, action: PayloadAction<any>) => {
        console.log("Successfully updated network cache with:", action.payload);

        // 直接将新的 networkDetails 更新到缓存
        state.networkDetails = action.payload;
      })

      // 处理新增网络的请求
      .addCase(addNetwork.pending, (state) => {
        state.loading = true;
      })
      .addCase(addNetwork.fulfilled, (state, action: PayloadAction<any>) => {
        state.networkDetails.push(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(addNetwork.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })

      // 处理删除网络的请求
      .addCase(deleteNetwork.fulfilled, (state, action) => {
        const { updatedNetworkDetails } = action.payload;
        state.networkDetails = updatedNetworkDetails;
        state.loading = false;
        state.error = null;
      })
      .addCase(deleteNetwork.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })

      // 处理更新网络的请求
      .addCase(updateNetwork.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateNetwork.fulfilled, (state, action) => {
        const payload = action.payload as { data: any; status: number }; // 类型断言
        const { data, status } = payload;
      
        if (status === 200) {
          const networkIndex = state.networkDetails.findIndex(
            (network: any) => network.network_id === data.network_id
          );
      
          if (networkIndex !== -1) {
            state.networkDetails[networkIndex] = data;
          }
      
          console.log("Network updated successfully");
        } else if (status === 304) {
          console.log("No changes made to the network");
        }
      
        state.loading = false;
        state.error = null;
      })
      .addCase(updateNetwork.rejected, (state, action) => {
        const payload = action.payload as { status: number; message: string }; // 类型断言
        const { status, message } = payload;
        state.loading = false;
        state.error = message;

        console.error(`Failed to update network: ${message} (Status: ${status})`);
      })

      .addCase(addNetworkElement.fulfilled, (state, action) => {
        const { devices, topology } = action.payload;
    
        // 更新 networkDetails 中的 devices 和拓扑信息
        const networkIndex = state.networkDetails.findIndex(
          (network: any) => network.network_id === action.meta.arg.network_id
        );
    
        if (networkIndex !== -1) {
          state.networkDetails[networkIndex].devices = devices;
          state.networkDetails[networkIndex].topology = topology;
        }
      });
  },
});

export default networkSlice.reducer;
