from PyQt6.QtWidgets import QWebEngineView
from PyQt6.QtCore import QUrl, pyqtSignal, QObject
import os
import json


class Live2DRenderer(QObject):
    """Live2D模型渲染器,处理与HTML/JS的交互"""

    model_loaded = pyqtSignal(bool)

    def __init__(self, web_view: None):
        super().__init__()
        self.web_view = web_view
        self.model_path = None
        self.is_model_loaded = False
        self.html_path = os.path.abspath(
            "./assets/live2d_renderer/live2d_renderer.html"
        )

    def set_web_view(self, web_view):
        """设置关联的QWebEngineView"""
        self.web_view = web_view

    def load_renderer(self):
        """加载HTML渲染器"""
        if not self.web_view:
            self.web_view.loadFinished.connect(self.on_html_loaded)
            self.web_view.load(QUrl.fromLocalFile(self.html_path))

    def _on_html_loaded(self, success):
        """HTML加载完成信号处理"""
        if success and self.model_path:
            self.load_model(self.model_path)

    def load_model(self, model_path):
        """加载Live2D模型"""
        self.model_path = model_path
        if self.web_view:
            script = f"loadLive2DModel('{os.path.abspath(model_path)}');"
            self.web_view.page().runJavaScript(script, self.on_model_loaded)

    def _on_model_loaded(self, result):
        """模型加载完成回调"""
        self.is_model_loaded = True
        self.model_loaded.emit(True)

    def play_animation(self, animation_name):
        """播放指定动画"""
        if self.web_view and self.is_model_loaded:
            script = f"playAnimation('{animation_name}');"
            self.web_view.page().runJavaScript(script)

    def play_random_animation(self):
        """播放随机动画"""
        if self.web_view and self.is_model_loaded:
            script = "playAnimation();"
            self.web_view.page().runJavaScript(script)

    def change_accessory(self, accessory_name):
        """更换配件"""
        if self.web_view and self.is_model_loaded:
            script = f"changeAccessory('{accessory_name}');"
            self.web_view.page().runJavaScript(script)

    def execute_js(self, script, callback=None):
        """执行自定义JavaScript代码"""
        if self.web_view:
            if callback:
                self.web_view.page().runJavaScript(script, callback)

            else:
                self.web_view.page().runJavaScript(script)
