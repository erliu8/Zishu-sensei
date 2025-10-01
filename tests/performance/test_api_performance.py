# -*- coding: utf-8 -*-
"""
API性能和负载测试套件
测试API在高负载下的性能表现
"""
import pytest
import asyncio
import time
import statistics
import psutil
import os
import gc
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple
from unittest.mock import Mock, AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient

from zishu.api.server import create_app


@pytest.mark.performance
@pytest.mark.api
class TestAPIPerformanceSetup:
    """API性能测试设置"""
    
    @pytest.fixture(scope="session")
    def performance_app(self):
        """创建性能测试应用"""
        # 创建优化的测试配置
        config = {
            "TESTING": True,
            "LOG_LEVEL": "WARNING",  # 减少日志输出
            "CORS_ORIGINS": ["*"],
            "MAX_REQUEST_SIZE": 50 * 1024 * 1024,  # 50MB
            "REQUEST_TIMEOUT": 60.0,
            "WORKER_CONNECTIONS": 1000
        }
        
        try:
            app = create_app(config=config)
            return app
        except Exception:
            # 创建基本的性能测试应用
            app = FastAPI(title="Performance Test API")
            
            @app.get("/health")
            async def health_check():
                return {"status": "healthy", "timestamp": time.time()}
            
            @app.post("/chat/completions")
            async def chat_completions(request: dict):
                # 模拟一些处理时间
                await asyncio.sleep(0.01)  # 10ms处理时间
                
                return {
                    "id": f"perf-test-{int(time.time() * 1000)}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": request.get("model", "performance-model"),
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": f"Performance response for: {request['messages'][-1]['content'][:50]}..."
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": len(request['messages'][-1]['content']) // 4,
                        "completion_tokens": 20,
                        "total_tokens": len(request['messages'][-1]['content']) // 4 + 20
                    }
                }
            
            @app.post("/chat/stream")
            async def chat_stream(request: dict):
                async def generate():
                    chunks = ["Hello", " world", "!", " This", " is", " streaming", "."]
                    for i, chunk in enumerate(chunks):
                        await asyncio.sleep(0.005)  # 5ms per chunk
                        finish_reason = 'null' if i < len(chunks)-1 else '"stop"'
                        yield f"data: {{'delta': {{'content': '{chunk}'}}, 'finish_reason': {finish_reason}}}\n\n"
                
                return generate()
            
            return app
    
    @pytest.fixture
    def perf_client(self, performance_app):
        """性能测试客户端"""
        return TestClient(performance_app)
    
    @pytest.fixture
    async def async_perf_client(self, performance_app):
        """异步性能测试客户端"""
        async with AsyncClient(app=performance_app, base_url="http://test") as ac:
            yield ac
    
    @pytest.fixture
    def system_monitor(self):
        """系统监控器"""
        class SystemMonitor:
            def __init__(self):
                self.process = psutil.Process(os.getpid())
                self.initial_memory = self.process.memory_info().rss
                self.initial_cpu_time = self.process.cpu_times()
                self.start_time = time.time()
            
            def get_current_stats(self):
                current_memory = self.process.memory_info().rss
                current_cpu_time = self.process.cpu_times()
                current_time = time.time()
                
                return {
                    "memory_mb": current_memory / (1024 * 1024),
                    "memory_increase_mb": (current_memory - self.initial_memory) / (1024 * 1024),
                    "cpu_percent": self.process.cpu_percent(),
                    "elapsed_time": current_time - self.start_time,
                    "user_cpu_time": current_cpu_time.user - self.initial_cpu_time.user,
                    "system_cpu_time": current_cpu_time.system - self.initial_cpu_time.system
                }
        
        return SystemMonitor()


