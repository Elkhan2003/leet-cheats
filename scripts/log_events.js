let loggingEnabled = false;

// 1. Перехват mp.events.callRemote (Client → Server)
const originalCallRemote = mp.events.callRemote;
mp.events.callRemote = function (eventName, ...args) {
	if (loggingEnabled) {
		const argsStr = args.length > 0 ? JSON.stringify(args) : "[]";
		mp.gui.chat.push(`!{00FF00}[C→S] ${eventName} | Args: ${argsStr}`);
		mp.console.logInfo(`[C→S] ${eventName} | Args: ${argsStr}`);
	}
	return originalCallRemote.call(mp.events, eventName, ...args);
};

// 2. Перехват входящих событий (Server → Client)
const originalEventsAdd = mp.events.add;
mp.events.add = function (eventName, callback) {
	const wrappedCallback = function (...args) {
		if (loggingEnabled) {
			const argsStr = args.length > 0 ? JSON.stringify(args) : "[]";
			mp.gui.chat.push(`!{00FFFF}[S→C] ${eventName} | Args: ${argsStr}`);
			mp.console.logInfo(`[S→C] ${eventName} | Args: ${argsStr}`);
		}
		return callback.apply(this, args);
	};
	return originalEventsAdd.call(mp.events, eventName, wrappedCallback);
};

// 3. Переключатель F8
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
