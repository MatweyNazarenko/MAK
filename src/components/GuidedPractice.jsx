import { useEffect, useRef, useState } from "react";
import { CARDS, CARD_BACK } from "../data";
import "./guided-practice.css";

const requests = ["Что забирает мои силы сегодня?", "На что я могу опереться на этой неделе?", "Что мне сейчас нужно?"];
const prompts = ["Что вы заметили первым: деталь, цвет, фигуру или свободное пространство?", "Какие чувства вызывает этот образ? Можно пока не подбирать им названия.", "Есть ли здесь что-то, что перекликается с вашим вопросом?"];
const titles = ["Что сейчас просит вашего внимания?", "Как вам хочется выбрать карту?", "На чём остановился ваш взгляд?", "Что хочется оставить себе?"];

export default function GuidedPractice({ active, privateMode, session, onChange, onClose, onSave, onFinish, onNotes }) {
  const { step, request: question, card, text } = session;
  const setStep = (value) => onChange((current) => ({ ...current, step: value }));
  const setQuestion = (value) => onChange((current) => ({ ...current, request: value }));
  const setCard = (value) => onChange((current) => ({ ...current, card: value, savedText: null }));
  const setText = (value) => onChange((current) => ({ ...current, text: value }));
  const [gallery, setGallery] = useState(false);
  const [offset, setOffset] = useState(0);
  const [prompt, setPrompt] = useState(0);
  const [result, setResult] = useState("");
  const saved = session.savedText === text;
  const heading = useRef(null);
  useEffect(() => {
    if (active) heading.current?.focus();
  }, [active, step]);
  const draft = { card, question, text };
  function selectCard(next) {
    setCard(next);
    setResult("");
    setGallery(false);
  }
  function save() {
    const message = onSave();
    setResult(message);
  }
  return (
    <section className="guided-practice" hidden={!active} aria-label="Практика с подсказками">
      <div className="guide-top">
        <span className="eyebrow">Первая карта · в своём темпе</span>
        <button type="button" className="btn ghost" onClick={() => onClose(draft)}>Закрыть подсказки</button>
      </div>
      <ol className="guide-progress" aria-label="Шаги практики">
        {["Настрой", "Карта", "Внимание", "Мысль"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
      </ol>
      <div className="guide-heading">
        <p className="muted">Шаг {step + 1} из 4 · Без спешки и правильных ответов</p>
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1>
      </div>
      {step === 0 && <div className="guide-paper">
        <p>Не обязательно точно формулировать запрос. Выберите близкий вопрос, напишите свой или просто посмотрите на карту.</p>
        <div className="guide-requests">{requests.map((item) => <button className="btn secondary" type="button" key={item} aria-pressed={question === item} onClick={() => setQuestion(item)}>{item}</button>)}</div>
        <label htmlFor="guide-question">Свой вопрос — если хочется</label>
        <textarea id="guide-question" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: что поможет мне немного выдохнуть?" />
        <p className="muted">Этот вопрос можно изменить позже. Он не сохранится автоматически.</p>
        <div className="btn-row"><button className="btn" type="button" onClick={() => setStep(1)}>Перейти к карте</button><button className="btn ghost" type="button" onClick={() => { setQuestion(""); setStep(1); }}>Пока без вопроса</button></div>
      </div>}
      {step === 1 && <div className="guide-paper">
        <p>Можно открыть случайную карту или выбрать изображение, которое привлекает внимание. Ни один способ не лучше другого.</p>
        <div className="guide-choice">
          <img className="guide-preview" src={card?.image || CARD_BACK} alt={card?.title || "Рубашка карты — изображение пока скрыто"} />
          <div><h2>{card ? card.title : "Одна карта для себя"}</h2><div className="guide-requests">
            <button className="btn" type="button" onClick={() => selectCard(CARDS[Math.floor(Math.random() * CARDS.length)])}>{card ? "Открыть другую случайную карту" : "Открыть случайную карту"}</button>
            <button className="btn secondary" type="button" onClick={() => setGallery(!gallery)} aria-expanded={gallery}>Выбрать по изображению</button>
          </div><p className="muted">Карта не даёт предсказаний и не определяет ваше состояние. Это образ для ваших собственных ассоциаций.</p></div>
        </div>
        {gallery && <div><div className="guide-gallery">{Array.from({ length: 6 }, (_, index) => CARDS[(offset + index) % CARDS.length]).map((item) => <button type="button" key={item.id} onClick={() => selectCard(item)} aria-label={`Выбрать карту: ${item.title}`}><img src={item.image} alt="" /><span>{item.title}</span></button>)}</div><button className="btn ghost" type="button" onClick={() => setOffset((offset + 6) % CARDS.length)}>Показать другие</button></div>}
        {card && <button className="btn" type="button" onClick={() => setStep(2)}>Рассмотреть карту</button>}
      </div>}
      {step === 2 && card && <div className="guide-paper guide-choice">
        <img className="guide-image" src={card.image} alt={card.title} />
        <div>{question && <p className="muted">Ваш вопрос: {question}</p>}<div className="guide-prompt" aria-live="polite">{prompts[prompt]}</div><button className="btn ghost" type="button" onClick={() => setPrompt((prompt + 1) % prompts.length)}>Другой вопрос-подсказка</button><p>Можно ничего не почувствовать или не найти связи. Не нужно заставлять себя искать смысл.</p><p className="muted">Если образ неприятен, можно вернуться и выбрать другую карту или закончить практику.</p><button className="btn" type="button" onClick={() => setStep(3)}>Перейти к своей мысли</button></div>
      </div>}
      {step === 3 && <div className="guide-paper">
        <p>Одного слова достаточно. Можно записать мысль, маленькое пожелание себе — или ничего не записывать.</p>
        <label htmlFor="guide-note">Моя мысль — необязательно</label>
        <textarea id="guide-note" rows={5} value={text} onChange={(e) => { setText(e.target.value); setResult(""); }} placeholder="Сейчас я замечаю… / Я хочу дать себе…" />
        <p className="muted">{privateMode ? "Включён режим без сохранения. Текст останется только в текущей практике." : "Заметка сохраняется только по вашему нажатию, в этом браузере. Она может быть доступна другим людям на этом устройстве. При очистке данных браузера записи удаляются."}</p>
        <div className="btn-row"><button type="button" className="btn" disabled={!text.trim() || privateMode || saved} onClick={save}>{saved ? "Мысль сохранена" : "Сохранить мысль"}</button>{saved && <button type="button" className="btn secondary" onClick={onNotes}>Открыть мои заметки</button>}<button type="button" className="btn secondary" onClick={onFinish}>На сегодня достаточно</button></div>
        <p role="status">{result}</p>
      </div>}
      <div className="guide-footer">{step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Назад</button>}<span>Можно остановиться в любой момент. Вернуться — через «Помощь».</span></div>
    </section>
  );
}
