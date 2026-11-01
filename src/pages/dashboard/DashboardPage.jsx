import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {getMonthlyStats, getCategoryStats, getTagStats} from "../../api/statsApi.js";
import {getAssets, getAssetUsage} from "../../api/assetApi.js";
import {getCurrentMonth, formatMonthLabel, shiftMonth} from "../../utils/month.js";
import {useMediaQuery} from "../../utils/useMediaQuery.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Button from "../../components/common/Button.jsx";
import BackupReminder from "../../components/common/BackupReminder.jsx";
import {TYPE_LABEL, isCardType} from "../asset/assetLabels.js";

const TREND_MONTHS = 6; // 월별 추이에 보여줄 개월 수 (선택 월 포함)
const TAG_TOP_N = 8; // 태그 차트에 보여줄 상위 개수
const ASSET_TYPE_LABEL = TYPE_LABEL;

const MOBILE_QUERY = '(max-width: 640px)';
const won = (v) => `${Number(v).toLocaleString()}원`;

// 축 눈금용 축약 표기 (12만, 1.2억)
const compactWon = (v) => {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return String(v);
};

const axisTick = {fill: 'var(--color-text-muted)', fontSize: 12};
const tooltipStyle = {
  background : 'var(--color-surface)',
  border : '1px solid var(--color-border)',
  borderRadius : 8,
  fontSize: 13,
  color : 'var(--color-text)'
};

// 섹션 공통 카드 : 로딩/에러 처리
function ChartCard({title, isLoading, error, children}) {
  return (
      <section className="card chart-card">
        <h2 className="chart-title">{title}</h2>
        {isLoading && <LoadingSpinner/>}
        {error && <p className="state-message is-error">에러 : {error.message}</p>}
        {!isLoading && !error && children}
      </section>
  );
}

