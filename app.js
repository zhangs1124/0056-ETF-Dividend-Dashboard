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
let isCalculatedPrefilled = false; // 是否已預填過計算機

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

// 試算器輸入 DOM
const inputPrincipal = document.getElementById("input-principal");
const inputPrice = document.getElementById("input-price");
const inputDividend = document.getElementById("input-dividend");
const inputDiscount = document.getElementById("input-discount");

// 主初始化程序
window.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadData();
});

// 設定按鈕事件監聽器與輸入框聯動
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

    // 試算器輸入即時監聽
    [inputPrincipal, inputPrice, inputDividend, inputDiscount].forEach(input => {
        input.addEventListener("input", calculateArbitrage);
    });
}

// 切換資料來源模式 UI
function setSourceMode(mode) {
    currentSource = mode;
    if (mode === "local") {
        btnLocal.classList.add("active");
        btnFirebase.classList.remove("active");
        statusDot.className = "status-dot";
        statusText.innerText = "目前資料來源: 本地 JSON 檔案";
    } else {
        btnLocal.classList.remove("active");
        btnFirebase.classList.add("active");
        statusDot.className = "status-dot online";
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
    
    const snapshot = await db.collection("0056_dividends")
                             .orderBy("ex_dividend_date", "desc")
                             .get();
                             
    const dataList = [];
    snapshot.forEach(doc => {
        dataList.push(doc.data());
    });
    
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
    tableBody.innerHTML = "";

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
        const fillBadge = daysToFillVal !== "--" && daysToFillVal !== null && daysToFillVal <= 15 
                          ? `<span class="badge badge-success">${daysToFillText} (快速填息)</span>` 
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

    // 計算並更新統計欄位
    updateStatistics(data);
    
    // 如果是第一次載入，用最新的配息與股價自動填入試算器
    if (!isCalculatedPrefilled && data.length > 0) {
        const latest = data[0];
        if (latest.price_before_ex) inputPrice.value = latest.price_before_ex;
        if (latest.dividend) inputDividend.value = latest.dividend;
        isCalculatedPrefilled = true;
    }

    // 計算除權息套利
    calculateArbitrage();
    
    showLoading(false);
}

// 更新統計欄位
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
    const yearlyYieldVal = latest.yearly_yield;
    
    statYearlyDiv.innerText = `${yearlySum.toFixed(3)} 元`;
    statYearlyYield.innerText = `年殖利率: ${yearlyYieldVal ? `${yearlyYieldVal} %` : "--"}`;

    // C. 平均填息天數
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

// 核心計算：除權息套利試算器
function calculateArbitrage() {
    const principal = parseFloat(inputPrincipal.value) || 0;
    const price = parseFloat(inputPrice.value) || 0;
    const dividend = parseFloat(inputDividend.value) || 0;
    const discount = parseFloat(inputDiscount.value) || 10;
    
    const resShares = document.getElementById("res-shares");
    const resCosts = document.getElementById("res-costs");
    const resNetDividend = document.getElementById("res-net-dividend");
    const resNetProfit = document.getElementById("res-net-profit");
    const resReturnRate = document.getElementById("res-return-rate");
    const resTaxCredit = document.getElementById("res-tax-credit");
    const nhiBadge = document.getElementById("nhi-badge");

    if (principal <= 0 || price <= 0 || dividend <= 0) {
        resShares.innerText = "-- 股 (0 張)";
        resCosts.innerText = "-- 元";
        resNetDividend.innerText = "-- 元";
        resNetProfit.innerText = "-- 元";
        resReturnRate.innerText = "-- %";
        resTaxCredit.innerText = "+ 0 元";
        nhiBadge.style.display = "none";
        return;
    }

    // 1. 買進手續費 (台灣單邊手續費率 0.1425%)
    const buyFeeRate = 0.001425 * (discount / 10);
    const buyCostPerShare = price * (1 + buyFeeRate);
    
    // 計算可買最大股數
    const shares = Math.floor(principal / buyCostPerShare);
    const lots = Math.floor(shares / 1000);
    const oddShares = shares % 1000;
    
    resShares.innerText = `${shares.toLocaleString()} 股 (${lots} 張 ${oddShares > 0 ? `又 ${oddShares} 股` : ""})`;

    // 實際購買股票花費金額
    const stockValue = shares * price;
    // 買進手續費 (低消通常 20 元)
    const buyFee = Math.max(20, Math.floor(stockValue * buyFeeRate));

    // 2. 領取股息與二代健保補充保費 (單筆股息 >= 20,000 元起扣 2.11% 補充保費)
    const rawDividend = shares * dividend;
    let nhiDeduction = 0;
    
    if (rawDividend >= 20000) {
        nhiDeduction = Math.floor(rawDividend * 0.0211);
        nhiBadge.innerText = `扣 2.11% 健保費 (-${nhiDeduction.toLocaleString()}元)`;
        nhiBadge.className = "badge badge-danger";
        nhiBadge.style.display = "inline-block";
    } else {
        nhiBadge.innerText = "免扣健保補充保費";
        nhiBadge.className = "badge badge-success";
        nhiBadge.style.display = "inline-block";
    }
    
    // 扣除匯費 10 元與補充保費後的實領股利
    const netDividend = Math.max(0, Math.floor(rawDividend - nhiDeduction - 10));
    resNetDividend.innerText = `${netDividend.toLocaleString()} 元`;

    // 3. 賣出成本 (以除息前價格賣出)
    const sellFeeRate = 0.001425 * (discount / 10);
    const sellFee = Math.max(20, Math.floor(stockValue * sellFeeRate));
    // ETF 證交稅為 0.1%
    const taxRate = 0.001; 
    const tax = Math.floor(stockValue * taxRate);

    // 總交易摩擦成本 (買手續費 + 賣手續費 + 證交稅 + 匯費)
    const totalCosts = buyFee + sellFee + tax + 10;
    resCosts.innerText = `${totalCosts.toLocaleString()} 元`;

    // 4. 純收益 (填息賣出後)
    // 淨利 = 實領股息 - 總摩擦成本
    const netProfit = Math.floor(netDividend - buyFee - sellFee - tax);
    
    // 依據利潤正負決定顯示顏色
    if (netProfit >= 0) {
        resNetProfit.innerHTML = `<span style="color: var(--accent-teal);">${netProfit.toLocaleString()} 元</span>`;
    } else {
        resNetProfit.innerHTML = `<span style="color: var(--danger-red);">${netProfit.toLocaleString()} 元 (虧損)</span>`;
    }

    // 5. 淨報酬率 (淨利 / 買進總花費)
    const totalSpent = stockValue + buyFee;
    const returnRate = totalSpent > 0 ? (netProfit / totalSpent) * 100 : 0;
    resReturnRate.innerText = `${returnRate.toFixed(2)} %`;

    // 6. 個人綜合所得稅抵減額估算 (8.5% 退稅紅利，每一申報戶最高 8 萬元)
    const taxCredit = Math.floor(rawDividend * 0.085);
    resTaxCredit.innerText = `+ ${taxCredit.toLocaleString()} 元`;
}
