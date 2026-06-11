import sqlite3
db = sqlite3.connect("/root/cloud-server/data/lingjing.db")

# Check user_devices
try:
    rows = db.execute("SELECT * FROM user_devices LIMIT 5").fetchall()
    cols = [d[0] for d in db.execute("PRAGMA table_info(user_devices)").fetchall()]
    print("=== user_devices ===")
    print("cols:", cols)
    for r in rows:
        print(r)
except Exception as e:
    print("user_devices error:", e)

# Check devices 
try:
    rows = db.execute("SELECT * FROM devices LIMIT 3").fetchall()
    cols = [d[0] for d in db.execute("PRAGMA table_info(devices)").fetchall()]
    print("=== devices ===")
    print("cols:", cols)
    for r in rows:
        print(r)
except Exception as e:
    print("devices error:", e)

# Check if any desktop_registrations
try:
    rows = db.execute("SELECT * FROM device_registrations LIMIT 3").fetchall()
    cols = [d[0] for d in db.execute("PRAGMA table_info(device_registrations)").fetchall()]
    print("=== device_registrations ===")
    print("cols:", cols)
    for r in rows:
        print(r)
except Exception as e:
    print("device_registrations error:", e)

# Check users
try:
    rows = db.execute("SELECT id, username, platform FROM users LIMIT 5").fetchall()
    print("=== users ===")
    for r in rows:
        print(r)
except:
    pass

db.close()
