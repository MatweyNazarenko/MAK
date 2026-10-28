import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CARD_BACK,
  CARDS,
  SECTIONS,
  STORIES,
  scenarios,
  stateOptions,
} from "./data";

import {
  Zap,
  Layers,
  Moon,
  Flame,
  DoorClosed,
  TrendingDown,
  Compass,
  Coffee,
  Shuffle,
  X,
  EyeOff,
  Download,
  Trash2,
  Lock,
  Settings,
  Upload,
} from "lucide-react";

const STATE_ICONS = {
  Zap,
  Layers,
  Moon,
  Flame,
  DoorClosed,
  TrendingDown,
  Compass,
  Coffee,
  Shuffle,
};

import {
  createDocxBlob,
  downloadBlob,
  formatDate,
  printNote,
  safeName,
} from "./documentUtils";

import MethodView from "./components/MethodView";
import GuidedPractice from "./components/GuidedPractice";

const STORAGE_KEY = "mak_teacher_v1";

const initialStorageState = {
  notes: [],
  favorites: [],
  privateMode: false,
};

function randomItem(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function hash(value) {
  let result = 2166136261;

  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }

  return result >>> 0;
}

function getDailyCard() {
  const date = new Date();

  const key = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ].join("-");

  return CARDS[hash(key) % CARDS.length];
}

function getDueDate(days) {
  if (!days) {
    return null;
  }

  const date = new Date();
  date.setDate(date.getDate() + Number(days));

  return date.toISOString();
}

function getInitialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved) {
      return {
        ...initialStorageState,
        ...saved,
      };
    }
  } catch {
    // Используем исходное состояние.
  }

  return initialStorageState;
}

