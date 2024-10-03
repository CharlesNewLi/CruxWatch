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

    // 动态统计站点数和设备数
    const siteCount = sites.length;
    const neCount = sites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0); // 统计所有站点的设备数
    
    // 创建 networkSummary 对象
    const networkSummary: NetworkSummary = {
      network_id,
      network_name,
      ne_count: neCount,  // 新增设备计数
      site_count: siteCount, // 假设站点数等于站点数组长度
      isLocked: false,
    };

    // 模拟一个网络创建过程或实际向后端发送创建请求
    const networkData = {
      network_id,
      network_name,
      ne_count: neCount,  // 新增设备计数
      isLocked: false,
      online_ne_count: 0,  // 初始化为 0
      sites: sites.map(site => ({
        site_id: site.site_id,
        site_name: site.site_name,
        elements: []
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
            site_name: site.site_name.trim(),
            elements: []  // 初始化 devices 数组为空
          }))
        ];
        isUpdated = true;
      }
    } else {
      console.log("No new sites provided, skipping site update.");
    }

    if (isUpdated) {
      // 动态计算 site_count 和 ne_count
      const siteCount = updatedNetwork.sites.length;
      const neCount = updatedNetwork.sites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0);
      updatedNetwork.site_count = siteCount;
      updatedNetwork.ne_count = neCount;

      const updatedNetworkSummary = {
        network_id: updatedNetwork.network_id,
        network_name: updatedNetwork.network_name,
        ne_count: neCount,
        site_count: siteCount,
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

    try {
      // 调用后端路由删除 MongoDB 中相应的网络
      const response = await axios.delete(`http://127.0.0.1:8888/networks/${network_id}`);
      console.log(`Deleted network ${network_id} from database:`, response.data);

      // 如果后端删除成功，返回更新后的 networkDetails
      return { updatedNetworkDetails, status: 200 };
    } catch (error) {
      // 解决 'error' is of type 'unknown'
      if (error instanceof Error) {
        console.error(`Failed to delete network ${network_id} from database:`, error.message);
        return thunkAPI.rejectWithValue({ status: 500, message: error.message });
      } else {
        console.error(`Failed to delete network ${network_id} from database:`, error);
        return thunkAPI.rejectWithValue({ status: 500, message: "An unknown error occurred" });
      }
    }
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

    // 找到目标网络
    const existingNetwork = networkDetails.find((network: any) => network.network_id === network_id);
    if (!existingNetwork) {
      const message = "Network not found";
      console.warn(message);
      return thunkAPI.rejectWithValue({ status: 404, message });
    }

    // 检查站点是否已存在
    const existingSite = existingNetwork.sites.find((site: any) => site.site_id === site_id);

    let updatedSite;
    let isUpdated = false;

    if (existingSite) {
      // 如果站点已存在，更新站点信息
      updatedSite = { 
        ...existingSite, 
        site_name: site_name.trim(), 
        site_location: { ...site_location }, 
        elements: existingSite.elements || [] // 确保已有站点有 devices 数组
      };

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
    } else {
      // 如果站点不存在，创建新站点并初始化 devices 数组
      updatedSite = {
        site_id: site_id || uuidv4(), // 如果没有传递 site_id，则生成一个新的
        site_name: site_name.trim(),
        site_location: { ...site_location },
        elements: [] // 初始化为一个空的 devices 数组
      };
      console.log(`Creating new site with name ${site_name} and initializing devices array.`);
      isUpdated = true; // 标记为已更新
    }

    if (!isUpdated) {
      console.log("No changes detected");
      return { data: existingSite, status: 304 }; // 未修改状态码
    }

    // 替换已更新的站点信息
    const updatedSites = existingNetwork.sites.map((site: any) =>
      site.site_id === site_id ? updatedSite : site
    );

    // 如果站点是新增的，将其加入站点列表
    if (!existingSite) {
      updatedSites.push(updatedSite);
    }

    // 更新后的网络
    const updatedNetwork = { 
      ...existingNetwork, 
      sites: updatedSites 
    };

    // 统计 site_count 和 ne_count
    const siteCount = updatedNetwork.sites.length;
    const neCount = updatedNetwork.sites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0);
    updatedNetwork.site_count = siteCount;
    updatedNetwork.ne_count = neCount;

    console.log("Updated network with new site details:", updatedNetwork);

    // 更新网络摘要
    const updatedNetworkSummary = {
      network_id: updatedNetwork.network_id,
      network_name: updatedNetwork.network_name,
      ne_count: neCount, // 更新网元数量
      site_count: siteCount, // 更新站点数量
    };

    // 触发网络摘要更新
    thunkAPI.dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));

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
    };

    // 重新计算站点数量和网元数量
    const siteCount = updatedSites.length;
    const neCount = updatedSites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0);

    updatedNetwork.site_count = siteCount;
    updatedNetwork.ne_count = neCount;

    // 更新 networkDetails
    thunkAPI.dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 更新 networkSummary 中的站点数量
    const updatedNetworkSummary = {
      network_id: updatedNetwork.network_id,
      network_name: updatedNetwork.network_name,
      ne_count: updatedNetwork.neCount,
      site_count: siteCount,  // 更新站点数量
    };

    // 调用 updateNetworksSummary 来同步更新 networkSummary 中的数据
    thunkAPI.dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));

    // 返回更新后的网络
    return { updatedNetwork, status: 200 };
  }
);

