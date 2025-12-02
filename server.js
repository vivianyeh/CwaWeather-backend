require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
// getWeather 只回傳資料，不使用 res
async function getWeather(location) {
  if (!CWA_API_KEY) {
    const error = new Error("請在 .env 檔案中設定 CWA_API_KEY");
    error.status = 500;
    throw error;
  }

  try {
    const response = await axios.get(`${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`, {
      params: {
        Authorization: CWA_API_KEY,
        locationName: location,
      },
    });

    const locationData = response.data.records.location[0];

    if (!locationData) {
      const error = new Error(`無法取得 ${location} 天氣資料`);
      error.status = 404;
      throw error;
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx": forecast.weather = value.parameterName; break;
          case "PoP": forecast.rain = value.parameterName + "%"; break;
          case "MinT": forecast.minTemp = value.parameterName + "°C"; break;
          case "MaxT": forecast.maxTemp = value.parameterName + "°C"; break;
          case "CI": forecast.comfort = value.parameterName; break;
          case "WS": forecast.windSpeed = value.parameterName; break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    return weatherData; // ✅ 回傳給路由
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      const err = new Error(error.response.data.message || "CWA API 錯誤");
      err.status = error.response.status;
      throw err;
    }

    const err = new Error("無法取得天氣資料，請稍後再試");
    err.status = 500;
    throw err;
  }
}

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      weatherByCity: "/api/weather/:location", // 動態抓城市
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});


// Weather 代理路由
app.get("/api/weather/:location", async (req, res) => {
  const location = req.params.location;
  console.log(`取得 ${location} 天氣資料`);
  try {
    const data = await getWeather(location);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
