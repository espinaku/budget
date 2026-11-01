import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {getCategories, createCategory, updateCategory, reorderCategories, deleteCategory, toggleCategoryVisibility} from '../../api/categoryApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from "../../components/common/Button.jsx";
import CategoryForm from "./CategoryForm.jsx";
import TopBar from "../../components/common/TopBar.jsx";
import {SortableList, SortableItem} from "../../components/common/SortableList.jsx";
import {getErrorMessage} from "../../api/errorMessage.js";

function CategoryListPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const {data, isLoading, error} = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories
  });

  const createMutation = useMutation({
    mutationFn : createCategory,
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['categories']});
      setShowForm(false);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const updateMutation = useMutation({
    mutationFn : ({id, payload}) => updateCategory(id, payload),
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['categories']});
      setEditingId(null);
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const reorderMutation = useMutation({
    mutationFn : reorderCategories,
    onError: (error) => {
      alert(getErrorMessage(error));
    },
    onSettled : () => {
      queryClient.invalidateQueries({queryKey : ['categories']}); // 실패 시 서버 순서로 복구
    }
  });

  // 놓는 즉시 화면에 반영되도록 캐시를 먼저 바꾼 뒤 저장
  const handleReorder = (items) => {
    queryClient.setQueryData(['categories'], items);
    reorderMutation.mutate(items.map((x) => x.id));
  };

  const deleteMutation = useMutation({
    mutationFn : deleteCategory,
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['categories']});
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });

  const toggleMutation = useMutation({
    mutationFn : toggleCategoryVisibility,
    onSuccess : () => {
      queryClient.invalidateQueries({queryKey : ['categories']});
    },
    onError: (error) => {
      alert(getErrorMessage(error));
    }
  });



  return (
      <div className="page">
        <TopBar title="카테고리 관리" backTo="/settings" right={(
          <Button type="button" size="sm" onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}>추가</Button>
        )}/>

        {showForm && (
          <CategoryForm
            onSubmit={(payload) => createMutation.mutate(payload)}
            onCancel={() => setShowForm(false)}
            submitting={createMutation.isPending}
          />
        )}

        {isLoading && <LoadingSpinner/>}
        {error && <p className="state-message is-error">에러: {error.message}</p>}

        {data && (
            data.length === 0 ? (
                <div className="empty-state">등록된 카테고리가 없습니다.</div>
            ) : (
                <SortableList items={data} onReorder={handleReorder}>
                  {data.map((ca) => (
                      <SortableItem key={ca.id} id={ca.id} dragDisabled={editingId === ca.id}
                          className={editingId === ca.id ? '' : 'list-item--clickable'}
                          onClick={() => {
                            if (editingId !== ca.id) {
                              setShowForm(false);
                              setEditingId(ca.id);
                            }
                          }}>
                        {editingId === ca.id ? (
                            <CategoryForm
                              initialValue={ca}
                              onSubmit={(payload) => updateMutation.mutate({id : ca.id, payload})}
                              onCancel={() => setEditingId(null)}
                              onDelete={!ca.isDefault ? () => {
                                if (window.confirm(`'${ca.name}' 카테고리를 삭제할까요?`)) {
                                  deleteMutation.mutate(ca.id);
                                }
                              } : undefined}
                              submitting={updateMutation.isPending}
                            />
                        ) : (
                            <>
                              <div className="list-item-main">
                                <span className="list-item-title">{ca.icon} {ca.name}</span>
                                {!ca.isVisible && <span className="list-item-meta">숨김</span>}
                              </div>
                              {ca.isDefault && <span className="badge">기본</span>}
                              <div className="list-item-actions">
                                <Button type="button" variant="ghost" size="sm" onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMutation.mutate(ca.id);
                                }}>
                                  {ca.isVisible ? '숨기기' : '보이기'}
                                </Button>
                              </div>
                            </>
                        )}
                      </SortableItem>
                  ))}
                </SortableList>
            )
        )}
      </div>
  );
}

export default CategoryListPage;
