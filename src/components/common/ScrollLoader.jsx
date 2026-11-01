import {useEffect, useRef} from "react";
import Button from "./Button.jsx";
import LoadingSpinner from "./LoadingSpinner";

// 무한 스크롤 목록 맨 아래에 두면 화면에 가까워질 때 다음 페이지를 불러온다 (scroll append).
// 불러오기에 실패하면 자동 재시도를 멈추고 다시 시도 버튼을 보여준다.
// props : useInfiniteQuery 결과의 hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage
function ScrollLoader({hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage}) {
  const sentinelRef = useRef(null);
  const autoLoad = hasNextPage && !isFetchNextPageError;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !autoLoad || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, {rootMargin : '200px'});
    observer.observe(target);
    return () => observer.disconnect();
  }, [autoLoad, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <div ref={sentinelRef}/>
      {isFetchingNextPage && <LoadingSpinner/>}
      {isFetchNextPageError && !isFetchingNextPage && (
        <div className="scroll-retry">
          <p className="state-message is-error">목록을 더 불러오지 못했습니다.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => fetchNextPage()}>다시 시도</Button>
        </div>
      )}
    </>
  );
}

export default ScrollLoader;
