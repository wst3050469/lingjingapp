#!/usr/bin/env python3
"""Fix /var/www/downloads/downloads.js: 
1. Add missing macOS URL variable declarations
2. Update fallback from v1.73.120 to v1.73.130
"""
with open('/var/www/downloads/downloads.js', 'r') as f:
    c = f.read()

# 1. Replace fallback version
c = c.replace('1.73.120', '1.73.130')

# 2. Add macOS URL fetching before 'var macItems = [];'
old = '    // ═══ macOS ═══\n    var macItems = [];'
new = ('    // ═══ macOS ═══\n'
       '    var macX64Keys = [\'mac-x64\', \'mac-x64_zip\'];\n'
       '    var macX64Url = getAnyUrl(macX64Keys);\n'
       '    var macArm64Keys = [\'mac-arm64\', \'mac-arm64_zip\'];\n'
       '    var macArm64Url = getAnyUrl(macArm64Keys);\n'
       '    var macItems = [];')

c = c.replace(old, new)

with open('/var/www/downloads/downloads.js', 'w') as f:
    f.write(c)

print('Fixed /var/www/downloads/downloads.js!')
