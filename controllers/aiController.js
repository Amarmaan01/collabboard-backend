const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper: extract JSON from Gemini response (strips markdown fences if present)
const extractJSON = (text) => {
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
};

// POST /api/ai/summarize
const summarize = async (req, res) => {
  try {
    const { chatHistory, eventLog } = req.body;

    if (!chatHistory && !eventLog) {
      return res
        .status(400)
        .json({ message: "chatHistory or eventLog required" });
    }

    const prompt = `You are an AI assistant for a collaborative whiteboard app called CollabBoard AI.
Analyze the following session data and return a JSON object with:
- summary: a concise summary of the session
- keyPoints: array of key discussion points
- actionItems: array of action items identified

Chat History:
${JSON.stringify(chatHistory || [], null, 2)}

Event Log (last 50 events):
${JSON.stringify((eventLog || []).slice(-50), null, 2)}

Respond ONLY with valid JSON. No markdown, no HTML, no explanation.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const content = result.response.text();
    const parsed = extractJSON(content);

    res.json(parsed);
  } catch (error) {
    console.error("AI summarize error:", error);
    res.status(500).json({
      message: "AI summarization failed",
      summary: "Unable to generate summary at this time.",
      keyPoints: [],
      actionItems: [],
    });
  }
};

// POST /api/ai/generate-diagram
const generateDiagram = async (req, res) => {
  try {
    const { prompt: userPrompt } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    const prompt = `You are a diagram generator for a collaborative whiteboard app.
Given the following description, generate a diagram as structured JSON.

Description: ${userPrompt}

Return ONLY valid JSON with this format:
{
  "elements": [
    {
      "id": "unique-id",
      "type": "box",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "text": "label"
    },
    {
      "id": "unique-id",
      "type": "arrow",
      "from": "box-id",
      "to": "box-id"
    }
  ]
}

Rules:
- Use "box" for nodes and "arrow" for connections.
- Position boxes in a logical layout starting from x:100, y:100.
- Space boxes at least 200px apart.
- Use sensible widths (120-200) and heights (60-80).
- Every box must have a unique id.
- No markdown. No HTML. ONLY valid JSON.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const content = result.response.text();
    const parsed = extractJSON(content);

    res.json(parsed);
  } catch (error) {
    console.error("AI generate-diagram error:", error);
    res.status(500).json({
      message: "AI diagram generation failed",
      elements: [],
    });
  }
};

// POST /api/ai/handwriting — Recognize handwriting from canvas image
const recognizeHandwriting = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: "Image data is required" });
    }

    // Extract base64 data and mime type from data URL
    const matches = image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ message: "Invalid image format. Expected base64 data URL." });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      "Look at this whiteboard image. Identify any handwritten text in the image and transcribe it accurately. Return ONLY the recognized text as a plain string. If no text is found, return an empty string. No explanations, no formatting.",
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const text = result.response.text().trim();

    res.json({ text });
  } catch (error) {
    console.error("AI handwriting recognition error:", error);
    res.status(500).json({
      message: "Handwriting recognition failed",
      text: "",
    });
  }
};

module.exports = { summarize, generateDiagram, recognizeHandwriting };