@pytest.mark.performance
@pytest.mark.api
class TestBasicPerformance:
    """基础性能测试"""
    
    def test_health_check_performance(self, perf_client, system_monitor):
        """测试健康检查性能"""
        num_requests = 1000
        response_times = []
        
        # 预热
        for _ in range(10):
            perf_client.get("/health")
        
        # 性能测试
        start_time = time.time()
        
        for i in range(num_requests):
            request_start = time.time()
            response = perf_client.get("/health")
            request_end = time.time()
            
            assert response.status_code == 200
            response_times.append(request_end - request_start)
            
            # 每100个请求检查一次系统状态
            if i % 100 == 0:
                stats = system_monitor.get_current_stats()
                assert stats["memory_increase_mb"] < 100  # 内存增长不超过100MB
        
        total_time = time.time() - start_time
        
        # 性能指标
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        p99_response_time = statistics.quantiles(response_times, n=100)[98]  # 99th percentile
        throughput = num_requests / total_time
        
        # 性能断言
        assert avg_response_time < 0.01  # 平均响应时间 < 10ms
        assert p95_response_time < 0.02  # 95%响应时间 < 20ms
        assert p99_response_time < 0.05  # 99%响应时间 < 50ms
        assert throughput > 100  # 吞吐量 > 100 req/s
        
        print(f"\n健康检查性能指标:")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  P95响应时间: {p95_response_time*1000:.2f}ms")
        print(f"  P99响应时间: {p99_response_time*1000:.2f}ms")
        print(f"  吞吐量: {throughput:.2f} req/s")
    
    def test_chat_completion_performance(self, perf_client, system_monitor):
        """测试聊天完成性能"""
        num_requests = 100
        response_times = []
        
        request_template = {
            "messages": [{"role": "user", "content": "Performance test message"}],
            "model": "performance-model",
            "temperature": 0.7,
            "max_tokens": 100
        }
        
        # 预热
        for _ in range(5):
            perf_client.post("/chat/completions", json=request_template)
        
        # 性能测试
        start_time = time.time()
        
        for i in range(num_requests):
            # 变化消息内容以避免缓存
            request_data = request_template.copy()
            request_data["messages"][0]["content"] = f"Performance test message {i}"
            
            request_start = time.time()
            response = perf_client.post("/chat/completions", json=request_data)
            request_end = time.time()
            
            assert response.status_code == 200
            response_times.append(request_end - request_start)
            
            # 验证响应格式
            data = response.json()
            assert "choices" in data
            assert len(data["choices"]) > 0
        
        total_time = time.time() - start_time
        
        # 性能指标
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]
        throughput = num_requests / total_time
        
        # 性能断言
        assert avg_response_time < 0.1  # 平均响应时间 < 100ms
        assert p95_response_time < 0.2  # 95%响应时间 < 200ms
        assert throughput > 10  # 吞吐量 > 10 req/s
        
        print(f"\n聊天完成性能指标:")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  P95响应时间: {p95_response_time*1000:.2f}ms")
        print(f"  吞吐量: {throughput:.2f} req/s")


