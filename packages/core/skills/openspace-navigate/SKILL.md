---
name: openspace-navigation
version: 1.0.0
level: builtin
triggers: [飞, 导航, 前往, 放大, 缩小, 旋转, 相机]
tools: [openspace_execute]
requires_openspace: true
---

# OpenSpace 导航操作

在 OpenSpace 宇宙可视化场景中执行导航操作：飞往天体、调整相机距离、控制时间流速、旋转视角。

## 操作指令

### 飞往天体
```
openspace.setPropertyValue("NavigationHandler.Target", "地球")
openspace.setPropertyValue("NavigationHandler.Distance", 2e7)
```

### 设置目标距离（放大/缩小）
```
openspace.setPropertyValue("NavigationHandler.Distance", 5e6)
```

### 时间控制
```
openspace.setPropertyValue("TimeManager.TargetDeltaTime", 60)
```

### 旋转视角
```
openspace.setPropertyValue("NavigationHandler.Aim", "NorthPole")
```

### 重置相机
```
openspace.setPropertyValue("NavigationHandler.Reset", true)
```

## 可用性
由 `OpenSpaceProcessManager.runState === 'running'` 决定。
