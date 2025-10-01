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


class TestRunner:
    """测试运行器"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.tests_dir = project_root / "tests"
        
    def run_unit_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行单元测试"""
        cmd = ["python", "-m", "pytest", "-m", "unit"]
        
        if verbose:
            cmd.append("-v")
        
        if coverage:
            cmd.extend(["--cov=zishu", "--cov-report=term-missing"])
        
        cmd.append(str(self.tests_dir / "unit"))
        
        print("🧪 运行单元测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_integration_tests(self, verbose: bool = False) -> int:
        """运行集成测试"""
        cmd = ["python", "-m", "pytest", "-m", "integration"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir / "integration"))
        
        print("🔗 运行集成测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_performance_tests(self, verbose: bool = False) -> int:
        """运行性能测试"""
        cmd = ["python", "-m", "pytest", "-m", "performance", "-s"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir / "performance"))
        
        print("⚡ 运行性能测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_api_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行API测试"""
        cmd = ["python", "-m", "pytest", "-m", "api"]
        
        if verbose:
            cmd.append("-v")
        
        if coverage:
            cmd.extend(["--cov=zishu.api", "--cov-report=term-missing"])
        
        cmd.append(str(self.tests_dir / "unit" / "api"))
        
        print("🌐 运行API测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_core_tests(self, verbose: bool = False, coverage: bool = True) -> int:
        """运行核心功能测试"""
        cmd = ["python", "-m", "pytest", "-m", "core"]
        
        if verbose:
            cmd.append("-v")
        
        if coverage:
            cmd.extend(["--cov=zishu.core", "--cov-report=term-missing"])
        
        cmd.append(str(self.tests_dir / "unit" / "core"))
        
        print("⚙️ 运行核心功能测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_all_tests(self, verbose: bool = False, coverage: bool = True, fast_only: bool = False) -> int:
        """运行所有测试"""
        cmd = ["python", "-m", "pytest"]
        
        if verbose:
            cmd.append("-v")
        
        if coverage:
            cmd.extend([
                "--cov=zishu",
                "--cov-report=term-missing",
                "--cov-report=html:htmlcov",
                "--cov-report=xml"
            ])
        
        if fast_only:
            cmd.append("--fast-only")
        
        cmd.append(str(self.tests_dir))
        
        print("🚀 运行所有测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_smoke_tests(self, verbose: bool = False) -> int:
        """运行冒烟测试"""
        cmd = ["python", "-m", "pytest", "-m", "smoke"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir))
        
        print("💨 运行冒烟测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_specific_test(self, test_path: str, verbose: bool = False) -> int:
        """运行特定测试"""
        cmd = ["python", "-m", "pytest"]
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(test_path)
        
        print(f"🎯 运行特定测试: {test_path}")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_failed_tests(self, verbose: bool = False) -> int:
        """重新运行失败的测试"""
        cmd = ["python", "-m", "pytest", "--lf"]  # --lf = --last-failed
        
        if verbose:
            cmd.append("-v")
        
        cmd.append(str(self.tests_dir))
        
        print("🔄 重新运行失败的测试...")
        return subprocess.call(cmd, cwd=self.project_root)
    
    def run_with_markers(self, markers: List[str], verbose: bool = False) -> int:
        """运行带特定标记的测试"""
        cmd = ["python", "-m", "pytest"]
        
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
        cmd = ["python", "-m", "pytest", "--cov=zishu", "--cov-report=html:htmlcov", "--cov-report=xml", "--cov-only"]
        
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
            self.project_root / "test_reports"
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
    
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())