// 在 networkDetails 中添加设备移动逻辑
export const moveDeviceToSite = createAsyncThunk(
  "network/moveDeviceToSite",
  async (
    { network_id, ne_name, current_site_id, target_site_id }: 
    { network_id: string, ne_name: string, current_site_id: string | null; target_site_id: string | null },
    { getState, dispatch, rejectWithValue }
  ) => {
    const state: any = getState();
    const networkDetails = state.network.networkDetails || [];
    
    const targetNetwork = networkDetails.find((network: any) => network.network_id === network_id);
    if (!targetNetwork) {
      console.error("Error: Network not found with ID", network_id);
      return rejectWithValue("Network not found");
    }
    console.log("Target network found:", targetNetwork);

    let device = null;
    let updatedSites = [...targetNetwork.sites]; // 确保 sites 是新引用

    // 根据 current_site_id 判断设备是在网络根目录还是在站点中
    if (current_site_id === null) {
      // current_site_id 为 null，设备在 network.devices 中查找
      device = targetNetwork.elements[ne_name];
      if (!device) {
        console.error("Error: Device not found in network root with name", ne_name);
        return rejectWithValue("Device not found in network");
      }
      console.log("Device found in network root:", device);

      // 如果设备已经在根目录，不需要执行任何操作
    } else {
      // current_site_id 有值，设备在站点的 devices 中查找
      const currentSiteIndex = targetNetwork.sites.findIndex((site: any) => site.site_id === current_site_id);
      if (currentSiteIndex === -1) {
        console.error("Error: Current site not found with ID", current_site_id);
        return rejectWithValue("Current site not found");
      }

      const currentSite = updatedSites[currentSiteIndex];

      device = currentSite.elements.find((d: any) => d.ne_name === ne_name);
      if (!device) {
        console.error("Error: Device not found in site", current_site_id, "with name", ne_name);
        return rejectWithValue("Device not found in site");
      }
      console.log("Device found in current site:", currentSite.site_name);

      // 从当前站点移除设备并创建新对象
      const updatedCurrentSite = {
        ...currentSite,
        elements: currentSite.elements.filter((d: any) => d.ne_name !== ne_name),
      };

      // 更新当前站点在 sites 数组中的位置
      updatedSites[currentSiteIndex] = updatedCurrentSite;
    }

    let updatedNetwork;

    if (target_site_id === null) {
      // 如果 target_site_id 为 null，将设备移回网络根目录
      updatedNetwork = {
        ...targetNetwork,
        elements: { ...targetNetwork.elements, [ne_name]: device },
        sites: updatedSites,
      };
      console.log(`Device ${ne_name} moved to network root`);
    } else {
      // 查找目标站点
      const targetSiteIndex = targetNetwork.sites.findIndex((site: any) => site.site_id === target_site_id);
      if (targetSiteIndex === -1) {
        console.error("Error: Target site not found with ID", target_site_id);
        return rejectWithValue("Target site not found");
      }

      const targetSite = updatedSites[targetSiteIndex];

      // 将设备添加到目标站点的 devices 列表中
      const updatedTargetSite = {
        ...targetSite,
        elements: [...targetSite.elements, device],
      };

      // 更新目标站点在 sites 数组中的位置
      updatedSites[targetSiteIndex] = updatedTargetSite;

      updatedNetwork = {
        ...targetNetwork,
        sites: updatedSites,
      };

      console.log(`Device ${ne_name} added to target site ${targetSite.site_name}`);
    }

    // 更新 networkDetails 中的网络数据
    dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 更新 networkSummary 中的网元数量
    const updatedNetworkSummary = {
      network_id: updatedNetwork.network_id,
      network_name: updatedNetwork.network_name,
      ne_count: updatedNetwork.ne_count,  // 保持不变
      site_count: updatedNetwork.sites.length,  // 更新后的站点数量
    };

    // 调用 updateNetworksSummary 来同步更新 networkSummary 中的数据
    dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));

    console.log("Device successfully moved");
    return { network_id, ne_name, target_site_id };
  }
);

