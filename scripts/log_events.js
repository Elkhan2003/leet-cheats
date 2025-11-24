let loggingEnabled = false;

// Функция для красивого форматирования аргументов
function formatArgs(args) {
	if (args.length === 0) return "нет аргументов";

	try {
		// Форматируем JSON с отступами
		return JSON.stringify(args, null, 2);
	} catch (e) {
		// Если JSON.stringify не работает (циклические ссылки и т.д.)
		return args
			.map((arg, index) => {
				if (arg === null) return `[${index}]: null`;
				if (arg === undefined) return `[${index}]: undefined`;
				if (typeof arg === "object") {
					try {
						return `[${index}]: ${JSON.stringify(arg, null, 2)}`;
					} catch {
						return `[${index}]: [Object]`;
					}
				}
				return `[${index}]: ${arg}`;
			})
			.join("\n");
	}
}

// 1. Перехват mp.events.callRemote (Client → Server)
const originalCallRemote = mp.events.callRemote;
mp.events.callRemote = function (eventName, ...args) {
	if (loggingEnabled) {
		mp.gui.chat.push(`!{00FF00}[C→S] ${eventName}`);
		mp.console.logInfo(`╔═══ [C→S] ${eventName} ═══`);
		mp.console.logInfo(`║ Аргументы:`);
		mp.console.logInfo(formatArgs(args));
		mp.console.logInfo(`╚═══════════════════`);
	}
	return originalCallRemote.call(mp.events, eventName, ...args);
};

// 2. Перехват mp.events.callRemoteProc (RPC вызовы)
if (mp.events.callRemoteProc) {
	const originalCallRemoteProc = mp.events.callRemoteProc;
	mp.events.callRemoteProc = function (eventName, ...args) {
		if (loggingEnabled) {
			mp.gui.chat.push(`!{FFFF00}[RPC→S] ${eventName}`);
			mp.console.logInfo(`╔═══ [RPC→S] ${eventName} ═══`);
			mp.console.logInfo(`║ Аргументы:`);
			mp.console.logInfo(formatArgs(args));
			mp.console.logInfo(`╚═══════════════════`);
		}
		return originalCallRemoteProc.call(mp.events, eventName, ...args);
	};
}

// 3. Перехват mp.events.callRemoteUnreliable (ненадежные вызовы)
if (mp.events.callRemoteUnreliable) {
	const originalCallRemoteUnreliable = mp.events.callRemoteUnreliable;
	mp.events.callRemoteUnreliable = function (eventName, ...args) {
		if (loggingEnabled) {
			mp.gui.chat.push(`!{FF9900}[C→S unreliable] ${eventName}`);
			mp.console.logWarning(`╔═══ [C→S unreliable] ${eventName} ═══`);
			mp.console.logWarning(`║ Аргументы:`);
			mp.console.logWarning(formatArgs(args));
			mp.console.logWarning(`╚═══════════════════`);
		}
		return originalCallRemoteUnreliable.call(mp.events, eventName, ...args);
	};
}

// 4. Перехват входящих событий (Server → Client)
const originalEventsAdd = mp.events.add;
mp.events.add = function (eventName, callback) {
	const wrappedCallback = function (...args) {
		if (loggingEnabled) {
			mp.gui.chat.push(`!{00FFFF}[S→C] ${eventName}`);
			mp.console.logInfo(`╔═══ [S→C] ${eventName} ═══`);
			mp.console.logInfo(`║ Аргументы:`);
			mp.console.logInfo(formatArgs(args));
			mp.console.logInfo(`╚═══════════════════`);
		}
		return callback.apply(this, args);
	};
	return originalEventsAdd.call(mp.events, eventName, wrappedCallback);
};

// 5. Переключатель F8
mp.keys.bind(0x77, false, function () {
	loggingEnabled = !loggingEnabled;
	mp.gui.chat.push(
		loggingEnabled ? "!{00FF00}✓ Логи ВКЛ" : "!{FF0000}✗ Логи ВЫКЛ"
	);

	if (loggingEnabled) {
		mp.console.logInfo("✓ Логирование ВКЛЮЧЕНО");
	} else {
		mp.console.logWarning("✗ Логирование ВЫКЛЮЧЕНО");
	}
});

mp.gui.chat.push("!{FFFF00}[Logger] Загружен. F8 = вкл/выкл");
mp.console.logInfo("=== Event Logger загружен. F8 для переключения ===");
