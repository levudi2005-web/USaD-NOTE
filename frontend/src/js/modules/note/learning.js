import { addCard, addQuiz, getState, reviewCard } from "./store";
import { escapeHTML, hideModal, refreshIcons, showToast } from "./utils";

let selectedDeckId = null;
let cardIndex = 0;
let cardFlipped = false;
let selectedQuizId = null;
let quizIndex = 0;
let quizAnswers = [];
let quizFinished = false;

// FLASHCARDS
export const renderDecks = () => {
  const list = document.querySelector("[data-deck-list]");
  if (!list) return;
  const { decks, cards } = getState();
  if (!decks.some((deck) => deck.id === selectedDeckId)) {
    selectedDeckId = decks[0]?.id ?? null;
  }
  list.innerHTML = decks.length
    ? decks
        .map((deck) => {
          const count = cards.filter((card) => card.deckId === deck.id).length;
          const knownCount = cards.filter(
            (card) => card.deckId === deck.id && card.known
          ).length;
          const isActive = deck.id === selectedDeckId;
          return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 p-3 border-0 border-bottom rounded mb-1 ${isActive ? "active" : ""}" data-deck-select="${escapeHTML(deck.id)}">
              <span class="p-2 rounded bg-success-subtle text-success"><i data-lucide="layers" style="width:16px;height:16px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <strong class="d-block text-truncate small">${escapeHTML(deck.name)}</strong>
                <small class="text-body-secondary d-block text-truncate">${count} thẻ &bull; Đã nhớ: ${knownCount}</small>
              </div>
              <i data-lucide="chevron-right" class="text-body-tertiary" style="width:14px;height:14px"></i>
            </button>`;
        })
        .join("")
    : '<div class="p-4 text-center text-body-secondary small">Chưa có bộ thẻ nào.</div>';
  refreshIcons(list);
  renderCard();
};

export const renderCard = () => {
  const cardElement = document.querySelector("[data-flashcard]");
  if (!cardElement) return;
  const state = getState();
  const deck = state.decks.find((item) => item.id === selectedDeckId);
  const cards = state.cards.filter((card) => card.deckId === selectedDeckId);

  if (cardIndex >= cards.length) cardIndex = Math.max(0, cards.length - 1);
  const card = cards[cardIndex];

  const deckName = document.querySelector("[data-review-deck]");
  const progress = document.querySelector("[data-review-progress]");
  const frontContent = document.querySelector("[data-card-content]");
  const backContent = document.querySelector("[data-card-back-content]");
  const progressBar = document.querySelector("[data-card-progress]");

  if (deckName) deckName.textContent = deck?.name ?? "Chọn một bộ thẻ";
  if (progress)
    progress.textContent = cards.length
      ? `${cardIndex + 1} / ${cards.length}`
      : "0 / 0";

  if (progressBar) {
    const reviewed = cards.filter((item) => item.known).length;
    progressBar.style.width = `${cards.length ? (reviewed / cards.length) * 100 : 0}%`;
  }

  if (frontContent) {
    frontContent.textContent = card
      ? card.front
      : "Bộ thẻ này hiện chưa có thẻ.";
  }
  if (backContent) {
    backContent.textContent = card ? card.back : "Chưa có đáp án.";
  }

  // Handle 3D flip class
  if (cardFlipped) {
    cardElement.classList.add("is-flipped");
  } else {
    cardElement.classList.remove("is-flipped");
  }
};

// QUIZ
export const renderQuizzes = () => {
  const list = document.querySelector("[data-quiz-list]");
  if (!list) return;
  const { quizzes } = getState();
  if (!quizzes.some((quiz) => quiz.id === selectedQuizId)) {
    selectedQuizId = quizzes[0]?.id ?? null;
  }
  list.innerHTML = quizzes.length
    ? quizzes
        .map((quiz) => {
          const isActive = quiz.id === selectedQuizId;
          const qCount = (quiz.questions || []).length;
          return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 p-3 border-0 border-bottom rounded mb-1 ${isActive ? "active" : ""}" data-quiz-select="${escapeHTML(quiz.id)}">
              <span class="p-2 rounded bg-primary-subtle text-primary"><i data-lucide="list-checks" style="width:16px;height:16px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <strong class="d-block text-truncate small">${escapeHTML(quiz.title)}</strong>
                <small class="text-body-secondary d-block text-truncate">${qCount} câu hỏi</small>
              </div>
              <i data-lucide="chevron-right" class="text-body-tertiary" style="width:14px;height:14px"></i>
            </button>`;
        })
        .join("")
    : '<div class="p-4 text-center text-body-secondary small">Chưa có bài kiểm tra nào.</div>';
  refreshIcons(list);
  renderQuizStage();
};

