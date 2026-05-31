import json
import shutil
from pathlib import Path
from app.database import db
from app.models import User, Category, Symbol, Lesson, Test, Question, Answer

BASE_DIR = Path(__file__).resolve().parents[3]
TACTICAL_SIGNS_PATH = BASE_DIR / 'data' / 'tactical_signs' / 'tactical_signs.json'
SIGN_IMAGES_DIR = BASE_DIR / 'data' / 'tactical_signs' / 'sign_images'

CATEGORY_DESCRIPTIONS = {
    'Пункти управління': 'Умовні знаки пунктів управління всіх рівнів, органів управління та пунктів спостереження.',
    'Сухопутні війська – загальновійськові частини': 'Умовні знаки загальновійськових підрозділів сухопутних військ та рубежів відкриття вогню.',
    'Сухопутні війська – РВіА': 'Умовні знаки ракетних військ та артилерійських підрозділів.',
    'Сухопутні війська – інженерні війська': 'Загородження, руйнування, проходи, мінування та інженерна обстановка.',
    'Сухопутні війська – ППО': 'Знаки підрозділів протиповітряної оборони сухопутних військ.',
    'Сухопутні війська – війська зв\'язку': 'Знаки підрозділів зв\'язку та вузлів зв\'язку.',
    'Сухопутні війська – ОВТ ЗСУ': 'Знаки озброєння та військової техніки сухопутних військ.',
    'Сухопутні війська – РХБЗ': 'Знаки радіаційного, хімічного та біологічного захисту.',
    'Повітряні сили – авіація': 'Знаки авіаційних підрозділів, типів повітряних суден та районів дій.',
    'Повітряні сили – ППО': 'Знаки зенітних ракетних підрозділів та позицій.',
    'Повітряні сили – зв\'язок та РТВ': 'Знаки підрозділів зв\'язку та радіотехнічних військ повітряних сил.',
    'Військово-Морські Сили': 'Умовні знаки Військово-Морських Сил ЗСУ.',
    'Десантно-штурмові війська': 'Знаки десантно-штурмових підрозділів.',
    'Сили спеціальних операцій': 'Умовні знаки сил спеціальних операцій.',
    'Медичні війська': 'Знаки медичних підрозділів та об\'єктів медичного забезпечення.',
    'Сили логістики': 'Знаки логістичних підрозділів, ремонту, відновлення та обслуговування ОВТ.',
    'Сили підтримки': 'Знаки підрозділів підтримки: переправи, метеозабезпечення, космічні засоби, кінологія тощо.',
    'Сухопутні війська – РЕБ': 'Знаки підрозділів радіоелектронної боротьби.',
    'Інше': 'Органи управління, суспільно-політична обстановка та інші умовні знаки.',
}


def seed_static_symbols(upload_folder: Path, catalog: list[dict]) -> None:
    upload_folder.mkdir(parents=True, exist_ok=True)
    for item in catalog:
        if not item['image_file']:
            continue
        src = SIGN_IMAGES_DIR / Path(item['image_file']).name
        dst = upload_folder / Path(item['image_file']).name
        if not dst.exists() and src.exists():
            shutil.copy2(src, dst)


def _load_catalog() -> list[dict]:
    if not TACTICAL_SIGNS_PATH.exists():
        return []
    raw = json.loads(TACTICAL_SIGNS_PATH.read_text(encoding='utf-8'))
    result = []
    for sign in raw.get('signs', []):
        image_file = sign.get('image_file') or ''
        color_info = sign.get('color', {})
        primary_color = color_info.get('primary', '') if isinstance(color_info, dict) else ''
        color_meaning = color_info.get('color_meaning', '') if isinstance(color_info, dict) else ''
        notes_parts = []
        if sign.get('section'):
            notes_parts.append(f"Розділ {sign['section']}: {sign.get('section_title', '')}")
        if primary_color:
            notes_parts.append(f"Колір: {primary_color} — {color_meaning}")
        if sign.get('doc_page'):
            notes_parts.append(f"Стор. документа: {sign['doc_page']}")
        if sign.get('notes'):
            notes_parts.append(sign['notes'])
        if image_file:
            image_path = f"/static/symbols/{Path(image_file).name}"
        else:
            image_path = '/static/symbols/placeholder.svg'
        result.append({
            'name': sign['name'],
            'category': sign.get('category', 'Інші умовні знаки'),
            'image_file': image_file,
            'image_path': image_path,
            'description': sign.get('section_title', ''),
            'notes': ' | '.join(notes_parts),
        })
    return result


