import os
import subprocess
import sys


def main() -> int:
    raw_port = os.environ.get("PORT", "8080")
    try:
        port = int(raw_port)
    except ValueError:
        port = 8080

    cmd = [
        "gunicorn",
        "app:app",
        "--bind",
        f"0.0.0.0:{port}",
        "--workers",
        "2",
        "--threads",
        "4",
        "--timeout",
        "120",
    ]
    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
