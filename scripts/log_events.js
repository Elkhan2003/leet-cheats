// ============ ПОЛНЫЙ LOGGER - СТАВЬ В НАЧАЛО index.js ============
let loggingEnabled = false;
let logKeys = true;
let logLocalEvents = true;
let logNatives = false;
let logGUI = true;
let logEntities = true;

// Функция для красивого форматирования
function formatArgs(args) {
	if (args.length === 0) return "нет аргументов";

	return args
		.map((arg, index) => {
			let formatted = "";

			if (typeof arg === "string") {
				try {
					const parsed = JSON.parse(arg);
					formatted = JSON.stringify(parsed, null, 2);
				} catch {
					formatted = arg.length > 200 ? arg.substring(0, 200) + "..." : arg;
				}
			} else if (typeof arg === "object" && arg !== null) {
				try {
					formatted = JSON.stringify(arg, null, 2);
				} catch {
					formatted = "[Object/Entity]";
				}
			} else {
				formatted = String(arg);
			}

			return `  [${index}]: ${formatted.split("\n").join("\n       ")}`;
		})
		.join("\n");
}

function logEvent(type, color, name, args = []) {
	if (!loggingEnabled) return;

	mp.gui.chat.push(`!{${color}}[${type}] ${name}`);
	mp.console.logInfo(`╔═══ [${type}] ${name} ═══`);
	if (args.length > 0) {
		mp.console.logInfo(`║ Аргументы (${args.length}):`);
		mp.console.logInfo(formatArgs(args));
	}
	mp.console.logInfo(`╚═══════════════════`);
}

// ==================== СОБЫТИЯ ====================

// 1. Client → Server
const originalCallRemote = mp.events.callRemote;
mp.events.callRemote = function (eventName, ...args) {
	logEvent("C→S", "00FF00", eventName, args);
	return originalCallRemote.call(mp.events, eventName, ...args);
};

// 2. Локальные события
const originalCall = mp.events.call;
mp.events.call = function (eventName, ...args) {
	if (logLocalEvents) logEvent("LOCAL", "FFAA00", eventName, args);
	return originalCall.call(mp.events, eventName, ...args);
};

// 3. RPC вызовы
if (mp.events.callRemoteProc) {
	const originalCallRemoteProc = mp.events.callRemoteProc;
	mp.events.callRemoteProc = function (eventName, ...args) {
		logEvent("RPC→S", "FFFF00", eventName, args);
		return originalCallRemoteProc.call(mp.events, eventName, ...args);
	};
}

// 4. Unreliable
if (mp.events.callRemoteUnreliable) {
	const originalCallRemoteUnreliable = mp.events.callRemoteUnreliable;
	mp.events.callRemoteUnreliable = function (eventName, ...args) {
		logEvent("C→S-U", "FF9900", eventName, args);
		return originalCallRemoteUnreliable.call(mp.events, eventName, ...args);
	};
}

// 5. Server → Client
const originalEventsAdd = mp.events.add;
mp.events.add = function (eventName, callback) {
	const wrappedCallback = function (...args) {
		logEvent("S→C", "00FFFF", eventName, args);
		return callback.apply(this, args);
	};
	return originalEventsAdd.call(mp.events, eventName, wrappedCallback);
};

// ==================== КЛАВИШИ ====================

const originalKeysBind = mp.keys.bind;
mp.keys.bind = function (key, keyDown, callback) {
	const keyName =
		typeof key === "number" ? `0x${key.toString(16).toUpperCase()}` : key;

	const wrappedCallback = function (...args) {
		if (logKeys)
			logEvent("KEY", "FF00FF", `${keyName} ${keyDown ? "↓" : "↑"}`, args);
		return callback.apply(this, args);
	};

	return originalKeysBind.call(mp.keys, key, keyDown, wrappedCallback);
};

// ==================== КОМАНДЫ ====================

const originalAddCommand = mp.events.addCommand;
if (originalAddCommand) {
	mp.events.addCommand = function (commandName, callback) {
		const wrappedCallback = function (...args) {
			logEvent("CMD", "FF69B4", `/${commandName}`, args);
			return callback.apply(this, args);
		};
		return originalAddCommand.call(mp.events, commandName, wrappedCallback);
	};
}

// ==================== GUI / CEF ====================

// Перехват mp.trigger (CEF → Client)
if (typeof mp.trigger !== "undefined") {
	const originalTrigger = mp.trigger;
	mp.trigger = function (eventName, ...args) {
		if (logGUI) logEvent("CEF→C", "00AAFF", eventName, args);
		return originalTrigger.call(mp, eventName, ...args);
	};
}

// Перехват Browser.execute
const originalBrowserNew = Browser;
Browser = function (...args) {
	const browser = new originalBrowserNew(...args);

	if (browser.execute) {
		const originalExecute = browser.execute;
		browser.execute = function (code) {
			if (logGUI && loggingEnabled) {
				mp.console.logInfo(`╔═══ [BROWSER.EXECUTE] ═══`);
				mp.console.logInfo(
					`Code: ${code.substring(0, 100)}${code.length > 100 ? "..." : ""}`
				);
				mp.console.logInfo(`╚═══════════════════`);
			}
			return originalExecute.call(browser, code);
		};
	}

	return browser;
};

// ==================== СУЩНОСТИ (Entities) ====================

