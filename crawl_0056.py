import os
import csv
import json
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

class DividendRecord:
    def __init__(self, year, dividend, ex_dividend_date, payment_date, price_before_ex, days_to_fill, yearly_dividend, yearly_yield):
        self.year = int(year) if year.isdigit() else year
        self.dividend = float(dividend) if dividend and dividend != '--' else 0.0
        self.ex_dividend_date = ex_dividend_date
        self.payment_date = payment_date
        self.price_before_ex = float(price_before_ex) if price_before_ex and price_before_ex != '--' else 0.0
        self.days_to_fill = int(days_to_fill) if days_to_fill and days_to_fill.isdigit() else days_to_fill
        self.yearly_dividend = float(yearly_dividend) if yearly_dividend and yearly_dividend != '--' else 0.0
        # 移除百分比符號以轉換為 float 數值
        self.yearly_yield = float(yearly_yield.replace('%', '')) if yearly_yield and yearly_yield != '--' else 0.0

    def to_dict(self):
        """轉換為字典格式，方便未來直接上傳 Firebase"""
        return {
            "year": self.year,
            "dividend": self.dividend,
            "ex_dividend_date": self.ex_dividend_date,
            "payment_date": self.payment_date,
            "price_before_ex": self.price_before_ex,
            "days_to_fill": self.days_to_fill,
            "yearly_dividend": self.yearly_dividend,
            "yearly_yield": self.yearly_yield
        }

    def __repr__(self):
        return f"<DividendRecord {self.year} - Div: {self.dividend}>"

class WantGooCrawler:
    def __init__(self, stock_no="0056"):
        self.stock_no = stock_no
        self.url = f"https://www.wantgoo.com/stock/etf/{stock_no}/dividend-policy/ex-dividend"

    def fetch_dividend_records(self) -> list[DividendRecord]:
        records = []
        print("[Playwright] Starting browser...")
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled']
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            page = context.new_page()
            print(f"[Playwright] Navigating to: {self.url}...")
            
            try:
                page.goto(self.url, wait_until="load", timeout=30000)
                print(f"[Playwright] Page title: {page.title()}")
                
                print("[Playwright] Waiting for table rows (up to 15s)...")
                page.wait_for_selector("#dividend tbody tr", timeout=15000)
                print("[Playwright] Table loaded, parsing HTML...")
                
                content = page.content()
                soup = BeautifulSoup(content, 'html.parser')
                table = soup.find('table', id='dividend')
                
                if not table:
                    print("[Playwright] Error: Table not found in DOM.")
                    return []
                    
                rows = table.find_all('tr')
                for tr in rows[2:]:
                    tds = [td.get_text(strip=True) for td in tr.find_all('td')]
                    if len(tds) < 8:
                        continue
                    
                    record = DividendRecord(
                        year=tds[0],
                        dividend=tds[1],
                        ex_dividend_date=tds[2],
                        payment_date=tds[3],
                        price_before_ex=tds[4],
                        days_to_fill=tds[5],
                        yearly_dividend=tds[6],
                        yearly_yield=tds[7]
                    )
                    records.append(record)
                    
            except Exception as e:
                print(f"[Error] Exception occurred: {e}")
            finally:
                browser.close()
                print("[Playwright] Browser closed.")
                
        return records

def main():
    stock_no = "0056"
    crawler = WantGooCrawler(stock_no)
    records = crawler.fetch_dividend_records()
    
    if not records:
        print("No records crawled.")
        return
        
    print(f"[Main] Successfully crawled {len(records)} records.")
    
    # 匯出 CSV (採用 UTF-8 BOM 格式)
    csv_file = f"dividend_data_{stock_no}.csv"
    csv_headers = [
        '除權息年度', '股利 (元)', '除息日', '發放日', 
        '除息前股價 (元)', '填息天數', '年股利 (元)', '年殖利率 (%)'
    ]
    with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        for r in records:
            d = r.to_dict()
            writer.writerow([
                d['year'],
                d['dividend'],
                d['ex_dividend_date'],
                d['payment_date'],
                d['price_before_ex'],
                d['days_to_fill'],
                d['yearly_dividend'],
                d['yearly_yield']
            ])
    print(f"[File] Exported CSV to: {os.path.abspath(csv_file)}")
    
    # 匯出 JSON
    json_file = f"dividend_data_{stock_no}.json"
    with open(json_file, 'w', encoding='utf-8-sig') as f:
        json.dump([r.to_dict() for r in records], f, ensure_ascii=False, indent=4)
    print(f"[File] Exported JSON to: {os.path.abspath(json_file)}")
    
    # 預覽轉換為 dict 的物件
    print("\n[Preview] Top 3 Firebase ready dict objects:")
    print("-" * 80)
    for r in records[:3]:
        print(json.dumps(r.to_dict(), ensure_ascii=False, indent=2))
    print("-" * 80)

if __name__ == '__main__':
    main()
