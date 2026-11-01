import {useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {getAssets, getAssetUsage} from "../../api/assetApi.js";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import MonthSwitcher from "../../components/common/MonthSwitcher.jsx";
import {getCurrentMonth} from "../../utils/month.js";
import AssetAmounts from "./AssetAmounts.jsx";
import {TYPE_LABEL, isCardType} from "./assetLabels.js";

// 조회 전용 목록. 등록·수정·비활성은 설정 > 자산 관리(/settings/assets)
function AssetListPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth);

  const {data, isLoading, error} = useQuery({
    queryKey: ['assets'],
    queryFn: () => getAssets(),
  });

  const {data: usageData} = useQuery({
    queryKey: ['assets', 'usage', month],
    queryFn: () => getAssetUsage(month),
  });

  const usageMap = useMemo(
    () => new Map((usageData ?? []).map((u) => [u.assetId, u])),
    [usageData]
  );
  const monthNumber = Number(month.slice(5));
  const totalAssets = (data ?? [])
    .filter((a) => !isCardType(a.type) && a.balance != null)
    .reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-title">
          <h1>자산</h1>
          <MonthSwitcher value={month} onChange={setMonth}/>
        </div>
      </div>

      {isLoading && <LoadingSpinner/>}
      {error && <p className="state-message is-error">에러: {error.message}</p>}

      {data && (data.length === 0 ? (
        <div className="empty-state">
          등록된 자산이 없습니다. <Link to="/settings/assets">자산 관리</Link>에서 추가해 주세요.
        </div>
      ) : (
        <>
          <div className="asset-total">
            <span className="kpi-label">총자산 (카드 제외)</span>
            <span className="kpi-value">{totalAssets.toLocaleString()}원</span>
          </div>
          <ul className="list">
            {data.map((a) => (
              <li key={a.id} className="list-item list-item--clickable" onClick={() => navigate(`/assets/${a.id}`)}>
                <div className="list-item-main">
                  <span className="list-item-title">{a.name}</span>
                  <span className="badge">{TYPE_LABEL[a.type] ?? a.type}</span>
                  {a.type === 'CHECK_CARD' && (
                    <span className="list-item-meta">
                      출금 계좌 {data.find((x) => x.id === a.linkedAssetId)?.name ?? '-'}
                    </span>
                  )}
                </div>
                <AssetAmounts asset={a} usage={usageMap.get(a.id)} monthNumber={monthNumber}/>
              </li>
            ))}
          </ul>
        </>
      ))}
    </div>
  );
}

export default AssetListPage;
