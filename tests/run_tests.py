#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试运行脚本
提供便捷的测试运行命令和选项
"""
import os
import sys
import argparse
import subprocess
from pathlib import Path
from typing import List, Optional
from datetime import datetime


class TestRunner:
    """测试运行器"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.tests_dir = project_root / "tests"
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.reports_dir = project_root / "tests" / "reports" / self.timestamp
        self._ensure_reports_dir()
    
    def _ensure_reports_dir(self):
        """确保报告目录存在"""
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        (self.reports_dir / "html").mkdir(exist_ok=True)
        (self.reports_dir / "json").mkdir(exist_ok=True)
        (self.reports_dir / "junit").mkdir(exist_ok=True)
        (self.reports_dir / "coverage" / "html").mkdir(parents=True, exist_ok=True)
        (self.reports_dir / "coverage" / "xml").mkdir(parents=True, exist_ok=True)
        (self.tests_dir / "logs").mkdir(exist_ok=True)
    
    def _add_report_options(self, cmd: List[str], coverage: bool = True, html_report: bool = True) -> List[str]:
        """添加报告选项到命令中"""
        if coverage:
            cmd.extend([
                "--cov=zishu",
                "--cov-report=term-missing",
                f"--cov-report=html:{self.reports_dir}/coverage/html",
                f"--cov-report=xml:{self.reports_dir}/coverage/coverage.xml"
            ])
        
        if html_report:
            cmd.extend([
                f"--html={self.reports_dir}/html/report.html",
                "--self-contained-html",
                "--json-report",
                f"--json-report-file={self.reports_dir}/json/report.json",
                f"--junitxml={self.reports_dir}/junit/junit.xml"
            ])
        
        # 添加日志文件
        cmd.extend([
            f"--log-file={self.tests_dir}/logs/pytest_{self.timestamp}.log",
            "--log-file-level=DEBUG"
        ])
        
        return cmd
    
    def _create_latest_link(self):
        """创建最新报告的软链接"""
        latest_link = self.project_root / "reports" / "latest"
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        latest_link.symlink_to(self.timestamp, target_is_directory=True)
        return latest_link
    
    def _print_report_summary(self):
        """打印报告摘要"""
        print(f"\n📊 报告已生成到: {self.reports_dir}")
        
        latest_link = self._create_latest_link()
        print(f"🔗 最新报告链接: {latest_link}")
        
        print("\n📋 生成的报告文件:")
        
        html_report = self.reports_dir / "html" / "report.html"
        if html_report.exists():
            print(f"  📄 HTML报告: {html_report}")
        
        json_report = self.reports_dir / "json" / "report.json"
        if json_report.exists():
            print(f"  📄 JSON报告: {json_report}")
        
        junit_report = self.reports_dir / "junit" / "junit.xml"
        if junit_report.exists():
            print(f"  📄 JUnit XML: {junit_report}")
        
        coverage_html = self.reports_dir / "coverage" / "html" / "index.html"
        if coverage_html.exists():
            print(f"  📄 覆盖率HTML: {coverage_html}")
        
        coverage_xml = self.reports_dir / "coverage" / "coverage.xml"
        if coverage_xml.exists():
            print(f"  📄 覆盖率XML: {coverage_xml}")
        
        log_file = self.tests_dir / "logs" / f"pytest_{self.timestamp}.log"
        if log_file.exists():
            print(f"  📄 测试日志: {log_file}")
        
    def run_unit_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行单元测试"""
        cmd = ["python3", "-m", "pytest", "-m", "unit"]
        
        if verbose:
            cmd.append("-v")
        
        cmd = self._add_report_options(cmd, coverage)
        cmd.append(str(self.tests_dir / "unit"))
        
        print("🧪 运行单元测试...")
        result = subprocess.call(cmd, cwd=self.project_root)
        self._print_report_summary()
        return result
    
    def run_integration_tests(self, verbose: bool = False) -> int:
        """运行集成测试"""
        cmd = ["python3", "-m", "pytest", "-m", "integration"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir / "integration"))
        
        print("🔗 运行集成测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_performance_tests(self, verbose: bool = False) -> int:
        """运行性能测试"""
        cmd = ["python3", "-m", "pytest", "-m", "performance", "-s"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir / "performance"))
        
        print("⚡ 运行性能测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_api_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行API测试"""
        cmd = ["python3", "-m", "pytest", "-m", "api"]
        
        if verbose:
            cmd.append("-v")
        
        cmd = self._add_report_options(cmd, coverage)
        cmd.append(str(self.tests_dir / "unit" / "api"))
        
        print("🌐 运行API测试...")
        result = subprocess.call(cmd, cwd=self.project_root)
        self._print_report_summary()
        return result
    
    def run_core_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行核心功能测试"""
        cmd = ["python3", "-m", "pytest", "-m", "core"]
        
        if verbose:
            cmd.append("-v")
        
        cmd = self._add_report_options(cmd, coverage)
        cmd.append(str(self.tests_dir / "unit" / "core"))
        
        print("⚙️ 运行核心功能测试...")
        result = subprocess.call(cmd, cwd=self.project_root)
        self._print_report_summary()
        return result
    
    def run_all_tests(self, verbose: bool = False, coverage: bool = True, fast_only: bool = False) -> int:
        """运行所有测试"""
        cmd = ["python3", "-m", "pytest"]
        
        if verbose:
            cmd.append("-v")
        
        if fast_only:
            cmd.append("--fast-only")
        
        cmd = self._add_report_options(cmd, coverage)
        cmd.append(str(self.tests_dir))
        
        print("🚀 运行所有测试...")
        result = subprocess.call(cmd, cwd=self.project_root)
        self._print_report_summary()
        return result
    
    def run_smoke_tests(self, verbose: bool = False) -> int:
        """运行冒烟测试"""
        cmd = ["python3", "-m", "pytest", "-m", "smoke"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir))
        
        print("💨 运行冒烟测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_specific_test(self, test_path: str, verbose: bool = False) -> int:
        """运行特定测试"""
        cmd = ["python3", "-m", "pytest"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(test_path)
        
        print(f"🎯 运行特定测试: {test_path}")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_failed_tests(self, verbose: bool = False) -> int:
        """重新运行失败的测试"""
        cmd = ["python3", "-m", "pytest", "--lf"]  # --lf = --last-failed
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir))
        
        print("🔄 重新运行失败的测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_with_markers(self, markers: List[str], verbose: bool = False) -> int:
        """运行带特定标记的测试"""
        cmd = ["python3", "-m", "pytest"]
        
        if verbose:
            cmd.append("-v")
        
        # 构建标记表达式
        marker_expr = " and ".join(markers)
        cmd.extend(["-m", marker_expr])
        
        cmd.append(str(self.tests_dir))
        
        print(f"🏷️ 运行标记为 '{marker_expr}' 的测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def generate_coverage_report(self) -> int:
        """生成覆盖率报告"""
        cmd = ["python3", "-m", "pytest", "--cov=zishu", "--cov-report=html:htmlcov", "--cov-report=xml", "--cov-only"]
        
        print("📊 生成覆盖率报告...")
        result = subprocess.call(cmd, cwd=self.project_root)
        
        if result == 0:
            print("✅ 覆盖率报告已生成:")
            print(f"   HTML: {self.project_root / 'htmlcov' / 'index.html'}")
            print(f"   XML:  {self.project_root / 'coverage.xml'}")
        
        return result
    
    def lint_tests(self) -> int:
        """检查测试代码质量"""
        cmd = ["python", "-m", "flake8", str(self.tests_dir)]
        
        print("🔍 检查测试代码质量...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def format_tests(self) -> int:
        """格式化测试代码"""
        cmd = ["python", "-m", "black", str(self.tests_dir)]
        
        print("🎨 格式化测试代码...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def clean_test_artifacts(self):
        """清理测试产生的文件"""
        artifacts = [
            self.project_root / ".coverage",
            self.project_root / "coverage.xml",
            self.project_root / "htmlcov",
            self.project_root / ".pytest_cache",
            self.tests_dir / "logs",
            self.project_root / "test_reports",
            self.project_root / "reports"
        ]
        
        print("🧹 清理测试文件...")
        
        for artifact in artifacts:
            if artifact.exists():
                if artifact.is_file():
                    artifact.unlink()
                    print(f"   删除文件: {artifact}")
                elif artifact.is_dir():
                    import shutil
                    shutil.rmtree(artifact)
                    print(f"   删除目录: {artifact}")
    
    def setup_test_environment(self):
        """设置测试环境"""
        print("🔧 设置测试环境...")
        
        # 创建必要的目录
        dirs_to_create = [
            self.tests_dir / "logs",
            self.project_root / "test_reports",
            self.project_root / "test_adapters",
            self.project_root / "test_models",
            self.project_root / "test_cache"
        ]
        
        for dir_path in dirs_to_create:
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"   创建目录: {dir_path}")
        
        # 设置环境变量
        os.environ["TESTING"] = "true"
        os.environ["LOG_LEVEL"] = "DEBUG"
        
        print("✅ 测试环境设置完成")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="Zishu测试运行器")
    
    # 添加子命令
    subparsers = parser.add_subparsers(dest="command", help="测试命令")
    
    # 单元测试
    unit_parser = subparsers.add_parser("unit", help="运行单元测试")
    unit_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    unit_parser.add_argument("--no-cov", action="store_true", help="不生成覆盖率报告")
    
    # 集成测试
    integration_parser = subparsers.add_parser("integration", help="运行集成测试")
    integration_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # 性能测试
    performance_parser = subparsers.add_parser("performance", help="运行性能测试")
    performance_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # API测试
    api_parser = subparsers.add_parser("api", help="运行API测试")
    api_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    api_parser.add_argument("--no-cov", action="store_true", help="不生成覆盖率报告")
    
    # 核心测试
    core_parser = subparsers.add_parser("core", help="运行核心功能测试")
    core_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    core_parser.add_argument("--no-cov", action="store_true", help="不生成覆盖率报告")
    
    # 所有测试
    all_parser = subparsers.add_parser("all", help="运行所有测试")
    all_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    all_parser.add_argument("--no-cov", action="store_true", help="不生成覆盖率报告")
    all_parser.add_argument("--fast-only", action="store_true", help="只运行快速测试")
    
    # 冒烟测试
    smoke_parser = subparsers.add_parser("smoke", help="运行冒烟测试")
    smoke_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # 特定测试
    specific_parser = subparsers.add_parser("run", help="运行特定测试")
    specific_parser.add_argument("test_path", help="测试文件或目录路径")
    specific_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # 失败测试
    failed_parser = subparsers.add_parser("failed", help="重新运行失败的测试")
    failed_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # 标记测试
    marker_parser = subparsers.add_parser("marker", help="运行带特定标记的测试")
    marker_parser.add_argument("markers", nargs="+", help="测试标记")
    marker_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    
    # 覆盖率报告
    coverage_parser = subparsers.add_parser("coverage", help="生成覆盖率报告")
    
    # 代码质量
    lint_parser = subparsers.add_parser("lint", help="检查测试代码质量")
    
    # 代码格式化
    format_parser = subparsers.add_parser("format", help="格式化测试代码")
    
    # 清理
    clean_parser = subparsers.add_parser("clean", help="清理测试文件")
    
    # 设置环境
    setup_parser = subparsers.add_parser("setup", help="设置测试环境")
    
    # 带完整报告的测试
    report_parser = subparsers.add_parser("report", help="运行测试并生成完整报告")
    report_parser.add_argument("test_type", nargs="?", default="all", 
                              choices=["all", "unit", "integration", "api", "core"],
                              help="测试类型 (默认: all)")
    report_parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    report_parser.add_argument("--no-cov", action="store_true", help="不生成覆盖率报告")
    
    # 解析参数
    args = parser.parse_args()
    
    # 获取项目根目录
    project_root = Path(__file__).parent.parent
    runner = TestRunner(project_root)
    
    # 执行命令
    if args.command == "unit":
        return runner.run_unit_tests(args.verbose, not args.no_cov)
    
    elif args.command == "integration":
        return runner.run_integration_tests(args.verbose)
    
    elif args.command == "performance":
        return runner.run_performance_tests(args.verbose)
    
    elif args.command == "api":
        return runner.run_api_tests(args.verbose, not args.no_cov)
    
    elif args.command == "core":
        return runner.run_core_tests(args.verbose, not args.no_cov)
    
    elif args.command == "all":
        return runner.run_all_tests(args.verbose, not args.no_cov, args.fast_only)
    
    elif args.command == "smoke":
        return runner.run_smoke_tests(args.verbose)
    
    elif args.command == "run":
        return runner.run_specific_test(args.test_path, args.verbose)
    
    elif args.command == "failed":
        return runner.run_failed_tests(args.verbose)
    
    elif args.command == "marker":
        return runner.run_with_markers(args.markers, args.verbose)
    
    elif args.command == "coverage":
        return runner.generate_coverage_report()
    
    elif args.command == "lint":
        return runner.lint_tests()
    
    elif args.command == "format":
        return runner.format_tests()
    
    elif args.command == "clean":
        runner.clean_test_artifacts()
        return 0
    
    elif args.command == "setup":
        runner.setup_test_environment()
        return 0
    
    elif args.command == "report":
        # 运行带完整报告的测试
        if args.test_type == "all":
            return runner.run_all_tests(args.verbose, not args.no_cov)
        elif args.test_type == "unit":
            return runner.run_unit_tests(args.verbose, not args.no_cov)
        elif args.test_type == "integration":
            return runner.run_integration_tests(args.verbose)
        elif args.test_type == "api":
            return runner.run_api_tests(args.verbose, not args.no_cov)
        elif args.test_type == "core":
            return runner.run_core_tests(args.verbose, not args.no_cov)
    
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())