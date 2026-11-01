import {useNavigate} from "react-router-dom";
import Icon from "./Icon.jsx";

// 하위 화면 공통 상단 바: 뒤로 | 가운데 제목 | 오른쪽 액션
// props : title, backTo(이동할 경로) 또는 onBack(직접 처리), right
function TopBar({title, backTo, onBack, right}) {
  const navigate = useNavigate();

  return (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="뒤로" onClick={onBack ?? (() => navigate(backTo))}>
        <Icon name="back"/>
      </button>
      <h1 className="top-bar-title">{title}</h1>
      <div className="top-bar-right">{right}</div>
    </div>
  );
}

export default TopBar;
