from flask import Blueprint, jsonify, request
from app.models import Category, Symbol

symbols_bp = Blueprint('symbols', __name__)

@symbols_bp.get('/categories')
def categories():
    return jsonify([c.to_dict() for c in Category.query.order_by(Category.name).all()])

@symbols_bp.get('/symbols')
def list_symbols():
    query = Symbol.query
    category_id = request.args.get('category_id', type=int)
    search = request.args.get('search', '').strip()
    limit = request.args.get('limit', type=int)
    if category_id:
        query = query.filter(Symbol.category_id == category_id)
    if search:
        like = f'%{search}%'
        query = query.filter(
            Symbol.name.ilike(like) |
            Symbol.description.ilike(like) |
            Symbol.notes.ilike(like)
        )
    query = query.order_by(Symbol.name)
    if limit:
        query = query.limit(limit)
    return jsonify([s.to_dict() for s in query.all()])
