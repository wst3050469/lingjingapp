import paramiko

def fix_remote_nginx():
    host = '120.55.5.220'
    user = 'root'
    password = 'WsT13575967132'
    conf_path = '/etc/nginx/sites-enabled/wap.zhejiangjinmo.com.conf'
    
    try:
        print(f"Connecting to {host}...")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=host, username=user, password=password)
        
        # The command to perform the replacement
        # We want to find the line containing 'alias /var/www/downloads/;' 
        # and append the Cache-Control header after it.
        # Using a simpler sed approach: find the line and append.
        
        cmd = f"sed -i '/alias \\/var\\/www\\/downloads\\/;/a \\        add_header Cache-Control \\\"no-cache, no-store, must-revalidate\\\";' {conf_path} && /usr/sbin/nginx -t && /usr/sbin/nginx -s reload && echo 'SUCCESS: Nginx updated and reloaded!'"
        
        print(f"Executing command: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode()
        err = stderr.read().decode()
        
        if exit_status == 0:
            print("Result Output:")
            print(out)
            if err:
                print("Error Output (if any):")
                print(err)
            print("\n✅ Task completed successfully!")
        else:
            print(f"❌ Task failed with exit status {exit_status}")
            print("Error Output:")
            print(err)
            
        client.close()
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    fix_remote_nginx()
