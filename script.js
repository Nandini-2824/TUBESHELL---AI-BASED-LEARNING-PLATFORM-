async function generate() {
  const transcript = document.getElementById("transcript").value.trim();
  const btn = document.getElementById("generateBtn");
  const loader = document.getElementById("loader");
  const status = document.getElementById("status");

  if (!transcript) {
    alert("Paste transcript first");
    return;
  }

  loader.classList.remove("hidden");
  btn.disabled = true;
  status.innerText = "Generating detailed notes...";

  try {
    const res = await fetch("http://localhost:5000/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ transcript })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to generate notes");
    }

    localStorage.setItem(
      "data",
      JSON.stringify({
        transcript,
        summary: data.summary || "",
        notes: data.notes || "",
        quiz: [],
        flashcards: []
      })
    );

    localStorage.setItem("notesViewed", "no");
    localStorage.setItem("quizScore", "0");
    localStorage.setItem("quizTotal", "0");
    localStorage.setItem("flashScore", "0");
    localStorage.setItem("flashTotal", "0");

    window.location.href = "notes.html";
  } catch (err) {
    console.error(err);
    alert(err.message || "AI failed");
  } finally {
    loader.classList.add("hidden");
    btn.disabled = false;
    status.innerText = "";
  }
}

function formatNotesToHTML(text) {
  if (!text) return "<p>No notes found.</p>";

  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const lines = safe.split("\n");
  let html = "";
  let inList = false;

  for (let line of lines) {
    line = line.trim();

    if (!line) continue;

    if (
      line.endsWith(":") ||
      line.startsWith("## ") ||
      line.startsWith("# ")
    ) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }

      line = line.replace(/^##\s+|^#\s+/, "");
      html += `<h3>${line}</h3>`;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${line.substring(2)}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${line}</p>`;
  }

  if (inList) html += "</ul>";

  return html;
}

function loadNotes() {
  const d = JSON.parse(localStorage.getItem("data") || "{}");
  const summaryEl = document.getElementById("summary");
  const notesEl = document.getElementById("notes");

  if (!summaryEl || !notesEl) return;

  summaryEl.innerText = d.summary || "No summary found.";
  notesEl.innerHTML = formatNotesToHTML(d.notes || "No notes found.");

  localStorage.setItem("notesViewed", "yes");
}

async function goQuiz() {
  try {
    const d = JSON.parse(localStorage.getItem("data") || "{}");

    if (!d.notes) {
      alert("Generate notes first!");
      return;
    }

    if (Array.isArray(d.quiz) && d.quiz.length > 0) {
      window.location.href = "quiz.html";
      return;
    }

    const res = await fetch("http://localhost:5000/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ transcript: d.notes })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || "Quiz generation failed");
    }

    d.quiz = Array.isArray(data.quiz) ? data.quiz : [];
    localStorage.setItem("data", JSON.stringify(d));
    localStorage.setItem("quizScore", "0");
    localStorage.setItem("quizTotal", String(d.quiz.length));

    window.location.href = "quiz.html";
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to generate quiz");
  }
}

let quizScore = 0;

function loadQuiz() {
  const d = JSON.parse(localStorage.getItem("data") || "{}");
  const quiz = Array.isArray(d.quiz) ? d.quiz : [];
  const container = document.getElementById("quizContainer");

  if (!container) return;

  quizScore = 0;
  localStorage.setItem("quizScore", "0");
  localStorage.setItem("quizTotal", String(quiz.length));

  if (!quiz.length) {
    container.innerHTML = "<p>No quiz found.</p>";
    return;
  }

  container.innerHTML = "";

  quiz.forEach((q, index) => {
    const card = document.createElement("div");
    card.className = "quiz-card";

    const question = document.createElement("div");
    question.className = "quiz-question";
    question.innerText = `Q${index + 1}. ${q.question || "Question missing"}`;

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "quiz-options";

    const options = Array.isArray(q.options) ? q.options : [];

    if (options.length === 4) {
      options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className = "quiz-option";
        btn.innerText = opt;

        btn.onclick = () => {
          if (optionsWrap.dataset.answered === "yes") return;
          optionsWrap.dataset.answered = "yes";

          const buttons = optionsWrap.querySelectorAll("button");

          buttons.forEach((b, idx) => {
            b.disabled = true;
            if (idx === q.correctIndex) b.classList.add("correct");
          });

          if (i === q.correctIndex) {
            quizScore++;
            localStorage.setItem("quizScore", String(quizScore));
          } else {
            btn.classList.add("wrong");
          }
        };

        optionsWrap.appendChild(btn);
      });
    } else {
      optionsWrap.innerHTML = "<p>Options missing from AI response.</p>";
    }

    card.appendChild(question);
    card.appendChild(optionsWrap);
    container.appendChild(card);
  });
}

async function finishQuiz() {
  try {
    const d = JSON.parse(localStorage.getItem("data") || "{}");

    if (!d.notes) {
      alert("Generate notes first.");
      return;
    }

    if (!Array.isArray(d.flashcards) || d.flashcards.length === 0) {
      const res = await fetch("http://localhost:5000/generate-flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ transcript: d.notes })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Flashcard generation failed");
      }

      d.flashcards = Array.isArray(data.flashcards) ? data.flashcards : [];
      localStorage.setItem("data", JSON.stringify(d));
    }

    window.location.href = "flashcards.html";
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to generate flashcards");
  }
}

let cards = [];
let currentCard = 0;
let flippedCards = new Set();
let showingAnswer = false;

function initFlashcards() {
  const d = JSON.parse(localStorage.getItem("data") || "{}");
  cards = Array.isArray(d.flashcards) ? d.flashcards : [];

  const textEl = document.getElementById("flashcardText");
  const progressEl = document.getElementById("flashProgress");

  if (!textEl || !progressEl) return;

  if (!cards.length) {
    textEl.innerText = "No flashcards found.";
    progressEl.innerText = "";
    return;
  }

  currentCard = 0;
  showingAnswer = false;
  flippedCards = new Set();
  showCard();
}

function showCard() {
  const card = cards[currentCard];
  if (!card) return;

  document.getElementById("flashcardText").innerText = showingAnswer ? card.a : card.q;
  document.getElementById("flashProgress").innerText = `Card ${currentCard + 1} / ${cards.length}`;
}

function flipCard() {
  if (!cards.length) return;
  showingAnswer = !showingAnswer;
  if (showingAnswer) flippedCards.add(currentCard);
  showCard();
}

function nextCard() {
  if (!cards.length) return;
  if (currentCard < cards.length - 1) {
    currentCard++;
    showingAnswer = false;
    showCard();
  }
}

function prevCard() {
  if (!cards.length) return;
  if (currentCard > 0) {
    currentCard--;
    showingAnswer = false;
    showCard();
  }
}

function goDashboard() {
  localStorage.setItem("flashScore", String(flippedCards.size));
  localStorage.setItem("flashTotal", String(cards.length));
  window.location.href = "dashboard.html";
}

function loadDashboard() {
  const notes = localStorage.getItem("notesViewed");
  const score = Number(localStorage.getItem("quizScore")) || 0;
  const total = Number(localStorage.getItem("quizTotal")) || 0;
  const flashScore = Number(localStorage.getItem("flashScore")) || 0;
  const flashTotal = Number(localStorage.getItem("flashTotal")) || 0;

  const notesStatus = document.getElementById("notesStatus");
  const quizStatus = document.getElementById("quizStatus");
  const flashStatus = document.getElementById("flashStatus");
  const overall = document.getElementById("overall");

  if (!notesStatus || !quizStatus || !flashStatus || !overall) return;

  notesStatus.innerText =
    notes === "yes" ? "✅ Notes Completed" : "❌ Notes Not Viewed";

  quizStatus.innerText =
    total > 0 ? `❓ Quiz Score: ${score}/${total}` : "❌ Quiz Not Attempted";

  flashStatus.innerText =
    flashTotal > 0 ? `🧠 Flashcards Completed: ${flashScore}/${flashTotal}` : "❌ Flashcards Not Done";

  let progress = 0;
  if (notes === "yes") progress += 30;
  if (total > 0) progress += (score / total) * 40;
  if (flashTotal > 0) progress += (flashScore / flashTotal) * 30;

  overall.innerText = `Overall Progress: ${Math.round(progress)}%`;
}

function goHome() {
  window.location.href = "index.html";
}