# APK 模式逆向与网页端映射

## 结论边界

`libgame.so` 可以反汇编并重建接近源码的规则状态机，但不能恢复变量名、注释和原始 C++ 源码。本文把证据分为三类：

- **符号确认**：来自 ELF 导出符号和 C++ 名称。
- **反汇编确认**：来自 ARM Thumb 指令、常量与分支。
- **网页端设计**：为适配无名杀引擎而做的实现，不代表 APK 原始规则。

分析对象：`三国KILL-4.6.3-201608231747.apk` 中的 `lib/armeabi-v7a/libgame.so`。

## 三英战吕布

已确认的入口包括：

```text
GameManager::startSanYingDIYGame(int, bool*)       0x0052c82d
DIYSanYingManager::startGame(ShenZuoCiRecord*, bool*) 0x004f3319
DIYSanYingManager::checkIsForbidSkill             0x004f326d
DIYSanYingManager::getRecordForLocal              0x004f0bdf
DIYSanYingManager::setRecordForLocal              0x004f128b
DIYSanYingManager::saveShenZuoCiRecord            0x004f6515
```

当前可重建的高层伪代码：

```text
startSanYingDIYGame(selection, flags):
  读取或创建本地三英记录
  校验所选武将技能是否被模式禁止
  建立 3 名联合军与吕布阵营
  启动第一形态并记录变身计时
  进入三英专用回合状态机

first-form turn order:
  allyA -> lvbu -> allyB -> lvbu -> allyC -> repeat

after transformation:
  lvbu -> allyA -> allyB -> allyC -> repeat
```

网页端对应实现位于 `mode/sanying.js`。回合顺序、双形态、阵营胜负和联合军选将已经实现；技能禁用表和 APK 精确变身条件仍需继续反汇编确认。

## 无尽模式

已确认 `EndlessManager` 维护以下状态：

```text
levelTop, levelChild, availablePoints
generalA, generalB, generalC
leftBloodNums[general]
addedMaxBloodNums[general]
currentMaxBloodNums[general]
```

关键入口：

```text
EndlessManager::startLevel                     0x00508639
EndlessManager::incrLevelTop                   0x005086c7
EndlessManager::incrLevelChild                 0x00508767
EndlessManager::requestForStartEndlessGame     0x005095d9
EndlessManager::requestForEndEndlessGame       0x0050a479
EndlessManager::recoverGeneral                 0x00509539
```

反汇编已确认：

- `levelTop`（对象偏移 `+0x24`）增加时在当前值大于 6 后停止，即有效范围为 1 到 7。
- `levelChild`（对象偏移 `+0x38`）增加时在当前值大于 `0x62` 后停止，即有效范围为 1 到 99。
- `getLevelChild(int)` 通过 `index - 1` 访问一个 7 项容器。
- `startLevel` 会重置两个层级容器，并用层级值选择关卡数据，然后触发后续游戏启动调用。

接近当前证据的伪代码：

```text
startLevel():
  levelChild = 1
  levelTop = 1
  stage = stageTable[levelTop - 1][levelChild - 1]
  dispatchStart(stage)

incrLevelChild():
  if levelChild > 98: return
  levelChild += 1
  refreshStage(stageTable[levelTop - 1][levelChild - 1])

incrLevelTop():
  if levelTop > 6: return
  reset/advance child level
  levelTop += 1
  refreshStage(stageTable[levelTop - 1][levelChild - 1])
```

## 当前网页端实现

网页端先恢复了 `versus` 中被隐藏的“无尽”入口，并补齐：

- 自由选将和随机敌将。
- 敌将死亡后进入下一关，不结束整局。
- 敌将池耗尽后重建候选池。
- 每三关提高敌将 1 点体力上限，最多增加 5 点。
- 每五关提高敌将起始手牌，最多增加 2 张。
- 过关后玩家回复 1 点体力并摸 2 张牌。
- 最高通关数保存到 `versus_endless_level`。

这些成长数值属于**网页端设计**，不是 APK 反汇编结论。APK 中 A/B/C 三武将编队、点数分配、关卡奖励和存档编解码会在对应函数完成反编译后逐项替换。

## 后续逆向顺序

1. 反编译 `requestForStartEndlessGame`，确认 A/B/C 如何进入战斗模型。
2. 跟踪 `availablePoints` 的写入交叉引用，恢复加点价格和奖励。
3. 反编译 `requestForEndEndlessGame`，确认胜负、血量回写和关卡推进。
4. 解析 `encode/decode` 的字典键，建立与网页 `localStorage` 的字段映射。
5. 对三英的变身条件、禁用技能表和救援规则做同样的调用图分析。
