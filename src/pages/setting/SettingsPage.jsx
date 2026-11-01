import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {getAssets} from "../../api/assetApi.js";
import {getCategories} from "../../api/categoryApi.js";
import {getTags} from "../../api/tagApi.js";
import {getLastBackupAt} from "../../api/backupApi.js";
import Icon from "../../components/common/Icon.jsx";
import {backupInfo} from "./backupStatus.js";

function SettingsPage() {
  const {data : assets} = useQuery({queryKey : ['assets'], queryFn : () => getAssets()});
  const {data : categories} = useQuery({queryKey : ['categories'], queryFn : getCategories});
  const {data : tags} = useQuery({queryKey : ['tags', 'ALL'], queryFn : () => getTags()});
  const {data : lastBackupAt, isSuccess : backupLoaded} = useQuery({
    queryKey : ['backup', 'last'],
    queryFn : getLastBackupAt,
  });

  const count = (list) => (list ? `${list.length}개` : '');

  const items = [
    {to : '/settings/assets', icon : 'wallet', label : '자산 관리', info : count(assets)},
    {to : '/settings/categories', icon : 'folder', label : '카테고리 관리', info : count(categories)},
    {to : '/settings/tags', icon : 'tag', label : '태그 관리', info : count(tags)},
    {to : '/settings/backup', icon : 'save', label : '백업 · 복원', info : backupLoaded ? backupInfo(lastBackupAt) : ''},
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>설정</h1>
      </div>

      <ul className="list">
        {items.map((item) => (
          <li key={item.to}>
            <Link className="settings-link" to={item.to}>
              <Icon name={item.icon} className="settings-icon"/>
              <span className="settings-label">{item.label}</span>
              <span className="list-item-meta">{item.info}</span>
              <Icon name="forward" size={18} className="settings-arrow"/>
            </Link>
          </li>
        ))}
      </ul>

      <p className="settings-footnote">
        데이터는 이 기기의 브라우저에만 저장됩니다. 로그인·서버가 없어 다른 사람은 볼 수 없지만,
        앱을 지우거나 기기를 바꾸면 사라지니 백업을 꼭 해 두세요.
      </p>
    </div>
  );
}

export default SettingsPage;
