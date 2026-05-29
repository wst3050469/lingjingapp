import paramiko
import os

host = '120.55.5.220'
user = 'root'
password = 'WsT13575967132'
local_file = 'packages/electron/release-v1601-win/latest.yml'
remote_dest = '/var/www/html/downloads/latest.yml'
remote_versions = '/var/www/html/downloads/versions.json'
remote_backup = '/var/www/html/downloads/versions.json.bak'

def deploy():
    try:
        print(f'Connecting to {host}...')
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=host, username=user, password=password)
        print('Connected successfully.')

        # 1. Backup remote versions.json
        print(f'Backing up {remote_versions} to {remote_backup}...')
        stdin, stdout, stderr = client.exec_stream(f'cp {remote_versions} {remote_backup}')
        # Note: exec_command is the correct method
        
        # Let's use a cleaner approach for command execution
        def run_cmd(cmd):
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            return exit_status, stdout.read().decode(), stderr.read().decode()

        status, out, err = run_cmd(f'cp {remote_versions} {remote_backup}')
        if status == 0:
            print('Backup successful.')
        else:
            print(f'Backup failed: {err}')
            return

        # 2. Upload local latest.yml
        print(f'Uploading {local_file} to {remote_dest}...')
        sftp = client.open_sftp()
        sftp.put(local_file, remote_dest)
        sftp.close()
        print('Upload complete.')

        # 3. Update remote versions.json using a remote python script
        update_script = f'''
import json
import os

path = "{remote_versions}"
new_version = "1.60.1"

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
        remote_script_path = '/tmp/update_versions.py'
        sftp = client.open_sftp()
        sftp.putfo(update_script.encode(), remote_script_path)
        sftp.close()

        print('Executing remote version update...')
        status, out, err = run_cmd(f'python3 {remote_script_path}')
        if status == 0:
            print(out.strip())
        else:
            print(f'Remote update failed: {err}')
            return

        print('Deployment step 1 & 2 completed.')
        client.close()

    except Exception as e:
        print(f'Deployment failed: {str(e)}')
        exit(1)

if __name__ == "__main__":
    deploy()
