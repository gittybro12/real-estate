import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, abort, g, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "real_estate.db"

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
RESET_TOKEN_TTL_MINUTES = 30

SAMPLE_LISTINGS = [
    {
        "title": "Skyline Glass Penthouse",
        "description": "A full-floor penthouse with panoramic downtown views, private elevator access, chef kitchen, and wraparound terrace.",
        "price": 1850000,
        "city": "Austin",
        "address": "2210 Westlake Dr",
        "property_type": "Condo",
        "bedrooms": 3,
        "bathrooms": 3.5,
        "area_sqft": 2740,
        "image_url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
    },
    {
        "title": "Modern Family Home",
        "description": "Open-concept home in a quiet cul-de-sac featuring vaulted ceilings, smart-home automation, and a landscaped backyard.",
        "price": 840000,
        "city": "Dallas",
        "address": "4807 Maple Crest Ln",
        "property_type": "House",
        "bedrooms": 4,
        "bathrooms": 3.0,
        "area_sqft": 3210,
        "image_url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    },
    {
        "title": "Waterfront Luxury Villa",
        "description": "An architectural villa with floor-to-ceiling windows, private dock access, infinity-edge pool, and resort-level finishes.",
        "price": 3250000,
        "city": "Miami",
        "address": "14 Biscayne Point",
        "property_type": "Villa",
        "bedrooms": 5,
        "bathrooms": 4.5,
        "area_sqft": 4680,
        "image_url": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
    },
    {
        "title": "High-Rise Urban Loft",
        "description": "Downtown loft with exposed concrete accents, custom cabinetry, and direct access to transit, dining, and nightlife.",
        "price": 610000,
        "city": "Chicago",
        "address": "912 W Loop St Apt 18A",
        "property_type": "Apartment",
        "bedrooms": 2,
        "bathrooms": 2.0,
        "area_sqft": 1390,
        "image_url": "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80",
    },
    {
        "title": "Suburban Townhome Retreat",
        "description": "Three-level townhome with attached garage, rooftop deck, community gym access, and upgraded fixtures throughout.",
        "price": 525000,
        "city": "Seattle",
        "address": "7603 Cedar Point Way",
        "property_type": "Townhome",
        "bedrooms": 3,
        "bathrooms": 2.5,
        "area_sqft": 1880,
        "image_url": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
    },
    {
        "title": "Coastal Designer Residence",
        "description": "A bright coastal residence with premium oak flooring, luxury appliances, and a short walk to shoreline trails.",
        "price": 1290000,
        "city": "San Diego",
        "address": "109 Harbor Light Ave",
        "property_type": "House",
        "bedrooms": 4,
        "bathrooms": 3.0,
        "area_sqft": 2950,
        "image_url": "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80",
    },
]


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exception: Exception | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            price INTEGER NOT NULL,
            city TEXT NOT NULL,
            address TEXT NOT NULL,
            property_type TEXT NOT NULL,
            bedrooms INTEGER NOT NULL,
            bathrooms REAL NOT NULL,
            area_sqft INTEGER NOT NULL,
            image_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_digest TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """
    )
    db.commit()
    seed_demo_data(db)
    db.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_minutes_iso(minutes: int) -> str:
    seconds = minutes * 60
    ts = datetime.now(timezone.utc).timestamp() + seconds
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def seed_demo_data(db: sqlite3.Connection) -> None:
    demo_email = "demo.agent@havenkeys.com"
    user_row = db.execute("SELECT id FROM users WHERE email = ?", (demo_email,)).fetchone()

    if user_row is None:
        cur = db.execute(
            "INSERT INTO users(name, email, password_hash, created_at) VALUES(?, ?, ?, ?)",
            ("HavenKeys Agent", demo_email, generate_password_hash("DemoPass123!"), now_iso()),
        )
        owner_id = cur.lastrowid
    else:
        owner_id = user_row[0]

    existing_titles = {row[0] for row in db.execute("SELECT title FROM listings").fetchall()}

    for item in SAMPLE_LISTINGS:
        if item["title"] in existing_titles:
            continue
        db.execute(
            """
            INSERT INTO listings(owner_id, title, description, price, city, address, property_type, bedrooms, bathrooms, area_sqft, image_url, created_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                owner_id,
                item["title"],
                item["description"],
                item["price"],
                item["city"],
                item["address"],
                item["property_type"],
                item["bedrooms"],
                item["bathrooms"],
                item["area_sqft"],
                item["image_url"],
                now_iso(),
            ),
        )
    db.commit()


def row_to_listing(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "owner_name": row["owner_name"],
        "title": row["title"],
        "description": row["description"],
        "price": row["price"],
        "city": row["city"],
        "address": row["address"],
        "property_type": row["property_type"],
        "bedrooms": row["bedrooms"],
        "bathrooms": row["bathrooms"],
        "area_sqft": row["area_sqft"],
        "image_url": row["image_url"],
        "created_at": row["created_at"],
    }


