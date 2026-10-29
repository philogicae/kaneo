import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import type Task from "@/types/task";
import TaskCardContent from "./task-card-content";
import { useTaskCardClick } from "./use-task-card-click";

type TaskCardProps = {
  task: Task;
  disableDragDrop?: boolean;
  isFinalColumn?: boolean;
};

function TaskCard({
  task,
  disableDragDrop = false,
  isFinalColumn,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: disableDragDrop,
    data: { isFinalColumn },
  });
  // The context menu trigger inside the card stops touchstart from bubbling,
  // so the TouchSensor listens on that trigger instead of this wrapper.
  const { onTouchStart, ...dragListeners } = listeners ?? {};
  const { handleKeyDown } = useTaskCardClick(task, listeners);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? "none"
      : transition || "transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    willChange: isDragging ? "transform" : undefined,
    opacity: isDragging ? 0.6 : 1,
    touchAction: isDragging ? "none" : "auto",
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...dragListeners}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <TaskCardContent
        task={task}
        disableDragDrop={disableDragDrop}
        isFinalColumn={isFinalColumn}
        isDragging={isDragging}
        dragListeners={listeners}
        onDragTouchStart={(event) => onTouchStart?.(event)}
      />
    </div>
  );
}

export default TaskCard;
