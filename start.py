import os

from waitress import serve

from app import app


def main() -> None:
    raw_port = os.environ.get("PORT", "8080")
    try:
        port = int(raw_port)
    except ValueError:
        port = 8080

    serve(app, host="0.0.0.0", port=port, threads=8)


if __name__ == "__main__":
    main()
