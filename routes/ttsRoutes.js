import express from "express";

const router = express.Router();

// Giọng đọc tiếng Việt miễn phí (Google Translate TTS - endpoint không chính thức)
router.get("/", async (req, res) => {
  try {
    const text = String(req.query.text || "").slice(0, 300);
    if (!text) {
      return res.status(400).json({ error: "Thiếu tham số text" });
    }
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=vi&client=tw-ob&ttsspeed=1`;
    const gRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!gRes.ok) {
      return res.status(gRes.status).send("TTS error");
    }
    res.setHeader("Content-Type", gRes.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await gRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("[TTS] Lỗi:", err.message);
    res.status(500).send("TTS error");
  }
});

export default router;
