import {DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors} from "@dnd-kit/core";
import {SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import Icon from "./Icon.jsx";

// 드래그로 순서를 바꾸는 목록. 행 왼쪽 손잡이로만 잡으므로 행 클릭·모바일 스크롤은 그대로 동작
// props
//   items     : id를 가진 객체 배열 (현재 순서)
//   onReorder : (새 순서의 items) => void
//   children  : SortableItem 목록
export function SortableList({items, onReorder, children}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint : {distance : 4}}),
    useSensor(KeyboardSensor, {coordinateGetter : sortableKeyboardCoordinates})
  );

  const handleDragEnd = ({active, over}) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((x) => x.id === active.id);
    const to = items.findIndex((x) => x.id === over.id);
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <ul className="list">{children}</ul>
      </SortableContext>
    </DndContext>
  );
}

// props
//   id           : 항목 id
//   dragDisabled : 수정 폼이 열린 행처럼 드래그하면 안 될 때 true (손잡이 숨김)
//   className, onClick : li에 그대로 전달
export function SortableItem({id, dragDisabled = false, className = '', onClick, children}) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} =
    useSortable({id, disabled : dragDisabled});

  const style = {
    // 세로로만 이동 (list의 overflow에 가로로 잘리지 않도록)
    transform : transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} onClick={onClick}
        className={`list-item list-item--sortable${isDragging ? ' is-dragging' : ''} ${className}`}>
      {!dragDisabled && (
        <button type="button" className="drag-handle" aria-label="순서 변경"
                ref={setActivatorNodeRef} {...attributes} {...listeners}
                onClick={(e) => e.stopPropagation()}>
          <Icon name="grip" size={20}/>
        </button>
      )}
      {children}
    </li>
  );
}
