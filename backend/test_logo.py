import os
import base64

def test_logo_read():
    try:
        # 模拟 ReportGenerator 中的路径逻辑
        current_dir = os.getcwd() # 假设我们在 backend 目录下运行
        # 调整逻辑以匹配 ReportGenerator.__file__ 的行为
        # 假设脚本在 backend/app/services/test_logo.py
        
        # 直接使用绝对路径进行测试，排除相对路径计算干扰
        project_root = "/Users/lintsinghua/DeepAudit"
        logo_path = os.path.join(project_root, 'frontend/public/logo_deepaudit.png')
        
        print(f"Looking for logo at: {logo_path}")
        
        if os.path.exists(logo_path):
            print("File exists.")
            with open(logo_path, "rb") as image_file:
                data = image_file.read()
                b64 = base64.b64encode(data).decode('utf-8')
                print(f"Read {len(data)} bytes.")
                print(f"Base64 length: {len(b64)}")
                print(f"Base64 prefix: {b64[:50]}...")
        else:
            print("File does NOT exist.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_logo_read()
