import paramiko
ssh=paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('120.55.5.220',username='root',password='WsT13575967132',timeout=10)

cmd1='cat /var/www/downloads/latest.yml'
stdin1,stdout1,stderr1=ssh.exec_command(cmd1)
print('=== Server latest.yml ===')
print(stdout1.read().decode())

cmd2='cat /var/www/html/versions.json'
stdin2,stdout2,stderr2=ssh.exec_command(cmd2)
data = stdout2.read().decode()
lines = data.strip().split('\n')
print('=== versions.json (last 20 lines) ===')
for l in lines[-20:]:
    print(l)

print()
cmd3='cat /var/www/html/latest.yml'
stdin3,stdout3,stderr3=ssh.exec_command(cmd3)
print('=== /var/www/html/latest.yml ===')
print(stdout3.read().decode())

ssh.close()
