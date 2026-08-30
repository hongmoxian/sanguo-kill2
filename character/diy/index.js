import { lib, game, ui, get, ai, _status } from "../../noname.js";
import characters from "./character.js?v=20260829-endless63";
import cards from "./card.js?v=20260829-endless63";
import pinyins from "./pinyin.js?v=20260829-endless63";
import skills from "./skill.js?v=20260829-endless63";
import translates from "./translate.js?v=20260829-endless63";
import characterIntros from "./intro.js?v=20260829-endless63";
import characterTitles from "./characterTitles.js?v=20260829-endless63";
import characterFilters from "./characterFilter.js?v=20260829-endless63";
import characterReplaces from "./characterReplace.js?v=20260829-endless63";
import dynamicTranslates from "./dynamicTranslate.js?v=20260829-endless63";
import perfectPairs from "./perfectPairs.js?v=20260829-endless63";
import voices from "./voices.js?v=20260829-endless63";
import { characterSort, characterSortTranslate } from "./sort.js?v=20260829-endless63";

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
