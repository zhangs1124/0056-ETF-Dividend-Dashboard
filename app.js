// Firebase SDK 配置資訊 (由 MCP 自動偵測帶入)
const firebaseConfig = {
    projectId: "my-firebase-database-tes-bd654",
    appId: "1:976583530986:web:502682cb05859419d3ba93",
    storageBucket: "my-firebase-database-tes-bd654.firebasestorage.app",
    apiKey: "AIzaSyBuYlTp1xXBkG_K4s-ibPD73PzMPT4eYvU",
    authDomain: "my-firebase-database-tes-bd654.firebaseapp.com",
    messagingSenderId: "976583530986"
};

let db = null;
let currentSource = "local"; // "local" 或 "firebase"

// 初始化 Firebase
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.warn("Firebase initialization failed. Direct DB connection will be disabled.", error);
}

// DOM 元素
const btnLocal = document.getElementById("btn-local");
const btnFirebase = document.getElementById("btn-firebase");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const loadingIndicator = document.getElementById("loading");
const dataTable = document.getElementById("data-table");
const tableBody = document.getElementById("table-body");

// 統計欄位 DOM
const statLatestDiv = document.getElementById("stat-latest-div");
const statLatestDate = document.getElementById("stat-latest-date");
const statYearlyDiv = document.getElementById("stat-yearly-div");
const statYearlyYield = document.getElementById("stat-yearly-yield");
const statAvgFill = document.getElementById("stat-avg-fill");
const statTotalRecords = document.getElementById("stat-total-records");

// 主初始化程序
window.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadData();
});

// 設定按鈕事件監聽器
function setupEventListeners() {
    btnLocal.addEventListener("click", () => {
        if (currentSource === "local") return;
        setSourceMode("local");
        loadData();
    });

    btnFirebase.addEventListener("click", () => {
        if (currentSource === "firebase") return;
        if (!db) {
            alert("Firebase 資料庫未成功初始化，將持續使用本地資料模式！");
            return;
        }
        setSourceMode("firebase");
        loadData();
    });
}

// 切換資料來源模式 UI
function setSourceMode(mode) {
    currentSource = mode;
    if (mode === "local") {
        btnLocal.classList.add("active");
        btnFirebase.classList.remove("active");
        statusDot.className = "status-dot"; // 灰色 / 本地模式
        statusText.innerText = "目前資料來源: 本地 JSON 檔案";
    } else {
        btnLocal.classList.remove("active");
        btnFirebase.classList.add("active");
        statusDot.className = "status-dot online"; // 綠色亮燈
        statusText.innerText = "目前資料來源: Firebase Firestore (實時連線)";
    }
}

// 載入資料邏輯
async function loadData() {
    showLoading(true);
    let rawData = [];

    try {
        if (currentSource === "local") {
            rawData = await fetchLocalData();
        } else {
            rawData = await fetchFirebaseData();
        }
        
        if (rawData && rawData.length > 0) {
            renderDashboard(rawData);
        } else {
            showError("找不到任何除權息紀錄。");
        }
    } catch (error) {
        console.error("Error loading data:", error);
        showError("資料載入時發生錯誤: " + error.message);
        
        // 若 Firebase 載入出錯，自動降級回本地模式
        if (currentSource === "firebase") {
            console.warn("Firestore fetch failed. Falling back to local data...");
            setTimeout(() => {
                alert("無法連線至 Firestore，可能是安全性規則限制或網路問題。將自動切換為本地備份 JSON 資料！");
                setSourceMode("local");
                loadData();
            }, 1000);
        }
    }
}

// 從本地檔案獲取資料
async function fetchLocalData() {
    const response = await fetch("dividend_data_0056.json");
    if (!response.ok) {
        throw new Error(`HTTP 錯誤: ${response.status}`);
    }
    return await response.json();
}

// 從 Firebase Firestore 獲取資料
async function fetchFirebaseData() {
    if (!db) throw new Error("Firebase 尚未初始化！");
    
    // 從 '0056_dividends' 集合中取得所有文件並按日期降序排序 (最新在最前)
    const snapshot = await db.collection("0056_dividends")
                             .orderBy("ex_dividend_date", "desc")
                             .get();
                             
    const dataList = [];
    snapshot.forEach(doc => {
        dataList.push(doc.data());
    });
    
    // 如果資料庫中只有少量測試數據，為了展示效果，我們做降序排序以防順序有異
    return dataList.sort((a, b) => new Date(b.ex_dividend_date) - new Date(a.ex_dividend_date));
}

