from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo", nullable=False)  # 'todo', 'doing', or 'done'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