def current_user() -> dict | None:
    user_id = session.get("user_id")
    if not user_id:
        return None

    db = get_db()
    row = db.execute(
        "SELECT id, name, email, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if row is None:
        session.pop("user_id", None)
        return None

    return {"id": row["id"], "name": row["name"], "email": row["email"], "created_at": row["created_at"]}


def login_required(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            return jsonify({"error": "Authentication required"}), 401
        return handler(*args, **kwargs)

    return wrapped


@app.get("/api/health")
def health() -> tuple[dict, int]:
    return {"ok": True}, 200


@app.post("/api/auth/signup")
def signup():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    if len(name) < 2:
        return jsonify({"error": "Name must be at least 2 characters"}), 400
    if "@" not in email or "." not in email:
        return jsonify({"error": "Enter a valid email"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO users(name, email, password_hash, created_at) VALUES(?, ?, ?, ?)",
            (name, email, generate_password_hash(password), now_iso()),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409

    session["user_id"] = cur.lastrowid
    return jsonify({"user": current_user()}), 201


@app.post("/api/auth/signin")
def signin():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    db = get_db()
    row = db.execute(
        "SELECT id, password_hash FROM users WHERE email = ?",
        (email,),
    ).fetchone()

    if row is None or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = row["id"]
    return jsonify({"user": current_user()}), 200


@app.post("/api/auth/signout")
def signout():
    session.clear()
    return jsonify({"ok": True}), 200


@app.post("/api/auth/forgot-password")
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()

    if "@" not in email or "." not in email:
        return jsonify({"error": "Enter a valid email"}), 400

    db = get_db()
    user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    response = {"message": "If an account exists for this email, a reset link has been generated."}

    if user is None:
        return jsonify(response), 200

    raw_token = secrets.token_urlsafe(32)
    digest = token_digest(raw_token)
    expires_at = add_minutes_iso(RESET_TOKEN_TTL_MINUTES)
    now = now_iso()

    db.execute("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", (user["id"], now))
    db.execute(
        "INSERT INTO password_resets(user_id, token_digest, expires_at, used, created_at) VALUES(?, ?, ?, 0, ?)",
        (user["id"], digest, expires_at, now),
    )
    db.commit()

    response["reset_url"] = f"{request.host_url.rstrip('/')}/reset-password?token={raw_token}"
    response["expires_in_minutes"] = RESET_TOKEN_TTL_MINUTES
    return jsonify(response), 200


@app.post("/api/auth/reset-password")
def reset_password():
    payload = request.get_json(silent=True) or {}
    token = str(payload.get("token", "")).strip()
    password = str(payload.get("password", ""))

    if not token:
        return jsonify({"error": "Reset token is required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    db = get_db()
    row = db.execute(
        """
        SELECT pr.id AS reset_id, pr.user_id, pr.expires_at
        FROM password_resets pr
        WHERE pr.token_digest = ? AND pr.used = 0
        """,
        (token_digest(token),),
    ).fetchone()

    if row is None or row["expires_at"] < now_iso():
        return jsonify({"error": "Reset token is invalid or expired"}), 400

    db.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (generate_password_hash(password), row["user_id"]),
    )
    db.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row["reset_id"],))
    db.execute("DELETE FROM password_resets WHERE user_id = ? AND id != ?", (row["user_id"], row["reset_id"]))
    db.commit()
    return jsonify({"message": "Password reset successful. You can now sign in."}), 200


@app.get("/api/auth/me")
def me():
    user = current_user()
    if user is None:
        return jsonify({"user": None}), 200
    return jsonify({"user": user}), 200


@app.get("/api/listings")
def get_listings():
    q = str(request.args.get("q", "")).strip().lower()
    db = get_db()

    query = (
        "SELECT l.*, u.name AS owner_name FROM listings l "
        "JOIN users u ON u.id = l.owner_id "
    )
    params: tuple = ()

    if q:
        query += "WHERE lower(l.title) LIKE ? OR lower(l.city) LIKE ? OR lower(l.property_type) LIKE ? "
        params = (f"%{q}%", f"%{q}%", f"%{q}%")

    query += "ORDER BY l.created_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify({"listings": [row_to_listing(row) for row in rows]}), 200


@app.get("/api/listings/<int:listing_id>")
def get_listing(listing_id: int):
    db = get_db()
    row = db.execute(
        "SELECT l.*, u.name AS owner_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?",
        (listing_id,),
    ).fetchone()

    if row is None:
        return jsonify({"error": "Listing not found"}), 404

    return jsonify({"listing": row_to_listing(row)}), 200


@app.post("/api/listings")
@login_required
def create_listing():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    city = str(payload.get("city", "")).strip()
    address = str(payload.get("address", "")).strip()
    property_type = str(payload.get("property_type", "")).strip()
    image_url = str(payload.get("image_url", "")).strip() or None

    try:
        price = int(payload.get("price", 0))
        bedrooms = int(payload.get("bedrooms", 0))
        bathrooms = float(payload.get("bathrooms", 0))
        area_sqft = int(payload.get("area_sqft", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Numeric fields are invalid"}), 400

    if not all([title, description, city, address, property_type]):
        return jsonify({"error": "All text fields are required"}), 400
    if price <= 0 or bedrooms < 0 or bathrooms < 0 or area_sqft <= 0:
        return jsonify({"error": "Numeric values must be positive"}), 400

    user = current_user()
    db = get_db()
    cur = db.execute(
        """
        INSERT INTO listings(owner_id, title, description, price, city, address, property_type, bedrooms, bathrooms, area_sqft, image_url, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user["id"],
            title,
            description,
            price,
            city,
            address,
            property_type,
            bedrooms,
            bathrooms,
            area_sqft,
            image_url,
            now_iso(),
        ),
    )
    db.commit()

    row = db.execute(
        "SELECT l.*, u.name AS owner_name FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?",
        (cur.lastrowid,),
    ).fetchone()

    return jsonify({"listing": row_to_listing(row)}), 201


@app.get("/")
def root():
    return render_template("index.html")


@app.get("/<path:path>")
def spa_fallback(path: str):
    if path.startswith("api/"):
        abort(404)
    return render_template("index.html")


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
else:
    init_db()
