import os

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
for filepath, imp_path, line in all_imports:
    filedir = os.path.dirname(filepath)
    resolved = os.path.normpath(os.path.join(filedir, imp_path))
    is_outside_src = not resolved.startswith('src' + os.sep) and not resolved.startswith('src/')
    if is_outside_src:
        issues.append((filepath, imp_path, resolved, 'OUTSIDE src/'))
    else:
        ts_path = resolved + '.ts'
        js_path = resolved + '.js'
        index_ts = os.path.join(resolved, 'index.ts')
        index_js = os.path.join(resolved, 'index.js')
        exists = os.path.exists(ts_path) or os.path.exists(js_path) or os.path.exists(index_ts) or os.path.exists(index_js)
        if not exists:
            issues.append((filepath, imp_path, resolved, 'FILE NOT FOUND'))

print(f'Total upward imports checked: {len(all_imports)}')
print(f'Issues found: {len(issues)}')
print()
for filepath, imp_path, resolved, reason in issues:
    print(f'[{reason}] {filepath}')
    print(f'  Import: {imp_path}')
    print(f'  Resolves to: {resolved}')
    print()

if not issues:
    print('All imports are valid and resolve within src/ directory.')
