---
name: openspace-scene
description: 管理OpenSpace场景，加载/卸载数据集、切换Profile、图层操作
triggers:
  - 加载数据集
  - 卸载数据集
  - 切换场景
  - load dataset
  - unload dataset
  - switch profile
  - toggle layer
  - 显示图层
  - 隐藏图层
  - 切换profile
  - 图层操作
tools:
  - openspace_execute
parameters:
  action:
    type: string
    enum: [load, unload, toggle, show, hide, switch_profile]
    description: 场景操作类型
    required: true
  target:
    type: string
    description: 操作目标名称（数据集名称、图层URI、Profile名称）
    required: true
  profile:
    type: string
    description: Profile名称（用于switch_profile操作）
    required: false
examples:
  - input: 加载数据集 EarthNightLights
    script: openspace.addSceneGraphNode("EarthNightLights")
  - input: 卸载数据集 EarthClouds
    script: openspace.removeSceneGraphNode("EarthClouds")
  - input: 显示图层 EarthAtmosphere
    script: openspace.setPropertyValue("Modules.EarthAtmosphere.Enabled", true)
  - input: 隐藏图层 EarthClouds
    script: openspace.setPropertyValue("Modules.EarthClouds.Enabled", false)
  - input: 切换到solar_system profile
    script: openspace.setPropertyValue("Modules.SolarSystem.Enabled", true)\nopenspace.setPropertyValue("NavigationHandler.Target", "Earth")
level: auto-generated
---