export const renderQuizStage = () => {
  const stage = document.querySelector("[data-quiz-stage]");
  if (!stage) return;
  const state = getState();
  const quiz = state.quizzes.find((item) => item.id === selectedQuizId);

  if (!quiz || !quiz.questions?.length) {
    stage.innerHTML = `
      <div class="note-empty-state text-center py-5">
        <span class="note-empty-icon mb-3"><i data-lucide="list-checks" style="width:48px;height:48px"></i></span>
        <h4 class="fw-bold">Chọn hoặc tạo một bài Quiz</h4>
        <p class="text-body-secondary small">Tự kiểm tra kiến thức và ôn tập có phản hồi lập tức.</p>
      </div>`;
    refreshIcons(stage);
    return;
  }

  const questions = quiz.questions;
  if (quizFinished) {
    // Show Results
    let correctCount = 0;
    questions.forEach((q, i) => {
      if (quizAnswers[i] === q.answer) correctCount++;
    });
    const percent = Math.round((correctCount / questions.length) * 100);

    stage.innerHTML = `
      <div class="text-center py-4">
        <div class="p-3 bg-success-subtle text-success rounded-circle d-inline-flex mb-3">
          <i data-lucide="award" style="width:48px;height:48px"></i>
        </div>
        <h3 class="fw-bold">Hoàn thành bài kiểm tra!</h3>
        <p class="text-body-secondary">Bạn đã trả lời đúng <strong>${correctCount} / ${questions.length}</strong> câu (${percent}%)</p>
        <div class="d-flex justify-content-center gap-2 mt-4">
          <button class="btn btn-primary" type="button" data-quiz-restart><i data-lucide="rotate-ccw"></i> Làm lại bài này</button>
        </div>
      </div>
      <div class="mt-4 pt-3 border-top">
        <h6 class="fw-bold mb-3">Xem lại đáp án và giải thích:</h6>
        ${questions
          .map((q, idx) => {
            const userChoice = quizAnswers[idx];
            const isCorrect = userChoice === q.answer;
            const letters = ["A", "B", "C", "D"];
            return `
              <div class="card p-3 mb-3 border ${isCorrect ? "border-success-subtle bg-success-subtle bg-opacity-10" : "border-danger-subtle bg-danger-subtle bg-opacity-10"}">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="fw-bold small">Câu ${idx + 1}: ${escapeHTML(q.question)}</span>
                  <span class="badge ${isCorrect ? "bg-success" : "bg-danger"} small">${isCorrect ? "Đúng" : "Sai"}</span>
                </div>
                <p class="small text-body-secondary mb-1">Đáp án của bạn: <strong>${letters[userChoice] || "Chưa chọn"}</strong> - Đáp án đúng: <strong>${letters[q.answer]}</strong></p>
                <div class="p-2 bg-body-tertiary rounded small"><i data-lucide="lightbulb" style="width:13px;height:13px" class="text-warning"></i> <strong>Giải thích:</strong> ${escapeHTML(q.explanation || "Không có giải thích.")}</div>
              </div>`;
          })
          .join("")}
      </div>`;
    refreshIcons(stage);
    return;
  }

  // Active Question
  const currentQ = questions[quizIndex];
  const userAns = quizAnswers[quizIndex];
  const isAnswered = userAns !== undefined;
  const letters = ["A", "B", "C", "D"];

  stage.innerHTML = `
    <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
      <div>
        <h5 class="fw-bold mb-0">${escapeHTML(quiz.title)}</h5>
        <small class="text-body-secondary">Câu hỏi ${quizIndex + 1} / ${questions.length}</small>
      </div>
      <span class="badge bg-secondary-subtle text-secondary fs-6 px-3 py-1">${quizIndex + 1}/${questions.length}</span>
    </div>

    <div class="progress mb-4" style="height: 6px;">
      <div class="progress-bar bg-primary" role="progressbar" style="width: ${((quizIndex + 1) / questions.length) * 100}%"></div>
    </div>

    <h4 class="fw-bold mb-4" style="line-height: 1.5;">${escapeHTML(currentQ.question)}</h4>

    <div class="d-grid gap-3 mb-4">
      ${currentQ.options
        .map((opt, i) => {
          let btnClass = "note-quiz-option-btn";
          if (isAnswered) {
            if (i === currentQ.answer) btnClass += " is-correct";
            else if (i === userAns) btnClass += " is-wrong";
          } else if (userAns === i) {
            btnClass += " is-selected";
          }
          return `
            <button type="button" class="${btnClass}" data-select-quiz-option="${i}" ${isAnswered ? "disabled" : ""}>
              <span class="note-quiz-badge">${letters[i]}</span>
              <span class="flex-grow-1">${escapeHTML(opt)}</span>
            </button>`;
        })
        .join("")}
    </div>

    ${
      isAnswered
        ? `<div class="p-3 bg-body-tertiary border rounded mb-4 small animate__animated animate__fadeIn">
            <h6 class="fw-bold mb-1 d-flex align-items-center gap-1 text-${userAns === currentQ.answer ? "success" : "danger"}">
              ${userAns === currentQ.answer ? '<i data-lucide="circle-check"></i>' : '<i data-lucide="circle-x"></i>'}
              ${userAns === currentQ.answer ? "Chính xác!" : "Chưa chính xác"}
            </h6>
            <p class="mb-0 text-body-secondary">${escapeHTML(currentQ.explanation || "")}</p>
          </div>`
        : ""
    }

    <div class="d-flex align-items-center justify-content-between pt-3 border-top">
      <button class="btn btn-outline-secondary btn-sm" type="button" data-quiz-nav="-1" ${quizIndex === 0 ? "disabled" : ""}>
        <i data-lucide="chevron-left"></i> Câu trước
      </button>
      ${
        quizIndex === questions.length - 1
          ? `<button class="btn btn-primary" type="button" data-quiz-finish ${!isAnswered ? "disabled" : ""}>Xem kết quả <i data-lucide="award"></i></button>`
          : `<button class="btn btn-primary btn-sm" type="button" data-quiz-nav="1" ${!isAnswered ? "disabled" : ""}>Câu tiếp theo <i data-lucide="chevron-right"></i></button>`
      }
    </div>`;

  refreshIcons(stage);
};

