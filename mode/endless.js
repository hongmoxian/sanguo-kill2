import createVersusMode from "./versus.js?v=20260828-endless19";

export const type = "mode";

/**
 * 无尽模式使用 versus 的通用战局引擎，但作为主模式单独显示。
 * @type {() => importModeConfig}
 */
export default () => {
	const config = createVersusMode();
	config.name = "endless";
	config.translate = Object.assign({}, config.translate, {
		endless: "无尽模式",
	});
	return config;
};
