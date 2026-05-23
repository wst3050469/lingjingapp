import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('https://ide.zhejiangjinmo.com', 'https://lingjing.zhejiangjinmo.com')
content = content.replace('wss://ide.zhejiangjinmo.com', 'wss://lingjing.zhejiangjinmo.com')
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.write(content)
print('OK: replaced', sys.argv[1])
