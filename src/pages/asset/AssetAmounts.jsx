// 자산 목록의 금액 영역. usage : /api/assets/usage의 해당 자산 항목 (없으면 undefined)
import {isCardType} from "./assetLabels.js";

function AssetAmounts({asset, usage, monthNumber}) {
  const expense = usage?.expense ?? 0;
  const income = usage?.income ?? 0;
  const transferIn = usage?.transferIn ?? 0;
  const transferOut = usage?.transferOut ?? 0;

  if (isCardType(asset.type)) {
    return (
      <div className="asset-amounts">
        <span className={`amount${expense ? ' amount-expense' : ''}`}>{expense ? '-' : ''}{expense.toLocaleString()}원</span>
        {transferIn > 0 && (
          <span className="list-item-meta">{monthNumber}월 납부 {transferIn.toLocaleString()}</span>
        )}
      </div>
    );
  }

  return (
    <div className="asset-amounts">
      {asset.balance != null && <span className="amount">{Number(asset.balance).toLocaleString()}원</span>}
      {(income > 0 || expense > 0) && (
        <span className="list-item-meta">{monthNumber}월 +{income.toLocaleString()} / -{expense.toLocaleString()}</span>
      )}
      {(transferIn > 0 || transferOut > 0) && (
        <span className="list-item-meta">이체 +{transferIn.toLocaleString()} / -{transferOut.toLocaleString()}</span>
      )}
    </div>
  );
}

export default AssetAmounts;
