# ！/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import sys
from PyQt6.QtWidgets import QApplication, QMainWindow, QMenu, QSystemTrayIcon
from PyQt6.QtCore import Qt, QPoint, QUrl, QSize, pyqtSignal, QTimer
from PyQt6.QtGui import QIcon, QAction
from PyQt6.QtWebEngineWidgets import QWebEngineView


class Zishusensei(QMainWindow):
    """zishu sensei主类"""

    def __init__(
        self,
        config_path="./config/desktop_config.json",
        character_path="./config/character/default.json",
    ):
        super().__init__()

        # 配置加载
        self.config = self.load_config(config_path)
        self.character = self.load_config(character_path)

        # 模型路径
        self.model_path = "./live2d_models/hiyori_vts/hiyori.model3.json"

        # 初始化UI
        self.init_ui()

        # 创建系统托盘
        self.create_tray_icon()

        # 初始化状态
        self.dragging = False
        self.old_pos = None
        self.current_state = "idle"

        # 设置动画计时器
        self.animation_timer = QTimer(self)
        self.animation_timer.timeout.connect(self.update_animation)
        self.animation_timer.start(1000 // self.config["animation"["fps"]])

        def load_config(self, path):
            """加载配置文件"""
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"配置加载错误:{e}")
                return {}

        def init_ui(self):
            """初始化用户界面"""

        # 设置无边框窗口
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

        # 设置窗口大小
        width = self.config["window"]["size"]["width"]
        height = self.config["window"]["size"]["height"]
        self.resize(width, height)

        # 设置窗口位置
        if self.config["window"]["position"] == "right_bottom":
            desktop = QApplication.primaryScreen().availableGeometry()
            self.move(desktop.width() - width, desktop.height() - height)

        # 创建WebView来渲染Live2D模型
        self.web_view = QWebEngineView()
        self.web_view.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)

        # 加载HTML文件以渲染Live2D模型
        self.web_view.load(
            QUrl.fromLocalFile(
                os.path.abspath("./assets/live2d_renderer/live2d_renderer.html")
            )
        )

        # 设置透明背景
        self.web_view.page().setBackgroundColor(Qt.GlobalColor.transparent)

        # 设置为中央窗口部件
        self.setCentralWidget(self.web_view)

        # 页面加载完成后执行JavaScript来加载模型
        self.web_view.loadFinished.connect(self.on_web_loaded)

    def on_web_loaded(self, success):
        """页面加载完成后执行JavaScript来加载模型"""
        if success:
            script = f"""
            loadLive2DModel("{os.path.abspath(self.model_path)}");
            """
            self.web_view.page().runJavaScript(script)

            # 若配置文件中设置了问候语,则播放
            if self.config["startup"]["greeting_on_startup"]:
                self.show_greeting()

    def show_greeting(self):
        """显示问候语"""
        import random

        greetings = random.choice(self.character["appearance"]["behavior"]["greetings"])

        # 可以在这里实现显示对话气泡的逻辑
        print(f"Zishu Sensei: {greetings}")

    def update_animation(self):
        """更新动画"""
        if self.current_state == "idle":
            # 随机播放闲置动画
            import random

            if random.random() < 0.01:  # 1%概率切换动画
                idle_action = random.choice(
                    self.character["appearance"]["behavior"]["idle_animations"]
                )

                # 通过JavaScript调用Live2D模型API来播放动画
                script = f"playAnimation('{idle_action}');"
                self.web_view.page().runJavaScript(script)

    def mousePressEvent(self, event):
        """鼠标按下事件"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.dragging = True
            self.old_pos = event.globalPostion().toPoint()

    def mouseMoveEvent(self, event):
        """鼠标移动事件"""
        if self.dragging and self.config["interaction"]["drag_enabled"]:
            delta = QPoint(event.globalPosition().toPoint() - self.old_pos)
            self.move(self.x() + delta.x(), self.y() + delta.y())
            self.old_pos = event.globalPosition().toPoint()

    def mouseReleaseEvent(self, event):
        """鼠标释放事件"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.dragging = False

    def contextMenuEvent(self, event):
        """右键菜单事件"""
        if self.config["interaction"]["context_menu"]:
            menu = QMenu(self)

            # 添加菜单项
            chat_action = QAction("开始聊天", self)
            chat_action.triggered.connect(self.start_chat)
            menu.addAction(chat_action)

            # 添加头饰切换菜单
            accessory_menu = menu.addMenu("更换头饰")
            for accessory in self.character["appearance"]["accessories"]:
                action = QAction(accessory, self)
                action.triggered.connect(
                    lambda checked, a=accessory: self.change_accessory(a)
                )
                accessory_menu.addAction(action)

            # 添加分隔线
            menu.addSeparator()

            # 添加退出菜单项
            exit_action = QAction("退出", self)
            exit_action.triggered.connect(self.close)
            menu.addAction(exit_action)

            # 显示菜单
            menu.exec(event.globalPosition().toPoint())

    def start_chat(self):
        """开始聊天"""
        print("开始聊天")

    def create_tray_icon(self):
        """创建系统托盘图标"""
        # 创建系统托盘图标
        self.tray_icon = QSystemTrayIcon(self)
        self.tray_icon.setIcon(QIcon(os.path.abspath("./assets/images/icon.png")))
        self.tray_icon.setToolTip(self.config["system"]["tooltip"])

        # 创建托盘菜单
        tray_menu = QMenu()

        # 根据配置添加菜单项
        for item in self.config["system"]["menu_items"]:
            if item == "separator":
                tray_menu.addSeparator()
            elif item == "open":
                action = QAction("显示", self)
                action.triggered.connect(self.show)
                tray_menu.addAction(action)
            elif item == "settings":
                action = QAction("设置", self)
                action.triggered.connect(self.show_settings)
                tray_menu.addAction(action)
            elif item == "mute":
                action = QAction("静音", self)
                action.triggered.connect(self.toggle_mute)
                tray_menu.addAction(action)
            elif item == "quit":
                action = QAction("退出", self)
                action.triggered.connect(self.close)
                tray_menu.addAction(action)

        # 设置托盘菜单
        self.tray_icon.setContextMenu(tray_menu)

        # 显示托盘图标
        self.tray_icon.show()

    def show_settings(self):
        """显示设置窗口"""
        print("显示设置窗口")

    def toggle_mute(self, checked):
        """切换静音状态"""
        print(f"切换静音状态: {checked}")

    def closeEvent(self, event):
        """关闭事件"""
        if hasattr(self, "tray_icon") and self.tray_icon.isVisible():
            # 显示通知
            self.tray_icon.showMessage(
                "我还在哦~", QSystemTrayIcon.MessageIcon.Information, 2000
            )
            # 隐藏窗口
            self.hide()
            event.ignore()
        else:
            event.accept()
