import subprocess, os
os.chdir('D:/lingjing/lingjing')

# First clean up temp files we created
temp_files = [f for f in os.listdir('.') if f.endswith('.py') and f.startswith(('check_', 'push_', 'merge_', 'resolve_', 'sync_', 'force_', 'remove_', 'find_', 'verify_'))]
for f in temp_files:
    os.remove(f)
    print(f'Removed: {f}')

print('\nTemp files cleaned')