// Отслеживание входа/выхода сущностей из стрима
mp.events.add("entityStreamIn", (entity) => {
	if (logEntities && loggingEnabled) {
		mp.console.logInfo(`╔═══ [ENTITY STREAM IN] ═══`);
		mp.console.logInfo(`Type: ${entity.type}`);
		mp.console.logInfo(`ID: ${entity.id}`);
		if (entity.model) mp.console.logInfo(`Model: ${entity.model}`);
		mp.console.logInfo(`╚═══════════════════`);
	}
});

mp.events.add("entityStreamOut", (entity) => {
	if (logEntities && loggingEnabled) {
		mp.console.logInfo(`╔═══ [ENTITY STREAM OUT] ═══`);
		mp.console.logInfo(`Type: ${entity.type}`);
		mp.console.logInfo(`ID: ${entity.id}`);
		mp.console.logInfo(`╚═══════════════════`);
	}
});

// ==================== НАТИВЫ GTA (опционально) ====================

function wrapNatives() {
	if (!mp.game) return;

	const categories = [
		"gameplay",
		"ped",
		"vehicle",
		"object",
		"graphics",
		"ui",
		"weapon",
	];

	categories.forEach((category) => {
		if (!mp.game[category]) return;

		const original = mp.game[category];
		mp.game[category] = new Proxy(original, {
			get(target, prop) {
				const value = target[prop];

				if (typeof value === "function") {
					return function (...args) {
						if (logNatives && loggingEnabled) {
							mp.console.logInfo(
								`[NATIVE] mp.game.${category}.${prop}(${args.length} args)`
							);
						}
						return value.apply(target, args);
					};
				}

				return value;
			},
		});
	});
}

// ==================== УПРАВЛЕНИЕ ====================

// F8 - Главный переключатель
mp.keys.bind(0x77, false, function () {
	loggingEnabled = !loggingEnabled;
	mp.gui.chat.push(
		loggingEnabled ? "!{00FF00}✓ Логи ВКЛ" : "!{FF0000}✗ Логи ВЫКЛ"
	);

	if (loggingEnabled) {
		mp.console.logInfo("=== ЛОГИРОВАНИЕ ВКЛЮЧЕНО ===");
		mp.console.logInfo(
			"4 = клавиши | 5 = локальные | 6 = GUI | 7 = entities | 8 = нативы"
		);
	} else {
		mp.console.logWarning("=== ЛОГИРОВАНИЕ ВЫКЛЮЧЕНО ===");
	}
});

// 4 - Клавиши
mp.keys.bind(0x34, false, function () {
	if (!loggingEnabled) return;
	logKeys = !logKeys;
	mp.gui.chat.push(
		logKeys ? "!{00FF00}✓ Клавиши ВКЛ" : "!{FF0000}✗ Клавиши ВЫКЛ"
	);
	mp.console.logInfo(logKeys ? "✓ Логи клавиш ВКЛ" : "✗ Логи клавиш ВЫКЛ");
});

// 5 - Локальные события
mp.keys.bind(0x35, false, function () {
	if (!loggingEnabled) return;
	logLocalEvents = !logLocalEvents;
	mp.gui.chat.push(
		logLocalEvents ? "!{00FF00}✓ Локальные ВКЛ" : "!{FF0000}✗ Локальные ВЫКЛ"
	);
	mp.console.logInfo(
		logLocalEvents ? "✓ Локальные события ВКЛ" : "✗ Локальные события ВЫКЛ"
	);
});

// 6 - GUI/CEF
mp.keys.bind(0x36, false, function () {
	if (!loggingEnabled) return;
	logGUI = !logGUI;
	mp.gui.chat.push(logGUI ? "!{00FF00}✓ GUI ВКЛ" : "!{FF0000}✗ GUI ВЫКЛ");
	mp.console.logInfo(logGUI ? "✓ GUI логи ВКЛ" : "✗ GUI логи ВЫКЛ");
});

// 7 - Entities
mp.keys.bind(0x37, false, function () {
	if (!loggingEnabled) return;
	logEntities = !logEntities;
	mp.gui.chat.push(
		logEntities ? "!{00FF00}✓ Entities ВКЛ" : "!{FF0000}✗ Entities ВЫКЛ"
	);
	mp.console.logInfo(
		logEntities ? "✓ Entities логи ВКЛ" : "✗ Entities логи ВЫКЛ"
	);
});

// 8 - Нативы (ОСТОРОЖНО: очень много логов!)
mp.keys.bind(0x38, false, function () {
	if (!loggingEnabled) return;
	logNatives = !logNatives;
	mp.gui.chat.push(
		logNatives
			? "!{FF0000}⚠ Нативы ВКЛ (МНОГО ЛОГОВ!)"
			: "!{00FF00}✗ Нативы ВЫКЛ"
	);
	mp.console.logWarning(
		logNatives ? "⚠ НАТИВЫ ВКЛ - БУДЕТ МНОГО ЛОГОВ!" : "✗ Нативы ВЫКЛ"
	);

	if (logNatives) {
		wrapNatives();
	}
});

// Стартовое сообщение
mp.gui.chat.push("!{FFFF00}[FULL LOGGER] Загружен");
mp.gui.chat.push(
	"!{FFFF00}F8=ВКЛ/ВЫКЛ | 4=Keys | 5=Local | 6=GUI | 7=Entities | 8=Natives"
);
mp.console.logInfo("=== FULL EVENT LOGGER ===");
mp.console.logInfo("F8 = главный переключатель");
mp.console.logInfo("4 = клавиши");
mp.console.logInfo("5 = локальные события");
mp.console.logInfo("6 = GUI/CEF события");
mp.console.logInfo("7 = entities (stream in/out)");
mp.console.logInfo("8 = нативы GTA (ОЧЕНЬ много логов!)");
// ============================================================
