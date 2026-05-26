from flask import Blueprint, jsonify, request
from app.database import db
from app.models import Result

results_bp = Blueprint("results", __name__)

@results_bp.get("/results")
def list_results():
    return jsonify([r.to_dict() for r in Result.query.order_by(Result.completed_at.desc()).all()])

@results_bp.post("/results")
def save_result():
    data = request.json or {}
    result = Result(user_id=data.get("user_id"), test_id=data["test_id"], score=float(data["score"]))
    db.session.add(result)
    db.session.commit()
    return jsonify(result.to_dict()), 201
