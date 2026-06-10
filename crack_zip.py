import zipfile
import itertools
import string
import time
import os

# === THAY ĐỔI Ở ĐÂY ===
zip_file = "/home/ngovan_tuan/Downloads/HACK AIM ẨN NO ROOT.zip"   # chỉnh theo username của mày   # Nếu đang ở trong thư mục Downloads thì chỉ cần tên file
password_length = 4
# ======================

# Charset
chars = string.digits + string.ascii_lowercase   # số + chữ thường

print(f"📂 File: {zip_file}")
print(f"🔍 Charset: {len(chars)} ký tự")
print(f"🔢 Tổng tổ hợp: {len(chars)**password_length:,} (4 ký tự)")
print("🚀 Đang crack...\n")

start = time.time()
found = False
count = 0

for prod in itertools.product(chars, repeat=password_length):
    password = ''.join(prod)
    count += 1
    
    if count % 50000 == 0:   # In tiến trình mỗi 50k lần
        print(f"Đã thử: {count:,} | Pass hiện tại: {password} | Thời gian: {time.time()-start:.1f}s")
    
    try:
        with zipfile.ZipFile(zip_file) as zf:
            zf.setpassword(password.encode('utf-8'))
            zf.extractall(pwd=password.encode('utf-8'))
            print(f"\n✅ MẬT KHẨU ĐÚNG: {password}")
            print(f"⏱ Thời gian: {time.time() - start:.2f} giây")
            found = True
            break
    except RuntimeError:
        continue
    except FileNotFoundError:
        print("❌ Không tìm thấy file ZIP! Kiểm tra tên và đường dẫn.")
        break
    except Exception as e:
        print(f"Lỗi: {e}")
        break

if not found:
    print("❌ Không tìm thấy mật khẩu trong charset này.")

print("Hoàn thành!")