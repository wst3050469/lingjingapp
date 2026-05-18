import os

def ts_exists(path):
    """Check if a TypeScript file exists, accounting for .js -> .ts resolution"""
    # Direct check
    if os.path.exists(path):
        return True
    # Try .ts extension instead of .js
    if path.endswith('.js'):
        ts_path = path[:-3] + '.ts'
        if os.path.exists(ts_path):
            return True
        tsx_path = path[:-3] + '.tsx'
        if os.path.exists(tsx_path):
            return True
    # Try index files
    if os.path.isdir(path) or (not path.endswith('.ts') and not path.endswith('.js')):
        for idx in ['index.ts', 'index.tsx', 'index.js', 'index.jsx']:
            if os.path.exists(os.path.join(path, idx)):
                return True
    # Try adding .ts extension
    if not path.endswith('.ts') and not path.endswith('.js'):
        if os.path.exists(path + '.ts') or os.path.exists(path + '.tsx'):
            return True
    return False

all_imports = []
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith('.ts'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as fh:
                for line in fh:
                    line_stripped = line.strip()
                    if line_stripped.startswith('import ') and '../' in line_stripped:
                        parts = line_stripped.split('from ')
                        if len(parts) > 1:
                            imp_path = parts[1].strip().rstrip(';').strip("'").strip('"')
                            if imp_path.startswith('../'):
                                all_imports.append((filepath, imp_path, line_stripped))

issues = []
correct_count = 0
for filepath, imp_path, line in all_imports:
    filedir = os.path.dirname(filepath)
    resolved = os.path.normpath(os.path.join(filedir, imp_path))
    is_outside_src = not resolved.startswith('src' + os.sep) and not resolved.startswith('src/')
    if is_outside_src:
        issues.append((filepath, imp_path, resolved, 'OUTSIDE src/'))
    elif ts_exists(resolved):
        correct_count += 1
    else:
        issues.append((filepath, imp_path, resolved, 'FILE NOT FOUND'))

print(f'Total upward imports checked: {len(all_imports)}')
print(f'Correctly resolving: {correct_count}')
print(f'Issues found: {len(issues)}')
print()
if issues:
    for filepath, imp_path, resolved, reason in issues:
        print(f'[{reason}] {filepath}')
        print(f'  Import: {imp_path}')
        print(f'  Resolves to: {resolved}')
        print()
else:
    print('All imports are valid and resolve to existing TypeScript files within src/ directory.')
