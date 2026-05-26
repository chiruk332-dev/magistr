import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ms from 'milsymbol';
import html2canvas from 'html2canvas';
import { api } from './api/client';
import './style.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Header({ page, setPage }) {
  const items = [
    ['catalog', 'Довідник'],
    ['tests', 'Тестування'],
    ['editor', 'Редактор схеми'],
  ];
  return <header><h1>ІС вивчення тактичних знаків</h1><nav>{items.map(([id, title]) => <button className={page===id?'active':''} onClick={() => setPage(id)} key={id}>{title}</button>)}</nav></header>;
}

const BADGE_PALETTE = [
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#dcfce7', color: '#166534' },
  { bg: '#fef9c3', color: '#854d0e' },
  { bg: '#fee2e2', color: '#991b1b' },
  { bg: '#f3e8ff', color: '#6b21a8' },
  { bg: '#ffedd5', color: '#9a3412' },
  { bg: '#cffafe', color: '#155e75' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#e0e7ff', color: '#3730a3' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#ede9fe', color: '#5b21b6' },
];

function badgeColor(category) {
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) & 0xffff;
  return BADGE_PALETTE[h % BADGE_PALETTE.length];
}

function CategoryBadge({ name }) {
  const { bg, color } = badgeColor(name);
  return <span className="badge" style={{ background: bg, color }} title={name}>{name}</span>;
}

function SymbolModal({ symbol, onClose }) {
  useEffect(() => {
    if (!symbol) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [symbol, onClose]);
  if (!symbol) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <img src={`${API_BASE}${symbol.image_path}`} alt={symbol.name} />
        <CategoryBadge name={symbol.category} />
        <h2>{symbol.name}</h2>
        {symbol.description && <p><b>Опис:</b> {symbol.description}</p>}
        {symbol.usage_example && <p><b>Застосування:</b> {symbol.usage_example}</p>}
        {symbol.notes && <p className="muted modal-notes">{symbol.notes}</p>}
      </div>
    </div>
  );
}

