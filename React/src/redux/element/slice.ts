import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Element } from "../interface";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // For generating unique device IDs
import { updateNetworksSummary } from "../networks/slice";
import { updateNetworkDetails } from "../network/slice";

interface DeviceState {
  loading: boolean;
  error: string | null;
  networkDetails: any[]; // 你需要定义 networkDetails 的具体类型
  configOutput: string;
  cliOutput: string;
  status: string; // 增加 status 属性，表示请求的状态
}

const initialState: DeviceState = {
  loading: false,
  error: null,
  networkDetails: [], // 初始化 networkDetails 列表
  configOutput: "",
  cliOutput: "",
  status: "", // 初始值为空字符串或其他合适的状态
};

// 添加网络设备的 Thunk
export const addNetworkElement = createAsyncThunk<
  { device: Element; topology: any; status: string; message: string },
  any,
  { rejectValue: string }
>("element/addNetworkElement", async (elementData, { dispatch, rejectWithValue }) => {
  try {
    const response = await axios.post(
      `http://127.0.0.1:8888/${elementData.network_name}/elements/add`,
      elementData
    );

    if (response.status === 201 && response.data.status === "success") {
      const { device, topology, status, message } = response.data;
      
      // 映射字段，将后端字段映射为 Element 接口定义的字段
      const mappedDevice: Element = {
        ne_name: device.device_name,          // device_name -> ne_name
        ne_type: device.ne_type,          // device_type -> ne_type
        ne_make: device.device_type,  // 使用 device_type 或 ne_make
        ne_ip: device.ip,                     // ip -> ne_ip
        ne_id: uuidv4(),                      // 生成唯一的设备ID
        network_name: device.network_name,     // 保持 network_name 不变
        ssh_username: device.ssh_username,     // SSH 用户名
        ssh_password: device.ssh_password,     // SSH 密码
        ssh_secret: device.ssh_secret || "",   // SSH secret (如果没有则为空)
        gne: device.gne,                      // GNE 设备信息
        session_log: device.session_log || "", // Session log (可选字段)
        verbose: device.verbose || false,      // Verbose (可选字段)
        global_delay_factor: device.global_delay_factor || 1  // 全局延迟因子 (可选字段)
      };

      dispatch(updateNetworkWithDevice({ device: mappedDevice, topology }));
      return { device: mappedDevice, topology, status, message };
    } else {
      return rejectWithValue(response.data.message || "Failed to add network element");
    }
  } catch (error: any) {
    return rejectWithValue(error.response?.data.message || "An unknown error occurred");
  }
});

// 设置 SNMP 配置的 Thunk
export const setElementSNMP = createAsyncThunk<
  { device_snmp: any; status: string; message: string },
  any,
  { rejectValue: string }
>("element/setElementSNMP", async (snmpData, { dispatch, rejectWithValue, getState }) => {
  try {
    console.log("Sending SNMP configuration to backend:", snmpData);
    
    const response = await axios.post(
      `http://127.0.0.1:8888/${snmpData.network_name}/${snmpData.ne_name}/set_snmp`,
      snmpData
    );

    console.log("SNMP configuration response (full response):", response);

    const { device_snmp, status, message } = response.data;
    console.log("Extracted data for SNMP:", { device_snmp, status, message });

    if (status === "success") {
      // 获取当前状态并查找目标网络
      const state: any = getState();
      const networkDetails = state.network.networkDetails || [];

      const networkIndex = networkDetails.findIndex(
        (network: any) => network.network_name === device_snmp.network_name
      );

      if (networkIndex === -1) {
        console.error("Network not found:", device_snmp.network_name);
        return rejectWithValue("Network not found");
      }

      // 获取当前设备并更新 SNMP 信息
      const existingElement = networkDetails[networkIndex].elements[device_snmp.device_name];
      if (!existingElement) {
        console.error("Device not found in network:", device_snmp.device_name);
        return rejectWithValue("Device not found");
      }

      const updatedElement = {
        ...existingElement,
        snmp_username: device_snmp.snmp_username,
        snmp_auth_protocol: device_snmp.snmp_auth_protocol,
        snmp_auth_password: device_snmp.snmp_auth_password,
        snmp_priv_protocol: device_snmp.snmp_priv_protocol,
        snmp_priv_password: device_snmp.snmp_priv_password,
        status: device_snmp.status
      };

      // 调用 updateNetworkWithDevice 进行设备信息更新，但不更新拓扑信息
      await dispatch(updateNetworkWithDevice({ device: updatedElement, topology: networkDetails[networkIndex].topology }));

      return { device_snmp, status, message };
    } else {
      console.error("SNMP setup failed with message:", message);
      return rejectWithValue(message || "SNMP setup failed");
    }
  } catch (error: any) {
    console.error("SNMP setup request failed with error:", error);
    return rejectWithValue(error.response?.data.message || "An unknown error occurred");
  }
});

