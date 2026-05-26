from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from app.config import Config
from app.database import db
from app.services.seed_service import seed_database
from app.routes.symbol_routes import symbols_bp
from app.routes.lesson_routes import lessons_bp
from app.routes.test_routes import tests_bp
from app.routes.result_routes import results_bp
from app.routes.scheme_routes import schemes_bp
from app.routes.quiz_routes import quiz_bp

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def create_app():
    app = Flask(__name__, static_folder="static")
    app.config.from_object(Config)
    CORS(app)
    db.init_app(app)

    app.register_blueprint(symbols_bp, url_prefix="/api")
    app.register_blueprint(lessons_bp, url_prefix="/api")
    app.register_blueprint(tests_bp, url_prefix="/api")
    app.register_blueprint(results_bp, url_prefix="/api")
    app.register_blueprint(schemes_bp, url_prefix="/api")
    app.register_blueprint(quiz_bp, url_prefix="/api")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "name": "Tactical Symbols Learning System"})

    if FRONTEND_DIST.exists():
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            file = FRONTEND_DIST / path
            if path and file.exists():
                return send_from_directory(FRONTEND_DIST, path)
            return send_from_directory(FRONTEND_DIST, "index.html")

    with app.app_context():
        db.create_all()
        seed_database(Path(app.config["UPLOAD_FOLDER"]))

    return app
