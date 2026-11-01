import {HashRouter, Navigate, Route, Routes} from 'react-router-dom';
import Layout from '../components/common/Layout';
import TransactionListPage from '../pages/transaction/TransactionListPage';
import AssetListPage from '../pages/asset/AssetListPage';
import AssetDetailPage from '../pages/asset/AssetDetailPage';
import AssetManagePage from '../pages/asset/AssetManagePage';
import CategoryListPage from '../pages/category/CategoryListPage';
import TagListPage from '../pages/tag/TagListPage';
import SettingsPage from "../pages/setting/SettingsPage.jsx";
import BackupPage from "../pages/setting/BackupPage.jsx";
import DashboardPage from "../pages/dashboard/DashboardPage.jsx";

const PAGES = [
  {path : '/dashboard', element : <DashboardPage />},
  {path : '/transactions', element : <TransactionListPage />},
  {path : '/assets', element : <AssetListPage />},
  {path : '/assets/:id', element : <AssetDetailPage />},
  {path : '/settings', element : <SettingsPage />},
  {path : '/settings/assets', element : <AssetManagePage />},
  {path : '/settings/categories', element : <CategoryListPage />},
  {path : '/settings/tags', element : <TagListPage />},
  {path : '/settings/backup', element : <BackupPage />},
];

// HashRouter: 주소가 /#/transactions 형태라 정적 호스팅(GitHub Pages 등)에서 새로고침해도 404가 나지 않는다.
// 로그인이 없으므로 ProtectedRoute도 없다.
function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        {PAGES.map(({path, element}) => (
          <Route key={path} path={path} element={<Layout>{element}</Layout>}/>
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default AppRouter;
