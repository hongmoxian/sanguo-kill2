import { lib, game, ui, get, ai, _status } from "../noname.js";

export const type = "mode";

export default () => {
	return {
		name: "sanying",
		start() {
			"step 0";
			var playback = localStorage.getItem(lib.configprefix + "playback");
			if (playback) {
				ui.create.me();
				ui.arena.style.display = "none";
				ui.system.style.display = "none";
				_status.playback = playback;
				localStorage.removeItem(lib.configprefix + "playback");
				var store = lib.db.transaction(["video"], "readwrite").objectStore("video");
				store.get(parseInt(playback)).onsuccess = function (e) {
					if (e.target.result) {
						game.playVideoContent(e.target.result.video);
					} else {
						alert("播放失败：找不到录像");
						game.reload();
					}
				};
				event.finish();
				return;
			}
			lib.init.css(lib.assetURL + "layout/mode", "versus");
			// 创建4个玩家位置
			game.prepareArena(4);
			game.delay(0.1);

			"step 1";
			// 初始化三英模式状态
			_status.sanying = {
				lvbu_form: 1,
				formSwitched: false,
				lvbu: null,
				allies: [],
				turnOrder: [],
				turnIndex: 0,
			};

			// 设置身份：3联合军 + 1吕布
			// 座位顺序：A → 吕布 → B → 吕布(二形态后) → C → ...
			// 但实际座位是：A → B → C → 吕布（联合军先行动）
			game.players[0].identity = "allyA";
			game.players[1].identity = "allyB";
			game.players[2].identity = "allyC";
			game.players[3].identity = "lvbu";
			game.players.forEach(function (player) {
				player.side = player.identity != "lvbu";
			});

			// 身份选择只决定玩家控制哪一方，模式仍然保持三英对一吕布。
			game.players.forEach(game.sanyingSetIdentity);
			game.me = game.players[0];
			game.me.chooseControl("联合军", "吕布").set("prompt", "请选择你的身份").set("ai", function () {
				return "联合军";
			});

			"step 2";
			event.controlIdentity = result.control == "吕布" ? "lvbu" : "ally";
			if (event.controlIdentity == "lvbu") {
				game.swapControl(game.players[3]);
				event.goto(5);
				return;
			}

			// 玩家最多选择三名联合军武将；少选的座位由AI自动补齐，避免确认按钮因数量不足无法使用。
			var characterList = game.sanyingCharacterList();
			characterList.remove("shen_lvbu_sanying");
			game.me
				.chooseButton(true, ["选择联合军武将（最多三名）", [characterList, "character"]])
				.set("onfree", true)
				.set("selectButton", [1, 3])
				.set("ai", function (button) {
					return Math.random();
				});

			"step 3";
			event.selectedAllies = result.links && result.links.length ? result.links.slice(0, 3) : [];
			for (var i = 0; i < event.selectedAllies.length; i++) {
				game.players[i].init(event.selectedAllies[i]);
				game.log(game.players[i], "选择了", "#y" + get.translation(event.selectedAllies[i]));
			}

			"step 4";
			// 吕布玩家不需要再次选将，跳过联合军选将结果处理。
			if (event.controlIdentity == "lvbu") event.goto(5);

			"step 5";
			// AI联合军选将；若玩家选择吕布，则三名联合军全部由AI初始化。
			var allyList = game.sanyingCharacterList();
			allyList.remove("shen_lvbu_sanying");
			if (event.selectedAllies) {
				event.selectedAllies.forEach(function (name) {
					allyList.remove(name);
				});
			}
			allyList.randomSort();
			var allyPlayers = game.players.slice(0, 3);
			for (var i = 0; i < allyPlayers.length; i++) {
				var ally = allyPlayers[i];
				if (!ally.name || !lib.character[ally.name]) {
					var allyName = allyList.shift();
					if (allyName) {
						ally.init(allyName);
						game.log(ally, "选择了", "#y" + get.translation(allyName));
					}
				}
			}
			game.players.forEach(game.sanyingSetIdentity);
			// init() 正常会挂载武将技能；模式选将后再校验一次，避免自定义模式
			// 的初始化流程遗漏角色定义中的技能。
			game.players.forEach(game.sanyingRestoreSkills);

			"step 6";
			// 吕布初始化
			game.players[3].init("shen_lvbu_sanying");
			_status.sanying.lvbu = game.players[3];
			_status.sanying.allies = game.players.slice(0, 3);
			_status.sanying.turnOrder = [
				game.players[0],
				game.players[3],
				game.players[1],
				game.players[3],
				game.players[2],
			];
			_status.sanying.turnIndex = 0;
			_status.sanying.allies.forEach(function (player) {
				player.addSkill("sanying_chongzheng");
			});
			game.addGlobalSkill("sanying_ally_rescue");
			game.sanyingSetIdentity(game.players[3]);
			game.log(game.players[3], "以【神吕布·最强神话】形态登场！");

			"step 7";
			// 起始手牌：联合军4张，吕布8张
			game.gameDraw(game.players[0], function (player) {
				if (player.identity == "lvbu") return 8;
				return 4;
			});

			// 牌堆洗牌四次仍未分出胜负时，按APK规则判定平局
			_status.maxShuffle = 4;
			_status.maxShuffleCheck = function () {
				return "平局";
			};

			// 联合军A先行动
			game.phaseLoop(game.players[0]);
		},
		game: {
			sanyingCharacterList: function () {
				return Object.keys(lib.character).filter(function (name) {
					return lib.character[name] && !lib.filter.characterDisabled(name);
				});
			},
			sanyingSetIdentity: function (player) {
					if (!player || !player.node || !player.node.identity || !player.node.identity.firstChild) return;
					player.node.identity.firstChild.innerHTML = get.translation(player.identity + "_bg") || get.translation(player.identity) || player.identity;
				player.node.identity.dataset.color = player.identity == "lvbu" ? "lvbu" : "ally";
			},
			sanyingRestoreSkills: function (player) {
				if (!player || !player.name || !lib.character[player.name]) return;
				var skills = lib.character[player.name][3];
				if (Array.isArray(skills) && skills.length) player.addSkills(skills);
			},
			sanyingNextPlayer: function (player) {
				var state = _status.sanying;
				if (!state || !state.turnOrder.length) return null;
				var index = state.turnOrder.indexOf(player);
				if (index < 0) index = state.turnIndex;
				for (var i = 1; i <= state.turnOrder.length; i++) {
					var nextIndex = (index + i) % state.turnOrder.length;
					var next = state.turnOrder[nextIndex];
					if (next && next.isIn()) {
						state.turnIndex = nextIndex;
						return next;
					}
				}
				return null;
			},
			phaseLoop: function (startPlayer) {
				var next = game.createEvent("phaseLoop");
				next.player = startPlayer;
				next._isStandardLoop = true;
				next.setContent(function () {
					"step 0";
					if (game.checkResult()) {
						event.finish();
						return;
					}
					if (!event.player || !event.player.isIn()) {
						event.player = game.sanyingNextPlayer(event.player);
					}
					if (!event.player) {
						event.finish();
						return;
					}
					event.turnPlayer = event.player;
					for (var i = 0; i < lib.onphase.length; i++) lib.onphase[i]();
					event.player.phase();
					"step 1";
					// phaseLoop 必须发出 phaseOver，否则阶段事件无法完整收尾，随后会卡在等待状态。
					event.trigger("phaseOver");
					"step 2";
					if (game.checkResult()) {
						event.finish();
						return;
					}
					// APK中的变身发生在吕布回合结束后，并立即由吕布继续行动一次。
					if (game.sanyingShouldSwitchForm(event.turnPlayer)) {
						game.sanyingSwitchForm(event.turnPlayer);
						_status.sanying.turnOrder = [
							_status.sanying.lvbu,
							_status.sanying.allies[0],
							_status.sanying.allies[1],
							_status.sanying.allies[2],
						];
						_status.sanying.turnIndex = 0;
						event.player = event.turnPlayer;
						event.goto(0);
						return;
					}
					event.player = game.sanyingNextPlayer(event.turnPlayer);
					event.goto(0);
				});
				return next;
			},
			sanyingShouldSwitchForm: function (lvbu) {
				return !!(
					lvbu &&
					lvbu.isIn() &&
					_status.sanying &&
					_status.sanying.lvbu == lvbu &&
					!_status.sanying.formSwitched &&
					!lvbu.getEquip(1) &&
					lvbu.hp <= 4
				);
			},
			sanyingSwitchForm: function (lvbu) {
				_status.sanying.formSwitched = true;
				_status.sanying.lvbu_form = 2;

				// 体力上限改为4，体力回复至4
				lvbu.maxHp = 4;
				lvbu.hp = 4;
				lvbu.update();

				// 摸3张牌
				lvbu.draw(3);

				// 弃置装备区所有武器
				var weapons = lvbu.getCards("e", function (card) {
					return get.subtype(card) == "equip1";
				});
				if (weapons.length) lvbu.discard(weapons);

				// 清空判定区延时锦囊
				var judges = lvbu.getCards("j");
				if (judges.length) lvbu.discard(judges);

				// 移除一形态技能，添加二形态技能
				lvbu.removeSkill("sanying_shenji1");
				lvbu.addSkill("sanying_shenji2");
				lvbu.addSkill("sanying_xiuluo");
				lvbu.addSkill("sanying_shenwei");
				lvbu.storage.sanying_form = 2;

				game.log(lvbu, "进入了【暴怒的战神】形态！");

			},
			checkResult: function () {
				if (_status.over) return true;
				var lvbu = _status.sanying && _status.sanying.lvbu;
				var playerIsLvbu = game.me && game.me.identity == "lvbu";
				var aliveAllies = game.players.filter(function (p) {
					return p.identity != "lvbu" && p.isIn();
				});

				if (!lvbu || !lvbu.isIn()) {
					game.over(!playerIsLvbu);
					return true;
				}
				if (aliveAllies.length == 0) {
					game.over(playerIsLvbu);
					return true;
				}
				return false;
			},
		},
			element: {
				player: {
					dieAfter: function () {
						if (!_status.sanying || _status.over) return;
						var playerIsLvbu = game.me && game.me.identity == "lvbu";
						if (this.identity == "lvbu") {
							game.over(!playerIsLvbu);
							return;
					}
					var ally = game.players.find(function (player) {
						return player.identity != "lvbu" && player.isIn();
					});
						if (!ally) {
							game.over(playerIsLvbu);
						return;
					}
					// 玩家阵亡后继续控制剩余联合军，保持三英模式的单人可玩性。
					if (this == game.me) game.swapControl(ally);
				},
			},
		},
		get: {
			rawAttitude: function (from, to) {
				if (!from || !to) return 0;
				if (from == to) return 10;
				if (from.identity == "lvbu") return to.identity == "lvbu" ? 6 : -6;
				return to.identity == "lvbu" ? -6 : 6;
			},
		},
	};
};
