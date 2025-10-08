#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
构建服务 - Zishu-sensei
提供包构建、测试、打包等核心功能
支持多种构建工具和测试框架，提供完整的CI/CD流程
"""

import os
import sys
import shutil
import subprocess
import asyncio
import tempfile
import zipfile
import tarfile
import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

from ..schemas.packaging import (
    PackageFormat,
    BuildStatus,
    TestType,
    BuildConfiguration,
    TestConfiguration,
    FileInfo,
    PackageType,
)
from ..core.config import settings
from ..core.logging import get_logger
from ..utils.file_utils import calculate_file_hash, create_archive, extract_archive
from ..utils.docker_utils import DockerManager
from ..utils.process_utils import run_command_async, kill_process_tree

logger = get_logger(__name__)


@dataclass
class BuildEnvironment:
    """构建环境配置"""

    name: str
    python_version: str = "3.9"
    node_version: Optional[str] = None
    docker_image: Optional[str] = None
    system_packages: List[str] = None
    environment_vars: Dict[str, str] = None

    def __post_init__(self):
        if self.system_packages is None:
            self.system_packages = []
        if self.environment_vars is None:
            self.environment_vars = {}


@dataclass
class BuildResult:
    """构建结果"""

    status: BuildStatus
    artifacts: List[FileInfo]
    logs: List[str]
    duration_seconds: float
    progress: float = 100.0
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class TestResult:
    """测试结果"""

    test_type: TestType
    status: str
    passed: int
    failed: int
    skipped: int
    coverage: Optional[float]
    duration_seconds: float
    logs: List[str]
    reports: List[FileInfo]
    error_message: Optional[str] = None


class BuildService:
    """构建服务类"""

    def __init__(self):
        self.docker_manager = DockerManager()
        self.thread_executor = ThreadPoolExecutor(max_workers=4)
        self.process_executor = ProcessPoolExecutor(max_workers=2)

        # 构建工作目录
        self.workspace_dir = Path(settings.BUILD_WORKSPACE_DIR)
        self.cache_dir = Path(settings.BUILD_CACHE_DIR)
        self.artifacts_dir = Path(settings.BUILD_ARTIFACTS_DIR)

        # 创建必要目录
        for directory in [self.workspace_dir, self.cache_dir, self.artifacts_dir]:
            directory.mkdir(parents=True, exist_ok=True)

        # 支持的构建工具
        self.build_tools = {
            "python": self._build_python_package,
            "nodejs": self._build_nodejs_package,
            "docker": self._build_docker_package,
            "make": self._build_make_package,
            "cmake": self._build_cmake_package,
            "gradle": self._build_gradle_package,
            "maven": self._build_maven_package,
            "go": self._build_go_package,
            "rust": self._build_rust_package,
            "custom": self._build_custom_package,
        }

        # 支持的测试框架
        self.test_frameworks = {
            "pytest": self._run_pytest,
            "unittest": self._run_unittest,
            "jest": self._run_jest,
            "mocha": self._run_mocha,
            "go_test": self._run_go_test,
            "cargo_test": self._run_cargo_test,
            "junit": self._run_junit,
            "custom": self._run_custom_test,
        }

    async def build_package(self, build_task, timeout: int = 3600) -> BuildResult:
        """构建包"""
        build_id = build_task.id
        start_time = datetime.now()
        logs = []

        try:
            logger.info(f"开始构建任务 {build_id}")

            # 创建构建工作空间
            workspace = await self._create_build_workspace(build_task)

            try:
                # 准备构建环境
                await self._prepare_build_environment(workspace, build_task)
                logs.append("构建环境准备完成")

                # 安装依赖
                await self._install_dependencies(workspace, build_task)
                logs.append("依赖安装完成")

                # 执行预构建命令
                if build_task.build_config.get("pre_build_commands"):
                    await self._run_pre_build_commands(workspace, build_task)
                    logs.append("预构建命令执行完成")

                # 执行构建
                build_tool = build_task.build_config.get("build_tool", "python")
                if build_tool not in self.build_tools:
                    raise ValueError(f"不支持的构建工具: {build_tool}")

                build_func = self.build_tools[build_tool]
                artifacts = await build_func(workspace, build_task)
                logs.append(f"使用 {build_tool} 构建完成")

                # 执行后构建命令
                if build_task.build_config.get("post_build_commands"):
                    await self._run_post_build_commands(workspace, build_task)
                    logs.append("后构建命令执行完成")

                # 运行测试（如果需要）
                if not build_task.skip_tests and build_task.test_config:
                    test_results = await self._run_package_tests(workspace, build_task)
                    logs.extend([f"测试完成: {result.status}" for result in test_results])

                # 生成包格式
                formatted_artifacts = await self._generate_package_formats(
                    artifacts, build_task.target_formats, workspace
                )

                # 计算构建时间
                duration = (datetime.now() - start_time).total_seconds()

                logger.info(f"构建任务 {build_id} 完成，耗时 {duration:.2f}s")

                return BuildResult(
                    status=BuildStatus.SUCCESS,
                    artifacts=formatted_artifacts,
                    logs=logs,
                    duration_seconds=duration,
                    progress=100.0,
                    metadata={
                        "build_tool": build_tool,
                        "workspace": str(workspace),
                        "artifact_count": len(formatted_artifacts),
                    },
                )

            finally:
                # 清理工作空间
                await self._cleanup_workspace(workspace)

        except asyncio.TimeoutError:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"构建任务 {build_id} 超时")

            return BuildResult(
                status=BuildStatus.TIMEOUT,
                artifacts=[],
                logs=logs + ["构建超时"],
                duration_seconds=duration,
                progress=50.0,
                error_message="构建超时",
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(f"构建任务 {build_id} 失败: {e}")

            return BuildResult(
                status=BuildStatus.FAILED,
                artifacts=[],
                logs=logs + [f"构建失败: {str(e)}"],
                duration_seconds=duration,
                progress=0.0,
                error_message=str(e),
            )

    async def run_tests(
        self,
        package,
        test_types: List[TestType],
        test_environments: List[str],
        parallel: bool = False,
        coverage_required: bool = True,
    ) -> TestResult:
        """运行测试"""
        try:
            logger.info(f"开始测试包 {package.name}")

            # 创建测试工作空间
            workspace = await self._create_test_workspace(package)

            try:
                # 准备测试环境
                await self._prepare_test_environment(workspace, package)

                # 运行测试
                test_results = []
                if parallel and len(test_types) > 1:
                    # 并行运行测试
                    tasks = [
                        self._run_single_test(
                            workspace, package, test_type, coverage_required
                        )
                        for test_type in test_types
                    ]
                    test_results = await asyncio.gather(*tasks, return_exceptions=True)
                else:
                    # 串行运行测试
                    for test_type in test_types:
                        result = await self._run_single_test(
                            workspace, package, test_type, coverage_required
                        )
                        test_results.append(result)

                # 合并测试结果
                return self._merge_test_results(test_results)

            finally:
                # 清理测试工作空间
                await self._cleanup_workspace(workspace)

        except Exception as e:
            logger.error(f"测试执行失败: {e}")
            return TestResult(
                test_type=test_types[0] if test_types else TestType.UNIT,
                status="failed",
                passed=0,
                failed=1,
                skipped=0,
                coverage=None,
                duration_seconds=0.0,
                logs=[f"测试失败: {str(e)}"],
                reports=[],
                error_message=str(e),
            )

    # ======================== 构建工具实现 ========================

    async def _build_python_package(
        self, workspace: Path, build_task
    ) -> List[FileInfo]:
        """构建Python包"""
        artifacts = []

        try:
            # 检查是否有setup.py或pyproject.toml
            setup_py = workspace / "setup.py"
            pyproject_toml = workspace / "pyproject.toml"

            if pyproject_toml.exists():
                # 使用现代Python打包工具
                await run_command_async(
                    ["python", "-m", "build"], cwd=workspace, timeout=1800
                )

                # 收集dist目录中的文件
                dist_dir = workspace / "dist"
                if dist_dir.exists():
                    for file_path in dist_dir.iterdir():
                        if file_path.is_file():
                            file_info = await self._create_file_info(file_path)
                            artifacts.append(file_info)

            elif setup_py.exists():
                # 使用传统setup.py
                await run_command_async(
                    ["python", "setup.py", "sdist", "bdist_wheel"],
                    cwd=workspace,
                    timeout=1800,
                )

                # 收集dist目录中的文件
                dist_dir = workspace / "dist"
                if dist_dir.exists():
                    for file_path in dist_dir.iterdir():
                        if file_path.is_file():
                            file_info = await self._create_file_info(file_path)
                            artifacts.append(file_info)
            else:
                # 创建简单的zip包
                zip_path = workspace / f"{build_task.package_name}.zip"
                await self._create_zip_package(workspace, zip_path)
                file_info = await self._create_file_info(zip_path)
                artifacts.append(file_info)

            return artifacts

        except Exception as e:
            logger.error(f"Python包构建失败: {e}")
            raise

    async def _build_nodejs_package(
        self, workspace: Path, build_task
    ) -> List[FileInfo]:
        """构建Node.js包"""
        artifacts = []

        try:
            # 检查package.json
            package_json = workspace / "package.json"
            if not package_json.exists():
                raise ValueError("缺少package.json文件")

            # 安装依赖
            await run_command_async(["npm", "install"], cwd=workspace, timeout=1800)

            # 运行构建脚本
            build_script = build_task.build_config.get("build_script", "build")
            await run_command_async(
                ["npm", "run", build_script], cwd=workspace, timeout=1800
            )

            # 打包
            await run_command_async(["npm", "pack"], cwd=workspace, timeout=300)

            # 收集.tgz文件
            for file_path in workspace.glob("*.tgz"):
                file_info = await self._create_file_info(file_path)
                artifacts.append(file_info)

            return artifacts

        except Exception as e:
            logger.error(f"Node.js包构建失败: {e}")
            raise

    async def _build_docker_package(
        self, workspace: Path, build_task
    ) -> List[FileInfo]:
        """构建Docker包"""
        artifacts = []

        try:
            # 检查Dockerfile
            dockerfile = workspace / "Dockerfile"
            if not dockerfile.exists():
                raise ValueError("缺少Dockerfile文件")

            # 构建Docker镜像
            image_name = f"{build_task.package_name}:{build_task.version}"
            await self.docker_manager.build_image(
                dockerfile_path=dockerfile,
                image_name=image_name,
                build_args=build_task.build_config.get("build_args", {}),
                timeout=3600,
            )

            # 导出镜像
            image_file = (
                workspace / f"{build_task.package_name}-{build_task.version}.tar"
            )
            await self.docker_manager.save_image(image_name, image_file)

            file_info = await self._create_file_info(image_file)
            artifacts.append(file_info)

            return artifacts

        except Exception as e:
            logger.error(f"Docker包构建失败: {e}")
            raise

    async def _build_make_package(self, workspace: Path, build_task) -> List[FileInfo]:
        """使用Make构建包"""
        artifacts = []

        try:
            # 检查Makefile
            makefile = workspace / "Makefile"
            if not makefile.exists():
                raise ValueError("缺少Makefile文件")

            # 运行make
            make_target = build_task.build_config.get("build_script", "all")
            await run_command_async(
                ["make", make_target],
                cwd=workspace,
                env=build_task.build_config.get("environment", {}),
                timeout=1800,
            )

            # 收集构建产物
            build_dir = workspace / "build"
            if build_dir.exists():
                for file_path in build_dir.rglob("*"):
                    if file_path.is_file():
                        file_info = await self._create_file_info(file_path)
                        artifacts.append(file_info)

            return artifacts

        except Exception as e:
            logger.error(f"Make构建失败: {e}")
            raise

    # ======================== 测试框架实现 ========================

    async def _run_pytest(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行pytest测试"""
        try:
            start_time = datetime.now()

            # 构建pytest命令
            cmd = ["python", "-m", "pytest"]

            # 添加测试路径
            test_paths = test_config.get("test_paths", ["tests"])
            cmd.extend(test_paths)

            # 添加覆盖率选项
            if test_config.get("coverage_enabled", True):
                cmd.extend(["--cov=.", "--cov-report=json", "--cov-report=html"])

            # 添加输出格式
            cmd.extend(["--json-report", "--json-report-file=test_report.json"])

            # 运行测试
            result = await run_command_async(
                cmd,
                cwd=workspace,
                timeout=test_config.get("timeout_seconds", 1800),
                capture_output=True,
            )

            duration = (datetime.now() - start_time).total_seconds()

            # 解析测试结果
            report_file = workspace / "test_report.json"
            if report_file.exists():
                with open(report_file) as f:
                    report = json.load(f)

                # 解析覆盖率
                coverage = None
                coverage_file = workspace / "coverage.json"
                if coverage_file.exists():
                    with open(coverage_file) as f:
                        coverage_data = json.load(f)
                        coverage = coverage_data.get("totals", {}).get(
                            "percent_covered"
                        )

                return TestResult(
                    test_type=TestType.UNIT,
                    status="passed" if result.returncode == 0 else "failed",
                    passed=report.get("summary", {}).get("passed", 0),
                    failed=report.get("summary", {}).get("failed", 0),
                    skipped=report.get("summary", {}).get("skipped", 0),
                    coverage=coverage,
                    duration_seconds=duration,
                    logs=result.stdout.decode().split("\n") if result.stdout else [],
                    reports=await self._collect_test_reports(workspace),
                    error_message=result.stderr.decode()
                    if result.stderr and result.returncode != 0
                    else None,
                )

            # 如果没有报告文件，返回基本结果
            return TestResult(
                test_type=TestType.UNIT,
                status="passed" if result.returncode == 0 else "failed",
                passed=1 if result.returncode == 0 else 0,
                failed=0 if result.returncode == 0 else 1,
                skipped=0,
                coverage=None,
                duration_seconds=duration,
                logs=result.stdout.decode().split("\n") if result.stdout else [],
                reports=[],
                error_message=result.stderr.decode()
                if result.stderr and result.returncode != 0
                else None,
            )

        except Exception as e:
            logger.error(f"pytest运行失败: {e}")
            return TestResult(
                test_type=TestType.UNIT,
                status="failed",
                passed=0,
                failed=1,
                skipped=0,
                coverage=None,
                duration_seconds=0.0,
                logs=[f"测试执行失败: {str(e)}"],
                reports=[],
                error_message=str(e),
            )

    async def _run_jest(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行Jest测试"""
        try:
            start_time = datetime.now()

            # 构建jest命令
            cmd = ["npm", "test", "--", "--json", "--outputFile=test_report.json"]

            # 添加覆盖率选项
            if test_config.get("coverage_enabled", True):
                cmd.append("--coverage")

            # 运行测试
            result = await run_command_async(
                cmd,
                cwd=workspace,
                timeout=test_config.get("timeout_seconds", 1800),
                capture_output=True,
            )

            duration = (datetime.now() - start_time).total_seconds()

            # 解析测试结果
            report_file = workspace / "test_report.json"
            if report_file.exists():
                with open(report_file) as f:
                    report = json.load(f)

                return TestResult(
                    test_type=TestType.UNIT,
                    status="passed" if report.get("success", False) else "failed",
                    passed=report.get("numPassedTests", 0),
                    failed=report.get("numFailedTests", 0),
                    skipped=report.get("numPendingTests", 0),
                    coverage=self._extract_jest_coverage(workspace),
                    duration_seconds=duration,
                    logs=result.stdout.decode().split("\n") if result.stdout else [],
                    reports=await self._collect_test_reports(workspace),
                    error_message=result.stderr.decode()
                    if result.stderr and result.returncode != 0
                    else None,
                )

            return TestResult(
                test_type=TestType.UNIT,
                status="passed" if result.returncode == 0 else "failed",
                passed=1 if result.returncode == 0 else 0,
                failed=0 if result.returncode == 0 else 1,
                skipped=0,
                coverage=None,
                duration_seconds=duration,
                logs=result.stdout.decode().split("\n") if result.stdout else [],
                reports=[],
                error_message=result.stderr.decode()
                if result.stderr and result.returncode != 0
                else None,
            )

        except Exception as e:
            logger.error(f"Jest运行失败: {e}")
            return TestResult(
                test_type=TestType.UNIT,
                status="failed",
                passed=0,
                failed=1,
                skipped=0,
                coverage=None,
                duration_seconds=0.0,
                logs=[f"测试执行失败: {str(e)}"],
                reports=[],
                error_message=str(e),
            )

    # ======================== 辅助方法 ========================

    async def _create_build_workspace(self, build_task) -> Path:
        """创建构建工作空间"""
        workspace_id = f"build_{build_task.id}_{int(datetime.now().timestamp())}"
        workspace = self.workspace_dir / workspace_id
        workspace.mkdir(parents=True, exist_ok=True)

        # 复制源码到工作空间
        source_path = Path(build_task.source_path)
        if source_path.is_dir():
            shutil.copytree(source_path, workspace / "src", dirs_exist_ok=True)
        else:
            shutil.copy2(source_path, workspace / "src")

        return workspace

    async def _create_test_workspace(self, package) -> Path:
        """创建测试工作空间"""
        workspace_id = f"test_{package.id}_{int(datetime.now().timestamp())}"
        workspace = self.workspace_dir / workspace_id
        workspace.mkdir(parents=True, exist_ok=True)

        # 复制源码到工作空间
        source_path = Path(package.source_path)
        if source_path.is_dir():
            shutil.copytree(source_path, workspace, dirs_exist_ok=True)
        else:
            shutil.copy2(source_path, workspace)

        return workspace

    async def _prepare_build_environment(self, workspace: Path, build_task) -> None:
        """准备构建环境"""
        build_config = build_task.build_config

        # 设置环境变量
        env_vars = build_config.get("environment", {})
        for key, value in env_vars.items():
            os.environ[key] = value

        # 如果使用Docker构建
        if build_config.get("docker_image"):
            await self._prepare_docker_environment(workspace, build_config)

    async def _install_dependencies(self, workspace: Path, build_task) -> None:
        """安装依赖"""
        dependencies = build_task.dependencies or []

        if not dependencies:
            return

        # 根据包类型安装依赖
        package_type = build_task.package_type

        if package_type == PackageType.ADAPTER:
            # Python依赖
            if any(dep["name"].endswith(".py") for dep in dependencies):
                await self._install_python_dependencies(workspace, dependencies)

            # Node.js依赖
            if any(
                dep["name"].startswith("@")
                or dep["name"] in ["react", "vue", "angular"]
                for dep in dependencies
            ):
                await self._install_nodejs_dependencies(workspace, dependencies)

    async def _create_file_info(self, file_path: Path) -> FileInfo:
        """创建文件信息"""
        stat = file_path.stat()
        checksum = await calculate_file_hash(file_path)

        return FileInfo(
            path=str(file_path),
            size=stat.st_size,
            checksum=checksum,
            checksum_type="sha256",
            mime_type=self._get_mime_type(file_path),
            created_at=datetime.fromtimestamp(stat.st_ctime),
            modified_at=datetime.fromtimestamp(stat.st_mtime),
        )

    async def _cleanup_workspace(self, workspace: Path) -> None:
        """清理工作空间"""
        try:
            if workspace.exists():
                shutil.rmtree(workspace)
                logger.debug(f"工作空间 {workspace} 清理完成")
        except Exception as e:
            logger.warning(f"工作空间清理失败: {e}")

    def _get_mime_type(self, file_path: Path) -> str:
        """获取文件MIME类型"""
        import mimetypes

        mime_type, _ = mimetypes.guess_type(str(file_path))
        return mime_type or "application/octet-stream"

    # 其他辅助方法的占位符实现
    async def _prepare_docker_environment(
        self, workspace: Path, build_config: Dict
    ) -> None:
        """准备Docker环境"""
        pass

    async def _install_python_dependencies(
        self, workspace: Path, dependencies: List[Dict]
    ) -> None:
        """安装Python依赖"""
        pass

    async def _install_nodejs_dependencies(
        self, workspace: Path, dependencies: List[Dict]
    ) -> None:
        """安装Node.js依赖"""
        pass

    async def _run_pre_build_commands(self, workspace: Path, build_task) -> None:
        """运行预构建命令"""
        pass

    async def _run_post_build_commands(self, workspace: Path, build_task) -> None:
        """运行后构建命令"""
        pass

    async def _run_package_tests(self, workspace: Path, build_task) -> List[TestResult]:
        """运行包测试"""
        return []

    async def _generate_package_formats(
        self,
        artifacts: List[FileInfo],
        target_formats: List[PackageFormat],
        workspace: Path,
    ) -> List[FileInfo]:
        """生成包格式"""
        return artifacts

    async def _prepare_test_environment(self, workspace: Path, package) -> None:
        """准备测试环境"""
        pass

    async def _run_single_test(
        self, workspace: Path, package, test_type: TestType, coverage_required: bool
    ) -> TestResult:
        """运行单个测试"""
        pass

    def _merge_test_results(self, test_results: List[TestResult]) -> TestResult:
        """合并测试结果"""
        # 简单实现，返回第一个结果
        return (
            test_results[0]
            if test_results
            else TestResult(
                test_type=TestType.UNIT,
                status="skipped",
                passed=0,
                failed=0,
                skipped=0,
                coverage=None,
                duration_seconds=0.0,
                logs=[],
                reports=[],
            )
        )

    async def _collect_test_reports(self, workspace: Path) -> List[FileInfo]:
        """收集测试报告"""
        return []

    def _extract_jest_coverage(self, workspace: Path) -> Optional[float]:
        """提取Jest覆盖率"""
        return None

    async def _create_zip_package(self, workspace: Path, zip_path: Path) -> None:
        """创建ZIP包"""
        pass

    # 其他构建工具的占位符实现
    async def _build_cmake_package(self, workspace: Path, build_task) -> List[FileInfo]:
        """构建CMake包"""
        return []

    async def _build_gradle_package(
        self, workspace: Path, build_task
    ) -> List[FileInfo]:
        """构建Gradle包"""
        return []

    async def _build_maven_package(self, workspace: Path, build_task) -> List[FileInfo]:
        """构建Maven包"""
        return []

    async def _build_go_package(self, workspace: Path, build_task) -> List[FileInfo]:
        """构建Go包"""
        return []

    async def _build_rust_package(self, workspace: Path, build_task) -> List[FileInfo]:
        """构建Rust包"""
        return []

    async def _build_custom_package(
        self, workspace: Path, build_task
    ) -> List[FileInfo]:
        """自定义构建"""
        return []

    # 其他测试框架的占位符实现
    async def _run_unittest(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行unittest测试"""
        pass

    async def _run_mocha(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行Mocha测试"""
        pass

    async def _run_go_test(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行Go测试"""
        pass

    async def _run_cargo_test(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行Cargo测试"""
        pass

    async def _run_junit(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行JUnit测试"""
        pass

    async def _run_custom_test(self, workspace: Path, test_config: Dict) -> TestResult:
        """运行自定义测试"""
        pass


# 创建全局服务实例
build_service = BuildService()

# 导出
__all__ = ["BuildService", "BuildResult", "TestResult", "build_service"]
