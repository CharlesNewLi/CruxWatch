import { actionLog } from "./middlewares/actionLog";
import { networksSlice } from "./networks/slice";
import { networkSlice } from "./network/slice";
import { elementSlice } from "./element/slice";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {persistStore, persistReducer} from "redux-persist";
import storage from "redux-persist/lib/storage";

const persistConfig = {
  key: "root",
  storage,
}

const rootReducer = combineReducers({
    networks: networksSlice.reducer,
    network: networkSlice.reducer,
    element: elementSlice.reducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(actionLog),
    devTools: true,
  });

const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch;

export default { store, persistor };