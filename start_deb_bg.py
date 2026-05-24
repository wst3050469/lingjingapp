import paramiko, time
BUILD = '/home/liuhui/lingjing'
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
time.sleep(2)
cmd = 'cd ' + BUILD + '/packages/electron && nohup npx electron-builder build --linux deb --x64 --publish=never > /tmp/deb-pub-never.log 2>&1 &'
ssh.exec_command(cmd)
time.sleep(3)
ssh.close()
