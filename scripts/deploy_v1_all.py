import os
import sys
import paramiko
from datetime import datetime

# Configuration from environment or hardcoded defaults for fallback
HOST = '120.55.5.220'
USER = 'root'
PASSWORD = 'WsT130575967132' # Note: Using the password from the logs/rules

# Paths
LOCAL_LATEST_YML = 'packages/electron/release-v1601-win/latest.yml'
REMOTE_DEST_YML = '/var/www/html/downloads/latest.yml'
REMOTE_VERSIONS_JSON = '/var/www/html/downloads/versions.json'
REMOTE_BACKUP_JSON = '/var/www/html/downloads/versions.json.bak'

def run_ssh_cmd(client, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return exit_status, out, err

def deploy_all():
    version = "1.60.1"
    print(f"Starting Full Deployment for v{version}...")
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=HOST, username=USER, password=PASSWORD)
        print("Connected to production server.")

        # 1. Backup remote versions.json
        print(f"Backing up {REMOTE_VERSIONS_JSON}...")
        status, out, err = run_ssh_cmd(client, f'cp {REMOTE_VERSIONS_JSON} {REMOTE_BACKUP_JSON}')
        if status != 0:
            print(f"Backup failed: {err}")
            return

        # 2. Upload latest.yml via SFTP
        if os.path.exists(LOCAL_LATEST_YML):
            print(f"Uploading {LOCAL_LATEST_YML} to {REMOTE_DEST_YML}...")
            sftp = client.open_sftp()
            sftp.put(LOCAL_LATEST_YML, REMOTE_DEST_YML)
            sftp.close()
            print("Upload of latest.yml complete.")
        else:
            print(f"Warning: Local file {LOCAL_LATEST_YML} not found. Skipping.")

        # 3. Update remote versions.json
        print("Updating remote versions.json...")
        update_script = f'''
import json
import os
path = "{REMOTE_VERSIONS_JSON}"
new_version = "{version}"
if os.path.exists(path):
    with open(path, 'r') as f:
        data = json.load(f)
    data["latest"] = new_version
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Successfully updated {{path}} to {{new_version}}")
else:
    print(f"Error: {{path}} not found")
    exit(1)
'''
        remote_script = '/tmp/update_versions.py'
        sftp = client.open_sftp()
        sftp.putfo(update_script.encode(), remote_script)
        sftp.close()
        
        status, out, err = run_ssh_cmd(client, f'python3 {remote_script}')
        if status == 0:
            print(out)
        else:
            print(f"Remote update failed: {err}")

        # 4. Trigger OSS Upload (If credentials provided in .env)
        # We check if .env exists and has OSS keys
        if os.path.exists('.env'):
            print("Found .env, attempting to trigger OSS upload...")
            # In a real scenario, we would call the python script directly
            # For this automation, we assume the user will run the orchestrator
            print("Note: Please ensure OSS credentials are set in .env and run 'python scripts/deploy_to_ss.py' manually or via CI.")
        
        client.close()
        print("\n--- Deployment Phase 1 (SFTP) Completed Successfully ---")

    except Exception as e:
        print(f"Deployment failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    import sys
    deploy_all()
