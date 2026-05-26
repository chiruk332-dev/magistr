from flask import Blueprint, jsonify
from app.models import Lesson

lessons_bp = Blueprint("lessons", __name__)

@lessons_bp.get("/lessons")
def lessons():
    return jsonify([l.to_dict() for l in Lesson.query.order_by(Lesson.id).all()])
