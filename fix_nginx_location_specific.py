import paramiko
import re

def fix_nginx_location_block():
    host = '120.55.5.220'
    user = 'root'
    password = 'WsT13575967132'
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
        
        # 2. Use regex to find the location /downloads/ block and inject the header
        # We look for the block starting with 'location /downloads/ {' and ending with '}'
        # We will insert the header after the 'alias' line within that block.
        
        pattern = r'(location\s+/downloads/\s*\{[^}]*alias\s+[^;]+;)'
        replacement = r'\1\n        add_header Cache-Control "no-cache, no-store, must-revalidate";'
        
        new_content = re.sub(pattern, replacement, content)
        
        if content == new_content:
            print("Warning: Regex failed to find the target location block or no change needed.")
            # Fallback: Try a simpler insertion if the complex regex fails
            print("Attempting fallback: Simple insertion after 'alias /var/www/downloads/;'")
            fallback_pattern = r'(alias\s+/var/www/downloads/;\s*)'
            fallback_replacement = r'\1add_header Cache-Control "no-cache, no_store, must-revalidate";\n'
            new_content = re.sub(fallback_pattern, fallback_replacement, content)
        
        if content != new_content:
            # 3. Write the modified content back
            print("Writing updated configuration back to server...")
            with sftp.file(conf_path, 'w') as f:
                f.write(new_content)
            sftp.close()
            
            # 4. Test and Reload Nginx
            print("Testing and reloading Nginx...")
            cmd = "/usr/sbin/nginx -t && /usr/sbin/nginx -s reload && echo 'SUCCESS: Nginx reloaded with Cache-Control!'"
            stdin, stdout, stderr = client.exec_command(cmd)
            
            out = stdout.read().decode()
            err = stderr.read().decode()
            
            if out: print(f"Output: {out}")
            if err: print(f"Error: {err}")
            
            if "SUCCESS" in out:
                print("\n✅ Task completed successfully!")
            else:
                print("\n❌ Failed to reload Nginx. Check error output above.")
        else:
            print("❌ No changes were made to the configuration.")
            
        client.close()
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    fix_nginx_location_block()
