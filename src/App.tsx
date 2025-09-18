import React from 'react';
import { ConfigProvider } from 'antd';
import ConfluenceCopy from './components/ConfluenceCopy';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
        },
      }}
    >
      <div className="App">
        <ConfluenceCopy />
      </div>
    </ConfigProvider>
  );
}

export default App;