export default function App() {
  const [storageState, setStorageState] = useState(getInitialState);

  const [guide, setGuide] = useState({ step: 0, request: "", card: null, text: "", savedText: null });
  const [guideDismissed, setGuideDismissed] = useState(() => {
    try { return localStorage.getItem("mak_teacher_guide_seen") === "1"; }
    catch { return false; }
  });
  const [view, setView] = useState("home");
  const [lastView, setLastView] = useState("home");

  const [currentCard, setCurrentCard] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionOverride, setQuestionOverride] = useState("");
  const [motivationOverride, setMotivationOverride] = useState("");

  const [storyOpen, setStoryOpen] = useState(false);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [noteMode, setNoteMode] = useState("thought");
  const [noteText, setNoteText] = useState("");
  const [returnAfter, setReturnAfter] = useState("");

  const [deckFilter, setDeckFilter] = useState("all");
  const [deckSearch, setDeckSearch] = useState("");
  const [noteTab, setNoteTab] = useState("all");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  const [currentFlow, setCurrentFlow] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [flowCards, setFlowCards] = useState([]);

  const [eveningCards, setEveningCards] = useState({});

  const importInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const dailyCard = useMemo(() => getDailyCard(), []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(storageState),
      );
    } catch {
      // Экспорт по-прежнему будет работать.
    }
  }, [storageState]);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = useCallback((message) => {
    setToastText(message);

    clearTimeout(toastTimeoutRef.current);

    toastTimeoutRef.current = setTimeout(() => {
      setToastText("");
    }, 2400);
  }, []);

  function navigate(name) {
    if (name !== "card") {
      setLastView(view);
    }

    setView(name);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function dismissGuideInvitation() {
    setGuideDismissed(true);
    try { localStorage.setItem("mak_teacher_guide_seen", "1"); }
    catch { /* The invitation can still be dismissed for this visit. */ }
  }

  function startGuide() {
    dismissGuideInvitation();
    if (view === "card" && currentCard?.id === guide.card?.id) {
      setGuide((current) => ({ ...current, text: noteText }));
    }
    navigate("guide");
  }

  function closeGuide() {
    dismissGuideInvitation();
    if (guide.card) {
      openCard(guide.card, "home");
      setQuestionOverride(guide.request || "Что вы заметили в этой карте?");
      setNoteText(guide.text);
      setNotePanelOpen(Boolean(guide.text) || guide.step === 3);
    } else {
      navigate("home");
    }
    setTimeout(() => document.querySelector(".guide-help")?.focus(), 0);
  }

  function saveGuideNote() {
    if (storageState.privateMode) return "Сейчас включён режим без сохранения. Текст остаётся в этой практике, но не записывается в заметки.";
    if (!guide.text.trim()) return "Можно оставить поле пустым и завершить без записи.";
    if (guide.savedText === guide.text) return "Эта мысль уже сохранена в разделе «Мои заметки».";
    const note = {
      id: `n${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(), cardId: guide.card.id,
      cardTitle: guide.card.title, section: guide.card.section,
      question: guide.request || "Что я хочу забрать с собой?",
      type: "thought", text: guide.text.trim(), due: null, status: "thinking",
    };
    const next = { ...storageState, notes: [note, ...storageState.notes] };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return "Браузер не смог сохранить заметку. Текст остался здесь — скопируйте его, прежде чем закрывать страницу.";
    }
    setStorageState(next);
    setGuide((current) => ({ ...current, savedText: current.text }));
    return "Мысль сохранена в разделе «Мои заметки» на этом устройстве.";
  }

  function getCardPool(section = "all") {
    if (!section || section === "all") {
      return CARDS;
    }

    return CARDS.filter((card) => card.sectionKey === section);
  }

  function openCard(card, origin = view, questionIndex = 0) {
    if (!card) {
      return;
    }

    setCurrentCard(card);
    setCurrentQuestion(questionIndex);
    setQuestionOverride("");
    setMotivationOverride("");
    setStoryOpen(false);
    setNotePanelOpen(false);
    setNoteMode("thought");
    setNoteText("");
    setReturnAfter("");
    setLastView(origin);
    setView("card");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function drawRandom(section = "all") {
    openCard(randomItem(getCardPool(section)), "home");
  }

  function surpriseMe() {
    const card = randomItem(CARDS);

    openCard(
      card,
      "home",
      Math.floor(Math.random() * card.questions.length),
    );
  }

  function justShowCard() {
    const card = randomItem(CARDS);

    openCard(card, "home");
    setQuestionOverride(
      "Можно просто посмотреть. Ничего объяснять не нужно.",
    );
  }

  function chooseState(option) {
    const [, , section, motivation] = option;
    const card = randomItem(getCardPool(section));

    openCard(card, "state");
    setMotivationOverride(motivation);
  }

  function toggleFavorite() {
    if (!currentCard) {
      return;
    }

    const favorite = storageState.favorites.includes(currentCard.id);

    setStorageState((current) => ({
      ...current,
      favorites: favorite
        ? current.favorites.filter((id) => id !== currentCard.id)
        : [...current.favorites, currentCard.id],
    }));

    showToast(
      favorite ? "Убрано из избранного" : "Карта в избранном",
    );
  }

  function openPersonalNote(mode) {
    setNoteMode(mode);
    setNotePanelOpen(true);

    setTimeout(() => {
      document
        .getElementById("noteText")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });

      document.getElementById("noteText")?.focus();
    }, 0);
  }

  function getCurrentQuestion() {
    if (questionOverride) {
      return questionOverride;
    }

    if (!currentCard) {
      return "";
    }

    return currentCard.questions[
      currentQuestion % currentCard.questions.length
    ];
  }

  function createCurrentNote() {
    const story = STORIES[currentCard?.id];

    return {
      id: `n${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      date: new Date().toISOString(),
      cardId: currentCard?.id || null,
      cardTitle: currentCard?.title || "Личная заметка",
      section: currentCard?.section || "",
      question:
        noteMode === "story" && storyOpen
          ? story?.question || ""
          : getCurrentQuestion(),
      type: noteMode,
      text: noteText.trim(),
      due: getDueDate(returnAfter),
      status: "thinking",
    };
  }

  function saveCurrentNote() {
    const note = createCurrentNote();

    if (!note.text) {
      showToast("Сначала запишите хотя бы одну мысль.");
      return;
    }

    if (storageState.privateMode) {
      showToast(
        "Режим без сохранения: запись осталась только на экране.",
      );
      return;
    }

    setStorageState((current) => ({
      ...current,
      notes: [note, ...current.notes],
    }));

    showToast(
      note.type === "story"
        ? "История сохранена."
        : "Мысль сохранена.",
    );
  }

  function clearNoteDraft() {
    setNoteText("");
    setReturnAfter("");
    setNotePanelOpen(false);
    showToast("Ничего не сохранено.");
  }

  function noteToText(note) {
    return [
      "МАК для учителя",
      formatDate(note.date),
      "",
      `Карта: ${note.cardTitle}${
        note.section ? ` | Раздел: ${note.section}` : ""
      }`,
      "",
      `Вопрос: ${note.question || "—"}`,
      "",
      note.type === "story" ? "Моя история:" : "Моя мысль:",
      note.text || "—",
      "",
      "На сегодня достаточно.",
    ].join("\n");
  }

  async function shareCurrent() {
    const note = createCurrentNote();
    const text = noteToText(note);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `МАК для учителя — ${note.cardTitle}`,
          text,
        });

        return;
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Заметка скопирована.");
    } catch {
      const textarea = document.createElement("textarea");

      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();

      showToast("Заметка скопирована.");
    }
  }

  function downloadCurrentDocx() {
    const note = createCurrentNote();

    downloadBlob(
      createDocxBlob([note]),
      `МАК_${safeName(note.cardTitle)}_${new Date()
        .toISOString()
        .slice(0, 10)}.docx`,
    );

    showToast("DOCX создан на этом устройстве.");
  }

  function printCurrentNote() {
    const opened = printNote(createCurrentNote());

    if (!opened) {
      showToast("Разрешите всплывающие окна для PDF / печати.");
    }
  }

  function startFlow(id) {
    const scenario = scenarios.find((item) => item.id === id);

    setCurrentFlow(scenario);
    setFlowStep(0);
    setFlowCards([]);
    setLastView("scenarios");
    setView("flow");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function getFlowSection(index) {
    if (currentFlow.sections === "all") {
      return "all";
    }

    if (Array.isArray(currentFlow.sections)) {
      return currentFlow.sections[
        Math.min(index, currentFlow.sections.length - 1)
      ];
    }

    return currentFlow.sections;
  }

  function flowDraw(index) {
    const usedIds = new Set(
      flowCards.filter(Boolean).map((card) => card.id),
    );

    let pool = getCardPool(getFlowSection(index)).filter(
      (card) => !usedIds.has(card.id),
    );

    if (!pool.length) {
      pool = getCardPool(getFlowSection(index));
    }

    const selected = randomItem(pool);

    setFlowCards((current) => {
      const result = [...current];
      result[index] = selected;
      return result;
    });

    setFlowStep((current) => Math.max(current, index));
  }

  function flowNext() {
    if (!flowCards[flowStep]) {
      flowDraw(flowStep);
    }

    if (flowStep < currentFlow.steps.length - 1) {
      setFlowStep((current) => current + 1);
    } else {
      showToast(
        "Маршрут завершен. Возьмите только то, что вам пригодилось.",
      );
    }
  }

  function flowNote() {
    const card = flowCards.find(Boolean);

    if (!card) {
      showToast("Сначала выберите карту маршрута.");
      return;
    }

    openCard(card, "flow");
    setQuestionOverride(
      "Что вы хотите забрать с собой из этого маршрута?",
    );
    setNoteText(
      `Мой вывод из маршрута «${currentFlow.title}»: `,
    );
    setNoteMode("thought");
    setNotePanelOpen(true);
  }

  const filteredDeck = useMemo(() => {
    const query = deckSearch.toLowerCase().trim();

    return CARDS.filter((card) => {
      const correctSection =
        deckFilter === "all" ||
        card.sectionKey === deckFilter;

      const correctSearch =
        !query ||
        `${card.title} ${card.section}`
          .toLowerCase()
          .includes(query);

      return correctSection && correctSearch;
    });
  }, [deckFilter, deckSearch]);

  const visibleNotes = useMemo(() => {
    if (noteTab === "fav") {
      return [];
    }

    let result = [...storageState.notes];

    if (noteTab === "due") {
      result = result.filter((note) => note.due);
    }

    if (noteTab === "stories") {
      result = result.filter(
        (note) => note.type === "story",
      );
    }

    return result;
  }, [noteTab, storageState.notes]);

  const favoriteCards = useMemo(
    () =>
      CARDS.filter((card) =>
        storageState.favorites.includes(card.id),
      ),
    [storageState.favorites],
  );

  function deleteNote(id) {
    setStorageState((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== id),
    }));
  }

  function continueNote(note) {
    const card = CARDS.find((item) => item.id === note.cardId);

    if (!card) {
      showToast("Карта для продолжения не найдена.");
      return;
    }

    openCard(card, "notes");
    setNoteMode(note.type);
    setNoteText(`${note.text}\n\nПродолжение: `);
    setNotePanelOpen(true);
  }

  function exportNoteDocx(note) {
    downloadBlob(
      createDocxBlob([note]),
      `МАК_${safeName(note.cardTitle)}.docx`,
    );
  }

  function exportAllDocx() {
    if (!storageState.notes.length) {
      showToast("Сохраненных заметок пока нет.");
      return;
    }

    downloadBlob(
      createDocxBlob(
        storageState.notes,
        "МАК для учителя — мои заметки",
      ),
      "Мои_МАК_заметки.docx",
    );
  }

  function backupJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exported: new Date().toISOString(),
            state: storageState,
          },
          null,
          2,
        ),
      ],
      {
        type: "application/json",
      },
    );

    downloadBlob(
      blob,
      `МАК_резервная_копия_${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
    );

    showToast("Резервная копия создана.");
  }

  function importJson(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);

        if (
          !backup.state ||
          !Array.isArray(backup.state.notes) ||
          !Array.isArray(backup.state.favorites)
        ) {
          throw new Error("Invalid backup");
        }

        const allowedCards = new Set(
          CARDS.map((card) => card.id),
        );

        const notes = backup.state.notes.map((note) => {
          if (
            !note ||
            typeof note.id !== "string" ||
            typeof note.text !== "string"
          ) {
            throw new Error("Invalid note");
          }

          const card = CARDS.find(
            (item) => item.id === note.cardId,
          );

          return {
            ...note,
            cardId: card?.id || null,
            cardTitle: String(
              note.cardTitle ||
                card?.title ||
                "Личная заметка",
            ).slice(0, 160),
            section: String(note.section || "").slice(0, 100),
            question: String(note.question || "").slice(0, 500),
            text: String(note.text).slice(0, 100000),
            type:
              note.type === "story" ? "story" : "thought",
            due:
              note.due && !Number.isNaN(Date.parse(note.due))
                ? note.due
                : null,
          };
        });

        setStorageState({
          notes,
          favorites: backup.state.favorites.filter((id) =>
            allowedCards.has(id),
          ),
          privateMode: Boolean(
            backup.state.privateMode,
          ),
        });

        showToast("Резервная копия восстановлена.");
      } catch {
        showToast("Не удалось прочитать резервную копию.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function togglePrivacy() {
    const nextValue = !storageState.privateMode;

    setStorageState((current) => ({
      ...current,
      privateMode: nextValue,
    }));

    showToast(
      nextValue
        ? "Режим без сохранения включен."
        : "Локальное сохранение включено.",
    );
  }

  function eraseNotes() {
    const accepted = window.confirm(
      "Удалить все сохраненные заметки этого проекта? Избранные карты останутся.",
    );

    if (!accepted) {
      return;
    }

    setStorageState((current) => ({
      ...current,
      notes: [],
    }));

    showToast("Заметки удалены.");
  }

  function eveningDraw(step) {
    const section =
      step === 1
        ? "04_Что_меня_поддерживает"
        : "09_Мне_можно";

    const card = randomItem(getCardPool(section));

    setEveningCards((current) => ({
      ...current,
      [step]: card,
    }));
  }

  function finishCard() {
    showToast("На сегодня достаточно.");

    setTimeout(() => {
      navigate("home");
    }, 500);
  }

  const currentStory = currentCard
    ? STORIES[currentCard.id]
    : null;

  const isFavorite =
    currentCard &&
    storageState.favorites.includes(currentCard.id);

  const eveningBackground =
    CARDS.find((card) =>
      card.title.startsWith("Сегодня достаточно"),
    ) || CARDS[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" type="button" onClick={() => navigate("home")} aria-label="МАК для учителя — на главную">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V13" />
                <path d="M12 13C8.5 13 6 10.5 6 7.5C6 5.5 7.5 4 9.5 4C11 4 12 5 12 6.5C12 5 13 4 14.5 4C16.5 4 18 5.5 18 7.5C18 10.5 15.5 13 12 13Z" />
                <circle cx="12" cy="8" r="1.5" fill="currentColor" fillOpacity="0.2" />
                <path d="M9 18C10 17 11 16.5 12 16.5C13 16.5 14 17 15 18" />
              </svg>
            </span>
            <span>МАК для учителя<small>Пространство бережной рефлексии</small></span>
          </button>

          <div className="top-actions">
            <button type="button" className="btn ghost guide-help" onClick={startGuide} aria-label="Помощь — практика с подсказками">Помощь</button>
            <span className="privacy-badge">🔒 локально</span>

            <button
              type="button"
              className="icon-btn"
              aria-label="Настройки"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <a className="skip-link" href="#main-content">Перейти к содержимому</a>
      <main id="main-content" tabIndex={-1}>
        <GuidedPractice active={view === "guide"} session={guide} onChange={setGuide} onClose={closeGuide} onSave={saveGuideNote} onNotes={() => navigate("notes")} privateMode={storageState.privateMode} onFinish={() => { dismissGuideInvitation(); navigate("home"); }} />
        {view === "home" && !guideDismissed && (
          <aside className="guide-invitation" aria-labelledby="guide-invitation-title">
            <span className="eyebrow">Первая карта · с подсказками</span>
            <h2 id="guide-invitation-title">Начнём с одной карты?</h2>
            <p>Небольшая практика поможет освоиться — без правильных ответов и спешки. Можно уделить ей пару минут или задержаться, если захочется.</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={startGuide}>Попробовать с подсказками</button>
              <button type="button" className="btn ghost" onClick={dismissGuideInvitation}>Пока самостоятельно</button>
            </div>
            <small className="muted">Подсказки можно закрыть в любой момент и вернуть через «Помощь».</small>
          </aside>
        )}
        {view === "home" && (
          <section className="view active">
            <div className="hero">
              <div className="soft-panel hero-copy">
                <span className="eyebrow">
                  Иногда достаточно одной карты
                </span>

                <h1>Что вам сейчас <em>нужно?</em></h1>

                <p>
                  Не еще одна задача. Небольшая пауза, в
                  которой можно заметить свое состояние,
                  разгрузить голову, увидеть опору или просто
                  сказать: «На сегодня достаточно».
                </p>

                <div className="btn-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => drawRandom()}
                  >
                    Открыть одну карту
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => navigate("state")}
                  >
                    Мне нужно разгрузиться
                  </button>
                </div>
                <div className="hero-footnote">2–3 минуты для себя · без правильных ответов</div>
              </div>

              <div className="hero-art">
                <span className="hero-orbit" aria-hidden="true" />
                <img src={CARD_BACK} alt="Рубашка МАК" />
                <span className="art-caption">Одна карта. Немного тишины. Время для себя.</span>
              </div>
            </div>

            <div className="section-title practice-heading">
              <div><span className="eyebrow">В своём темпе</span><h2>С чего начнём?</h2></div>
              <span className="muted">Выберите небольшую паузу для себя</span>
            </div>
            <div className="quick-grid">
              <button
                type="button"
                className="quick"
                onClick={() => drawRandom()}
              >
                <span className="emoji">🃏</span>
                <strong>Одна карта</strong>
                <small>2–3 минуты</small>
              </button>

              <button
                type="button"
                className="quick sage"
                onClick={() => navigate("state")}
              >
                <span className="emoji">🍃</span>
                <strong>Немного разгрузиться</strong>
                <small>5–10 минут</small>
              </button>

              <button
                type="button"
                className="quick blue"
                onClick={() => navigate("scenarios")}
              >
                <span className="emoji">🧭</span>
                <strong>Разобраться с ситуацией</strong>
                <small>10–15 минут</small>
              </button>

              <button
                type="button"
                className="quick lilac"
                onClick={surpriseMe}
              >
                <span className="emoji">🎲</span>
                <strong>Просто удивите меня</strong>
                <small>случайная карта</small>
              </button>
            </div>

            <div className="section-title">
              <div>
                <span className="eyebrow">Сегодня</span>
                <h2>Карта дня</h2>
              </div>

              <button
                type="button"
                className="link-btn"
                onClick={() => openCard(dailyCard, "home")}
              >
                Открыть
              </button>
            </div>

            <div className="panel card-day">
              <img
                src={dailyCard.image}
                className="thumb-card"
                alt={dailyCard.title}
              />

              <div>
                <h3>{dailyCard.title}</h3>
                <p className="muted">
                  {dailyCard.motivation}
                </p>

                <button
                  type="button"
                  className="btn gold"
                  onClick={() => openCard(dailyCard, "home")}
                >
                  Открыть карту
                </button>
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="link-btn"
                onClick={justShowCard}
              >
                Мне сейчас вообще не до вопросов — просто
                покажите карту
              </button>
            </div>

            <div className="privacy-strip">
              <span style={{ fontSize: 24 }}>🔒</span>

              <div>
                <strong>
                  Без регистрации и сервера.
                </strong>
                <br />
                <span className="muted">
                  Ваши заметки остаются на этом устройстве.
                  Сохранение можно отключить.
                </span>
              </div>
            </div>
          </section>
        )}

        {view === "state" && (
          <section className="view active">
            <button
              type="button"
              className="back-link"
              onClick={() => navigate("home")}
            >
              ← Назад
            </button>

            <span className="eyebrow">
              Немного разгрузиться
            </span>

            <h2>Что сейчас ближе?</h2>

            <p className="muted">
              Это не тест и не диагностика. Просто выберите
              фразу, которая сегодня звучит знакомо.
            </p>

            <div className="state-grid">
              {stateOptions.map((option) => {
                const IconComp = STATE_ICONS[option[0]];
                return (
                  <button
                    type="button"
                    className="state-btn"
                    key={option[1]}
                    onClick={() => chooseState(option)}
                  >
                    <span className="state-icon">
                      {IconComp ? <IconComp size={22} strokeWidth={1.6} /> : option[0]}
                    </span>
                    <strong>{option[1]}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {view === "card" && currentCard && (
          <section className="view active">
            <button
              type="button"
              className="back-link"
              onClick={() =>
                navigate(
                  lastView === "card" ? "home" : lastView,
                )
              }
            >
              ← Назад
            </button>

            <div className="reveal-wrap">
              <div className="story-stage">
                <div className="big-card-shell">
                  <img
                    src={currentCard.image}
                    className="big-card"
                    alt={currentCard.title}
                  />
                </div>

                <div className="story-card-shell">
                  {!storyOpen && (
                    <button
                      type="button"
                      className="story-cover"
                      aria-expanded="false"
                      onClick={() => {
                        if (currentStory) {
                          setStoryOpen(true);
                        }
                      }}
                    >
                      <img
                        src={CARD_BACK}
                        alt=""
                        className="story-back-image"
                      />

                      <span className="story-cover-label">
                        История карты{" "}
                        <span aria-hidden="true">↗</span>
                        <small>Открыть по желанию</small>
                      </span>
                    </button>
                  )}

                  {storyOpen && currentStory && (
                    <article className="story-content">
                      <div className="story-paper">
                        <span className="eyebrow">
                          История карты
                        </span>

                        <h3>{currentStory.title}</h3>
                        <p>{currentStory.text}</p>

                        <div className="story-thought">
                          <span className="eyebrow">
                            Вопрос для размышления
                          </span>
                          <p>{currentStory.question}</p>
                        </div>

                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() =>
                              setStoryOpen(false)
                            }
                          >
                            Закрыть историю
                          </button>

                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() =>
                              openPersonalNote("story")
                            }
                          >
                            Моя история
                          </button>
                        </div>
                      </div>
                    </article>
                  )}
                </div>
              </div>

              <div className="card-meta">
                <span className="eyebrow">
                  {currentCard.section}
                </span>

                <h2>{currentCard.title}</h2>

                <p className="muted">
                  {motivationOverride ||
                    currentCard.motivation}
                </p>

                <div className="question-box">
                  <span className="eyebrow">Вопрос</span>

                  <p>{getCurrentQuestion()}</p>

                  {!questionOverride && (
                    <div className="dots">
                      {currentCard.questions.map(
                        (question, index) => (
                          <span
                            key={question}
                            className={`dot ${
                              index ===
                              currentQuestion %
                                currentCard.questions.length
                                ? "on"
                                : ""
                            }`}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="btn-row no-print">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQuestionOverride("");
                      setCurrentQuestion(
                        (current) =>
                          (current + 1) %
                          currentCard.questions.length,
                      );
                    }}
                  >
                    Еще вопрос
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() =>
                      openPersonalNote("thought")
                    }
                  >
                    Записать мысль
                  </button>

                  <button
                    type="button"
                    className="btn blue"
                    onClick={() =>
                      openPersonalNote("story")
                    }
                  >
                    Моя история
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={finishCard}
                  >
                    Мне достаточно
                  </button>

                  <button
                    type="button"
                    className="icon-btn"
                    title="Избранное"
                    onClick={toggleFavorite}
                  >
                    {isFavorite ? "♥" : "♡"}
                  </button>
                </div>

                {notePanelOpen && (
                  <div className="save-panel">
                    <label htmlFor="noteText">
                      <strong>
                        {noteMode === "story"
                          ? "Моя история"
                          : "Ваша мысль"}
                      </strong>
                    </label>

                    <p className="muted note-hint">
                      {noteMode === "story"
                        ? "Опишите образ, придумайте историю героя или расскажите о себе. Можно написать всего одну фразу."
                        : "Можно записать одну фразу. Можно ничего не сохранять."}
                    </p>

                    <textarea
                      id="noteText"
                      className="note-area"
                      value={noteText}
                      placeholder={
                        noteMode === "story"
                          ? "На этой карте я вижу… Этот образ напоминает мне…"
                          : "Можно записать одну фразу. Можно ничего не сохранять."
                      }
                      onChange={(event) =>
                        setNoteText(event.target.value)
                      }
                    />

                    <div style={{ marginTop: 10 }}>
                      <label
                        className="muted"
                        htmlFor="returnSelect"
                      >
                        Вернуться к этой мысли:
                      </label>

                      <select
                        id="returnSelect"
                        className="search"
                        style={{ marginTop: 6 }}
                        value={returnAfter}
                        onChange={(event) =>
                          setReturnAfter(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">не нужно</option>
                        <option value="1">завтра</option>
                        <option value="7">
                          через неделю
                        </option>
                        <option value="30">
                          через месяц
                        </option>
                      </select>
                    </div>

                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn"
                        onClick={saveCurrentNote}
                      >
                        Сохранить здесь
                      </button>

                      <button
                        type="button"
                        className="btn blue"
                        onClick={shareCurrent}
                      >
                        Поделиться
                      </button>

                      <button
                        type="button"
                        className="btn secondary"
                        onClick={downloadCurrentDocx}
                      >
                        DOCX
                      </button>

                      <button
                        type="button"
                        className="btn secondary"
                        onClick={printCurrentNote}
                      >
                        PDF / печать
                      </button>

                      <button
                        type="button"
                        className="link-btn"
                        onClick={clearNoteDraft}
                      >
                        Не сохранять
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {view === "scenarios" && (
          <section className="view active">
            <span className="eyebrow">Сценарии</span>
            <h2>С чем вы пришли?</h2>

            <p className="muted">
              Выберите короткий маршрут. Он подскажет, какие
              карты взять и какой вопрос задать.
            </p>

            <div className="scenario-grid">
              {scenarios.map((scenario) => (
                <button
                  type="button"
                  className="scenario"
                  key={scenario.id}
                  onClick={() => startFlow(scenario.id)}
                >
                  <span className="time">
                    {scenario.time}
                  </span>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.intro}</p>
                  <span className="scenario-cue">Начать практику <span aria-hidden="true">↗</span></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "flow" && currentFlow && (
          <section className="view active">
            <button
              type="button"
              className="back-link"
              onClick={() => navigate("scenarios")}
            >
              ← К сценариям
            </button>

            <span className="eyebrow">
              {currentFlow.time}
            </span>

            <h2>{currentFlow.title}</h2>
            <p className="muted">{currentFlow.intro}</p>

            <div className="flow-slots">
              {currentFlow.steps.map((step, index) => {
                const card = flowCards[index];

                return (
                  <div className="flow-slot" key={step}>
                    {card ? (
                      <>
                        <img
                          src={card.image}
                          alt={card.title}
                        />
                        <strong>{card.title}</strong>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 32 }}>
                          {index + 1}
                        </span>
                        <strong>{step}</strong>

                        <button
                          type="button"
                          className="btn secondary"
                          style={{ marginTop: 12 }}
                          onClick={() => flowDraw(index)}
                        >
                          Выбрать карту
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="question-box">
              <span className="eyebrow">Сейчас</span>
              <p>
                {
                  currentFlow.steps[
                    Math.min(
                      flowStep,
                      currentFlow.steps.length - 1,
                    )
                  ]
                }
              </p>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={flowNext}
              >
                {flowStep >= currentFlow.steps.length - 1
                  ? "Завершить маршрут"
                  : "Следующий шаг"}
              </button>

              <button
                type="button"
                className="btn secondary"
                onClick={flowNote}
              >
                Записать итог
              </button>

              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("home")}
              >
                На сегодня достаточно
              </button>
            </div>
          </section>
        )}

        {view === "deck" && (
          <section className="view active">
            <span className="eyebrow">
              Виртуальная колода
            </span>

            <h2>Все карты</h2>

            <input
              className="search"
              type="search"
              aria-label="Найти карту"
              placeholder="Найти карту…"
              value={deckSearch}
              onChange={(event) =>
                setDeckSearch(event.target.value)
              }
            />

            <div className="filter-row">
              <button
                type="button"
                className={`chip ${
                  deckFilter === "all" ? "on" : ""
                }`}
                onClick={() => setDeckFilter("all")}
              >
                Все
              </button>

              {SECTIONS.map((section) => (
                <button
                  type="button"
                  className={`chip ${
                    deckFilter === section.key ? "on" : ""
                  }`}
                  key={section.key}
                  onClick={() =>
                    setDeckFilter(section.key)
                  }
                >
                  {section.title}
                </button>
              ))}
            </div>

            <div className="deck-status" role="status">
              <span>Найдено карт: {filteredDeck.length}</span>
              {(deckSearch || deckFilter !== "all") && (
                <button type="button" className="link-btn" onClick={() => { setDeckSearch(""); setDeckFilter("all"); }}>Сбросить фильтры</button>
              )}
            </div>
            {filteredDeck.length === 0 && (
              <div className="empty">
                <strong>Такой карты пока не нашлось</strong>
                Попробуйте другое слово или сбросьте выбранный раздел.
              </div>
            )}
            <div className="deck-grid">
              {filteredDeck.map((card) => (
                <button
                  type="button"
                  className="deck-item"
                  key={card.id}
                  onClick={() => openCard(card, "deck")}
                >
                  <img
                    loading="lazy"
                    src={card.image}
                    alt={card.title}
                  />
                  <strong>{card.title}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "notes" && (
          <section className="view active">
            <div className="notes-toolbar">
              <div>
                <span className="eyebrow">
                  Личное пространство
                </span>
                <h2>Мои заметки и истории</h2>
              </div>

              <div className="btn-row">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={exportAllDocx}
                >
                  DOCX
                </button>

                <button
                  type="button"
                  className="btn secondary"
                  onClick={backupJson}
                >
                  Резервная копия
                </button>
              </div>
            </div>

            <div className="tabs">
              {[
                ["all", "Все"],
                ["stories", "Мои истории"],
                ["fav", "Избранные карты"],
                ["due", "К чему вернуться"],
              ].map(([key, title]) => (
                <button
                  type="button"
                  className={`tab ${
                    noteTab === key ? "on" : ""
                  }`}
                  key={key}
                  onClick={() => setNoteTab(key)}
                >
                  {title}
                </button>
              ))}
            </div>

            <div className="notes-list">
              {noteTab === "fav" ? (
                favoriteCards.length ? (
                  favoriteCards.map((card) => (
                    <div
                      className="note-card"
                      key={card.id}
                    >
                      <img
                        src={card.image}
                        alt={card.title}
                      />

                      <div>
                        <h3>{card.title}</h3>
                        <span className="tag">
                          {card.section}
                        </span>
                        <p className="muted">
                          Избранная карта
                        </p>
                      </div>

                      <div className="note-actions">
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() =>
                            openCard(card, "notes")
                          }
                        >
                          Открыть
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    Пока нет избранных карт.
                  </div>
                )
              ) : visibleNotes.length ? (
                visibleNotes.map((note) => {
                  const card = CARDS.find(
                    (item) => item.id === note.cardId,
                  );

                  return (
                    <div
                      className="note-card"
                      key={note.id}
                    >
                      {card && (
                        <img
                          src={card.image}
                          alt={card.title}
                        />
                      )}

                      <div>
                        <h3>{note.cardTitle}</h3>

                        <span
                          className="muted"
                          style={{ fontSize: 13 }}
                        >
                          {formatDate(note.date)}
                        </span>

                        <span className="tag">
                          {note.type === "story"
                            ? "Моя история"
                            : "Моя мысль"}
                        </span>

                        {note.due && (
                          <span className="tag">
                            Вернуться:{" "}
                            {formatDate(note.due)}
                          </span>
                        )}

                        <p>{note.text}</p>
                      </div>

                      <div className="note-actions">
                        {card && (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() =>
                              continueNote(note)
                            }
                          >
                            Продолжить
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() =>
                            exportNoteDocx(note)
                          }
                        >
                          DOCX
                        </button>

                        <button
                          type="button"
                          className="link-btn"
                          onClick={() =>
                            deleteNote(note.id)
                          }
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty">
                  <strong>Место для ваших открытий</strong>
                  <p>Сохраненная мысль или история появится здесь только по вашему желанию.</p>
                  <button type="button" className="btn secondary" onClick={() => navigate("deck")}>Выбрать карту</button>
                </div>
              )}
            </div>
          </section>
        )}

        {view === "method" && (
          <MethodView
            privateMode={storageState.privateMode}
            onTogglePrivacy={togglePrivacy}
            onEraseNotes={eraseNotes}
            onImport={() =>
              importInputRef.current?.click()
            }
          />
        )}

        {view === "evening" && (
          <section className="view active evening">
            <button
              type="button"
              className="back-link"
              onClick={() => navigate("home")}
            >
              ← Назад
            </button>

            <div className="soft-panel">
              <span className="eyebrow">
                Вечерний режим
              </span>

              <h2>Закрыть школьный день</h2>

              {[
                [
                  1,
                  "Что сегодня было хорошего?",
                  "Выберите одну карту и заметите хотя бы один момент, который хочется забрать с собой.",
                ],
                [
                  2,
                  "Что оставляем до завтра?",
                  "Не все незавершенное требует завершения сегодня.",
                ],
                [
                  3,
                  "Что вам можно сегодня вечером?",
                  "Карта из раздела «Мне можно».",
                ],
              ].map(([step, title, description]) => {
                const card = eveningCards[step];

                return (
                  <div className="step-line" key={step}>
                    <span className="step-no">
                      {step}
                    </span>
                    <h3>{title}</h3>
                    <p className="muted">
                      {description}
                    </p>

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => eveningDraw(step)}
                    >
                      Выбрать карту
                    </button>

                    {card && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginTop: 12,
                        }}
                      >
                        <img
                          src={card.image}
                          alt={card.title}
                          style={{
                            width: 80,
                            borderRadius: 9,
                          }}
                        />

                        <div>
                          <strong>{card.title}</strong>
                          <br />

                          <button
                            type="button"
                            className="link-btn"
                            onClick={() =>
                              openCard(card, "evening")
                            }
                          >
                            Открыть карту
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="evening-art">
                <img
                  src={eveningBackground.image}
                  alt="Тихий вечер"
                />
              </div>

              <div
                style={{
                  textAlign: "center",
                  paddingTop: 18,
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 32,
                  }}
                >
                  На сегодня достаточно.
                </h2>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => navigate("home")}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Основная навигация">
        <div className="bottom-inner">
          {[
            ["home", "☀", "Сегодня"],
            ["scenarios", "✦", "Сценарии"],
            ["deck", "⊞", "Колода"],
            ["notes", "◉", "Мое"],
            ["method", "✎", "Методика"],
          ].map(([name, icon, title]) => (
            <button
              type="button"
              className={`nav-btn ${
                view === name ? "active" : ""
              }`}
              key={name}
              aria-current={view === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <span className="nav-ico">{icon}</span>
              {title}
            </button>
          ))}
        </div>
      </nav>

      <div
        className={`toast ${toastText ? "show" : ""}`}
        role="status"
      >
        {toastText}
      </div>

      <div
        className={`modal ${settingsOpen ? "show" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSettingsOpen(false);
          }
        }}
      >
        <div className="sheet settings-sheet">
          {/* ── Header ── */}
          <div className="settings-header">
            <div className="settings-header-left">
              <span className="settings-header-icon">
                <Settings size={20} strokeWidth={1.8} />
              </span>
              <h2>Настройки</h2>
            </div>
            <button
              type="button"
              className="settings-close"
              aria-label="Закрыть настройки"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* ── Основное ── */}
          <div className="settings-section">
            <div className="settings-section-label">Основное</div>

            <div className="settings-row">
              <span className="settings-row-icon settings-row-icon--sage">
                <EyeOff size={18} strokeWidth={1.8} />
              </span>
              <div className="settings-row-text">
                <strong>Режим без сохранения</strong>
                <span className="settings-row-hint">
                  Можно писать и экспортировать, но история не сохраняется.
                </span>
              </div>
              <button
                type="button"
                className={`switch ${storageState.privateMode ? "on" : ""}`}
                aria-label="Режим без сохранения"
                onClick={togglePrivacy}
              />
            </div>
          </div>

          <div className="settings-divider" />

          {/* ── Данные ── */}
          <div className="settings-section">
            <div className="settings-section-label">Данные</div>

            <div className="settings-row settings-row--btn" onClick={backupJson} role="button" tabIndex={0}>
              <span className="settings-row-icon settings-row-icon--gold">
                <Download size={18} strokeWidth={1.8} />
              </span>
              <div className="settings-row-text">
                <strong>Резервная копия</strong>
                <span className="settings-row-hint">Скачать JSON со всеми заметками</span>
              </div>
            </div>

            <div className="settings-row settings-row--btn settings-row--danger" onClick={eraseNotes} role="button" tabIndex={0}>
              <span className="settings-row-icon settings-row-icon--rose">
                <Trash2 size={18} strokeWidth={1.8} />
              </span>
              <div className="settings-row-text">
                <strong>Удалить всё</strong>
                <span className="settings-row-hint">Очистить историю этого проекта</span>
              </div>
            </div>
          </div>

          {/* ── Privacy note ── */}
          <div className="settings-privacy">
            <Lock size={15} strokeWidth={1.8} />
            <div>
              <strong>Ваши заметки остаются на этом устройстве.</strong>
              <br />
              <span className="muted">Нет аккаунта, регистрации и отправки записей на сервер.</span>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={importJson}
      />
    </div>
  );
}