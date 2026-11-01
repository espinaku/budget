// 앱 공통 선 아이콘 (24x24, currentColor). 새 아이콘은 PATHS에 추가해서 사용 (이모지·문자 화살표를 섞지 않음)
const PATHS = {
  search : 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus : 'M12 5v14M5 12h14',
  back : 'M15 5l-7 7 7 7',
  forward : 'M9 5l7 7-7 7',
  gear : 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4z',
  chevronDown : 'M6 9l6 6 6-6',
  close : 'M6 6l12 12M18 6L6 18',
  transfer : 'M4 8h14l-3-3M20 16H6l3 3',
  grip : 'M5 8h14M5 12h14M5 16h14',
  home : 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  list : 'M4 6h16M4 12h16M4 18h10',
  wallet : 'M3 7h18v12H3zM3 11h18M16 15h2',
  sliders : 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
  folder : 'M3 6h6l2 3h10v10H3z',
  tag : 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  sparkle : 'M12 3l1.8 5.7L19.5 10.5l-5.7 1.8L12 18l-1.8-5.7L4.5 10.5l5.7-1.8zM19 16v4M17 18h4',
  save : 'M12 4v11M7 10l5 5 5-5M5 19h14',
};

function Icon({name, size = 22, className = ''}) {
  return (
    <svg className={`icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]}/>
    </svg>
  );
}

export default Icon;
