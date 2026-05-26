from flask import Blueprint, jsonify, request
from app.models import Test, Question

tests_bp = Blueprint("tests", __name__)

@tests_bp.get("/tests")
def tests():
    return jsonify([t.to_dict() for t in Test.query.order_by(Test.id).all()])

@tests_bp.get("/tests/<int:test_id>/questions")
def questions(test_id):
    return jsonify([q.to_dict() for q in Question.query.filter_by(test_id=test_id).all()])

@tests_bp.post("/tests/<int:test_id>/check")
def check_test(test_id):
    data = request.json or {}
    answers = data.get("answers", {})
    questions = Question.query.filter_by(test_id=test_id).all()
    if not questions:
        return jsonify({"score": 0, "correct": 0, "total": 0})
    correct = 0
    details = []
    for q in questions:
        user_answer = answers.get(str(q.id)) or answers.get(q.id)
        is_correct = user_answer == q.correct_answer
        correct += int(is_correct)
        details.append({"question_id": q.id, "correct_answer": q.correct_answer, "user_answer": user_answer, "is_correct": is_correct})
    return jsonify({"score": round(correct / len(questions) * 100, 2), "correct": correct, "total": len(questions), "details": details})