// 定义 toggleNetworkLock 的异步动作
export const toggleNetworkLock = createAsyncThunk(
  "network/toggleNetworkLock",
  async (network_id: string, { getState, dispatch }) => {
    const state: any = getState();
    const networksSummary = state.networks?.data?.networks || [];
    const networkDetails = state.network?.networkDetails || [];

    // 查找 networkSummary 和 networkDetails 中的目标网络
    const networkSummary = networksSummary.find((n: any) => n.network_id === network_id);
    const networkDetail = networkDetails.find((n: any) => n.network_id === network_id);

    if (networkSummary && networkDetail) {
      // 判断当前网络的锁定状态
      const currentLockStatus = networkSummary.isLocked;

      // 切换锁定状态（锁定/解锁）
      const updatedNetworkSummary = { ...networkSummary, isLocked: !currentLockStatus };
      const updatedNetworkDetail = { ...networkDetail, isLocked: !currentLockStatus };

      // 将更新后的 networkSummary 和 networkDetails 保存到缓存
      await dispatch(updateNetworksSummary({ newNetwork: [updatedNetworkSummary] }));
      await dispatch(updateNetworkDetails({ newNetwork: updatedNetworkDetail }));

      // 如果网络从 unlocked (false) 切换为 locked (true)，保存到数据库
      if (!currentLockStatus) {
        try {
          // 传递指定 network_id 对应的网络详细信息进行保存
          await dispatch(saveNetworkData({ network_id, networkDetails: state.network.networkDetails }));
          console.log(`Network ${network_id} locked and saved to database.`);
        } catch (error) {
          console.error(`Error in saving network ${network_id}:`, error);
          throw error;  // 抛出错误
        }
      }

      // 返回更新后的网络状态
      return updatedNetworkDetail;
    }

    throw new Error(`Network with id ${network_id} not found`);
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

    let updatedNetworkDetails = [...networkDetails]; // 在外部声明

    if (existingNetworkIndex !== -1) {
      // 更新已有的网络详细信息
      console.log("Updating existing network in cache:", newNetwork);
      updatedNetworkDetails[existingNetworkIndex] = newNetwork; // 直接修改外部作用域的 updatedNetworkDetails
    } else {
      // 如果 networkDetails 中没有该网络，则添加进去
      console.log("Adding new network to cache:", newNetwork);
      updatedNetworkDetails.push(newNetwork); // 直接在外部的 updatedNetworkDetails 中添加
    }
    
    // 动态统计网元和站点数量
    const neCount = updatedNetworkDetails.reduce((acc: number, network: any) => {
      const siteNeCount = network.sites.reduce((siteAcc: number, site: any) => siteAcc + site.elements.length, 0);
      return acc + siteNeCount + Object.keys(network.elements || {}).length;
    }, 0);

    const siteCount = updatedNetworkDetails.reduce((acc: number, network: any) => acc + network.sites.length, 0);

    console.log("Recalculated totals:", { neCount, siteCount });

    return { updatedNetworkDetails, neCount, siteCount }; // 返回更新后的 networkDetails 和统计数据
  }
);

