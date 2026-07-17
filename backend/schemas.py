from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal

class TaskBase(BaseModel):
    title: str
    status: Literal["todo", "doing", "done"] = "todo"

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, description="The title of the task")
    status: Literal["todo", "doing", "done"] = "todo"

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, description="The updated title of the task")
    status: Literal["todo", "doing", "done"] = Field(..., description="The status of the task")

class Task(TaskBase):
    id: int
    created_at: datetime

    class Config:
        # Compatibility with both Pydantic v1 and Pydantic v2
        orm_mode = True
        from_attributes = True