function Catalog() {
  const [symbols, setSymbols] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (cat) q.set('category_id', cat);
    api(`/symbols?${q}`)
      .then(data => { setSymbols(data); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [search, cat]);
  return (
    <section>
      <h2>Довідник тактичних знаків</h2>
      <p className="muted">
        {loading ? 'Завантаження…' : error ? `Помилка: ${error}` : `У базі: ${symbols.length} знаків${search || cat ? ' за поточним фільтром' : ''}.`}
      </p>
      <div className="filters">
        <input placeholder="Пошук за назвою, описом або кодом" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Усі категорії</option>
          {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid">
        {symbols.map(s => (
          <article className="card card--compact" key={s.id} onClick={() => setSelected(s)}>
            <img src={`${API_BASE}${s.image_path}`} alt={s.name} />
            <CategoryBadge name={s.category} />
            <h3>{s.name}</h3>
          </article>
        ))}
      </div>
      <SymbolModal symbol={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

// ── Тестування ─────────────────────────────────────────────────────────────

function ModeSelect({ onSelect }) {
  return (
    <section>
      <h2>Тестування</h2>
      <p className="muted">Оберіть режим роботи:</p>
      <div className="mode-cards">
        <article className="mode-card" onClick={() => onSelect('blitz')}>
          <div className="mode-icon">⚡</div>
          <h3>Бліц-знаки</h3>
          <p>Знак відображається без підпису. Спробуйте пригадати назву, потім перевірте себе. Не оцінюється.</p>
        </article>
        <article className="mode-card" onClick={() => onSelect('image')}>
          <div className="mode-icon">🔍</div>
          <h3>По назві</h3>
          <p>За назвою знаку оберіть правильне зображення з чотирьох варіантів.</p>
        </article>
        <article className="mode-card" onClick={() => onSelect('control')}>
          <div className="mode-icon">📋</div>
          <h3>Контрольний тест</h3>
          <p>20 запитань, 20 хвилин. Оцінюється за національною шкалою та ECTS.</p>
        </article>
      </div>
    </section>
  );
}

function BlitzMode({ onBack }) {
  const [symbol, setSymbol] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(0);

  async function next() {
    setSymbol(null);
    const s = await api('/quiz/random-symbol');
    setSymbol(s);
    setRevealed(false);
    setCount(c => c + 1);
  }

  useEffect(() => { next(); }, []);

  return (
    <section>
      <div className="quiz-topbar">
        <button onClick={onBack}>← Назад</button>
        <span className="muted">Переглянуто знаків: {count}</span>
      </div>
      <div className="blitz-wrap">
        {!symbol ? <p className="muted">Завантаження…</p> : (
          <div className="blitz-card">
            <img src={`${API_BASE}${symbol.image_path}`} alt="" />
            {revealed ? (
              <div className="blitz-answer">
                <CategoryBadge name={symbol.category} />
                <h2>{symbol.name}</h2>
                {symbol.description && <p className="muted">{symbol.description}</p>}
                <button className="btn-primary" onClick={next}>Наступний знак →</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setRevealed(true)}>Показати відповідь</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ImageChoiceMode({ onBack }) {
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  async function next() {
    setQuestion(null);
    setSelected(null);
    const q = await api('/quiz/image-choice');
    setQuestion(q);
  }

  useEffect(() => { next(); }, []);

  function choose(id) {
    if (selected !== null) return;
    setSelected(id);
    setTotal(t => t + 1);
    if (id === question.correct_id) setScore(s => s + 1);
  }

  const isCorrect = selected === question?.correct_id;

  return (
    <section>
      <div className="quiz-topbar">
        <button onClick={onBack}>← Назад</button>
        <span className="muted">Правильних: {score} / {total}</span>
      </div>
      <div className="image-choice-wrap">
        {!question ? <p className="muted">Завантаження…</p> : (
          <>
            <div className="image-choice-question">
              <CategoryBadge name={question.category} />
              <h2>{question.name}</h2>
              <p className="muted">Оберіть відповідне зображення:</p>
            </div>
            <div className="choices-grid">
              {question.options.map(opt => {
                let cls = 'choice-btn';
                if (selected !== null) {
                  if (opt.id === question.correct_id) cls += ' choice-correct';
                  else if (opt.id === selected) cls += ' choice-wrong';
                }
                return (
                  <button key={opt.id} className={cls} onClick={() => choose(opt.id)}>
                    <img src={`${API_BASE}${opt.image_path}`} alt="" />
                  </button>
                );
              })}
            </div>
            {selected !== null && (
              <div className="choice-feedback">
                <span className={isCorrect ? 'feedback-ok' : 'feedback-err'}>
                  {isCorrect ? '✓ Правильно!' : '✗ Неправильно'}
                </span>
                <button className="btn-primary" onClick={next}>Наступне питання →</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function nationalScale(score) {
  if (score >= 90) return '5 — Відмінно';
  if (score >= 75) return '4 — Добре';
  if (score >= 60) return '3 — Задовільно';
  return '2 — Незадовільно';
}

function ectsScale(score) {
  if (score >= 90) return 'A — Відмінно';
  if (score >= 82) return 'B — Дуже добре';
  if (score >= 74) return 'C — Добре';
  if (score >= 64) return 'D — Задовільно';
  if (score >= 60) return 'E — Достатньо';
  if (score >= 35) return 'FX — Незадовільно (можна перескласти)';
  return 'F — Незадовільно (необхідне повторне навчання)';
}

function ControlTest({ onBack }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [started, setStarted] = useState(false);

  useEffect(() => { api('/quiz/control-questions').then(setQuestions); }, []);

  useEffect(() => {
    if (!started || submitted) return;
    if (timeLeft <= 0) { setSubmitted(true); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, submitted, timeLeft]);

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const answered = Object.keys(answers).length;

  function setAnswer(i, value) {
    setAnswers(prev => ({ ...prev, [i]: value }));
  }

  function calcScore() {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length;
    return { points: correct * 5, correct };
  }

  if (questions.length === 0) return <section><p className="muted">Завантаження…</p></section>;

  if (!started) {
    return (
      <section>
        <div className="quiz-topbar"><button onClick={onBack}>← Назад</button></div>
        <div className="control-intro">
          <h2>Контрольний тест</h2>
          <ul>
            <li>20 запитань з 4 варіантами відповіді</li>
            <li>60% запитань — визначення знаку за зображенням або навпаки</li>
            <li>Час: 20 хвилин</li>
            <li>Кожна правильна відповідь: 5 балів (максимум 100)</li>
            <li>Питання можна відповідати в будь-якому порядку</li>
          </ul>
          <button className="btn-primary" onClick={() => setStarted(true)}>Почати тест</button>
        </div>
      </section>
    );
  }

  if (submitted) {
    const { points, correct } = calcScore();
    return (
      <section>
        <h2>Результати тесту</h2>
        <div className="result-card">
          <div className="result-score">{points}<span>/100</span></div>
          <div className="result-detail">Правильних відповідей: <b>{correct} з 20</b></div>
          <div className="result-scales">
            <div className="scale-row">
              <span className="scale-label">Національна шкала</span>
              <span className="scale-value">{nationalScale(points)}</span>
            </div>
            <div className="scale-row">
              <span className="scale-label">ECTS</span>
              <span className="scale-value">{ectsScale(points)}</span>
            </div>
          </div>
        </div>

        <h3 className="review-heading">Розбір відповідей</h3>
        <div className="review-list">
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correct;
            const unanswered = userAnswer === undefined;
            return (
              <article key={i} className={`review-item${isCorrect ? ' review-ok' : ' review-err'}`}>
                <div className="review-num">{isCorrect ? '✓' : '✗'}</div>
                <div className="review-body">
                  <p className="review-q"><b>{i + 1}.</b> {q.text}</p>

                  {q.type === 'name_to_image' ? (
                    <div className="review-images">
                      <div className="review-img-wrap">
                        <span className="review-img-label correct-label">Правильно</span>
                        <img src={`${API_BASE}${q.correct}`} alt="" />
                      </div>
                      {!isCorrect && !unanswered && (
                        <div className="review-img-wrap">
                          <span className="review-img-label wrong-label">Ваша відповідь</span>
                          <img src={`${API_BASE}${userAnswer}`} alt="" />
                        </div>
                      )}
                    </div>
                  ) : q.type === 'image_to_name' ? (
                    <div className="review-image-question">
                      <img src={`${API_BASE}${q.image}`} className="review-sign-img" alt="" />
                      <div className="review-answers">
                        <div className="review-answer correct-label">✓ {q.correct}</div>
                        {!isCorrect && !unanswered && <div className="review-answer wrong-label">✗ {userAnswer}</div>}
                        {unanswered && <div className="review-answer skipped-label">— Не відповіли</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="review-answers">
                      <div className="review-answer correct-label">✓ {q.correct}</div>
                      {!isCorrect && !unanswered && <div className="review-answer wrong-label">✗ {userAnswer}</div>}
                      {unanswered && <div className="review-answer skipped-label">— Не відповіли</div>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <button onClick={onBack}>← До вибору режиму</button>
      </section>
    );
  }

  const q = questions[current];

  return (
    <section>
      <div className="quiz-topbar control-topbar">
        <button onClick={onBack}>← Вийти</button>
        <span className="muted">{answered}/20 відповідей</span>
        <span className={`timer${timeLeft < 120 ? ' timer-warn' : ''}`}>{minutes}:{seconds}</span>
      </div>

      <div className="question-tabs">
        {questions.map((_, i) => {
          let cls = 'qtab';
          if (i === current) cls += answers[i] !== undefined ? ' qtab-current qtab-done' : ' qtab-current';
          else if (answers[i] !== undefined) cls += ' qtab-done';
          return <button key={i} className={cls} onClick={() => setCurrent(i)}>{i + 1}</button>;
        })}
      </div>

      <div className="question-card">
        {q.image && (
          <div className="question-img-wrap">
            <img src={`${API_BASE}${q.image}`} className="question-img" alt="" />
          </div>
        )}
        <p className="question-text"><b>{current + 1}.</b> {q.text}</p>

        {q.type === 'name_to_image' ? (
          <div className="choices-grid">
            {q.options.map(opt => (
              <button
                key={opt.id}
                className={`choice-btn${answers[current] === opt.image_path ? ' choice-selected' : ''}`}
                onClick={() => setAnswer(current, opt.image_path)}
              >
                <img src={`${API_BASE}${opt.image_path}`} alt="" />
              </button>
            ))}
          </div>
        ) : (
          <div className="question-options">
            {q.options.map((opt, j) => (
              <label key={j} className={`option-label${answers[current] === opt ? ' option-selected' : ''}`}>
                <input type="radio" name={`q${current}`} checked={answers[current] === opt} onChange={() => setAnswer(current, opt)} />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="question-nav">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>← Попереднє</button>
        <button className="btn-primary" onClick={() => setSubmitted(true)}>Завершити тест</button>
        <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>Наступне →</button>
      </div>
    </section>
  );
}

function Tests() {
  const [mode, setMode] = useState(null);
  if (mode === 'blitz') return <BlitzMode onBack={() => setMode(null)} />;
  if (mode === 'image') return <ImageChoiceMode onBack={() => setMode(null)} />;
  if (mode === 'control') return <ControlTest onBack={() => setMode(null)} />;
  return <ModeSelect onSelect={setMode} />;
}

// ── Leaflet map ─────────────────────────────────────────────────────────────

// ── MIL-STD-2525D / APP-6D (milsymbol.js) ──────────────────────────────────

const MS_AFFL = [
  { code: 'F', label: 'Свої',       color: '#004F9F' },
  { code: 'H', label: 'Противник',  color: '#C0392B' },
  { code: 'N', label: 'Нейтральний',color: '#27AE60' },
  { code: 'U', label: 'Невідомий',  color: '#7D6608' },
];

// APP-6D / MIL-STD-2525D: symbolmodifier12 (позиція 11 SIDC)
const MS_ECHELONS = [
  { code: 'A', label: 'Розрахунок / Екіпаж'  },  // Team/Crew      ●
  { code: 'B', label: 'Відділення'           },  // Squad          ●●
  { code: 'C', label: 'Секція'               },  // Section        ●●●
  { code: 'D', label: 'Взвод'                },  // Platoon        |
  { code: 'E', label: 'Рота / Батарея'       },  // Company        ||
  { code: 'F', label: 'Батальйон / Дивізіон' },  // Battalion      |||
  { code: 'G', label: 'Полк / Група'         },  // Regiment       I
  { code: 'H', label: 'Бригада'              },  // Brigade        X
  { code: 'I', label: 'Дивізія'              },  // Division       XX
  { code: 'J', label: 'Корпус'               },  // Corps          XXX
  { code: 'K', label: 'Армія'                },  // Army           XXXX
];

const MS_DOMAINS = [
  { code: 'G', label: 'Сухопутні' },
  { code: 'A', label: 'Повітряні' },
  { code: 'S', label: 'Морські'   },
];

const MS_FUNCS = {
  G: [
    { id: 'UCI---', label: 'Піхота'           },
    { id: 'UCIM--', label: 'Мех. піхота'      },
    { id: 'UCA---', label: 'Бронетанкові'     },
    { id: 'UCFS--', label: 'Артилерія'        },
    { id: 'UCFR--', label: 'Рект. артилерія'  },
    { id: 'UCE---', label: 'Інженерні'        },
    { id: 'UCD---', label: 'ППО'              },
    { id: 'UCR---', label: 'Розвідка'         },
    { id: 'USXE--', label: 'РЕБ'             },
    { id: 'USXR--', label: 'РХБ'             },
    { id: 'UCS---', label: 'ССО'              },
    { id: 'UCAA--', label: 'ДШВ'              },
    { id: 'USS---', label: "Зв'язок"          },
    { id: 'UST---', label: 'Пункт управл.'    },
    { id: 'UH----', label: 'Медичний'         },
    { id: 'USAL--', label: 'Логістика'        },
  ],
  A: [
    { id: 'MFF---', label: 'Винищувач'        },
    { id: 'MFA---', label: 'Штурмовик'        },
    { id: 'MFB---', label: 'Бомбардувальник'  },
    { id: 'MH----', label: 'Вертоліт'         },
    { id: 'MHA---', label: 'Ударний вертоліт' },
    { id: 'MFQ---', label: 'БПЛА'             },
  ],
  S: [
    { id: 'CLFF--', label: 'Фрегат'          },
    { id: 'CLDD--', label: 'Есмінець'        },
    { id: 'CLCC--', label: 'Крейсер'         },
    { id: 'CLBB--', label: 'Лінкор'          },
    { id: 'CPSB--', label: 'Патрульний катер'},
    { id: 'CMMA--', label: 'Мінний загородж.'},
  ],
};

function buildSIDC(aff, dim, funcId, echelon = '-') {
  // 15-char SIDC: S{aff}{dim}P{funcId(6)}-{echelon}---
  // Echelon кодується в позиції 11 (symbolmodifier12)
  return `S${aff}${dim}P${funcId.padEnd(6, '-')}-${echelon}---`;
}

function milsymLabel(aff, dim, funcId, echelon) {
  const a = MS_AFFL.find(x => x.code === aff)?.label || aff;
  const f = (MS_FUNCS[dim] || []).find(x => x.id === funcId)?.label || funcId;
  const e = MS_ECHELONS.find(x => x.code === echelon)?.label || '';
  return `${a} • ${f} • ${e}`;
}

const SCALES = [
  { label: '1:25 000',    zoom: 14 },
  { label: '1:50 000',    zoom: 13 },
  { label: '1:100 000',   zoom: 12 },
  { label: '1:200 000',   zoom: 11 },
  { label: '1:500 000',   zoom: 9  },
  { label: '1:1 000 000', zoom: 8  },
];

const RU_BORDER_CENTERS = [
  { name: 'Бєлгород',      ll: [50.60, 36.59] },
  { name: 'Курськ',         ll: [51.73, 36.19] },
  { name: 'Брянськ',        ll: [53.24, 34.37] },
  { name: 'Вороніж',        ll: [51.67, 39.21] },
  { name: 'Ростов-на-Дону', ll: [47.22, 39.72] },
  { name: 'Таганрог',       ll: [47.21, 38.94] },
  { name: 'Валуйки',        ll: [50.21, 38.11] },
  { name: 'Стародуб',       ll: [52.58, 32.77] },
];

function markerIcon(item, selected) {
  const rot = item.rotation || 0;
  const ring = selected ? 'outline:2.5px solid #1565c0;outline-offset:2px;border-radius:4px;' : '';

  if (item.type === 'milsym') {
    try {
      const sym = new ms.Symbol(item.sidc, {
        size: item.size || 40,
        uniqueDesignation: item.modifiers?.designation || '',
        higherFormation:   item.modifiers?.higher      || '',
      });
      const { width, height } = sym.getSize();
      return L.divIcon({
        className: '',
        html: `<div style="transform:rotate(${rot}deg);display:inline-block;${ring}">${sym.asSVG()}</div>`,
        iconSize:   [width, height],
        iconAnchor: [width / 2, height / 2],
      });
    } catch {
      return L.divIcon({
        className: '',
        html: `<div style="width:40px;height:40px;background:#eee;border:2px solid #999;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px">?</div>`,
        iconSize: [40, 40], iconAnchor: [20, 20],
      });
    }
  }

  // PNG symbol
  const sz = item.size || 60;
  return L.divIcon({
    className: '',
    html: `<img src="${API_BASE}${item.image_path}"
      style="width:${sz}px;height:${sz}px;object-fit:contain;
             transform:rotate(${rot}deg);display:block;${ring}"/>`,
    iconSize:   [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  });
}

function LeafletMap({ items, activeSymbol, selectedId, onPlace, onMove, onSelect, scaleRef, jumpRef, defaultZoom }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const activeRef    = useRef(activeSymbol);
  const onPlaceRef   = useRef(onPlace);
  const onMoveRef    = useRef(onMove);
  const onSelectRef  = useRef(onSelect);

  useEffect(() => { activeRef.current  = activeSymbol; }, [activeSymbol]);
  useEffect(() => { onPlaceRef.current = onPlace;      }, [onPlace]);
  useEffect(() => { onMoveRef.current  = onMove;       }, [onMove]);
  useEffect(() => { onSelectRef.current = onSelect;    }, [onSelect]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: RU_BORDER_CENTERS[0].ll,
      zoom: defaultZoom || 12,
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> | © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 17,
    }).addTo(map);

    map.on('click', (e) => {
      if (activeRef.current) onPlaceRef.current(e.latlng.lat, e.latlng.lng);
      else onSelectRef.current(null);
    });

    if (scaleRef) scaleRef.current = (zoom) => map.setZoom(zoom);
    if (jumpRef)  jumpRef.current  = (idx)  => map.setView(RU_BORDER_CENTERS[idx || 0].ll, map.getZoom());

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (containerRef.current)
      containerRef.current.style.cursor = activeSymbol ? 'crosshair' : '';
  }, [activeSymbol]);

  useEffect(() => {
    if (!mapRef.current) return;
    const ids = new Set(items.map(it => String(it.id)));

    Object.keys(markersRef.current).forEach(id => {
      if (!ids.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });

    items.forEach(item => {
      const id = String(item.id);
      const sel = id === String(selectedId);
      const existing = markersRef.current[id];
      if (existing) { existing.setIcon(markerIcon(item, sel)); return; }

      const marker = L.marker([item.lat, item.lng], { icon: markerIcon(item, sel), draggable: true });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const px   = mapRef.current.latLngToContainerPoint(marker.getLatLng());
        const rect = containerRef.current.getBoundingClientRect();
        onSelectRef.current(item.id, { x: rect.left + px.x, y: rect.top + px.y });
      });
      marker.on('dragend', () => { const p = marker.getLatLng(); onMoveRef.current(item.id, p.lat, p.lng); });
      marker.addTo(mapRef.current);
      markersRef.current[id] = marker;
    });
  }, [items, selectedId]);

  return <div ref={containerRef} className="leaflet-canvas"/>;
}

function _Unused({ seed }) {
  const W = 1000, H = 620;

  const map = useMemo(() => {
    let s = Math.abs((seed || 17) | 0);
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const R  = (a, b) => a + rnd() * (b - a);
    const RI = (a, b) => Math.floor(R(a, b + 0.99));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const shuffle = arr => { const a = [...arr]; for (let i = a.length-1; i>0; i--) { const j=RI(0,i); [a[i],a[j]]=[a[j],a[i]]; } return a; };

    const NAMES   = shuffle(['ЛАНДИРІ','СОСНИ','ВЕСЕЛЕ','ДУБИ','МАЛИН','ПІСКИ','КОДНЯ','ВІЛЬНЕ','КРАСНЕ','РОМНИ','ОЗЕРНЕ','СТАРКИ','ЧЕРНЯХІВ','ТУПИЧІВ','ХОРОШІВ']);
    const RIVERS  = ['р. Случ','р. Тетерів','р. Ірша','р. Уж','р. Здвиж'];
    const MARSHES = ['болото Велике','болото Чорне'];

    // ── Горизонталі: декілька горбів ──────────────────────────────────────
    const hills = Array.from({ length: RI(3,5) }, () => ({
      cx: R(120,880), cy: R(90,530),
      rx: R(65,155), ry: R(50,115),
      rot: R(0,175),
      top: RI(140,430),
      step: RI(10,20),
      levels: RI(3,6),
    }));

    // ── Ліси ──────────────────────────────────────────────────────────────
    const forests = Array.from({ length: RI(3,5) }, () => {
      const fcx=R(60,940), fcy=R(60,560), n=RI(7,11);
      return Array.from({ length:n }, (_,j) => {
        const a = (j/n)*Math.PI*2 + R(-0.3,0.3), r=R(38,100);
        return [clamp(fcx+Math.cos(a)*r*R(0.7,1.4),5,W-5), clamp(fcy+Math.sin(a)*r*R(0.6,1.3),5,H-5)];
      });
    });

    // ── Озеро ─────────────────────────────────────────────────────────────
    const lake = rnd()>0.45 ? { cx:R(160,840), cy:R(120,500), rx:R(22,52), ry:R(14,36), rot:R(0,170) } : null;

    // ── Болото ────────────────────────────────────────────────────────────
    const marsh = rnd()>0.55 ? { x:R(60,800), y:R(60,500), w:R(60,130), h:R(35,70) } : null;

    // ── Головна річка ─────────────────────────────────────────────────────
    const riverPts = [];
    let rx=R(-10,80), ry=R(170,450);
    riverPts.push([rx,ry]);
    for (let i=0;i<7;i++) {
      rx=clamp(rx+R(100,180),0,W+30);
      ry=clamp(ry+R(-90,90),30,H-30);
      riverPts.push([rx,ry]);
    }

    // ── Притока ───────────────────────────────────────────────────────────
    const tribPts = [];
    let tx=R(riverPts[1][0]-20,riverPts[2][0]), ty=R(15,riverPts[1][1]-40);
    tribPts.push([tx,ty]);
    for (let i=0;i<3;i++) { tx=clamp(tx+R(50,100),0,W); ty=clamp(ty+R(25,70),15,ry); tribPts.push([tx,ty]); }
    tribPts.push([riverPts[2][0]+R(-15,15), riverPts[2][1]]);

    // ── Дороги ────────────────────────────────────────────────────────────
    const mainRoad = [[0, R(200,400)]];
    for (let i=0;i<5;i++) { const l=mainRoad[mainRoad.length-1]; mainRoad.push([clamp(l[0]+R(150,220),0,W+20), clamp(l[1]+R(-70,70),30,H-30)]); }

    const secRoads = Array.from({ length:RI(2,4) }, () => {
      const pts=[[R(0,250),R(40,580)]];
      for (let i=0;i<RI(3,5);i++) { const l=pts[pts.length-1]; pts.push([clamp(l[0]+R(110,200),0,W), clamp(l[1]+R(-100,100),20,H-20)]); }
      return pts;
    });

    const trackRoad = [[R(0,300),R(60,560)]];
    for (let i=0;i<4;i++) { const l=trackRoad[trackRoad.length-1]; trackRoad.push([clamp(l[0]+R(80,160),0,W), clamp(l[1]+R(-80,80),20,H-20)]); }

    // ── Населені пункти ───────────────────────────────────────────────────
    const settlements = Array.from({ length:RI(5,8) }, (_,i) => ({
      name: NAMES[i], x:R(30,970), y:R(30,590), isCity: rnd()>0.6,
    }));

    // ── Відмітки висот ────────────────────────────────────────────────────
    const spots = Array.from({ length:RI(4,8) }, () => ({ x:R(50,950), y:R(50,570), h:RI(80,460) }));

    // ── Координатна сітка ─────────────────────────────────────────────────
    const gx0 = RI(36,50)*100, gy0 = RI(58,66)*100;

    return { hills, forests, lake, marsh, riverPts, tribPts, mainRoad, secRoads, trackRoad, settlements, spots, gx0, gy0,
      riverName: RIVERS[RI(0,RIVERS.length-1)], marshName: MARSHES[RI(0,MARSHES.length-1)] };
  }, [seed]);

  // ── SVG-хелпери ───────────────────────────────────────────────────────────
  function openPath(pts) {
    if (pts.length<2) return '';
    let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i=1;i<pts.length-1;i++) {
      const mx=((pts[i][0]+pts[i+1][0])/2).toFixed(1), my=((pts[i][1]+pts[i+1][1])/2).toFixed(1);
      d+=` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx},${my}`;
    }
    const l=pts[pts.length-1]; return d+` L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
  }

  function closedPath(pts) {
    const n=pts.length; if(n<3) return '';
    const mids=pts.map((_,i)=>[((pts[i][0]+pts[(i+1)%n][0])/2),((pts[i][1]+pts[(i+1)%n][1])/2)]);
    let d=`M${mids[0][0].toFixed(1)},${mids[0][1].toFixed(1)}`;
    for (let i=0;i<n;i++) {
      const cp=pts[(i+1)%n], ep=mids[(i+1)%n];
      d+=` Q${cp[0].toFixed(1)},${cp[1].toFixed(1)} ${ep[0].toFixed(1)},${ep[1].toFixed(1)}`;
    }
    return d+' Z';
  }

  const gxLines=[100,200,300,400,500,600,700,800,900];
  const gyLines=[100,200,300,400,500];

  return (
    <svg className="topo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <pattern id="topoForest" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="2" fill="#4a7a3a" opacity="0.45"/>
        </pattern>
        <pattern id="topoMarsh" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="5" x2="10" y2="5" stroke="#4a90c4" strokeWidth="0.7" opacity="0.6"/>
          <circle cx="2.5" cy="2" r="1" fill="#4a90c4" opacity="0.5"/>
          <circle cx="7.5" cy="8" r="1" fill="#4a90c4" opacity="0.5"/>
        </pattern>
        <path id="rpath" d={openPath(map.riverPts)}/>
      </defs>

      {/* Фон */}
      <rect width={W} height={H} fill="#f0ebe0"/>

      {/* Координатна сітка */}
      <g stroke="#7090b8" strokeWidth="0.45" opacity="0.4">
        {gxLines.map(v=><line key={`gx${v}`} x1={v} y1={0} x2={v} y2={H}/>)}
        {gyLines.map(v=><line key={`gy${v}`} x1={0} y1={v} x2={W} y2={v}/>)}
      </g>
      {gxLines.map((v,i)=><text key={i} x={v} y={H-3} textAnchor="middle" fontSize="9" fill="#4a6080" fontFamily="Arial">{map.gx0/100+i+1}</text>)}
      {gyLines.map((v,i)=><text key={i} x={3} y={v} fontSize="9" fill="#4a6080" fontFamily="Arial" dominantBaseline="middle">{map.gy0/100+gyLines.length-i}</text>)}

      {/* Ліси */}
      {map.forests.map((pts,i)=>(
        <g key={i}>
          <path d={closedPath(pts)} fill="#c4dba5" stroke="#78a852" strokeWidth="0.9"/>
          <path d={closedPath(pts)} fill="url(#topoForest)"/>
        </g>
      ))}

      {/* Болото */}
      {map.marsh && (
        <g>
          <rect x={map.marsh.x} y={map.marsh.y} width={map.marsh.w} height={map.marsh.h} fill="url(#topoMarsh)" stroke="#4a90c4" strokeWidth="0.6" opacity="0.8"/>
          <text x={map.marsh.x+map.marsh.w/2} y={map.marsh.y+map.marsh.h/2+4} textAnchor="middle" fontSize="9" fontStyle="italic" fill="#3060a0" fontFamily="Arial">{map.marshName}</text>
        </g>
      )}

      {/* Озеро */}
      {map.lake && (
        <ellipse cx={map.lake.cx} cy={map.lake.cy} rx={map.lake.rx} ry={map.lake.ry}
          fill="#b0d0ec" stroke="#4a88c0" strokeWidth="1.2"
          transform={`rotate(${map.lake.rot} ${map.lake.cx} ${map.lake.cy})`}/>
      )}

      {/* Горизонталі */}
      {map.hills.map((h,hi)=>
        Array.from({length:h.levels},(_,lvl)=>{
          const t=(h.levels-lvl)/h.levels;
          const isIdx=lvl%4===0;
          const elev=Math.round(h.top - lvl*h.step);
          return (
            <g key={`${hi}-${lvl}`}>
              <ellipse cx={h.cx} cy={h.cy} rx={h.rx*t} ry={h.ry*t}
                fill="none" stroke="#c47830"
                strokeWidth={isIdx?1.7:0.85} opacity={0.6+lvl*0.05}
                transform={`rotate(${h.rot} ${h.cx} ${h.cy})`}/>
              {isIdx && h.rx*t>40 && (
                <text fontSize="8.5" fill="#a05c18" fontFamily="Arial" opacity="0.9"
                  transform={`rotate(${h.rot} ${h.cx} ${h.cy}) translate(${h.cx+h.rx*t*0.5} ${h.cy})`}>
                  {elev}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Притока */}
      <path d={openPath(map.tribPts)} fill="none" stroke="#4a88c4" strokeWidth="1.8" strokeLinecap="round" opacity="0.75"/>

      {/* Головна річка */}
      <path d={openPath(map.riverPts)} fill="none" stroke="#3a78b8" strokeWidth="5.5" strokeLinecap="round" opacity="0.65"/>
      <path d={openPath(map.riverPts)} fill="none" stroke="#90bce0" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>

      {/* Підпис річки */}
      <text fontSize="10" fontStyle="italic" fill="#2a60a0" fontFamily="Arial" opacity="0.85">
        <textPath href="#rpath" startOffset="38%">{map.riverName}</textPath>
      </text>

      {/* Просілки (пунктир) */}
      <path d={openPath(map.trackRoad)} fill="none" stroke="#9a7848" strokeWidth="1.5" strokeDasharray="8 5" strokeLinecap="round" opacity="0.7"/>

      {/* Другорядні дороги */}
      {map.secRoads.map((pts,i)=>(
        <g key={i}>
          <path d={openPath(pts)} fill="none" stroke="#c8a830" strokeWidth="4.5" strokeLinecap="round"/>
          <path d={openPath(pts)} fill="none" stroke="#f0d860" strokeWidth="2.5" strokeLinecap="round"/>
        </g>
      ))}

      {/* Головна дорога */}
      <path d={openPath(map.mainRoad)} fill="none" stroke="#b04020" strokeWidth="7" strokeLinecap="round"/>
      <path d={openPath(map.mainRoad)} fill="none" stroke="#f07040" strokeWidth="4.5" strokeLinecap="round"/>

      {/* Населені пункти */}
      {map.settlements.map((t,i)=>(
        <g key={i}>
          {t.isCity
            ? <rect x={t.x-6} y={t.y-6} width={12} height={12} fill="#111" rx="1"/>
            : <circle cx={t.x} cy={t.y} r={4.5} fill="#111"/>}
          <text x={t.x+(t.isCity?10:8)} y={t.y+4}
            fontSize={t.isCity?13:11} fontFamily="Arial"
            fontWeight={t.isCity?'700':'400'} fill="#111">
            {t.name}
          </text>
        </g>
      ))}

      {/* Відмітки висот */}
      {map.spots.map((s,i)=>(
        <g key={i}>
          <path d={`M${s.x},${s.y-5} L${s.x-3.5},${s.y+3} L${s.x+3.5},${s.y+3}Z`} fill="#8a5010"/>
          <text x={s.x+5} y={s.y+2} fontSize="9" fontFamily="Arial" fill="#6a3c08">{s.h}</text>
        </g>
      ))}

      {/* Рамка */}
      <rect width={W} height={H} fill="none" stroke="#2a2520" strokeWidth="2.5"/>
    </svg>
  );
}

// ── MilSym Panel (NATO знаки) ────────────────────────────────────────────────
function MilSymPanel({ onUpdate, paused }) {
  const [aff,    setAff]    = useState('F');
  const [domain, setDomain] = useState('G');
  const [funcId, setFuncId] = useState('UCI---');
  const [echelon,setEchelon]= useState('E');
  const [desig,  setDesig]  = useState('');
  const [higher, setHigher] = useState('');

  const sidc  = buildSIDC(aff, domain, funcId, echelon);
  const funcs = MS_FUNCS[domain] || [];

  // Автоматично оновлюємо activeSym при кожній зміні параметрів
  useEffect(() => {
    if (paused) return;
    onUpdate({ _ms: true, sidc, echelon, modifiers: { designation: desig, higher },
               label: milsymLabel(aff, domain, funcId, echelon), size: 40, rotation: 0 });
  }, [sidc, echelon, desig, higher, paused]);

  const previewSvg = useMemo(() => {
    try {
      return new ms.Symbol(sidc, { size: 60, uniqueDesignation: desig, higherFormation: higher }).asSVG();
    } catch { return ''; }
  }, [sidc, echelon, desig, higher]);

  function changeDomain(code) {
    setDomain(code);
    setFuncId((MS_FUNCS[code] || [])[0]?.id || '');
  }

  return (
    <div className="ms-panel">
      <div className="ms-sec">
        <div className="ms-lbl">Приналежність</div>
        <div className="ms-affl-row">
          {MS_AFFL.map(a => (
            <button key={a.code}
              className={`ms-affl-btn${aff === a.code ? ' ms-on' : ''}`}
              style={aff === a.code ? { borderColor: a.color, color: a.color, background: a.color + '18' } : {}}
              onClick={() => setAff(a.code)}>{a.label}</button>
          ))}
        </div>
      </div>

      <div className="ms-sec">
        <div className="ms-lbl">Сфера</div>
        <div className="ms-domain-row">
          {MS_DOMAINS.map(d => (
            <button key={d.code}
              className={`ms-domain-btn${domain === d.code ? ' ms-on' : ''}`}
              onClick={() => changeDomain(d.code)}>{d.label}</button>
          ))}
        </div>
      </div>

      <div className="ms-sec">
        <div className="ms-lbl">Тип підрозділу</div>
        <div className="ms-funcs-grid">
          {funcs.map(f => (
            <button key={f.id}
              className={`ms-func-btn${funcId === f.id ? ' ms-on' : ''}`}
              onClick={() => setFuncId(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="ms-sec">
        <div className="ms-lbl">Рівень</div>
        <div className="ms-ech-col">
          {MS_ECHELONS.map(e => (
            <button key={e.code}
              className={`ms-ech-btn${echelon === e.code ? ' ms-on' : ''}`}
              onClick={() => setEchelon(e.code)}>{e.label}</button>
          ))}
        </div>
      </div>

      <div className="ms-sec">
        <input className="ms-input" placeholder="Позначення підрозділу (напр. 72 ОМБр)" value={desig}  onChange={e => setDesig(e.target.value)}  />
        <input className="ms-input" placeholder="Вища формація"                          value={higher} onChange={e => setHigher(e.target.value)} />
      </div>

      <div className="ms-preview">
        {previewSvg && <div dangerouslySetInnerHTML={{ __html: previewSvg }} />}
        {!paused && <p className="ms-hint">Клацніть на карті для розміщення</p>}
      </div>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────
function Editor() {
  const [symbols,    setSymbols]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [items,      setItems]      = useState([]);
  const [title,      setTitle]      = useState('Навчальна схема');
  const [search,     setSearch]     = useState('');
  const [cat,        setCat]        = useState('');
  const [activeSym,  setActiveSym]  = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [popupPos,   setPopupPos]   = useState(null);
  const [scale,      setScale]      = useState('1:100 000');
  const [locIdx,     setLocIdx]     = useState(0);
  const [sideTab,    setSideTab]    = useState('library'); // 'library' | 'nato'
  const [saveModal,  setSaveModal]  = useState(false);
  const [author,     setAuthor]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const scaleRef   = useRef(null);
  const jumpRef    = useRef(null);
  const mapWrapRef = useRef(null);

  useEffect(() => { api('/categories').then(setCategories); }, []);
  useEffect(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (cat) q.set('category_id', cat);
    if (!search && !cat) q.set('limit', 150);
    api(`/symbols?${q}`).then(setSymbols);
  }, [search, cat]);

  const placeSymbol = useCallback((lat, lng) => {
    if (!activeSym) return;
    if (activeSym._ms) {
      setItems(prev => [...prev, {
        id: Date.now() + Math.random(), type: 'milsym',
        sidc: activeSym.sidc, echelon: activeSym.echelon,
        modifiers: activeSym.modifiers, label: activeSym.label,
        lat, lng, size: activeSym.size, rotation: activeSym.rotation,
      }]);
    } else {
      setItems(prev => [...prev, {
        id: Date.now() + Math.random(),
        name: activeSym.name, image_path: activeSym.image_path,
        lat, lng, size: 60, rotation: 0,
      }]);
    }
  }, [activeSym]);

  const moveSymbol = useCallback((id, lat, lng) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, lat, lng } : it));
    setSelectedId(null); setPopupPos(null);
  }, []);

  const updateItem = useCallback((id, patch) =>
    setItems(prev => prev.map(it => String(it.id) === String(id) ? { ...it, ...patch } : it)), []);

  const handleSelect = useCallback((id, pos) => {
    setSelectedId(id);
    setPopupPos(pos || null);
    if (id) setActiveSym(null);
  }, []);

  function switchTab(tab) { setSideTab(tab); setActiveSym(null); setSelectedId(null); }

  function handleScale(label) {
    setScale(label);
    scaleRef.current?.(SCALES.find(s => s.label === label)?.zoom || 12);
  }

  function handleLocation(idx) {
    setLocIdx(Number(idx));
    jumpRef.current?.(Number(idx));
  }

  function deleteSelected() {
    setItems(prev => prev.filter(it => String(it.id) !== String(selectedId)));
    setSelectedId(null); setPopupPos(null);
  }

  async function exportPng() {
    if (!mapWrapRef.current) return;
    setSaving(true);
    try {
      const mapCanvas = await html2canvas(mapWrapRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const W = mapCanvas.width;
      const SIG_H = 56;
      const out = document.createElement('canvas');
      out.width  = W;
      out.height = mapCanvas.height + SIG_H;
      const ctx = out.getContext('2d');

      ctx.drawImage(mapCanvas, 0, 0);

      // Signature strip
      ctx.fillStyle = '#1a237e';
      ctx.fillRect(0, mapCanvas.height, W, SIG_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 12, mapCanvas.height + SIG_H * 0.35);
      ctx.font = '13px sans-serif';
      const dateStr = new Date().toLocaleDateString('uk-UA');
      ctx.fillText(`Склав: ${author || '—'}   |   Масштаб: ${scale}   |   ${dateStr}`, 12, mapCanvas.height + SIG_H * 0.72);

      out.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `${title.replace(/[^\wа-яА-ЯіїєґІЇЄҐ]/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');

      // Also persist JSON to backend
      await api('/schemes', { method: 'POST', body: JSON.stringify({ title, scheme_data: JSON.stringify({ items, author, scale }) }) });
      setSaveModal(false);
    } finally {
      setSaving(false);
    }
  }

  const selItem  = items.find(it => String(it.id) === String(selectedId));
  const rot      = selItem?.rotation || 0;
  const selLabel = selItem ? (selItem.type === 'milsym' ? selItem.label : selItem.name) : '';
  const selSize  = selItem?.size || (selItem?.type === 'milsym' ? 40 : 60);

  return (
    <section>
      <h2>Редактор оперативної схеми</h2>
      <div className="editorTop">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Назва схеми" />
        <select value={scale} onChange={e => handleScale(e.target.value)} title="Масштаб">
          {SCALES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>
        <select value={locIdx} onChange={e => handleLocation(e.target.value)} title="Район">
          {RU_BORDER_CENTERS.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
        </select>
        <button onClick={() => setSaveModal(true)}>Зберегти схему</button>
      </div>

      {/* Модальне вікно збереження */}
      {saveModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSaveModal(false)}>
          <div className="modal-box save-modal">
            <h3>Зберегти схему як PNG</h3>
            <label>
              Назва схеми
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Назва схеми" />
            </label>
            <label>
              Склав (автор)
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Прізвище та ім'я" />
            </label>
            <div className="save-modal-meta">
              Масштаб: <b>{scale}</b> &nbsp;|&nbsp; Дата: <b>{new Date().toLocaleDateString('uk-UA')}</b>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={exportPng} disabled={saving}>
                {saving ? 'Збереження…' : 'Зберегти PNG'}
              </button>
              <button onClick={() => setSaveModal(false)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {/* Попап керування знаком */}
      {selItem && popupPos && (
        <div className="mkr-popup" style={{ left: popupPos.x, top: popupPos.y }}>
          <div className="mkr-popup-header">
            <span className="mkr-popup-name" title={selLabel}>{selLabel.length > 42 ? selLabel.slice(0,40)+'…' : selLabel}</span>
            <button className="mkr-popup-close" onClick={() => { setSelectedId(null); setPopupPos(null); }}>×</button>
          </div>
          <div className="mkr-popup-row">
            <label>Розмір <b>{selSize}px</b></label>
            <input type="range" min={25} max={140} step={5} value={selSize}
              onChange={e => updateItem(selectedId, { size: +e.target.value })} />
          </div>
          <div className="mkr-popup-row">
            <label>Поворот <b>{rot}°</b></label>
            <div className="mkr-popup-rot">
              <button onClick={() => updateItem(selectedId, { rotation: (rot-45+360)%360 })}>↺45°</button>
              <button onClick={() => updateItem(selectedId, { rotation: (rot-15+360)%360 })}>↺15°</button>
              <button onClick={() => updateItem(selectedId, { rotation: 0 })}>0°</button>
              <button onClick={() => updateItem(selectedId, { rotation: (rot+15)%360 })}>↻15°</button>
              <button onClick={() => updateItem(selectedId, { rotation: (rot+45)%360 })}>↻45°</button>
            </div>
          </div>
          <button className="mkr-popup-del" onClick={deleteSelected}>Видалити знак</button>
        </div>
      )}

      <div className="editor">
        <aside>
          <div className="aside-tabs">
            <button className={`aside-tab${sideTab==='library'?' aside-tab-on':''}`} onClick={() => switchTab('library')}>Бібліотека PNG</button>
            <button className={`aside-tab${sideTab==='nato'?' aside-tab-on':''}`}    onClick={() => switchTab('nato')}>NATO знаки</button>
          </div>

          {sideTab === 'nato' ? (
            <MilSymPanel onUpdate={setActiveSym} paused={!!selectedId} />
          ) : (
            <>
              {activeSym && !activeSym._ms && (
                <div className="active-sym-hint">
                  <img src={`${API_BASE}${activeSym.image_path}`} alt="" />
                  <span>Клацніть на карті для розміщення</span>
                  <button onClick={() => setActiveSym(null)}>✕</button>
                </div>
              )}
              <input placeholder="Пошук знака" value={search} onChange={e => setSearch(e.target.value)} />
              <select value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">Усі категорії</option>
                {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
              </select>
              <p className="muted">Показано: {symbols.length}</p>
              <div className="symbolList">
                {symbols.map(s => (
                  <button key={s.id}
                    className={`symbolPick${activeSym?.id === s.id ? ' symbolPick--active' : ''}`}
                    onClick={() => { setActiveSym(prev => prev?.id === s.id ? null : s); setSelectedId(null); }}>
                    <img src={`${API_BASE}${s.image_path}`} alt="" />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
        <div ref={mapWrapRef} className="map-capture-wrap">
          <LeafletMap
            items={items}
            activeSymbol={activeSym}
            selectedId={selectedId}
            onPlace={placeSymbol}
            onMove={moveSymbol}
            onSelect={handleSelect}
            scaleRef={scaleRef}
            jumpRef={jumpRef}
            defaultZoom={SCALES.find(s => s.label === scale)?.zoom || 12}
          />
        </div>
      </div>
    </section>
  );
}

function App() {
  const [page, setPage] = useState('catalog');
  const pages = { catalog: <Catalog />, tests: <Tests />, editor: <Editor /> };
  return <><Header page={page} setPage={setPage} /><main>{pages[page]}</main></>;
}

createRoot(document.getElementById('root')).render(<App/>);
