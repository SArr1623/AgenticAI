import { storageGet, storageSet, KEYS } from './storage.js';

const WMO = {
  0:  { d:'Clear sky',     i:'☀️' }, 1: { d:'Mainly clear', i:'🌤' },
  2:  { d:'Partly cloudy', i:'⛅' }, 3: { d:'Overcast',      i:'☁️' },
  45: { d:'Foggy',         i:'🌫' }, 48:{ d:'Icy fog',       i:'🌫' },
  51: { d:'Light drizzle', i:'🌦' }, 61:{ d:'Slight rain',   i:'🌧' },
  63: { d:'Moderate rain', i:'🌧' }, 65:{ d:'Heavy rain',    i:'🌧' },
  71: { d:'Slight snow',   i:'🌨' }, 73:{ d:'Moderate snow', i:'❄️' },
  75: { d:'Heavy snow',    i:'❄️' }, 80:{ d:'Showers',       i:'🌦' },
  95: { d:'Thunderstorm',  i:'⛈' }, 99:{ d:'Severe storm',  i:'⛈' },
};

const CACHE_TTL = 30 * 60 * 1000; // 30 min

function render({ temp, wmoCode }) {
  const info = WMO[wmoCode] || { d: 'Unknown', i: '🌡' };
  document.getElementById('weather-icon').textContent = info.i;
  document.getElementById('weather-temp').textContent = `${Math.round(temp)}°F`;
  document.getElementById('weather-desc').textContent = info.d;
}

function getCoords() {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => rej(new Error('Geolocation denied'))
    ));
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather fetch failed');
  const d = await r.json();
  return { temp: d.current_weather.temperature, wmoCode: d.current_weather.weathercode, fetchedAt: Date.now() };
}

export async function initWeather() {
  try {
    const cached = (await storageGet(KEYS.WEATHER_CACHE))[KEYS.WEATHER_CACHE];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) { render(cached); return; }
    const { lat, lon } = await getCoords();
    const weather = await fetchWeather(lat, lon);
    await storageSet({ [KEYS.WEATHER_CACHE]: weather });
    render(weather);
  } catch (e) {
    document.getElementById('weather-icon').textContent = '🌡';
    document.getElementById('weather-temp').textContent = '--°';
    if (e.message === 'Geolocation denied') {
      document.getElementById('weather-desc').textContent = 'Set location in Settings';
    } else {
      document.getElementById('weather-desc').textContent = 'Weather unavailable';
    }
  }
}
