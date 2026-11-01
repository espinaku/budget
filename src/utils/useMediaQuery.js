import {useEffect, useState} from 'react';

// CSS 미디어쿼리 일치 여부를 반응형으로 반환 (차트처럼 CSS만으로 조정이 안 되는 곳에서 사용)
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