// 顯示或隱藏載入中指示器
function showLoading(isLoading) {
    if (isLoading) {
        loadingIndicator.style.display = "flex";
        dataTable.style.display = "none";
    } else {
        loadingIndicator.style.display = "none";
        dataTable.style.display = "table";
    }
}

// 顯示錯誤訊息
function showError(message) {
    loadingIndicator.style.display = "flex";
    loadingIndicator.innerHTML = `<p style="color: var(--danger-red);">${message}</p>`;
    dataTable.style.display = "none";
}

// 渲染儀表板與表格
function renderDashboard(data) {
    // 1. 清空舊表格列
    tableBody.innerHTML = "";

    // 2. 依序填入表格資料
    data.forEach(item => {
        const tr = document.createElement("tr");
        
        // 季度期別處理
        let periodText = "年度配息";
        if (item.ex_dividend_date) {
            const month = new Date(item.ex_dividend_date).getMonth() + 1;
            if (month === 1 || month === 2) periodText = "第一季配息";
            else if (month === 4 || month === 5) periodText = "第二季配息";
            else if (month === 7 || month === 8) periodText = "第三季配息";
            else if (month === 10 || month === 11) periodText = "第四季配息";
        }

        const daysToFillVal = item.days_to_fill;
        const daysToFillText = daysToFillVal === "--" || daysToFillVal === null ? "--" : `${daysToFillVal} 天`;
        const fillBadge = daysToFillVal !== "--" && daysToFillVal !== null && daysToFillVal <= 10 
                          ? `<span class="badge badge-success">${daysToFillText} (閃電填息)</span>` 
                          : daysToFillText;

        tr.innerHTML = `
            <td><strong>${item.year}</strong></td>
            <td><span class="badge badge-info">${periodText}</span></td>
            <td style="color: var(--accent-blue); font-weight: 600;">${item.dividend} 元</td>
            <td>${item.ex_dividend_date || "--"}</td>
            <td>${item.payment_date || "--"}</td>
            <td>${item.price_before_ex ? `${item.price_before_ex} 元` : "--"}</td>
            <td>${fillBadge}</td>
            <td style="font-weight: 600; color: ${item.yearly_yield > 8 ? 'var(--accent-teal)' : 'var(--text-primary)'}">${item.yearly_yield ? `${item.yearly_yield} %` : "--"}</td>
        `;
        tableBody.appendChild(tr);
    });

    // 3. 計算並更新統計欄位
    updateStatistics(data);
    
    // 4. 關閉 loading 指示器
    showLoading(false);
}

// 計算指標數據
function updateStatistics(data) {
    if (!data || data.length === 0) return;

    // A. 最新配息
    const latest = data[0];
    statLatestDiv.innerText = `${latest.dividend} 元`;
    statLatestDate.innerText = `除息日期: ${latest.ex_dividend_date || "--"}`;

    // B. 近一年累計股利
    const latestYear = latest.year;
    const sameYearRecords = data.filter(item => item.year === latestYear);
    const yearlySum = sameYearRecords.reduce((sum, item) => sum + item.dividend, 0);
    
    // 取最新配息前的股價算最新殖利率，或取資料中記載的年殖利率
    const yearlyYieldVal = latest.yearly_yield;
    
    statYearlyDiv.innerText = `${yearlySum.toFixed(3)} 元`;
    statYearlyYield.innerText = `年殖利率: ${yearlyYieldVal ? `${yearlyYieldVal} %` : "--"}`;

    // C. 平均填息天數與總配息次數
    let totalFillDays = 0;
    let fillDaysCount = 0;
    
    data.forEach(item => {
        const days = Number(item.days_to_fill);
        if (!isNaN(days) && days > 0) {
            totalFillDays += days;
            fillDaysCount++;
        }
    });

    const avgFillDays = fillDaysCount > 0 ? (totalFillDays / fillDaysCount).toFixed(1) : "--";
    
    statAvgFill.innerText = avgFillDays !== "--" ? `${avgFillDays} 天` : "--";
    statTotalRecords.innerText = `歷史配息次數: ${data.length} 次`;
}