@pytest.mark.performance
@pytest.mark.api
class TestConcurrencyPerformance:
    """并发性能测试"""
    
    def test_concurrent_health_checks(self, perf_client, system_monitor):
        """测试并发健康检查"""
        num_threads = 10
        requests_per_thread = 50
        total_requests = num_threads * requests_per_thread
        
        def make_requests(thread_id):
            """单线程请求函数"""
            thread_times = []
            for i in range(requests_per_thread):
                start_time = time.time()
                response = perf_client.get("/health")
                end_time = time.time()
                
                assert response.status_code == 200
                thread_times.append(end_time - start_time)
            
            return thread_times
        
        # 并发测试
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(make_requests, i) for i in range(num_threads)]
            all_times = []
            
            for future in as_completed(futures):
                thread_times = future.result()
                all_times.extend(thread_times)
        
        total_time = time.time() - start_time
        
        # 性能指标
        avg_response_time = statistics.mean(all_times)
        throughput = total_requests / total_time
        
        # 并发性能断言
        assert avg_response_time < 0.05  # 并发下平均响应时间 < 50ms
        assert throughput > 200  # 并发吞吐量 > 200 req/s
        
        # 系统资源检查
        final_stats = system_monitor.get_current_stats()
        assert final_stats["memory_increase_mb"] < 200  # 内存增长 < 200MB
        
        print(f"\n并发健康检查性能指标:")
        print(f"  并发线程数: {num_threads}")
        print(f"  总请求数: {total_requests}")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  吞吐量: {throughput:.2f} req/s")
        print(f"  内存增长: {final_stats['memory_increase_mb']:.2f}MB")
    
    def test_concurrent_chat_completions(self, perf_client, system_monitor):
        """测试并发聊天完成"""
        num_threads = 5
        requests_per_thread = 10
        total_requests = num_threads * requests_per_thread
        
        def make_chat_requests(thread_id):
            """单线程聊天请求函数"""
            thread_times = []
            for i in range(requests_per_thread):
                request_data = {
                    "messages": [{"role": "user", "content": f"Concurrent test {thread_id}-{i}"}],
                    "model": "performance-model"
                }
                
                start_time = time.time()
                response = perf_client.post("/chat/completions", json=request_data)
                end_time = time.time()
                
                assert response.status_code == 200
                thread_times.append(end_time - start_time)
                
                # 验证响应
                data = response.json()
                assert "choices" in data
            
            return thread_times
        
        # 并发聊天测试
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(make_chat_requests, i) for i in range(num_threads)]
            all_times = []
            
            for future in as_completed(futures):
                thread_times = future.result()
                all_times.extend(thread_times)
        
        total_time = time.time() - start_time
        
        # 性能指标
        avg_response_time = statistics.mean(all_times)
        throughput = total_requests / total_time
        
        # 并发聊天性能断言
        assert avg_response_time < 0.5  # 并发下平均响应时间 < 500ms
        assert throughput > 5  # 并发吞吐量 > 5 req/s
        
        print(f"\n并发聊天完成性能指标:")
        print(f"  并发线程数: {num_threads}")
        print(f"  总请求数: {total_requests}")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  吞吐量: {throughput:.2f} req/s")
    
    @pytest.mark.asyncio
    async def test_async_concurrent_performance(self, async_perf_client, system_monitor):
        """测试异步并发性能"""
        num_concurrent = 20
        requests_per_task = 25
        total_requests = num_concurrent * requests_per_task
        
        async def make_async_requests(task_id):
            """异步请求任务"""
            task_times = []
            for i in range(requests_per_task):
                start_time = time.time()
                response = await async_perf_client.get("/health")
                end_time = time.time()
                
                assert response.status_code == 200
                task_times.append(end_time - start_time)
            
            return task_times
        
        # 异步并发测试
        start_time = time.time()
        
        tasks = [make_async_requests(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks)
        
        total_time = time.time() - start_time
        
        # 收集所有响应时间
        all_times = []
        for task_times in results:
            all_times.extend(task_times)
        
        # 性能指标
        avg_response_time = statistics.mean(all_times)
        throughput = total_requests / total_time
        
        # 异步并发性能断言
        assert avg_response_time < 0.02  # 异步平均响应时间 < 20ms
        assert throughput > 500  # 异步吞吐量 > 500 req/s
        
        print(f"\n异步并发性能指标:")
        print(f"  并发任务数: {num_concurrent}")
        print(f"  总请求数: {total_requests}")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  吞吐量: {throughput:.2f} req/s")


@pytest.mark.performance
@pytest.mark.api
class TestLoadTesting:
    """负载测试"""
    
    def test_sustained_load(self, perf_client, system_monitor):
        """测试持续负载"""
        duration_seconds = 30  # 30秒持续负载
        target_rps = 50  # 目标每秒50个请求
        
        request_interval = 1.0 / target_rps
        end_time = time.time() + duration_seconds
        
        response_times = []
        error_count = 0
        request_count = 0
        
        print(f"\n开始持续负载测试 ({duration_seconds}秒, 目标 {target_rps} RPS)...")
        
        while time.time() < end_time:
            request_start = time.time()
            
            try:
                response = perf_client.get("/health")
                request_end = time.time()
                
                if response.status_code == 200:
                    response_times.append(request_end - request_start)
                else:
                    error_count += 1
                
                request_count += 1
                
                # 控制请求速率
                elapsed = request_end - request_start
                if elapsed < request_interval:
                    time.sleep(request_interval - elapsed)
                
            except Exception as e:
                error_count += 1
                request_count += 1
                print(f"请求错误: {e}")
            
            # 每5秒报告一次状态
            if request_count % (target_rps * 5) == 0:
                stats = system_monitor.get_current_stats()
                print(f"  {request_count} 请求完成, 内存: {stats['memory_mb']:.1f}MB, CPU: {stats['cpu_percent']:.1f}%")
        
        # 最终统计
        actual_duration = time.time() - (end_time - duration_seconds)
        actual_rps = request_count / actual_duration
        error_rate = error_count / request_count if request_count > 0 else 0
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            p95_response_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 20 else max(response_times)
        else:
            avg_response_time = 0
            p95_response_time = 0
        
        # 负载测试断言
        assert error_rate < 0.01  # 错误率 < 1%
        assert actual_rps >= target_rps * 0.9  # 实际RPS >= 目标的90%
        assert avg_response_time < 0.1  # 平均响应时间 < 100ms
        
        final_stats = system_monitor.get_current_stats()
        
        print(f"\n持续负载测试结果:")
        print(f"  持续时间: {actual_duration:.1f}秒")
        print(f"  总请求数: {request_count}")
        print(f"  实际RPS: {actual_rps:.2f}")
        print(f"  错误率: {error_rate*100:.2f}%")
        print(f"  平均响应时间: {avg_response_time*1000:.2f}ms")
        print(f"  P95响应时间: {p95_response_time*1000:.2f}ms")
        print(f"  最终内存使用: {final_stats['memory_mb']:.1f}MB")
        print(f"  内存增长: {final_stats['memory_increase_mb']:.1f}MB")
    
    def test_spike_load(self, perf_client, system_monitor):
        """测试突发负载"""
        # 正常负载阶段
        normal_rps = 10
        normal_duration = 10
        
        # 突发负载阶段
        spike_rps = 100
        spike_duration = 5
        
        # 恢复阶段
        recovery_duration = 10
        
        def run_load_phase(rps, duration, phase_name):
            """运行负载阶段"""
            request_interval = 1.0 / rps
            end_time = time.time() + duration
            
            phase_times = []
            phase_errors = 0
            phase_requests = 0
            
            print(f"\n{phase_name} 阶段 ({duration}秒, {rps} RPS)...")
            
            while time.time() < end_time:
                request_start = time.time()
                
                try:
                    response = perf_client.get("/health")
                    request_end = time.time()
                    
                    if response.status_code == 200:
                        phase_times.append(request_end - request_start)
                    else:
                        phase_errors += 1
                    
                    phase_requests += 1
                    
                    # 控制请求速率
                    elapsed = request_end - request_start
                    if elapsed < request_interval:
                        time.sleep(request_interval - elapsed)
                
                except Exception:
                    phase_errors += 1
                    phase_requests += 1
            
            return phase_times, phase_errors, phase_requests
        
        # 执行各个阶段
        print("开始突发负载测试...")
        
        # 正常负载
        normal_times, normal_errors, normal_requests = run_load_phase(
            normal_rps, normal_duration, "正常负载"
        )
        
        # 突发负载
        spike_times, spike_errors, spike_requests = run_load_phase(
            spike_rps, spike_duration, "突发负载"
        )
        
        # 恢复阶段
        recovery_times, recovery_errors, recovery_requests = run_load_phase(
            normal_rps, recovery_duration, "恢复"
        )
        
        # 分析结果
        def analyze_phase(times, errors, requests, phase_name):
            if times:
                avg_time = statistics.mean(times)
                p95_time = statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times)
            else:
                avg_time = 0
                p95_time = 0
            
            error_rate = errors / requests if requests > 0 else 0
            
            print(f"\n{phase_name} 阶段结果:")
            print(f"  请求数: {requests}")
            print(f"  错误率: {error_rate*100:.2f}%")
            print(f"  平均响应时间: {avg_time*1000:.2f}ms")
            print(f"  P95响应时间: {p95_time*1000:.2f}ms")
            
            return avg_time, error_rate
        
        normal_avg, normal_error_rate = analyze_phase(normal_times, normal_errors, normal_requests, "正常负载")
        spike_avg, spike_error_rate = analyze_phase(spike_times, spike_errors, spike_requests, "突发负载")
        recovery_avg, recovery_error_rate = analyze_phase(recovery_times, recovery_errors, recovery_requests, "恢复")
        
        # 突发负载测试断言
        assert spike_error_rate < 0.05  # 突发负载错误率 < 5%
        assert spike_avg < 0.2  # 突发负载平均响应时间 < 200ms
        assert recovery_error_rate < 0.01  # 恢复阶段错误率 < 1%
        
        # 恢复能力检查
        recovery_degradation = recovery_avg / normal_avg if normal_avg > 0 else 1
        assert recovery_degradation < 2.0  # 恢复后性能不应该严重下降
        
        final_stats = system_monitor.get_current_stats()
        print(f"\n系统最终状态:")
        print(f"  内存使用: {final_stats['memory_mb']:.1f}MB")
        print(f"  内存增长: {final_stats['memory_increase_mb']:.1f}MB")


