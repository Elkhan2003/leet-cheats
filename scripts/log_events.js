// ============ ПОЛНЫЙ LOGGER - СТАВЬ В НАЧАЛО index.js ============
let loggingEnabled = false;

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

// 3. Server → Client
const originalEventsAdd = mp.events.add;
mp.events.add = function (eventName, callback) {
	const wrappedCallback = function (...args) {
		logEvent("S→C", "00FFFF", eventName, args);
		return callback.apply(this, args);
	};
	return originalEventsAdd.call(mp.events, eventName, wrappedCallback);
};

// ==================== УПРАВЛЕНИЕ ====================

// F8 - Главный переключатель
mp.keys.bind(0x77, false, function () {
	loggingEnabled = !loggingEnabled;

	if (loggingEnabled) {
		mp.gui.chat.push("!{00FF00}╔═══════════════════════════╗");
		mp.gui.chat.push("!{00FF00}║ ✓ ЛОГИРОВАНИЕ ВКЛЮЧЕНО   ║");
		mp.gui.chat.push("!{00FF00}║ F8 - выключить            ║");
		mp.gui.chat.push("!{00FF00}╚═══════════════════════════╝");
		mp.console.logInfo("=== ЛОГИРОВАНИЕ ВКЛЮЧЕНО ===");
	} else {
		mp.gui.chat.push("!{FF0000}╔═══════════════════════════╗");
		mp.gui.chat.push("!{FF0000}║ ✗ ЛОГИРОВАНИЕ ВЫКЛЮЧЕНО  ║");
		mp.gui.chat.push("!{FF0000}║ F8 - включить             ║");
		mp.gui.chat.push("!{FF0000}╚═══════════════════════════╝");
		mp.console.logWarning("=== ЛОГИРОВАНИЕ ВЫКЛЮЧЕНО ===");
	}
});

// Стартовое сообщение
mp.gui.chat.push("!{FFFF00}╔═══════════════════════════╗");
mp.gui.chat.push("!{FFFF00}║ [FULL LOGGER] Загружен    ║");
mp.gui.chat.push("!{FFFF00}║ F8 = Вкл/Выкл логов       ║");
mp.gui.chat.push("!{FFFF00}╚═══════════════════════════╝");
mp.console.logInfo("╔═══════════════════════════╗");
mp.console.logInfo("║ FULL LOGGER ИНИЦИАЛИЗИРОВАН");
mp.console.logInfo("║ F8 = главный переключатель");
mp.console.logInfo("╚═══════════════════════════╝");
