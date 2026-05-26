from flask import Blueprint, jsonify, request
from app.database import db
from app.models import Scheme

schemes_bp = Blueprint("schemes", __name__)

@schemes_bp.get("/schemes")
def list_schemes():
    return jsonify([s.to_dict() for s in Scheme.query.order_by(Scheme.created_at.desc()).all()])

@schemes_bp.post("/schemes")
def save_scheme():
    data = request.json or {}
    scheme = Scheme(user_id=data.get("user_id"), title=data.get("title", "Без назви"), scheme_data=data.get("scheme_data", "[]"))
    db.session.add(scheme)
    db.session.commit()
    return jsonify(scheme.to_dict()), 201
