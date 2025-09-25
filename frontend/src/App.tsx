import React, { useState } from 'react';
import { ConfigProvider, Tabs } from 'antd';
import { CopyOutlined, EyeOutlined, BookOutlined } from '@ant-design/icons';
import ConfluenceCopy from './components/ConfluenceCopy';
import ConfluenceViewer from './components/ConfluenceViewer';
import ConfluenceDateUpdater from './components/ConfluenceDateUpdater';
function App() {
  const [activeTab, setActiveTab] = useState('viewer');

  const tabItems = [
    {
      key: 'copy',
      label: (
        <span>
          <CopyOutlined />
          Copy Page
        </span>
      ),
      children: <ConfluenceCopy />
    },
    {
      key: 'viewer',
      label: (
        <span>
          <EyeOutlined /> View Page
        </span>
      ),
      children: <ConfluenceViewer />
    },
    {
      key: 'updater',
      label: (
        <span>
          <BookOutlined></BookOutlined> Updater
        </span>
      ),
      children: <ConfluenceDateUpdater/>
    }
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
        },
      }}
    >
      <div className="App" style={{ minHeight: '100vh' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ height: '100vh' }}
          tabBarStyle={{
            background: '#001529',
            color: 'white',
            margin: 0,
            paddingLeft: '24px'
          }}
        />
      </div>
    </ConfigProvider>
  );
}

export default App;