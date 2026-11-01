import {useEffect, useState} from "react";
import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {getTagPage, createTag, updateTag, deleteTag} from "../../api/tagApi";
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ScrollLoader from '../../components/common/ScrollLoader.jsx';
import {getCategories} from "../../api/categoryApi.js";
import TagForm from "./TagForm.jsx";
import Select from "../../components/common/Select.jsx";
import Button from "../../components/common/Button.jsx";
import {getErrorMessage} from "../../api/errorMessage.js";
import TopBar from "../../components/common/TopBar.jsx";

const PAGE_SIZE = 30;

function TagListPage() {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState(null); // 카테고리 로딩 완료 시 첫 항목으로 초기화하거나, 선택 전까지 null 유지
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const {data : categories} = useQuery({
    queryKey : ['categories'],
    queryFn : getCategories
  });

  // 카테고리 로딩 완료 시 첫 항목으로 자동 선택
  useEffect(() => {
    if (categories && categories.length > 0 && categoryId === null) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const {data, isLoading, error, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage} = useInfiniteQuery({
    queryKey: ['tags', 'page', categoryId], // queryKey에 변수를 넣으면 값이 바뀔 때 자동 재조회
    queryFn: ({pageParam}) => getTagPage({
      categoryId: categoryId === 'ALL' ? undefined : categoryId,
      page: pageParam,
      size: PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled : !!categoryId // categoryId 없으면 요청 자체를 보내지 않음
  });
  const tags = data?.pages.flatMap((p) => p.items);

  const createMutation = useMutation({
    mutationFn : createTag,
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['tags']});
      setShowForm(false);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const updateMutation = useMutation({
    mutationFn : ({id, payload}) => updateTag(id, payload),
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['tags']});
      setEditingId(null);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const deleteMutation = useMutation({
    mutationFn : (id) => deleteTag(id),
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['tags']});
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const categoryOption = [
    {value : 'ALL', label : '전체'},
    ...(categories ?? []).map((c) => ({value : c.id, label : c.name}))
  ];

  return (
      <div className="page">
        <TopBar title="태그 관리" backTo="/settings" right={(
          <Button type="button" size="sm" onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }} disabled={!categoryId || categoryId === 'ALL'}>추가</Button>
        )}/>
        <Select
          className="page-filter"
          options={categoryOption}
          value={categoryId ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setCategoryId(value === 'ALL' ? 'ALL' : Number(value));
            setShowForm(false);
            setEditingId(null);
          }}
        />
        {showForm && (
          <TagForm
            initialValue={{categoryId}}
            categories={categories ?? []}
            onSubmit={(payload) => createMutation.mutate(payload)}
            onCancel={() => setShowForm(false)}
            submitting={createMutation.isPending}
          />
        )}

        {isLoading && <LoadingSpinner/>}
        {error && <p className="state-message is-error">에러: {error.message}</p>}

        {tags && (
          tags.length === 0 ? (
            <div className="empty-state">등록된 태그가 없습니다.</div>
          ) : (
            <ul className="list">
              {tags.map((tag) => (
                <li key={tag.id}
                    className={`list-item${editingId === tag.id ? '' : ' list-item--clickable'}`}
                    onClick={() => {
                      if (editingId !== tag.id) {
                        setShowForm(false);
                        setEditingId(tag.id);
                      }
                    }}>
                  {editingId === tag.id ? (
                    <TagForm
                      initialValue={tag}
                      categories={categories ?? []}
                      onSubmit={(payload) => updateMutation.mutate({id:tag.id, payload})}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => {
                        if (window.confirm(`'#${tag.name}' 태그를 삭제할까요?`)) {
                          deleteMutation.mutate(tag.id);
                        }
                      }}
                      submitting={updateMutation.isPending}
                    />
                  ) : (
                    <div className="list-item-main">
                      <span className="badge" style={tag.color ? {
                        color : tag.color,
                        backgroundColor : `color-mix(in srgb, ${tag.color} 15%, transparent)`,
                      } : undefined}>#{tag.name}</span>
                      {categoryId === 'ALL' && <span className="list-item-meta">{tag.categoryName}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        <ScrollLoader hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage}
                      isFetchNextPageError={isFetchNextPageError} fetchNextPage={fetchNextPage}/>
      </div>
  );
}

export default TagListPage;
