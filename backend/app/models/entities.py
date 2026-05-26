from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.database import db

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="student", nullable=False)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role}

class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    symbols = db.relationship("Symbol", backref="category", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description}

class Symbol(db.Model):
    __tablename__ = "symbols"
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    name = db.Column(db.String(180), nullable=False)
    image_path = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    usage_example = db.Column(db.Text, default="")
    notes = db.Column(db.Text, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
            "name": self.name,
            "image_path": self.image_path,
            "description": self.description,
            "usage_example": self.usage_example,
            "notes": self.notes,
        }

class Lesson(db.Model):
    __tablename__ = "lessons"
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    title = db.Column(db.String(180), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {"id": self.id, "category_id": self.category_id, "title": self.title, "content": self.content}

class Test(db.Model):
    __tablename__ = "tests"
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    title = db.Column(db.String(180), nullable=False)

    def to_dict(self):
        return {"id": self.id, "category_id": self.category_id, "title": self.title}

class Question(db.Model):
    __tablename__ = "questions"
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey("tests.id"), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(30), default="single_choice")
    correct_answer = db.Column(db.String(255), nullable=False)
    answers = db.relationship("Answer", backref="question", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_correct=False):
        data = {
            "id": self.id,
            "test_id": self.test_id,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "answers": [a.to_dict() for a in self.answers],
        }
        if include_correct:
            data["correct_answer"] = self.correct_answer
        return data

class Answer(db.Model):
    __tablename__ = "answers"
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id"), nullable=False)
    answer_text = db.Column(db.String(255), nullable=False)
    is_correct = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {"id": self.id, "answer_text": self.answer_text}

class Result(db.Model):
    __tablename__ = "results"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    test_id = db.Column(db.Integer, db.ForeignKey("tests.id"), nullable=False)
    score = db.Column(db.Float, nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "user_id": self.user_id, "test_id": self.test_id, "score": self.score, "completed_at": self.completed_at.isoformat()}

class Scheme(db.Model):
    __tablename__ = "schemes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    title = db.Column(db.String(180), nullable=False)
    scheme_data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "user_id": self.user_id, "title": self.title, "scheme_data": self.scheme_data, "created_at": self.created_at.isoformat()}
