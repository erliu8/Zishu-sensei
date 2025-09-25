# Jupyter Lab Configuration for Zishu-sensei Development

c = get_config()

# Server configuration
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.allow_root = True
c.ServerApp.token = 'dev-token'
c.ServerApp.password = ''

# Allow all origins in development
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_credentials = True

# Disable CSRF protection for development
c.ServerApp.disable_check_xsrf = True

# Enable extensions
c.ServerApp.jpserver_extensions = {
    'jupyterlab': True,
    'jupyterlab_git': True,
}

# File manager configuration
c.ContentsManager.allow_hidden = True

# Kernel configuration
c.MultiKernelManager.default_kernel_name = 'python3'

# Terminal configuration
c.ServerApp.terminals_enabled = True
