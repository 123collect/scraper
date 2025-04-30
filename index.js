const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

// Use the port from environment variable or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;

// Proxy Eporner API with rewrites
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q || "all";
    const apiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=20&thumbsize=big&order=top-weekly&format=json`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Rewrite thumbnail URLs to go through /thumb
    data.videos = data.videos.map(v => ({
      ...v,
      default_thumb: {
        ...v.default_thumb,
        src: `/thumb?url=${encodeURIComponent(v.default_thumb.src)}`
      },
      embed_url: `/embed?id=${v.id}`
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch data." });
  }
});

// Proxy thumbnails
app.get("/thumb", async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    res.set("Content-Type", contentType);
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send("Thumbnail failed.");
  }
});

// Proxy and rewrite embed iframe to prevent blocked content
app.get("/embed", async (req, res) => {
  const id = req.query.id;
  const embedUrl = `https://www.eporner.com/embed/${id}/`;

  try {
    const html = await (await fetch(embedUrl)).text();
    const $ = cheerio.load(html);

    // Remove tracking scripts, etc
    $("script, iframe").remove();
    const videoUrl = `https://www.eporner.com/embed/${id}/`;

    const rewritten = `
      <html><head>
        <style>body{margin:0; background:black;} iframe{width:100vw;height:100vh;border:none;}</style>
      </head><body>
        <iframe src="${videoUrl}" allowfullscreen></iframe>
      </body></html>
    `;
    res.send(rewritten);
  } catch (e) {
    res.status(500).send("Embed failed.");
  }
});

// Listen on the correct port as provided by Render
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
