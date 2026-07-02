import os
import sys
import requests
import subprocess

def run_git(args):
    result = subprocess.run(["git"] + args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[Git Error] Code {result.returncode}: {result.stderr.strip()}")
    return result

def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("[Error] GITHUB_TOKEN environment variable is not set!")
        sys.exit(1)
        
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # 1. 取得使用者名稱
    print("[GitHub] Fetching user information...")
    user_resp = requests.get("https://api.github.com/user", headers=headers)
    if user_resp.status_code != 200:
        print(f"[Error] Failed to fetch user: {user_resp.status_code} - {user_resp.text}")
        sys.exit(1)
        
    username = user_resp.json().get("login")
    print(f"[GitHub] Logged in as: {username}")
    
    # 2. 定義 Repo 名稱
    repo_name = "0056-ETF-Dividend-Dashboard"
    
    # 3. 檢查 Repo 是否已存在
    print(f"[GitHub] Checking if repository '{repo_name}' exists...")
    repo_check_resp = requests.get(f"https://api.github.com/repos/{username}/{repo_name}", headers=headers)
    
    if repo_check_resp.status_code == 404:
        # 建立新 Repo
        print(f"[GitHub] Repository '{repo_name}' not found. Creating a new one...")
        create_payload = {
            "name": repo_name,
            "description": "元大高股息 (0056) 歷年股利政策及除權息數據分析平台與套利試算器",
            "private": False, # 公開庫，方便部署 GitHub Pages
            "has_issues": True,
            "has_projects": True,
            "has_wiki": True
        }
        create_resp = requests.post("https://api.github.com/user/repos", json=create_payload, headers=headers)
        if create_resp.status_code != 201:
            print(f"[Error] Failed to create repository: {create_resp.status_code} - {create_resp.text}")
            sys.exit(1)
        print(f"[GitHub] Repository '{repo_name}' created successfully!")
    elif repo_check_resp.status_code == 200:
        print(f"[GitHub] Repository '{repo_name}' already exists.")
    else:
        print(f"[Error] Failed to check repository: {repo_check_resp.status_code} - {repo_check_resp.text}")
        sys.exit(1)
        
    # 4. 設定 Git 遠端並推送
    print("[Git] Configuring remote origin...")
    
    # 檢查是否已設定過 origin
    remotes = run_git(["remote", "-v"]).stdout
    if "origin" in remotes:
        print("[Git] Removing existing origin remote...")
        run_git(["remote", "remove", "origin"])
        
    # 設定含有 Token 的認證 URL，方便推送
    remote_url = f"https://{username}:{token}@github.com/{username}/{repo_name}.git"
    run_git(["remote", "add", "origin", remote_url])
    
    # 確認當前分支名稱並推送到 master
    print("[Git] Pushing code to GitHub...")
    push_result = subprocess.run(["git", "push", "-u", "origin", "master"], capture_output=True, text=True)
    
    if push_result.returncode == 0:
        print("\n" + "="*80)
        print(f"[Success] Successfully pushed to: https://github.com/{username}/{repo_name}")
        print("="*80)
    else:
        print(f"[Error] Failed to push code: {push_result.stderr.strip()}")
        sys.exit(1)

if __name__ == '__main__':
    main()