def _reset_symbol_catalog(catalog: list[dict]) -> None:
    expected = len(catalog)
    existing = Symbol.query.count()
    expected_cats = {item['category'] for item in catalog}
    existing_cats = {c.name for c in Category.query.all()}
    if existing == expected and expected_cats == existing_cats:
        return
    Answer.query.delete()
    Question.query.delete()
    Test.query.delete()
    Lesson.query.delete()
    Symbol.query.delete()
    Category.query.delete()
    db.session.flush()

    categories = {}
    for name in sorted({item['category'] for item in catalog}):
        desc = CATEGORY_DESCRIPTIONS.get(name, 'Категорія умовних знаків.')
        c = Category(name=name, description=desc)
        db.session.add(c)
        categories[name] = c
    db.session.flush()

    for item in catalog:
        db.session.add(Symbol(
            category_id=categories[item['category']].id,
            name=item['name'],
            image_path=item['image_path'],
            description=item.get('description', ''),
            usage_example='Використовується під час навчального нанесення оперативної або тактичної обстановки на схему.',
            notes=item.get('notes', ''),
        ))

    lessons = [
        Lesson(title='Побудова та застосування умовних знаків', content='Система містить каталог умовних знаків за категоріями. Під час роботи зі схемою знак обирається з довідника, розміщується на топографічній основі та супроводжується підписом.'),
        Lesson(title='Оформлення графічної оперативної схеми', content='Оперативна обстановка має наноситися так, щоб не перевантажувати топографічну основу. Для навчальних цілей у редакторі використовується умовно згенерована карта з населеними пунктами, дорогами, річками, лісами та висотами.'),
        Lesson(title='Пошук знаків у каталозі', content='Для швидкого вибору знака використовуйте пошук за назвою, кодом або категорією. Це особливо важливо для великої бази умовних позначень.'),
    ]
    db.session.add_all(lessons)

    test = Test(title='Базовий тест з умовних знаків')
    db.session.add(test)
    db.session.flush()
    questions = [
        ('Для чого призначений довідник умовних знаків?', 'Для пошуку, вивчення і використання знаків під час оформлення схем', ['Для пошуку, вивчення і використання знаків під час оформлення схем', 'Для редагування паролів користувачів', 'Для налаштування сервера']),
        ('Що потрібно зробити перед нанесенням знака на схему?', 'Знайти потрібний знак у каталозі або через пошук', ['Знайти потрібний знак у каталозі або через пошук', 'Очистити всю базу даних', 'Вимкнути backend']),
        ('Що зберігається в редакторі оперативної схеми?', 'Положення доданих знаків на карті', ['Положення доданих знаків на карті', 'Тільки назва користувача', 'Лише список категорій']),
    ]
    for text, correct, variants in questions:
        q = Question(test_id=test.id, question_text=text, correct_answer=correct)
        db.session.add(q)
        db.session.flush()
        for v in variants:
            db.session.add(Answer(question_id=q.id, answer_text=v, is_correct=(v == correct)))


def seed_database(upload_folder: Path) -> None:
    catalog = _load_catalog()
    seed_static_symbols(upload_folder, catalog)

    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', role='admin')
        admin.set_password('admin123')
        student = User(username='student', role='student')
        student.set_password('student123')
        db.session.add_all([admin, student])
        db.session.flush()

    if catalog:
        _reset_symbol_catalog(catalog)

    db.session.commit()
