let showTrunkStatus = false;
const MAX_DISTANCE = 400;

mp.keys.bind(0x74, false, function () {
	showTrunkStatus = !showTrunkStatus;
	mp.gui.chat.push(showTrunkStatus ? "Скрипт включён!" : "Скрипт отключен.");
});

mp.events.add("render", () => {
	if (!showTrunkStatus) return;
	const playerPos = mp.players.local.position;

	mp.vehicles.forEachInStreamRange((vehicle) => {
		const vehiclePos = vehicle.position;
		if (
			mp.game.system.vdist(
				playerPos.x,
				playerPos.y,
				playerPos.z,
				vehiclePos.x,
				vehiclePos.y,
				vehiclePos.z
			) <= MAX_DISTANCE
		) {
			const trunkOpen = vehicle.getVariable("trunkStatus");
			if (trunkOpen) {
				mp.game.graphics.drawLine(
					playerPos.x,
					playerPos.y,
					playerPos.z,
					vehiclePos.x,
					vehiclePos.y,
					vehiclePos.z + 0.5,
					0,
					0,
					255,
					255
				);
			}
		}
	});
});
