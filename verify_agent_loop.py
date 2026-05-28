
import re

def looks_like_task_complete_simulated(text):
    """
    模拟修复后的 looksLikeTaskComplete 逻辑。
    修复后的逻辑应能识别 '任务已完成，接下来...' 这种模糊状态并返回 'ambiguous'。
    """
    # 1. 检查是否存在“任务已完成，接下来...”这种模糊模式 (Ambiguous Case)
    ambiguous_pattern = r"任务已完成，接下来"
    if re.search(ambiguous_pattern, text):
        return 'ambiguous'
    
    # 2. 检查是否完全匹配完成信号 (Explicit Complete Case)
    complete_patterns = [
        r"^任务已全部完成$",
        r"^任务结束$",
        r"^任务已完成$"
    ]
    
    for pattern in complete_patterns:
        if re.search(pattern, text):
            return True
            
    # 3. 默认返回 False (Explicit Incomplete Case)
    return False

def agent_run_simulation(input_text):
    """
    模拟 Agent.run 的循环控制逻辑。
    """
    print(f"\n[Testing Input]: '{input_text}'")
    
    status = looks_like_task_complete_simulated(input_text)
    print(f"[Detected Status]: {status}")
    
    if status is True:
        return "STOP (Success: Loop terminated as expected)"
    elif status == 'ambiguous':
        # 关键点：如果是 ambiguous，必须停止自动注入，等待用户干预
        return "STOP (Success: Ambiguous state prevented auto-injection)"
    elif status is False:
        return "CONTINUE (Proceeding to next iteration)"
    else:
        return "ERROR (Unknown status)"

def run_test_suite():
    test_cases = [
        ("任务已全部完成", True, "Explicit Complete"),
        ("任务结束", True, "Explicit Complete"),
        ("任务还在进行中，请继续", False, "Explicit Incompleted"),
        ("任务已完成，接下来请查看日志", "ambiguous", "Ambiguous (The Critical Case)"),
        ("任务已完成，接下来执行部署", "ambiguous", "Ambiguous (The Critical Case)"),
    ]
    
    passed = 0
    total = len(test_cases)
    
    print("=== Starting Agent.run Regression Test Simulation ===\n")
    
    for text, expected_status, description in test_cases:
        print(f"--- Case: {description} ---")
        result = agent_run_simulation(text)
        
        # 验证逻辑
        # 对于 True 和 'ambiguous'，我们期望的是 STOP
        # 对于 False，我们期望的是 CONTINUE
        
        is_correct = False
        if expected_status in [True, 'ambiguous'] and "STOP" in result:
            is_correct = True
        elif expected_status is False and "CONTINUE" in result:
            is_correct = True
            
        if is_correct:
            print("Result: [PASS]")
            passed += 1
        else:
            print(f"Result: [FAIL] (Expected {expected_status} behavior, but got {result})")
            
    print(f"\n=== Test Summary: {passed}/{total} passed ===")

if __name__ == "__main__":
    run_test_suite()