// 邻居设备发现的 Thunk
export const NeighborDiscover = createAsyncThunk<
  { topology: any; devices: any; status: string; message: string },
  any,
  { rejectValue: string }
>("element/NeighborDiscover", async (discoverData, { dispatch, rejectWithValue }) => {
  try {
    const response = await axios.post(
      `http://127.0.0.1:8888/${discoverData.network_name}/${discoverData.ne_name}/discover`,
      discoverData
    );

    if (response.status === 200 && response.data.status === "success") {
      const { topology, devices, status, message } = response.data;

      // 更新 devices 和 topology
      for (const deviceKey of Object.keys(devices)) {
        const device = devices[deviceKey];

        // 为设备生成 ne_id，并映射字段到 Element 接口
        const mappedDevice: Element = {
          ne_name: device.device_name,          // device_name -> ne_name
          ne_type: device.ne_type,          // device_type -> ne_type
          ne_make: device.device_type,  // 使用 device_type 或 ne_make
          ne_ip: device.ip,                     // ip -> ne_ip
          ne_id: uuidv4(),                      // 生成唯一的设备ID
          network_name: device.network_name,     // 保持 network_name 不变
          ssh_username: device.ssh_username,     // SSH 用户名
          ssh_password: device.ssh_password,     // SSH 密码
          ssh_secret: device.ssh_secret || "",   // SSH secret (如果没有则为空)
          gne: device.gne,                      // GNE 设备信息
          session_log: device.session_log || "", // Session log (可选字段)
          verbose: device.verbose || false,      // Verbose (可选字段)
          global_delay_factor: device.global_delay_factor || 1  // 全局延迟因子 (可选字段)
        };

        // 打印设备信息和生成的 ne_id
        console.log(`Adding device: ${mappedDevice.ne_name} with ne_id: ${mappedDevice.ne_id}`);

        // 调用 updateNetworkWithDevice 来更新设备信息和拓扑
        await dispatch(
          updateNetworkWithDevice({
            device: mappedDevice,
            topology,
          })
        );
      }

      return { topology, devices, status, message };
    } else {
      return rejectWithValue(response.data.message || "Failed to discover neighbors");
    }
  } catch (error: any) {
    return rejectWithValue(error.response?.data.message || "An unknown error occurred");
  }
});

// 获取设备配置的 Thunk，并更新设备的 ne_type 和配置
export const fetchCurrentConfig = createAsyncThunk<
  { output: string; status: string; message: string; ne_type: string },  // 返回值类型，包含 ne_type
  { networkName: string; deviceName: string; sshCredentials: any },
  { rejectValue: string }
>(
  "element/fetchCurrentConfig",
  async ({ networkName, deviceName, sshCredentials }, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.post(
        `http://127.0.0.1:8888/${networkName}/${deviceName}/query_config`,
        {
          ...sshCredentials,
          command: "display current-configuration",
        }
      );

      if (response.data.status === "success") {
        const { ne_type } = response.data;

        // 打印 response 和 ne_type 的值
        console.log("fetchCurrentConfig response:", response.data);
        console.log("Received ne_type:", ne_type);

        // 修改 fetchCurrentConfig 中的 dispatch 逻辑，确保传递正确的 network_name
        dispatch(updateNetworkWithDevice({
          device: {
            ne_name: deviceName,
            ne_type,  // 只更新 ne_type，不更新其他字段
            network_name: networkName // 添加 network_name
          },
          topology: {} // 如果没有拓扑变化，可以传空对象
        }));

        return {
          output: response.data.output,  // 只是为了返回给前端，内部不更新 configOutput
          status: response.data.status,
          message: response.data.message,
          ne_type
        };
      } else {
        return rejectWithValue(response.data.message || "Failed to fetch current configuration");
      }
    } catch (error: any) {
      return rejectWithValue(error.response?.data.message || "An unknown error occurred");
    }
  }
);

// 执行 CLI 命令的 Thunk
export const handleCliCommand = createAsyncThunk<
  { output: string; status: string; message: string },
  { networkName: string; deviceName: string; command: string; sshCredentials: any },
  { rejectValue: string }
>("element/handleCliCommand", async ({ networkName, deviceName, command, sshCredentials }, { rejectWithValue }) => {
  try {
    const response = await axios.post(`http://127.0.0.1:8888/${networkName}/${deviceName}/apply_config`, {
      ...sshCredentials,
      new_config: command,
    });

    if (response.data.status === "success") {
      return { output: response.data.output, status: response.data.status, message: response.data.message };
    } else {
      return rejectWithValue(response.data.message || "Failed to execute command");
    }
  } catch (error: any) {
    return rejectWithValue(error.response?.data.message || "An unknown error occurred");
  }
});

