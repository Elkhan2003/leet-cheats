// ============ ОТКРЫТИЕ БАГАЖНИКА ИЗНУТРИ МАШИНЫ ============

// Клавиша B - открыть багажник
mp.keys.bind(0x42, false, function () {
	const player = mp.players.local;

	if (!player.vehicle) {
		mp.gui.chat.push("!{FF0000}Вы должны быть в машине!");
		return;
	}

	const vehicle = player.vehicle;
	const vehicleId = vehicle.remoteId;

	const requestId = Math.random().toString(36).substring(2, 8);

	mp.events.callRemote(
		"__rpc:process",
		JSON.stringify({
			req: 1,
			id: requestId,
			name: "__rpc:triggerEvent",
			env: "client",
			args: [
				"server_vehicle_openBagSave",
				{
					__t: "v",
					i: vehicleId,
				},
			],
			fenv: "cef",
			noRet: 1,
		})
	);

	mp.gui.chat.push(`!{00FF00}Багажник открыт/закрыт (ID: ${vehicleId})`);
});

mp.gui.chat.push("!{00FF00}╔═══════════════════════════╗");
mp.gui.chat.push("!{00FF00}║ Багажник: Клавиша B       ║");
mp.gui.chat.push("!{00FF00}╚═══════════════════════════╝");
