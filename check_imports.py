
try:
    import docker
    client = docker.from_env()
    client.ping()
    print("Docker is available and connected")
except Exception as e:
    print(f"Docker connection failed: {e}")

try:
    from app.services.agent.tools.sandbox_tool import SandboxConfig, SandboxManager, SandboxTool  # pyright: ignore[reportMissingImports]
    print("Sandbox modules imported successfully")
except ImportError as e:
    print(f"Sandbox import failed: {e}")
except Exception as e:
    print(f"Sandbox import error: {e}")