// 更新网络设备和拓扑的 Thunk
export const updateNetworkWithDevice = createAsyncThunk<
  void,
  { device: Partial<Element>; topology?: any }
>("element/updateNetworkWithDevice", async ({ device, topology }, { dispatch, getState }) => {
  try {
    const state: any = getState();
    const networkDetails = state.network.networkDetails || [];

    console.log("Received device:", device);
    console.log("Current networkDetails from state:", networkDetails);

    // 添加对 network_name 是否存在的检查
    if (!device.network_name) {
      console.error("Device's network_name is undefined.");
      return;
    }

    const networkIndex = networkDetails.findIndex(
      (network: any) => network.network_name === device.network_name
    );

    if (networkIndex === -1) {
      console.error("Network not found in cache:", device.network_name);
      return;
    }

    console.log("Found network at index:", networkIndex);
    
    // 深拷贝整个网络对象，避免直接修改原始对象
    const updatedNetwork = {
      ...networkDetails[networkIndex],
      elements: { ...networkDetails[networkIndex].elements } // 深拷贝 elements
    };

    console.log("Updated network data before modification:", updatedNetwork);

    // 检查 device.ne_name 是否存在
    if (device.ne_name) {
      const existingDevice = { ...updatedNetwork.elements[device.ne_name] }; // 深拷贝设备对象
      
      if (existingDevice) {
        console.log("Existing device found:", existingDevice);
        console.log("Updating device ne_type to:", device.ne_type);

        updatedNetwork.elements[device.ne_name] = {
          ...existingDevice,  // 保留已有设备信息
          ...device,          // 仅更新传递的属性（如 ne_type）
        };

        console.log("Updated device information:", updatedNetwork.elements[device.ne_name]);
      } else {
        console.error("Device not found in network:", device.ne_name);
      }
    } else {
      console.error("ne_name is undefined for device:", device);
    }

    // 如果传递了拓扑信息，则更新拓扑
    if (topology && Object.keys(topology).length > 0) {
      console.log("Updating network topology with new data:", topology);
      updatedNetwork.topology = {
        ...updatedNetwork.topology,
        nodes: [...(updatedNetwork.topology?.nodes || []), ...(topology.nodes || [])],
        edges: [...(updatedNetwork.topology?.edges || []), ...(topology.edges || [])],
      };
      console.log("Updated topology:", updatedNetwork.topology);
    }

    const updatedNetworkDetails = [...networkDetails];
    updatedNetworkDetails[networkIndex] = updatedNetwork;
    console.log("Final updated networkDetails:", updatedNetworkDetails);

    // 更新 networkDetails 中的网络信息
    dispatch(updateNetworkDetails({ newNetwork: updatedNetwork }));

    // 更新 networks 概览信息
    dispatch(
      updateNetworksSummary({
        newNetwork: [
          {
            network_id: updatedNetwork.network_id,
            network_name: updatedNetwork.network_name,
            ne_count: Object.keys(updatedNetwork.elements).length,
            site_count: updatedNetwork.site_count,
          },
        ],
      })
    );

    console.log("Dispatched updated network details and network summary.");
    
  } catch (error) {
    console.error("Error occurred in updateNetworkWithDevice:", error);
  }
});