export const initLearning = () => {
  renderDecks();
  renderQuizzes();
  window.addEventListener("note:statechange", () => {
    renderDecks();
    renderQuizzes();
  });
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "flashcards") renderDecks();
    if (e.detail.view === "quiz") renderQuizzes();
  });

  // Global Keyboard Shortcuts for Flashcards
  document.addEventListener("keydown", (event) => {
    if (document.body.dataset.noteView === "flashcards") {
      if (event.code === "Space" && !event.target.matches("input, textarea")) {
        event.preventDefault();
        cardFlipped = !cardFlipped;
        renderCard();
      } else if (event.key === "1") {
        const state = getState();
        const cards = state.cards.filter((c) => c.deckId === selectedDeckId);
        if (cards[cardIndex]) {
          reviewCard(cards[cardIndex].id, false);
          cardIndex = (cardIndex + 1) % Math.max(1, cards.length);
          cardFlipped = false;
          renderCard();
          showToast("Đã đánh dấu: Chưa nhớ", "info");
        }
      } else if (event.key === "2") {
        const state = getState();
        const cards = state.cards.filter((c) => c.deckId === selectedDeckId);
        if (cards[cardIndex]) {
          reviewCard(cards[cardIndex].id, true);
          cardIndex = (cardIndex + 1) % Math.max(1, cards.length);
          cardFlipped = false;
          renderCard();
          showToast("Đã đánh dấu: Đã nhớ", "success");
        }
      }
    }
  });

  // Click interactions
  document.addEventListener("click", (event) => {
    // Flip Card Click
    if (event.target.closest("[data-flashcard]")) {
      cardFlipped = !cardFlipped;
      renderCard();
      return;
    }

    // Select Deck
    const deckBtn = event.target.closest("[data-deck-select]");
    if (deckBtn) {
      selectedDeckId = deckBtn.dataset.deckSelect;
      cardIndex = 0;
      cardFlipped = false;
      renderDecks();
      return;
    }

    // Review Card buttons
    const reviewBtn = event.target.closest("[data-card-review]");
    if (reviewBtn) {
      const state = getState();
      const cards = state.cards.filter((c) => c.deckId === selectedDeckId);
      const card = cards[cardIndex];
      if (card) {
        const known = reviewBtn.dataset.cardReview === "known";
        reviewCard(card.id, known);
        cardIndex = (cardIndex + 1) % Math.max(1, cards.length);
        cardFlipped = false;
        renderCard();
        showToast(
          known ? "Đã ghi nhớ thẻ này!" : "Sẽ nhắc lại để bạn ôn tiếp.",
          known ? "success" : "info"
        );
      }
      return;
    }

    // Card Nav
    const cardNav = event.target.closest("[data-card-nav]");
    if (cardNav) {
      const step = Number(cardNav.dataset.cardNav);
      const cards = getState().cards.filter((c) => c.deckId === selectedDeckId);
      if (cards.length) {
        cardIndex = (cardIndex + step + cards.length) % cards.length;
        cardFlipped = false;
        renderCard();
      }
      return;
    }

    // Shuffle
    if (event.target.closest("[data-card-shuffle]")) {
      cardIndex = 0;
      cardFlipped = false;
      renderCard();
      showToast("Đã xáo trộn danh sách thẻ", "info");
      return;
    }

    // Trigger AI Card Modal / Prompt
    if (event.target.closest("[data-ai-generate-cards]")) {
      const topic = prompt(
        "Nhập chủ đề bạn muốn AI tạo Flashcards (ví dụ: JavaScript Async/Await):"
      );
      if (topic && topic.trim()) {
        addCard({
          deckName: topic.trim(),
          front: `Khái niệm cốt lõi của ${topic.trim()} là gì?`,
          back: `Là cơ chế tối ưu giúp xử lý luồng công việc mượt mà và trực quan hơn.`,
        });
        showToast(`Đã tạo bộ thẻ AI cho "${topic.trim()}"!`, "success");
      }
      return;
    }

    // QUIZ INTERACTIONS
    const quizBtn = event.target.closest("[data-quiz-select]");
    if (quizBtn) {
      selectedQuizId = quizBtn.dataset.quizSelect;
      quizIndex = 0;
      quizAnswers = [];
      quizFinished = false;
      renderQuizzes();
      return;
    }

    // Select Quiz Option
    const optionBtn = event.target.closest("[data-select-quiz-option]");
    if (optionBtn) {
      const optionIdx = Number(optionBtn.dataset.selectQuizOption);
      quizAnswers[quizIndex] = optionIdx;
      renderQuizStage();
      return;
    }

    // Quiz Nav
    const quizNav = event.target.closest("[data-quiz-nav]");
    if (quizNav) {
      const step = Number(quizNav.dataset.quizNav);
      quizIndex += step;
      renderQuizStage();
      return;
    }

    // Quiz Finish
    if (event.target.closest("[data-quiz-finish]")) {
      quizFinished = true;
      renderQuizStage();
      return;
    }

    // Quiz Restart
    if (event.target.closest("[data-quiz-restart]")) {
      quizIndex = 0;
      quizAnswers = [];
      quizFinished = false;
      renderQuizStage();
      return;
    }

    // Trigger AI Quiz
    if (event.target.closest("[data-ai-generate-quiz]")) {
      const title = prompt("Nhập chủ đề để AI tạo bài trắc nghiệm:");
      if (title && title.trim()) {
        addQuiz({
          title: `Quiz: ${title.trim()}`,
          questions: [
            {
              question: `Khái niệm quan trọng nhất trong ${title.trim()} là gì?`,
              options: [
                "Áp dụng nguyên lý cơ bản",
                "Chỉ thực hành khi có yêu cầu",
                "Ghi nhớ máy móc",
                "Không cần kiểm tra",
              ],
              answer: 0,
              explanation:
                "Nắm vững nguyên lý cơ bản là nền móng để giải quyết mọi bài toán phức tạp.",
            },
          ],
        });
        showToast(`Đã tạo bài Quiz AI cho "${title.trim()}"!`, "success");
      }
    }
  });

  // Modal forms
  const cardForm = document.querySelector("[data-card-form]");
  cardForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(cardForm);
    const deck = formData.get("deck")?.toString().trim();
    const front = formData.get("front")?.toString().trim();
    const back = formData.get("back")?.toString().trim();
    if (deck && front && back) {
      const deckId = addCard({ deckName: deck, front, back });
      cardForm.reset();
      const modal = document.querySelector("#card-modal");
      if (modal) hideModal(modal);
      selectedDeckId = deckId;
      showToast("Đã lưu thẻ Flashcard mới", "success");
    }
  });

  const quizForm = document.querySelector("[data-quiz-form]");
  quizForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(quizForm);
    const title = formData.get("title")?.toString().trim();
    const question = formData.get("question")?.toString().trim();
    const optA = formData.get("optionA")?.toString().trim();
    const optB = formData.get("optionB")?.toString().trim();
    const optC = formData.get("optionC")?.toString().trim();
    const optD = formData.get("optionD")?.toString().trim();
    const answer = Number(formData.get("answer"));
    const explanation = formData.get("explanation")?.toString().trim();

    if (title && question && optA && optB && optC && optD) {
      const created = addQuiz({
        title,
        questions: [
          {
            question,
            options: [optA, optB, optC, optD],
            answer,
            explanation,
          },
        ],
      });
      quizForm.reset();
      const modal = document.querySelector("#quiz-modal");
      if (modal) hideModal(modal);
      selectedQuizId = created.id;
      quizIndex = 0;
      quizAnswers = [];
      quizFinished = false;
      showToast("Đã lưu câu hỏi trắc nghiệm mới", "success");
    }
  });
};
