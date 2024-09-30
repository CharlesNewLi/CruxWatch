import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import rootStore from "./redux/store";
import {PersistGate} from "redux-persist/es/integration/react"
import 'antd/dist/antd.min.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Provider store = {rootStore.store}>
      <PersistGate persistor={rootStore.persistor}>
        <App />
      </PersistGate>  
    </Provider>
  </React.StrictMode>
);
