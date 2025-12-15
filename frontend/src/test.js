// tick-test.js
const axios = require("axios");

setInterval(() => {
  axios.post("http://localhost:1111/api/market/tick", {
    symbol: "AAPL",
    price: 270 + Math.random() * 20,
    time: Date.now(),
  }).then(() => {
    console.log("✅ Tick sent");
  }).catch(err => {
    console.error("❌ Error", err.message);
  });
}, 3000);
