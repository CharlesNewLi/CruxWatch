import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// 更新后的 CartItem 接口，包含所有字段
interface CartItem {
  checkOutDate: string;
  totalPrice: number;
  nights: number;
  roomTypeName: string;
  hotelId: string;
  checkInDate: string;
  roomTypeId: string;
  pricePerNight: number;
  itemKey: string;
}

interface ShoppingCartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
}

const initialState: ShoppingCartState = {
  items: [],
  loading: true,
  error: null,
};

// 获取购物车条目的 getShoppingCart async thunk
export const getShoppingCart = createAsyncThunk(
  "shoppingCart/getShoppingCart",
  async (jwt: string, thunkAPI) => {
    const { data } = await axios.get(`http://127.0.0.1:3000/cart`, {
      headers: {
        Authorization: `bearer ${jwt}`,
      },
    });
    return data.items; // 假设返回的数据结构为 data.items
  }
);

export const addShoppingCartItem = createAsyncThunk(
  "shoppingCart/addShoppingCartItem",
  async (
    {
      jwt,
      roomTypeId,
      checkInDate,
      checkOutDate,
    }: { jwt: string; roomTypeId: string; checkInDate: string; checkOutDate: string },
    thunkAPI
  ) => {
    try {
      const response = await axios.post(
        "http://127.0.0.1:3000/cart/add",
        {
          roomTypeId,
          checkInDate,
          checkOutDate,
        },
        {
          headers: {
            Authorization: `bearer ${jwt}`,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  }
);

// 基于 ItemKey 清除购物车条目的 async thunk
export const clearShoppingCartItem = createAsyncThunk(
  "shoppingCart/clearShoppingCartItem",
  async (parameters: { jwt: string; itemKey: string }, thunkAPI) => {
    try {
      const response = await axios.post(
        `http://127.0.0.1:3000/cart/remove`, // 使用 POST 方法和路径 /cart/remove
        { itemKey: parameters.itemKey }, // 请求体中包含要删除的 itemKey
        {
          headers: {
            Authorization: `bearer ${parameters.jwt}`,
          },
        }
      );
      return parameters.itemKey; // 将 itemKey 返回以便在 fulfilled 中使用
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response.data);
    }
  }
);

export const checkout = createAsyncThunk(
  "shoppingCart/checkout",
  async (jwt: string, thunkAPI) => {
    const { data } = await axios.post(
      `http://127.0.0.1:3000/cart/checkout`,
      null,
      {
        headers: {
          Authorization: `bearer ${jwt}`,
        },
      }
    );
    return data;
  }
);


export const shoppingCartSlice = createSlice({
  name: "shoppingCart",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getShoppingCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(getShoppingCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.items = action.payload || []; 
        state.loading = false;
        state.error = null;
      })
      .addCase(getShoppingCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addShoppingCartItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(addShoppingCartItem.fulfilled, (state, action: PayloadAction<CartItem>) => {
        state.items.push(action.payload);
        state.loading = false;
        state.error = null;
      })
      .addCase(addShoppingCartItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(clearShoppingCartItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(clearShoppingCartItem.fulfilled, (state, action: PayloadAction<string>) => {
        const keyToRemove = action.payload; // 从 payload 中获取单个 itemKey
        state.items = state.items.filter((item) => item.itemKey !== keyToRemove); // 根据 itemKey 过滤
        state.loading = false;
        state.error = null;
      })
      .addCase(clearShoppingCartItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default shoppingCartSlice.reducer;