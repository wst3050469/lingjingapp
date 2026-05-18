---
name: openspace-navigate
description: 控制OpenSpace导航，聚焦天体、调整相机和时间
triggers:
  - 导航到
  - 聚焦
  - 飞向
  - navigate to
  - focus on
  - fly to
  - go to
  - set distance
  - zoom
  - set time
  - 调整时间
  - 时间控制
tools:
  - openspace_execute
parameters:
  target:
    type: string
    description: 目标天体名称（如 Earth, Mars, Jupiter, Sun, Moon）
    required: false
  distance:
    type: number
    description: 相机距离目标天体的距离（单位：km）
    required: false
  time:
    type: string
    description: 模拟时间（ISO 8601格式，如 2024-01-01T00:00:00）
    required: false
  latitude:
    type: number
    description: 地理纬度（用于地球观测）
    required: false
  longitude:
    type: number
    description: 地理经度（用于地球观测）
    required: false
examples:
  - input: 导航到火星
    script: openspace.setPropertyValue("NavigationHandler.Target", "Mars")\nopenspace.setPropertyValue("NavigationHandler.FlyToTarget", true)
  - input: 飞向木星，距离10000km
    script: openspace.setPropertyValue("NavigationHandler.Target", "Jupiter")\nopenspace.setPropertyValue("NavigationHandler.Distance", 10000)\nopenspace.setPropertyValue("NavigationHandler.FlyToTarget", true)
  - input: 设置时间为2024年6月1日
    script: openspace.time.setTime("2024-06-01T00:00:00")
  - input: 聚焦地球，距离5000km
    script: openspace.setPropertyValue("NavigationHandler.Target", "Earth")\nopenspace.setPropertyValue("NavigationHandler.Distance", 5000)
level: auto-generated
---
