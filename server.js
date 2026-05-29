const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

const API_KEY ="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";

function extractJson(content) {
  if (!content || typeof content !== "string") return null;

  const cleaned = content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    console.error("JSON parse failed. Raw AI content:\n", content);
    return null;
  }
}

async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://127.0.0.1:5500",
      "X-OpenRouter-Title": "TubeShell"
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenRouter error:", data);
    throw new Error(data?.error?.message || "OpenRouter failed");
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No AI content returned");
  }

  const parsed = extractJson(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON from AI");
  }

  return parsed;
}

app.get("/test", (req, res) => {
  res.json({ ok: true, message: "Backend working" });
});

app.get("/generate-quiz-test", (req, res) => {
  res.json({ ok: true, message: "Quiz route exists" });
});

app.post("/generate", async (req, res) => {
  try {
    console.log("HIT /generate");

    const transcript = req.body.transcript;

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({ error: "Transcript is required." });
    }

    const cleanTranscript = transcript.slice(0, 6000);

    const prompt = `
You are an expert teacher.

From the transcript below, create detailed study notes.

Transcript:
${cleanTranscript}

Return ONLY valid JSON in exactly this format:
{
  "summary": "5 to 7 sentence clear summary",
  "notes": "very detailed notes as plain text with section headings, subheadings, bullet points, explanations, examples, and key takeaways"
}

Rules:
- Return only JSON
- Do not include markdown code fences
- Do not include text before or after JSON
- notes must be a string
- Make notes detailed and useful for studying
`;

    const parsed = await callOpenRouter(prompt);

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No summary available.";

    let notes = parsed.notes;
    if (typeof notes !== "string") {
      notes = JSON.stringify(notes, null, 2);
    }
    if (!notes.trim()) {
      notes = "No notes available.";
    }

    return res.json({ summary, notes });
  } catch (err) {
    console.error("Generate route crash:", err);
    return res.status(500).json({ error: err.message || "AI failed" });
  }
});

app.post("/generate-quiz", async (req, res) => {
  try {
    console.log("HIT /generate-quiz");

    const transcript = req.body.transcript;

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({ error: "Transcript is required for quiz." });
    }

    const cleanTranscript = transcript.slice(0, 5000);

    const prompt = `
You are an expert teacher.

Create a quiz from this study material.

Content:
${cleanTranscript}

Return ONLY valid JSON in exactly this format:
{
  "quiz": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}

Rules:
- Create exactly 10 quiz questions
- Each question must have exactly 4 options
- correctIndex must be 0, 1, 2, or 3
- Vary correctIndex naturally
- Return only JSON
- No markdown
`;

    const parsed = await callOpenRouter(prompt);

    const quiz = Array.isArray(parsed.quiz) ? parsed.quiz : [];

    return res.json({ quiz });
  } catch (err) {
    console.error("Generate quiz crash:", err);
    return res.status(500).json({ error: err.message || "Quiz generation failed" });
  }
});

app.post("/generate-flashcards", async (req, res) => {
  try {
    console.log("HIT /generate-flashcards");

    const transcript = req.body.transcript;

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({ error: "Transcript is required for flashcards." });
    }

    const cleanTranscript = transcript.slice(0, 5000);

    const prompt = `
You are an expert teacher.

Create flashcards from this study material.

Content:
${cleanTranscript}

Return ONLY valid JSON in exactly this format:
{
  "flashcards": [
    {
      "q": "Question",
      "a": "Answer"
    }
  ]
}

Rules:
- Create exactly 10 flashcards
- Keep them concise but useful
- Return only JSON
- No markdown
`;

    const parsed = await callOpenRouter(prompt);

    const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];

    return res.json({ flashcards });
  } catch (err) {
    console.error("Generate flashcards crash:", err);
    return res.status(500).json({ error: err.message || "Flashcard generation failed" });
  }
});

app.get("/", (req, res) => {
  res.send("TubeShell backend is running");
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});