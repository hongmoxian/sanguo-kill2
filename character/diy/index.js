import { lib, game, ui, get, ai, _status } from "../../noname.js";
import characters from "./character.js";
import cards from "./card.js";
import pinyins from "./pinyin.js";
import skills from "./skill.js";
import translates from "./translate.js";
import characterIntros from "./intro.js";
import characterTitles from "./characterTitles.js";
import characterFilters from "./characterFilter.js";
import characterReplaces from "./characterReplace.js";
import dynamicTranslates from "./dynamicTranslate.js";
import perfectPairs from "./perfectPairs.js";
import voices from "./voices.js";
import { characterSort, characterSortTranslate } from "./sort.js";

game.import("character", function () {
	// 默认开启"显示身份按钮"和"显示角色势力"
	if (lib.config) {
		if (lib.config.show_playerids !== true) {
			game.saveConfig("show_playerids", true);
		}
		if (lib.config.show_group !== true) {
			game.saveConfig("show_group", true);
		}
	}
	return {
		name: "diy",
		connect: true,
		connectBanned: ["diy_tianyu", "diy_yangyi", "diy_lukang", "ns_huamulan", "ns_yuji", "ns_duangui", "ns_liuzhang", "key_yuu"],
		character: { ...characters },
		characterSort: {
			diy: characterSort,
		},
		characterFilter: { ...characterFilters },
		characterTitle: { ...characterTitles },
		dynamicTranslate: { ...dynamicTranslates },
		characterIntro: { ...characterIntros },
		characterReplace: { ...characterReplaces },
		card: { ...cards },
		skill: { ...skills },
		perfectPair: { ...perfectPairs },
		translate: { ...translates, ...voices, ...characterSortTranslate },
		pinyins: { ...pinyins },
	};
});
