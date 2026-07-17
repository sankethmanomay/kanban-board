import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from database import engine, Base, get_db
import models, schemas

# Initialize database tables on startup
# This is safe and idempotent. SQLAlchemy will skip existing tables.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Kanban Board API",
    description="Backend API for a simple Kanban Board with CRUD actions.",
    version="1.0.0"
)

# CORS Configuration
# Allowed origin comes from the environment. Fallback to Vite's local dev server host.
allowed_origin_env = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")

# Normalize allowed origins list
origins = []
if allowed_origin_env:
    # Split by comma if multiple origins are provided, though typically single origin
    origins = [origin.strip().rstrip("/") for origin in allowed_origin_env.split(",") if origin.strip()]

# Add support for localhost loopback as fallback for easier developer setup
if "http://localhost:5173" not in origins:
    origins.append("http://localhost:5173")
# Also support 127.0.0.1
if "http://127.0.0.1:5173" not in origins:
    origins.append("http://127.0.0.1:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/tasks", response_model=List[schemas.Task])
def list_tasks(db: Session = Depends(get_db)):
    """Fetch all tasks sorted by creation date (ascending)."""
    return db.query(models.Task).order_by(models.Task.created_at.asc()).all()

@app.post("/tasks", response_model=schemas.Task, status_code=status.HTTP_201_CREATED)
def create_task(task_in: schemas.TaskCreate, db: Session = Depends(get_db)):
    """Create a new task. Newly created tasks go to 'todo' by default."""
    db_task = models.Task(
        title=task_in.title,
        status=task_in.status
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task_in: schemas.TaskUpdate, db: Session = Depends(get_db)):
    """Update an existing task's status (or title)."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    
    if task_in.title is not None:
        db_task.title = task_in.title
    db_task.status = task_in.status
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task by its ID."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    
    db.delete(db_task)
    db.commit()
    return None