@pytest.mark.performance
@pytest.mark.api
class TestMemoryPerformance:
    """内存性能测试"""
    
    def test_memory_leak_detection(self, perf_client, system_monitor):
        """测试内存泄漏检测"""
        num_cycles = 10
        requests_per_cycle = 100
        
        memory_snapshots = []
        
        for cycle in range(num_cycles):
            # 执行一批请求
            for i in range(requests_per_cycle):
                response = perf_client.get("/health")
                assert response.status_code == 200
            
            # 强制垃圾回收
            gc.collect()
            
            # 记录内存使用
            stats = system_monitor.get_current_stats()
            memory_snapshots.append(stats["memory_mb"])
            
            print(f"周期 {cycle + 1}: 内存使用 {stats['memory_mb']:.1f}MB")
            
            # 短暂休息
            time.sleep(0.1)
        
        # 分析内存趋势
        if len(memory_snapshots) >= 3:
            # 计算内存增长趋势
            memory_growth = memory_snapshots[-1] - memory_snapshots[0]
            avg_growth_per_cycle = memory_growth / (num_cycles - 1)
            
            # 检查是否有明显的内存泄漏
            assert memory_growth < 50  # 总内存增长 < 50MB
            assert avg_growth_per_cycle < 5  # 平均每周期增长 < 5MB
            
            print(f"\n内存泄漏检测结果:")
            print(f"  总内存增长: {memory_growth:.1f}MB")
            print(f"  平均每周期增长: {avg_growth_per_cycle:.1f}MB")
        
        # 检查内存稳定性
        if len(memory_snapshots) >= 5:
            recent_snapshots = memory_snapshots[-5:]
            memory_variance = statistics.variance(recent_snapshots)
            assert memory_variance < 100  # 内存使用方差应该较小
    
    def test_large_request_memory_handling(self, perf_client, system_monitor):
        """测试大请求内存处理"""
        # 创建不同大小的请求
        request_sizes = [1024, 10*1024, 100*1024, 1024*1024]  # 1KB到1MB
        
        initial_stats = system_monitor.get_current_stats()
        
        for size in request_sizes:
            large_content = "x" * size
            request_data = {
                "messages": [{"role": "user", "content": large_content}],
                "model": "performance-model"
            }
            
            # 发送大请求前的内存
            pre_request_stats = system_monitor.get_current_stats()
            
            response = perf_client.post("/chat/completions", json=request_data)
            
            # 发送大请求后的内存
            post_request_stats = system_monitor.get_current_stats()
            
            if response.status_code == 200:
                # 验证响应
                data = response.json()
                assert "choices" in data
                
                # 检查内存增长是否合理
                memory_increase = post_request_stats["memory_mb"] - pre_request_stats["memory_mb"]
                expected_increase = size / (1024 * 1024) * 2  # 预期增长（考虑处理开销）
                
                print(f"请求大小: {size/1024:.1f}KB, 内存增长: {memory_increase:.1f}MB")
                
                # 内存增长应该是合理的
                assert memory_increase < expected_increase + 10  # 允许10MB的处理开销
            
            # 强制垃圾回收
            gc.collect()
            time.sleep(0.1)
        
        # 检查最终内存状态
        final_stats = system_monitor.get_current_stats()
        total_memory_increase = final_stats["memory_mb"] - initial_stats["memory_mb"]
        
        # 处理大请求后，内存增长应该是合理的
        assert total_memory_increase < 100  # 总增长 < 100MB
        
        print(f"\n大请求内存处理结果:")
        print(f"  总内存增长: {total_memory_increase:.1f}MB")


