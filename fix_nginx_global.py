import paramiko

def fix_nginx_globally():
    host = '120.55.5.220'
    user = 'root'
    password = 'WsT130575967132'
    conf_path = '/etc/nginx/sites-enabled/wap.zhejiangjinmo.com.conf'
    
    try:
        print(f"Connecting to {host}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=host, username=user, password=password)
        
        # 1. Read the remote file
        print(f"Reading {conf_path}...")
        sftp = client.open_sftp()
        with sftp.file(conf_path, 'r') as f:
            content = f.read().decode('utf-8')
        
        # 2. Inject the header after 'server {'
        import re
        new_content = re.sub(r'(server\s*\{)', r'\1\n    add_header Cache-Control "no-cache, no-store, must-revalidate";', content)
        
        if content == new_content:
            print("No changes needed. Header might already be present or regex failed.")
        else:
            # 3. Write the modified content back
            print("Writing updated configuration back to server...")
            with sftp.file(conf_path, 'w') as f:
                f.write(new_content)
            sftp.close()
            
            # 4. Test and Reload Nginx
            print("Testing and reloading Nginx...")
            cmd = "/usr/sbin/nginx -t && /usr/sbin/nginx -s reload && echo 'SUCCESS: Nginx reloaded with global Cache-Control!'"
            stdin, stdout, stderr = client.exec_command(cmd)
            
            out = stdout.read().decode()
            err = stderr.read().decode()
            
            if out: print(f"Output: {out}")
            if err: print(f"Error: {err}")
            
            if "SUCCESS" in out:
                print("\n✅ Global Cache-Control injection completed successfully!")
            else:
                print("\n❌ Failed to reload Nginx. Check error output above.")
        
        client.close()
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    fix_nginx_globally()
