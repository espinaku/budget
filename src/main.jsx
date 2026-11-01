import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { requestPersistentStorage } from './api/backupApi.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // 서버가 없으므로 재시도할 네트워크 오류가 없음
      refetchOnWindowFocus: false,
    },
  },
});

// iOS가 저장 공간 정리 시 이 앱 데이터를 지우지 않도록 요청 (거절돼도 앱 동작에는 영향 없음)
requestPersistentStorage().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