// 创建设备 slice
export const elementSlice = createSlice({
  name: "element",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // 添加网络设备请求
      .addCase(addNetworkElement.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        addNetworkElement.fulfilled,
        (state, action: PayloadAction<{ device: Element; status: string; message: string }>) => {
          if (action.payload.status === "success") {
            const networkIndex = state.networkDetails.findIndex(
              (network: any) => network.network_name === action.payload.device.network_name
            );
            if (networkIndex !== -1) {
              state.networkDetails[networkIndex].elements = {
                ...state.networkDetails[networkIndex].elements,
                [action.payload.device.ne_name]: action.payload.device,
              };
            }
            console.log("Updated NetworkDetails after adding device:", state.networkDetails);
            state.error = null;
          } else {
            state.error = action.payload.message || "Failed to add network element";
          }
          state.loading = false;
        }
      )
      .addCase(addNetworkElement.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to add network element";
      })

      // 设置 SNMP 请求的状态处理
      .addCase(setElementSNMP.pending, (state) => {
        console.log("SNMP setup request pending..."); // 打印 pending 状态
        state.loading = true;
        state.error = null; // 清空错误状态
      })
      .addCase(
        setElementSNMP.fulfilled,
        (state, action: PayloadAction<{ device_snmp: any; status: string; message: string }>) => {
          console.log("SNMP setup fulfilled action triggered"); // 打印 fulfilled 状态

          if (action.payload.status === "success") {
            const { device_snmp } = action.payload;

            // 打印接收到的 SNMP 设备信息
            console.log("Received SNMP device information:", device_snmp);

            // 1. 通过 network_name 查找设备所在的网络
            const networkIndex = state.networkDetails.findIndex(
              (network: any) => network.network_name === device_snmp.network_name
            );

            if (networkIndex !== -1) {
              const updatedNetwork = state.networkDetails[networkIndex];

              console.log("Found network:", updatedNetwork.network_name);

              const existingElement = updatedNetwork.devices[device_snmp.ne_name];
              if (existingElement) {
                console.log("Found device:", device_snmp.ne_name);

                updatedNetwork.elements = {
                  ...updatedNetwork.elements,
                  [device_snmp.ne_name]: {
                    ...existingElement,
                    snmp_auth_protocol: device_snmp.snmp_auth_protocol,
                    snmp_auth_password: device_snmp.snmp_auth_password,
                    snmp_priv_protocol: device_snmp.snmp_priv_protocol,
                    snmp_priv_password: device_snmp.snmp_priv_password,
                    status: device_snmp.status,
                  },
                };

                console.log("Updated device SNMP information:", updatedNetwork.elements[device_snmp.ne_name]);
              } else {
                console.error("Device not found in network:", device_snmp.ne_name);
              }

              state.networkDetails[networkIndex] = updatedNetwork;
              console.log("Updated NetworkDetails after SNMP setup:", state.networkDetails);
            } else {
              console.error("Network not found:", device_snmp.network_name);
            }

            state.loading = false;
            state.error = null;
          } else {
            console.error("SNMP setup failed with message:", action.payload.message || "Failed to set SNMP");
            state.loading = false;
            state.error = action.payload.message || "Failed to set SNMP";
          }
        }
      )
      .addCase(setElementSNMP.rejected, (state, action: PayloadAction<string | undefined>) => {
        console.log("SNMP setup request rejected:", action.payload); // 打印 rejected 状态
        state.loading = false;
        state.error = action.payload || "SNMP setup request failed";
      })

      // 邻居设备发现请求的处理
      .addCase(NeighborDiscover.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        NeighborDiscover.fulfilled,
        (state, action: PayloadAction<{ topology: any; devices: any; status: string; message: string }>) => {
          if (action.payload.status === "success") {
            const networkIndex = state.networkDetails.findIndex(
              (network: any) => network.network_name === action.payload.devices[Object.keys(action.payload.devices)[0]].network_name
            );

            if (networkIndex !== -1) {
              const updatedNetwork = { ...state.networkDetails[networkIndex] };

              // 更新设备信息，并为每个设备生成 ne_id
              Object.keys(action.payload.devices).forEach((key) => {
                const device = { ...action.payload.devices[key], ne_id: uuidv4() };
                updatedNetwork.elements[device.ne_name] = device;
                console.log(`Added device: ${device.ne_name} with ne_id: ${device.ne_id}`);
              });

              // 更新拓扑信息
              updatedNetwork.topology = {
                ...updatedNetwork.topology,
                nodes: [...(updatedNetwork.topology?.nodes || []), ...action.payload.topology.nodes],
                edges: [...(updatedNetwork.topology?.edges || []), ...action.payload.topology.edges],
              };

              state.networkDetails[networkIndex] = updatedNetwork;
              console.log("Updated NetworkDetails after neighbor discovery:", state.networkDetails);
            }
          } else {
            state.error = action.payload.message || "Failed to discover neighbors";
          }

          state.loading = false;
        }
      )
      .addCase(NeighborDiscover.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to discover neighbors";
      })

      // 处理 fetchCurrentConfig 请求
      .addCase(fetchCurrentConfig.pending, (state) => {
        state.loading = true;
        state.status = 'loading'; // 当请求开始时，设置状态为 loading
      })
      .addCase(fetchCurrentConfig.fulfilled, (state, action) => {
        state.loading = false;
        state.configOutput = action.payload.output;
        state.status = 'success'; // 请求成功时，设置状态为 success
      })
      .addCase(fetchCurrentConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch current configuration';
        state.status = 'failed'; // 请求失败时，设置状态为 failed
      })

      // handleCliCommand 请求的状态处理
      .addCase(handleCliCommand.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(handleCliCommand.fulfilled, (state, action) => {
        state.loading = false;
        state.cliOutput += `\n${action.meta.arg.command}\n${action.payload.output}`;
      })
      .addCase(handleCliCommand.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to execute command";
      });

  },
});

export default elementSlice.reducer;