// 가로 막대 순위 차트. items : [{key, name, totalAmount, color}], onSelect : (item) => void 행 클릭
function RankBarChart({items, onSelect}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const height = Math.max(96, items.length * (isMobile ? 38 : 34) + 16);
  const labelFormat = isMobile ? (v) => `${compactWon(v)}원` : won;
  const nameFormat = isMobile ? (v) => (v.length > 5 ? `${v.slice(0, 5)}…` : v) : undefined;
  return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} layout="vertical" margin={{top:0, right:isMobile ? 52 : 80, left:isMobile ? 0 : 9, bottom:0}}
                  style={{cursor:'pointer'}}
                  onClick={(state) => {
                    const item = items[Number(state?.activeTooltipIndex)];
                    if (item) onSelect(item);
                  }}>
          <XAxis type="number" hide/>
          <YAxis type="category" dataKey="name" width={isMobile ? 68 : 88} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={nameFormat} />
          <Tooltip
              cursor={{fill:'var(--color-primary-bg)'}}
              contentStyle={tooltipStyle}
              formatter={(v) => [won(v), '합계']}
          />
          <Bar
            dataKey="totalAmount"
            barSize={14}
            shape={(props) => (
                <Rectangle {...props} fill={props.payload?.color || 'var(--series-1)'} radius={[0,4,4,0]}/>
            )}
          >
              <LabelList
                dataKey="totalAmount"
                position="right"
                formatter={labelFormat}
                style={{fill: 'var(--color-text)', fontSize:12}}
              />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [month, setMonth] = useState(getCurrentMonth);
  const [type, setType] = useState('EXPENSE');
  const typeLabel = type === 'EXPENSE' ? '지출' : '수입';

  const monthly = useQuery({
    queryKey: ['stats', 'monthly', month],
    queryFn: () => getMonthlyStats(shiftMonth(month, -(TREND_MONTHS - 1)), month),
  });

  const categories = useQuery({
    queryKey : ['stats', 'categories', month, type],
    queryFn: () => getCategoryStats(month, type),
  });

  const tags = useQuery({
    queryKey : ['stats', 'tags', month, type],
    queryFn: () => getTagStats(month, type),
  });

  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: () => getAssets(),
  });

  const assetUsage = useQuery({
    queryKey: ['assets', 'usage', month],
    queryFn: () => getAssetUsage(month),
  });
  const usageMap = new Map((assetUsage.data ?? []).map((u) => [u.assetId, u]));

  // --- 데이터 가공 ----
  const monthlyItems = monthly.data?.items ?? [];
  const current = monthlyItems.find((m) => m.month === month);
  const income = current?.income ?? 0;
  const expense = current?.expense ?? 0;
  const net = income - expense;

  const trendData = monthlyItems.map((m) => ({...m, label: `${Number(m.month.slice(5))}월`}));
  const categoryItems = (categories.data?.items ?? []).map((c) => ({
    key:c.categoryId, name : c.categoryName, totalAmount : c.totalAmount, color : c.color,
  }));

  const tagItems = [...(tags.data?.tags ?? [])]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, TAG_TOP_N)
      .map((t) => ({key:t.tagId, categoryId:t.categoryId, name:`#${t.tagName}`, totalAmount:t.totalAmount, color: t.tagColor}));

  // 차트 항목 → 같은 조건의 거래 목록
  const openTransactions = (filter) => {
    navigate(`/transactions?${new URLSearchParams({month, type, ...filter})}`);
  };

  const assetList = assets.data ?? [];
  const totalAssets = assetList
      .filter((a) => !isCardType(a.type) && a.balance != null)
      .reduce((sum, a) => sum + a.balance, 0);

  return (
      <div className="page">
        <div className="page-header">
          <div className="page-header-title">
            <h1>대시보드</h1>
            <div className="month-switcher">
              <button type="button" className="month-switcher-arrow" aria-label="이전 달"
                      onClick={() => setMonth((m) => shiftMonth(m, -1))}>‹</button>
              <label className="month-switcher-label">
                {formatMonthLabel(month)}
                <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}/>
              </label>
              <button type="button" className="month-switcher-arrow" aria-label="다음 달"
                      onClick={() => setMonth((m) => shiftMonth(m, 1))}>›</button>
            </div>
          </div>
          <div className="dashboard-toggle">
            <Button size="sm" variant={type === 'EXPENSE' ? 'primary' : 'ghost'} onClick={() => setType('EXPENSE')}>지출</Button>
            <Button size="sm" variant={type === 'INCOME' ? 'primary' : 'ghost'} onClick={() => setType('INCOME')}>수입</Button>
          </div>
        </div>
        <BackupReminder/>

        {/* 요약 */}
        <div className="kpi-row">
          <div className="card kpi">
            <span className="kpi-label">수입</span>
            <span className="kpi-value">{won(income)}</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">지출</span>
            <span className="kpi-value">{won(expense)}</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">수지</span>
            <span className="kpi-value">{net > 0 ? '+' : net < 0 ? '-' : ''}{won(Math.abs(net))}</span>
          </div>
        </div>

        {/* 월별 추이 */}
        <ChartCard title={`월별 추이 (최근 ${TREND_MONTHS}개월)`} isLoading={monthly.isLoading} error={monthly.error}>
          <ResponsiveContainer width="100%" height={isMobile ? 210 : 240}>
            <BarChart data={trendData} margin={{top: 8, right: 8, left: 0, bottom: 0}} barGap={2}>
              <CartesianGrid stroke="var(--color-border)" vertical={false}/>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick}/>
              <YAxis tickFormatter={compactWon} tickLine={false} axisLine={false} tick={axisTick} width={isMobile ? 40 : 48}/>
              <Tooltip
                  cursor={{fill: 'var(--color-primary-bg)'}}
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [won(v), name]}
              />
              <Legend
                  iconType="square"
                  formatter={(value) => <span style={{color: 'var(--color-text-muted)', fontSize: 13}}>{value}</span>}
              />
              <Bar dataKey="income" name="수입" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={20}/>
              <Bar dataKey="expense" name="지출" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={20}/>
            </BarChart>
          </ResponsiveContainer>
          <details className="chart-table">
            <summary>표로 보기</summary>
            <table>
              <thead>
              <tr><th>월</th><th>수입</th><th>지출</th></tr>
              </thead>
              <tbody>
              {trendData.map((m) => (
                  <tr key={m.month}><td>{m.label}</td><td>{won(m.income)}</td><td>{won(m.expense)}</td></tr>
              ))}
              </tbody>
            </table>
          </details>
        </ChartCard>

        {/* 카테고리 */}
        <ChartCard title={`카테고리별 ${typeLabel}`} isLoading={categories.isLoading} error={categories.error}>
          {categoryItems.length === 0
              ? <div className="empty-state">{formatMonthLabel(month)} {typeLabel} 내역이 없습니다.</div>
              : <RankBarChart items={categoryItems} onSelect={(item) => openTransactions({categoryId : item.key})}/>}
        </ChartCard>

        {/* 태그 */}
        <ChartCard title={`태그별 ${typeLabel} (상위 ${TAG_TOP_N}개)`} isLoading={tags.isLoading} error={tags.error}>
          {tagItems.length === 0
              ? <div className="empty-state">태그가 붙은 {typeLabel} 내역이 없습니다.</div>
              : <RankBarChart items={tagItems} onSelect={(item) => openTransactions({categoryId : item.categoryId, tagId : item.key})}/>}
        </ChartCard>

        {/* 자산 현황 */}
        <ChartCard title="자산 현황" isLoading={assets.isLoading} error={assets.error}>
          <div className="kpi-label">총자산 (카드 제외)</div>
          <div className="kpi-value" style={{marginBottom: 12}}>{won(totalAssets)}</div>
          {assetList.length === 0 ? (
              <div className="empty-state">등록된 자산이 없습니다.</div>
          ) : (
              <ul className="list">
                {assetList.map((a) => (
                    <li key={a.id} className="list-item">
                      <div className="list-item-main">
                        <span className="list-item-title">{a.name}</span>
                        <span className="list-item-meta">{ASSET_TYPE_LABEL[a.type] ?? a.type}</span>
                      </div>
                      {isCardType(a.type) ? (
                        <div className="asset-amounts">
                          <span className={`amount${(usageMap.get(a.id)?.expense ?? 0) > 0 ? ' amount-expense' : ''}`}>
                            {(usageMap.get(a.id)?.expense ?? 0) > 0 ? '-' : ''}{won(usageMap.get(a.id)?.expense ?? 0)}
                          </span>
                          {(usageMap.get(a.id)?.transferIn ?? 0) > 0 && (
                              <span className="list-item-meta">납부 {won(usageMap.get(a.id).transferIn)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="amount">{a.balance != null ? won(a.balance) : '-'}</span>
                      )}
                    </li>
                ))}
              </ul>
          )}
        </ChartCard>
      </div>
  );
}

export default DashboardPage;