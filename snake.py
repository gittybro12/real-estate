import argparse
from task_store import add_task, clear_tasks, delete_task, load_tasks, mark_done


def print_tasks() -> None:
    tasks = load_tasks()
    if not tasks:
        print("No tasks yet. Add one with: python snake.py add \"your task\"")
        return

    print("\nID  Status  Title")
    print("--  ------  -----")
    for task in sorted(tasks, key=lambda t: t.id):
        status = "[x]" if task.done else "[ ]"
        print(f"{task.id:<2}  {status:<6}  {task.title}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Simple task manager")
    sub = parser.add_subparsers(dest="command")

    add_cmd = sub.add_parser("add", help="Add a task")
    add_cmd.add_argument("title", help="Task title")

    sub.add_parser("list", help="List all tasks")

    done_cmd = sub.add_parser("done", help="Mark a task as done")
    done_cmd.add_argument("id", type=int, help="Task ID")

    del_cmd = sub.add_parser("delete", help="Delete a task")
    del_cmd.add_argument("id", type=int, help="Task ID")

    sub.add_parser("clear", help="Delete all tasks")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "add":
        task = add_task(args.title)
        print(f"Added task #{task.id}: {task.title}")
    elif args.command == "list":
        print_tasks()
    elif args.command == "done":
        task = mark_done(args.id)
        if task is None:
            print(f"Task #{args.id} not found.")
        else:
            print(f"Completed task #{task.id}: {task.title}")
    elif args.command == "delete":
        if delete_task(args.id):
            print(f"Deleted task #{args.id}.")
        else:
            print(f"Task #{args.id} not found.")
    elif args.command == "clear":
        clear_tasks()
        print("Cleared all tasks.")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
