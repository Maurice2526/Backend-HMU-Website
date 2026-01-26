import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   KONFIG
========================= */

const ROOMS = [
  {
    id: "P4.34",
    name: "P4.34",
    url: "https://www.trainex32.de/hmu24/public/ress_qr.cfm?con=781854&secur=3SB"
  }
];

const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 Minuten

/* =========================
   CACHE
========================= */

let cache = {
  updatedAt: null,
  rooms: []
};

/* =========================
   SCRAPER
========================= */

async function scrapeTrainexRoom(room) {
  const { data: html } = await axios.get(room.url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(html);

  const bodyText = $("body").text().toLowerCase();

  let status = "unbekannt";
  if (bodyText.includes("derzeit frei")) status = "frei";
  if (bodyText.includes("derzeit belegt")) status = "belegt";

  // Termine extrahieren (robust gegen mehrere <br>)
  const rawHtml = $("body").html() || "";

  const bookings = rawHtml
    .split("<br>")
    .map(line => cheerio.load(line).text().trim())
    .filter(line =>
      line &&
      /\d{2}\.\d{2}\.\d{2}/.test(line)
    );

  return {
    id: room.id,
    name: room.name,
    status,
    currentBooking: status === "belegt" ? bookings[0] || null : null,
    upcomingBookings: bookings
  };
}

/* =========================
   UPDATE CACHE
========================= */

async function updateCache() {
  console.log("🔄 Aktualisiere Trainex-Daten…");

  const results = [];

  for (const room of ROOMS) {
    try {
      const data = await scrapeTrainexRoom(room);
      results.push(data);
    } catch (err) {
      console.error("❌ Fehler bei Raum:", room.id);
      results.push({
        id: room.id,
        name: room.name,
        error: true
      });
    }
  }

  cache = {
    updatedAt: new Date().toISOString(),
    rooms: results
  };

  console.log("✅ Update abgeschlossen");
}

// Initial + Intervall
updateCache();
setInterval(updateCache, UPDATE_INTERVAL);

/* =========================
   API
========================= */

app.get("/api/rooms", (req, res) => {
  res.json(cache);
});

/* Healthcheck (wichtig für Render) */
app.get("/", (req, res) => {
  res.send("Trainex Backend läuft 🚀");
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});

