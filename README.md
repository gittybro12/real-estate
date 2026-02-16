# HavenKeys Real Estate App

Full-stack real estate marketplace using Flask (backend) and React (frontend).

## Features
- Sign up and sign in with secure password hashing.
- Forgot password and password reset via tokenized reset links.
- Session-based authentication.
- Welcome page explaining the service.
- Browse real estate listings with search.
- View detailed listing cards.
- Post real estate listings as an authenticated user.
- SQLite persistence (`real_estate.db`).

## Run
1. Install dependencies:
   - `python -m pip install -r requirements.txt`
2. Start server:
   - `python app.py`
3. Open in browser:
   - `http://127.0.0.1:5000`

## Deploy
### Render
1. Create a GitHub repo and push this project.
2. In Render, create a new Web Service from that repo.
3. Render will auto-detect `render.yaml`, or use:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`
4. Set environment variable:
   - `SECRET_KEY` = any long random string
5. Deploy.

### Railway / Other PaaS
- Uses `Procfile` with:
  - `web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`

### Docker
1. Build:
   - `docker build -t havenkeys .`
2. Run:
   - `docker run -p 8080:8080 -e SECRET_KEY=change-this havenkeys`

## API Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/signout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/listings`
- `GET /api/listings/<id>`
- `POST /api/listings`
