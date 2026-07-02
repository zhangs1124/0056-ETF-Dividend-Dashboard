import os
import csv
import json
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def main():
    url = "https://www.wantgoo.com/stock/etf/0056/dividend-policy/ex-dividend"
    csv_file = "dividend_data_0056.csv"
    json_file = "dividend_data_0056.json"
    
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
        print(f"[Playwright] Navigating to: {url}...")
        
        try:
            page.goto(url, wait_until="load", timeout=30000)
            print(f"[Playwright] Page title: {page.title()}")
            
            print("[Playwright] Waiting for table rows (up to 15s)...")
            page.wait_for_selector("#dividend tbody tr", timeout=15000)
            print("[Playwright] Table loaded, parsing HTML...")
            
            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')
            table = soup.find('table', id='dividend')
            
            if not table:
                print("[Playwright] Error: Table not found in DOM.")
                browser.close()
                return
                
            rows = table.find_all('tr')
            parsed_data = []
            
            csv_headers = [
                '除權息年度', '股利 (元)', '除息日', '發放日', 
                '除息前股價 (元)', '填息天數', '年股利 (元)', '年殖利率 (%)'
            ]
            
            for tr in rows[2:]:
                tds = [td.get_text(strip=True) for td in tr.find_all('td')]
                if len(tds) < 8:
                    continue
                
                row_dict = {
                    'year': tds[0],
                    'dividend': tds[1],
                    'ex_dividend_date': tds[2],
                    'payment_date': tds[3],
                    'price_before_ex': tds[4],
                    'days_to_fill': tds[5],
                    'yearly_dividend': tds[6],
                    'yearly_yield': tds[7]
                }
                parsed_data.append(row_dict)
                
            print(f"[Playwright] Successfully parsed {len(parsed_data)} records.")
            
            with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(csv_headers)
                for item in parsed_data:
                    writer.writerow([
                        item['year'],
                        item['dividend'],
                        item['ex_dividend_date'],
                        item['payment_date'],
                        item['price_before_ex'],
                        item['days_to_fill'],
                        item['yearly_dividend'],
                        item['yearly_yield']
                    ])
            print(f"[File] Exported CSV to: {os.path.abspath(csv_file)}")
            
            with open(json_file, 'w', encoding='utf-8-sig') as f:
                json.dump(parsed_data, f, ensure_ascii=False, indent=4)
            print(f"[File] Exported JSON to: {os.path.abspath(json_file)}")
            
            print("\nPreview of top 5 records:")
            print("-" * 80)
            print(f"{'Year':^6} | {'Div':^6} | {'Ex-Date':^10} | {'Pay-Date':^10} | {'Pre-Price':^10} | {'FillDays':^8} | {'Yield(%)':^10}")
            print("-" * 80)
            for item in parsed_data[:5]:
                print(f"{item['year']:^6} | {item['dividend']:^6} | {item['ex_dividend_date']:^10} | {item['payment_date']:^10} | {item['price_before_ex']:^10} | {item['days_to_fill']:^8} | {item['yearly_yield']:^10}")
            print("-" * 80)
            
        except Exception as e:
            print(f"[Error] Exception occurred: {e}")
        finally:
            browser.close()
            print("[Playwright] Browser closed.")

if __name__ == '__main__':
    main()
