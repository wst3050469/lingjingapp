import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

cmd = [
    'node',
    r'D:\lingjing-ide\desktop\electron\node_modules\electron-builder\cli.js',
    '--win', '--x64',
    '--publish', 'never',
    '--project', r'D:\lingjing-ide\desktop\electron'
]

with open(r'D:\lingjing-ide\build-log.txt', 'w', encoding='utf-8') as log:
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=r'D:\lingjing-ide\desktop\electron')
    log.write('STDOUT:\n' + result.stdout + '\n')
    log.write('STDERR:\n' + result.stderr + '\n')
    log.write('Return code: ' + str(result.returncode) + '\n')

print('Done. Check build-log.txt')
