from dataclasses import dataclass, asdict
import json
from pathlib import Path
from typing import List

DATA_FILE = Path("tasks.json")


@dataclass
class Task:
    id: int
    title: str
    done: bool = False


def load_tasks() -> List[Task]:
    if not DATA_FILE.exists():
        return []

    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    tasks: List[Task] = []
    for item in raw:
        if "id" in item and "title" in item:
            tasks.append(
                Task(
                    id=int(item["id"]),
                    title=str(item["title"]),
                    done=bool(item.get("done", False)),
                )
            )
    return tasks


def save_tasks(tasks: List[Task]) -> None:
    DATA_FILE.write_text(
        json.dumps([asdict(t) for t in tasks], indent=2),
        encoding="utf-8",
    )


def next_id(tasks: List[Task]) -> int:
    return max((task.id for task in tasks), default=0) + 1


def add_task(title: str) -> Task:
    tasks = load_tasks()
    task = Task(id=next_id(tasks), title=title.strip())
    tasks.append(task)
    save_tasks(tasks)
    return task


def mark_done(task_id: int) -> Task | None:
    tasks = load_tasks()
    for task in tasks:
        if task.id == task_id:
            task.done = True
            save_tasks(tasks)
            return task
    return None


def delete_task(task_id: int) -> bool:
    tasks = load_tasks()
    updated = [task for task in tasks if task.id != task_id]
    if len(updated) == len(tasks):
        return False
    save_tasks(updated)
    return True


def clear_tasks() -> None:
    save_tasks([])
