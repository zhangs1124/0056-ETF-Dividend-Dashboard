import json
import os
import sys
from google.cloud import firestore
from google.oauth2.credentials import Credentials

def main():
    print("[Firebase] Initializing Firestore Client with Firebase CLI credentials...")
    project_id = "my-firebase-database-tes-bd654"
    
    # 1. 讀取 Firebase CLI 產生的 token 檔
    home_dir = os.path.expanduser("~")
    config_path = os.path.join(home_dir, ".config", "configstore", "firebase-tools.json")
    
    if not os.path.exists(config_path):
        print(f"[Error] Firebase config not found at: {config_path}")
        print("Please run `firebase login` first.")
        sys.exit(1)
        
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
        tokens = config.get("tokens")
        if not tokens:
            print("[Error] No tokens found in firebase-tools.json!")
            sys.exit(1)
            
        # 2. 建立認證憑證
        # Firebase CLI 的 Client ID 是固定的
        client_id = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
        
        creds = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=""  # Firebase CLI 公開 client 不需要 secret
        )
        
        # 3. 建立 Firestore 用戶端
        db = firestore.Client(project=project_id, credentials=creds)
        print(f"[Firebase] Connected to project: {project_id}")
        
        json_file = "dividend_data_0056.json"
        if not os.path.exists(json_file):
            print(f"[Error] Local file {json_file} not found!")
            sys.exit(1)
            
        print(f"[File] Reading local data from {json_file}...")
        with open(json_file, 'r', encoding='utf-8-sig') as f:
            records = json.load(f)
            
        print(f"[Firebase] Found {len(records)} records. Starting upload...")
        
        collection_ref = db.collection("0056_dividends")
        
        uploaded_count = 0
        for item in records:
            # 建立唯一的文件 ID（例如: "2026/07/21" -> "2026_07_21"）
            ex_date = item.get("ex_dividend_date")
            if not ex_date or ex_date == "--":
                doc_id = f"{item['year']}_unknown_{item['dividend']}"
            else:
                doc_id = ex_date.replace("/", "_")
                
            # 將資料寫入 Firestore
            doc_ref = collection_ref.document(doc_id)
            doc_ref.set(item)
            uploaded_count += 1
            print(f" -> [{uploaded_count}/{len(records)}] Uploaded document: {doc_id}")
            
        print(f"\n[Firebase] Success! Successfully imported {uploaded_count} records to collection '0056_dividends'.")
        
    except Exception as e:
        print(f"[Error] Failed to upload records to Firestore: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
