---
name: openspace-scene-management
version: 1.0.0
level: builtin
triggers: [加载, 卸载, 显示, 隐藏, 切换场景, Profile, 数据集]
tools: [openspace_execute]
requires_openspace: true
---

# OpenSpace 场景管理

管理 OpenSpace 场景内容：加载/卸载数据集、切换 Profile、图层显隐、属性修改。

## 操作指令

### 加载数据集
```
openspace.addSceneGraphNode("数据集名称")
```

### 卸载数据集
```
openspace.removeSceneGraphNode("数据集名称")
```

### 切换 Profile
```
openspace.loadProfile("solar_system")
```

### 图层显隐
```
openspace.setPropertyValue("Modules.Stars.Enabled", false)
openspace.setPropertyValue("Modules.MilkyWay.Enabled", true)
```

### 属性修改
```
openspace.setPropertyValue("RenderEngine.ShowAtmosphere", true)
openspace.setPropertyValue("RenderEngine.AmbientLight", 1.0)
```

## 可用性
由 `OpenSpaceProcessManager.runState === 'running'` 决定。
