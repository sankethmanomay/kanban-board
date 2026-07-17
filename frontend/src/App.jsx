import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/tasks`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks from the server');
      }
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the Kanban server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Add a new task (New tasks always added to "todo")
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const titleToAdd = newTitle.trim();
    setNewTitle(''); // Clear input

    // Optimistic Update Setup
    const tempId = Date.now(); // temporary numeric ID
    const optimisticTask = {
      id: tempId,
      title: titleToAdd,
      status: 'todo',
      created_at: new Date().toISOString(),
      isOptimistic: true, // internal marker
    };

    // Apply optimistic update
    setTasks((prevTasks) => [...prevTasks, optimisticTask]);

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToAdd, status: 'todo' }),
      });

      if (!response.ok) {
        throw new Error('Server rejected adding the task');
      }

      const realTask = await response.json();
      
      // Replace optimistic task with the real one from the server
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === tempId ? realTask : t))
      );
    } catch (err) {
      console.error(err);
      alert('Failed to save the task. Reverting UI.');
      // Rollback optimistic update
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== tempId));
    }
  };

  // Move task status (for drag-and-drop & fallback arrow buttons)
  const moveTask = async (taskId, newStatus) => {
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];
    const oldStatus = task.status;

    if (oldStatus === newStatus) return;

    // Apply optimistic update: change status in state
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Server rejected moving the task');
      }

      const updatedTask = await response.json();
      // Update with correct backend values if any changed
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === taskId ? updatedTask : t))
      );
    } catch (err) {
      console.error(err);
      alert('Failed to update task status on the server. Reverting UI.');
      // Rollback optimistic update
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t))
      );
    }
  };

  // Delete a task with confirmation
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const taskToDelete = tasks[taskIndex];

    // Apply optimistic update: remove from state
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Server rejected deleting the task');
      }
      // Success: task already removed from state, nothing more to do
    } catch (err) {
      console.error(err);
      alert('Failed to delete the task on the server. Reverting UI.');
      // Rollback optimistic update: restore task at its original position
      setTasks((prevTasks) => {
        const restored = [...prevTasks];
        restored.splice(taskIndex, 0, taskToDelete);
        return restored;
      });
    }
  };

  // Drag and Drop End handler
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a valid column
    if (!destination) return;

    // Dropped in the exact same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId, 10);
    const targetStatus = destination.droppableId; // 'todo', 'doing', or 'done'

    moveTask(taskId, targetStatus);
  };

  // Helper for arrow button logic
  const getAdjacentStatuses = (currentStatus) => {
    switch (currentStatus) {
      case 'todo':
        return { prev: null, next: 'doing' };
      case 'doing':
        return { prev: 'todo', next: 'done' };
      case 'done':
        return { prev: 'doing', next: null };
      default:
        return { prev: null, next: null };
    }
  };

  // Group tasks by column status
  const columns = {
    todo: tasks.filter((t) => t.status === 'todo'),
    doing: tasks.filter((t) => t.status === 'doing'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <div className="kanban-container">
      <header className="kanban-header">
        <h1>Kanban Flow</h1>
        <p className="subtitle">Manage your project tasks visually and efficiently</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Kanban board...</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="kanban-board">
            
            {/* TO DO COLUMN */}
            <div className="kanban-column-wrapper">
              <div className="kanban-column-header">
                <h2>To Do</h2>
                <span className="count-badge">{columns.todo.length}</span>
              </div>
              
              {/* Add Task input at the top of To Do column */}
              <form onSubmit={handleAddTask} className="add-task-form">
                <input
                  type="text"
                  placeholder="Create a new task..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="add-task-input"
                  required
                />
                <button type="submit" className="add-task-button" aria-label="Add Task">
                  Add Task
                </button>
              </form>

              <Droppable droppableId="todo">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column-body ${
                      snapshot.isDraggingOver ? 'dragging-over' : ''
                    }`}
                  >
                    {columns.todo.length === 0 ? (
                      <div className="empty-placeholder">No tasks in To Do</div>
                    ) : (
                      columns.todo.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <TaskCard
                              task={task}
                              provided={provided}
                              snapshot={snapshot}
                              onDelete={handleDeleteTask}
                              onMove={moveTask}
                              adjacent={getAdjacentStatuses(task.status)}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* DOING COLUMN */}
            <div className="kanban-column-wrapper">
              <div className="kanban-column-header">
                <h2>Doing</h2>
                <span className="count-badge">{columns.doing.length}</span>
              </div>
              <Droppable droppableId="doing">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column-body ${
                      snapshot.isDraggingOver ? 'dragging-over' : ''
                    }`}
                  >
                    {columns.doing.length === 0 ? (
                      <div className="empty-placeholder">No tasks currently in progress</div>
                    ) : (
                      columns.doing.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <TaskCard
                              task={task}
                              provided={provided}
                              snapshot={snapshot}
                              onDelete={handleDeleteTask}
                              onMove={moveTask}
                              adjacent={getAdjacentStatuses(task.status)}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* DONE COLUMN */}
            <div className="kanban-column-wrapper">
              <div className="kanban-column-header">
                <h2>Done</h2>
                <span className="count-badge">{columns.done.length}</span>
              </div>
              <Droppable droppableId="done">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column-body ${
                      snapshot.isDraggingOver ? 'dragging-over' : ''
                    }`}
                  >
                    {columns.done.length === 0 ? (
                      <div className="empty-placeholder">No completed tasks</div>
                    ) : (
                      columns.done.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <TaskCard
                              task={task}
                              provided={provided}
                              snapshot={snapshot}
                              onDelete={handleDeleteTask}
                              onMove={moveTask}
                              adjacent={getAdjacentStatuses(task.status)}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

          </div>
        </DragDropContext>
      )}
    </div>
  );
}

// Inner helper component for displaying a Task Card
function TaskCard({ task, provided, snapshot, onDelete, onMove, adjacent }) {
  const formattedTime = new Date(task.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`task-card ${snapshot.isDragging ? 'dragging' : ''} ${
        task.isOptimistic ? 'optimistic-loading' : ''
      }`}
    >
      <div className="task-card-header">
        <span className="task-timestamp">{formattedTime}</span>
        <button
          className="delete-button"
          onClick={() => onDelete(task.id)}
          title="Delete Task"
          aria-label="Delete Task"
        >
          &times;
        </button>
      </div>
      
      <div className="task-card-body">
        <p className="task-title">{task.title}</p>
      </div>

      <div className="task-card-footer">
        {/* Navigation Arrows for Accessibility/Fallback */}
        <div className="fallback-controls">
          {adjacent.prev && (
            <button
              onClick={() => onMove(task.id, adjacent.prev)}
              className="fallback-arrow-button"
              title={`Move to ${adjacent.prev}`}
              aria-label={`Move to ${adjacent.prev}`}
            >
              &larr;
            </button>
          )}
          
          <div className="spacer"></div>
          
          {adjacent.next && (
            <button
              onClick={() => onMove(task.id, adjacent.next)}
              className="fallback-arrow-button"
              title={`Move to ${adjacent.next}`}
              aria-label={`Move to ${adjacent.next}`}
            >
              &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