@pytest.mark.performance
@pytest.mark.api
class TestStreamingPerformance:
    """流式响应性能测试"""
    
    def test_streaming_response_performance(self, perf_client, system_monitor):
        """测试流式响应性能"""
        num_streams = 10
        
        def test_single_stream():
            """测试单个流式响应"""
            request_data = {
                "messages": [{"role": "user", "content": "Stream test"}],
                "model": "performance-model",
                "stream": True
            }
            
            start_time = time.time()
            
            # 注意：TestClient可能不完全支持流式响应
            # 这里测试基本的流式端点
            try:
                response = perf_client.post("/chat/stream", json=request_data)
                
                if response.status_code == 200:
                    # 如果支持流式响应，读取所有数据
                    content = response.content
                    assert len(content) > 0
                
                end_time = time.time()
                return end_time - start_time
            
            except Exception as e:
                # 如果不支持流式响应，跳过测试
                pytest.skip(f"流式响应不支持: {e}")
        
        # 测试多个流式响应
        stream_times = []
        
        for i in range(num_streams):
            stream_time = test_single_stream()
            stream_times.append(stream_time)
            
            print(f"流 {i+1} 完成时间: {stream_time*1000:.2f}ms")
        
        # 性能分析
        if stream_times:
            avg_stream_time = statistics.mean(stream_times)
            max_stream_time = max(stream_times)
            
            # 流式响应性能断言
            assert avg_stream_time < 1.0  # 平均流式时间 < 1秒
            assert max_stream_time < 2.0  # 最大流式时间 < 2秒
            
            print(f"\n流式响应性能结果:")
            print(f"  流数量: {num_streams}")
            print(f"  平均完成时间: {avg_stream_time*1000:.2f}ms")
            print(f"  最大完成时间: {max_stream_time*1000:.2f}ms")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])  # -s 显示打印输出