// 定义独立的异步请求函数，用于保存指定 network_id 的网络数据（包括 elements 和 topology）
export const saveNetworkData = createAsyncThunk(
  "networks/saveNetworkData",
  async ({ network_id, networkDetails }: { network_id: string, networkDetails: any }) => {
    try {
      // 筛选出指定 network_id 的网络字典
      const targetNetwork = networkDetails.find((network: any) => network.network_id === network_id);
      
      if (!targetNetwork) {
        throw new Error(`Network with id ${network_id} not found`);
      }

      // POST 请求将 targetNetwork 写入数据库
      const response = await axios.post(`http://127.0.0.1:8888/networks/${network_id}`, {
        networkDetails: targetNetwork,  // 只传递指定网络的详情
      });

      console.log(`Network ${network_id} saved to database:`, response.data);
      return response.data;  // 返回服务器的响应
    } catch (error) {
      console.error(`Failed to save network ${network_id} to database:`, error);
      throw error;  // 抛出错误以便 Redux Thunk 捕获处理
    }
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

        // 动态统计 site_count 和 ne_count
        const siteCount = action.payload.sites.length;  // 站点数量
        const neCount = action.payload.sites.reduce(
          (acc: number, site: any) => acc + (site.elements?.length || 0), 0
        );  // 设备数量统计

        // 构建更新后的网络数据，包含统计的 ne_count 和 site_count
        const updatedNetwork = {
          ...action.payload,
          site_count: siteCount,
          ne_count: neCount,
        };
              
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

      // 处理新增网络的请求
      .addCase(addNetwork.pending, (state) => {
        state.loading = true;
      })
      .addCase(addNetwork.fulfilled, (state, action: PayloadAction<any>) => {
        const siteCount = action.payload.sites.length;
        const neCount = action.payload.sites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0);
      
        // 构建更新后的网络数据，包含统计的 ne_count 和 site_count
        const updatedNetwork = {
          ...action.payload,
          ne_count: neCount,  // 设备总数
          site_count: siteCount  // 站点总数
        };
      
        state.networkDetails.push(updatedNetwork);
        state.loading = false;
        state.error = null;
      })
      .addCase(addNetwork.rejected, (state, action) => {
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
            // 动态计算 site_count 和 ne_count
            const siteCount = data.sites.length;
            const neCount = data.sites.reduce((acc: number, site: any) => acc + (site.elements?.length || 0), 0);
      
            // 更新已存在的网络，同时更新统计
            state.networkDetails[networkIndex] = {
              ...data,
              site_count: siteCount,  // 站点总数
              ne_count: neCount,      // 设备总数
            };
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

      // 处理 updateSite 的请求
      .addCase(updateSite.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateSite.fulfilled, (state, action) => {
        const payload = action.payload as { data: any; status: number };
        const { data, status } = payload;

        if (status === 200) {
          const networkIndex = state.networkDetails.findIndex(
            (network: any) => network.network_id === data.network_id
          );

          if (networkIndex !== -1) {
            state.networkDetails[networkIndex] = data;
          }

          console.log("Site updated successfully");
        } else if (status === 304) {
          console.log("No changes made to the site");
        }

        state.loading = false;
        state.error = null;
      })
      .addCase(updateSite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        console.error("Failed to update site:", action.error.message);
      })

      // 处理 deleteSite 的请求
      .addCase(deleteSite.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteSite.fulfilled, (state, action) => {
        const payload = action.payload as { updatedNetwork: any; status: number };
        const { updatedNetwork, status } = payload;

        if (status === 200) {
          const networkIndex = state.networkDetails.findIndex(
            (network: any) => network.network_id === updatedNetwork.network_id
          );

          if (networkIndex !== -1) {
            state.networkDetails[networkIndex] = updatedNetwork;
          }

          console.log("Site deleted and network updated successfully");
        }

        state.loading = false;
        state.error = null;
      })
      .addCase(deleteSite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        console.error("Failed to delete site:", action.error.message);
      })

      // 处理 moveDeviceToSite 的请求
      .addCase(moveDeviceToSite.pending, (state) => {
        state.loading = true;
      })
      .addCase(moveDeviceToSite.fulfilled, (state, action) => {
        const payload = action.payload;
        console.log("Device moved successfully:", payload);

        // 更新网络成功后，设置 loading 为 false
        state.loading = false;
        state.error = null;
      })
      .addCase(moveDeviceToSite.rejected, (state, action) => {
        console.error("Device move failed:", action.error.message || action.payload);
        state.loading = false;
        state.error = action.error.message || null;
      })

      // 处理 toggleNetworkLock 成功的情况
      .addCase(toggleNetworkLock.fulfilled, (state, action) => {
        const updatedNetworkDetail = action.payload;
      
        // 查找并更新 networkDetails 中的目标网络
        const networkDetailIndex = state.networkDetails.findIndex(
          (network: any) => network.network_id === updatedNetworkDetail.network_id
        );
      
        if (networkDetailIndex !== -1) {
          // 如果找到目标网络，更新其详细信息
          state.networkDetails[networkDetailIndex] = updatedNetworkDetail;
        } else {
          // 如果没有找到，则将其作为新网络添加
          state.networkDetails.push(updatedNetworkDetail);
        }
      
        console.log("Network lock state updated in networkDetails:", updatedNetworkDetail);
      })

      // 处理 updateNetworkDetails 的缓存更新
      .addCase(updateNetworkDetails.fulfilled, (state, action: PayloadAction<any>) => {
        console.log("Successfully updated network cache with:", action.payload);

        const { updatedNetworkDetails } = action.payload;

        // 更新缓存中的 networkDetails
        state.networkDetails = updatedNetworkDetails;

        console.log("Current networkDetails in memory after updateNetworkDetails.fulfilled:", state.networkDetails); // 打印内存中的 networkDetails 数据结构
      })
  },
});

export default networkSlice.reducer;
