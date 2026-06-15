with open(r'D:\lingjing-ide\日志.md', 'rb') as f:
    raw = f.read()

# Find "TypeScript"
idx = raw.find('TypeScript'.encode('utf-8'))
if idx >= 0:
    print(f"Found at byte {idx}")
    print(f"Context: {raw[idx-10:idx+30]}")
else:
    # Try gbk
    idx = raw.find('TypeScript'.encode('gbk'))
    if idx >= 0:
        print(f"Found (gbk) at byte {idx}")
        print(f"Context: {raw[idx-10:idx+30]}")
    else:
        print("NOT FOUND")
        # Search nearby bytes
        print(f"Total size: {len(raw)}")
        print(f"Last 100 bytes: {raw[-100:]}")
