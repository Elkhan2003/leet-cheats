const WEAPON_HASHES = [
    { objectHash: 619715967 },
    { objectHash: 3548001216 },
    { objectHash: 3942415509 },
    { objectHash: 1111175276 },
    { objectHash: 2937268560 },
    { objectHash: 2125691888 },
    { objectHash: 2288151111 },
    { objectHash: 1270762638 },
    { objectHash: 583786626 },
];

const OBJECT_HASHES = WEAPON_HASHES.map(w => w.objectHash);
const WEAPON_MAP = new Map(WEAPON_HASHES.filter(w => w.weaponHash).map(w => [w.objectHash, w.weaponHash]));
const SEARCH_RADIUS = 5000; // Увеличен для максимального поиска
const EMIT_OPEN = 3352416830;
const EMIT_LOOT = 1821395888;
const MAX_FAILED_ATTEMPTS = 5;
const TELEPORT_Z_OFFSET = -1.2;

const CONFIG = {
    HUD_VISIBLE_BY_DEFAULT: true,
    MAIN_LOOP: 5, // Уменьшен для максимальной скорости
    WAIT_AFTER_TP: 25, // Уменьшен для быстрого телепорта
    WAIT_AFTER_OPEN: 25, // Уменьшен для быстрого открытия
    WAIT_AFTER_LOOT: 25, // Уменьшен для быстрого лута
    WAIT_BEFORE_CLOSE: 25, // Уменьшен для быстрого закрытия
    FORCE_RETURN_DELAY: 1500, // Уменьшен для быстрого возврата
    SPOOF_RESET_INTERVAL: 1500, // Уменьшен для быстрого сброса
    DEBUG_MODE: false,
};



const state = {
    readingEnabled: true,
    isActive: true,
    isFullyStopped: false,
    objectsFound: 0,
    itemsLooted: 0,
    lastFoundObjectHandle: 0,
    lastProcessedHash: 0,
    currentHashIndex: 0,
    originalPlayerPos: null,
    isLooting: false,
    shouldReturn: false,
    hudVisible: CONFIG.HUD_VISIBLE_BY_DEFAULT,
    failedObjects: new Map(),
    blacklistedCoords: new Set(),
};

const timers = {
    forceReturn: null,
    spoofReset: null,
};

const statusWebView = new alt.WebView(
    'data:text/html;charset=utf-8,' + encodeURIComponent(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>AutoLoot Status</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: transparent;
            font-family: 'Segoe UI', Arial, sans-serif;
        }
        
        #status-container {
            position: fixed;
            bottom: 300px;
            left: 20px;
            width: 250px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(80, 120, 220, 0.8);
            overflow: hidden;
            z-index: 9999;
            border: 2px solid rgba(100, 140, 240, 0.6);
        }
        
        .header {
            background: linear-gradient(90deg, 
                rgba(30, 50, 120, 0.8) 0%, 
                rgba(70, 120, 200, 0.8) 100%);
            color: #ffffff;
            padding: 10px 15px;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .header-icon {
            font-size: 16px;
            color: #a0cfff;
        }
        
        .content {
            padding: 12px 15px;
            color: #e0e8ff;
            font-size: 14px;
        }
        
        .status-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            align-items: center;
        }
        
        .status-label {
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .status-icon {
            color: #5f9eff;
            width: 18px;
            text-align: center;
        }
        
        .status-value {
            color: #a0cfff;
            font-weight: bold;
        }
        
        .active {
            color: #4cff4c;
            text-shadow: 0 0 8px rgba(76, 255, 76, 0.7);
        }
        
        .inactive {
            color: #ff4c4c;
            text-shadow: 0 0 8px rgba(255, 76, 76, 0.7);
        }
        
        .pulse {
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .hidden {
            display: none;
        }

        .debug-info {
            padding: 8px 15px;
            background: rgba(40, 40, 40, 0.9);
            color: #ffffff;
            font-size: 11px;
            border-top: 1px solid rgba(100, 140, 240, 0.3);
        }
    </style>
</head>
<body>
    <div id="status-container" ${!CONFIG.HUD_VISIBLE_BY_DEFAULT ? 'class="hidden"' : ''}>
        <div class="header">
            <i class="fas fa-robot header-icon pulse"></i>
            АВТОЛУТ
            <i class="fas fa-robot header-icon pulse"></i>
        </div>
        <div class="content">
            <div class="status-row">
                <span class="status-label">
                    <i class="fas fa-power-off status-icon"></i>
                    Статус:
                </span>
                <span id="status-badge" class="status-value active">АКТИВЕН</span>
            </div>
            <div class="status-row">
                <span class="status-label">
                    <i class="fas fa-hand-holding status-icon"></i>
                    Подобрано:
                </span>
                <span id="items-looted" class="status-value">0</span>
            </div>
        </div>
        <div id="debug-info" class="debug-info" style="display: none;">
            <div>DEBUG: Не активен</div>
        </div>
    </div>

    <script>
        function updateStatus(status) {
            const element = document.getElementById('status-badge');
            if (!element) return;
            
            element.textContent = status ? 'АКТИВЕН' : 'НЕАКТИВЕН';
            if (status) {
                element.classList.remove('inactive');
                element.classList.add('active');
            } else {
                element.classList.remove('active');
                element.classList.add('inactive');
            }
        }

        function animateNumber(elementId, target) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const start = parseInt(element.textContent) || 0;
            const diff = target - start;
            
            if (diff === 0) return;

            const startTime = Date.now();
            const duration = Math.min(500, Math.abs(diff) * 50);

            const update = () => {
                const progress = (Date.now() - startTime) / duration;
                if (progress < 1) {
                    const value = start + diff * progress;
                    element.textContent = Math.round(value);
                    requestAnimationFrame(update);
                } else {
                    element.textContent = target;
                }
            };

            update();
        }

        function updateDebugInfo(debugText) {
            const element = document.getElementById('debug-info');
            if (element) {
                element.innerHTML = '<div>DEBUG: ' + debugText + '</div>';
            }
        }

        function toggleDebugVisibility(show) {
            const element = document.getElementById('debug-info');
            if (element) {
                element.style.display = show ? 'block' : 'none';
            }
        }

        if (typeof alt !== 'undefined') {
            alt.on('autoLoot:Update', (status, objects, items) => {
                updateStatus(status);
                animateNumber('items-looted', items);
            });
            
            alt.on('autoLoot:Debug', (debugText) => {
                updateDebugInfo(debugText);
            });
            
            alt.on('autoLoot:ToggleDebug', (show) => {
                toggleDebugVisibility(show);
            });
            
            alt.on('autoLoot:HideHUD', () => {
                const container = document.getElementById('status-container');
                if (container) container.classList.add('hidden');
            });
            
            alt.on('autoLoot:ShowHUD', () => {
                const container = document.getElementById('status-container');
                if (container) container.classList.remove('hidden');
            });
        }
    </script>
</body>
</html>
    `)
);

function debugLog(message) {
    if (CONFIG.DEBUG_MODE) {
        alt.log(`[Автолут ОТЛАДКА] ${message}`);
        if (statusWebView?.valid) {
            try {
                statusWebView.emit('autoLoot:Debug', message);
            } catch (error) {}
        }
    }
}

function updateStatusUI() {
    if (statusWebView?.valid) {
        try {
            statusWebView.emit('autoLoot:Update', state.isActive, state.objectsFound, state.itemsLooted);
        } catch (error) {
        }
    }
}

function destroyStatusWebView() {
    try {
        if (statusWebView && statusWebView.valid) {
            statusWebView.destroy();
        }
    } catch (error) {
    }
}

function toggleHudVisibility() {
    if (statusWebView?.valid) {
        try {
            state.hudVisible = !state.hudVisible;
            statusWebView.emit(state.hudVisible ? 'autoLoot:ShowHUD' : 'autoLoot:HideHUD');
            alt.emit('api.longNotify', `HUD ${state.hudVisible ? "показан" : "скрыт"}`, 1);
        } catch (error) {
        }
    }
}

function clearTimer(timerName) {
    if (timers[timerName]) {
        try {
            alt.clearTimeout(timers[timerName]);
        } catch (error) {
        }
        timers[timerName] = null;
    }
}

function clearAllTimers() {
    Object.keys(timers).forEach(clearTimer);
}

function startSpoofResetTimer() {
    clearTimer('spoofReset');
    timers.spoofReset = alt.setTimeout(() => {
        try {
            alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, false);
        } catch (error) {
        }
    }, CONFIG.SPOOF_RESET_INTERVAL);
}

function setForceReturnTimer() {
    clearTimer('forceReturn');
    timers.forceReturn = alt.setTimeout(() => {
        if (state.isLooting && state.shouldReturn && state.originalPlayerPos) {
            returnToOriginalPosition();
            resetLootingState();
            alt.emit('api.longNotify', 'Принудительное возвращение', 1);
        }
    }, CONFIG.FORCE_RETURN_DELAY);
}

function resetLootingState() {
    state.isLooting = false;
    state.lastFoundObjectHandle = 0;
    state.shouldReturn = false;
    clearAllTimers();
}

function returnToOriginalPosition() {
    if (!state.shouldReturn || !state.originalPlayerPos) return;
    
    try {
        const localPlayer = alt.Player.local;
        alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, false);
        
        const currentPos = native.getEntityCoords(localPlayer.scriptID, false);
        const distance = native.getDistanceBetweenCoords(
            currentPos.x, currentPos.y, currentPos.z,
            state.originalPlayerPos.x, state.originalPlayerPos.y, state.originalPlayerPos.z,
            true
        );
        
        if (distance > 5.0) {
            alt.setTimeout(() => {
                alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, false);
            }, 100);
        }
        
        state.shouldReturn = false;
    } catch (error) {
    } finally {
        clearAllTimers();
    }
}

function addToBlacklist(objPos) {
    const coordKey = `${Math.round(objPos.x)}_${Math.round(objPos.y)}_${Math.round(objPos.z)}`;
    state.blacklistedCoords.add(coordKey);
    updateStatusUI();
    alt.emit('api.longNotify', `Объект добавлен в блеклист (${state.blacklistedCoords.size})`, 1);
}

function isBlacklisted(objPos) {
    const coordKey = `${Math.round(objPos.x)}_${Math.round(objPos.y)}_${Math.round(objPos.z)}`;
    return state.blacklistedCoords.has(coordKey);
}

function trackFailedObject(objHandle, objPos) {
    const coordKey = `${Math.round(objPos.x)}_${Math.round(objPos.y)}_${Math.round(objPos.z)}`;
    
    if (!state.failedObjects.has(coordKey)) {
        state.failedObjects.set(coordKey, 0);
    }
    
    const failCount = state.failedObjects.get(coordKey) + 1;
    state.failedObjects.set(coordKey, failCount);
    
    if (failCount >= MAX_FAILED_ATTEMPTS) {
        addToBlacklist(objPos);
        state.failedObjects.delete(coordKey);
        return true;
    }
    
    return false;
}

async function isPlayerHoldingTargetWeapon(player) {
    try {
        debugLog(`=== Checking player ${player.id} ===`);
        
        const [hasWeapon, weaponHash] = native.getCurrentPedWeapon(player.scriptID, true);
        debugLog(`getCurrentPedWeapon: hasWeapon=${hasWeapon}, weaponHash=${weaponHash}`);
        
        if (!hasWeapon || weaponHash === 0) {
            debugLog(`Player ${player.id}: no weapon or hash is 0`);
            return false;
        }
        
        const unarmedHash = native.getHashKey("WEAPON_UNARMED");
        debugLog(`WEAPON_UNARMED hash: ${unarmedHash}`);
        
        if (weaponHash === unarmedHash) {
            debugLog(`Player ${player.id}: has unarmed weapon`);
            return false;
        }
        
        debugLog(`Target hashes: ${JSON.stringify(OBJECT_HASHES)}`);
        
        const hasTargetWeaponByHash = OBJECT_HASHES.includes(weaponHash);
        debugLog(`Weapon hash match: ${hasTargetWeaponByHash}`);
        
        if (hasTargetWeaponByHash) {
            debugLog(`Player ${player.id}: BLOCKED by weapon hash`);
            return true;
        }
        
        debugLog(`Player ${player.id}: NOT BLOCKED`);
        return false;
    } catch (error) {
        debugLog(`Error checking player ${player.id} weapon: ${error.message}`);
        return false;
    }
}

async function checkAnyPlayerHasSpecificWeaponNearby(objPos, targetObjectHash) {
    try {
        const targetWeaponHash = WEAPON_MAP.get(targetObjectHash);
        
        if (!targetWeaponHash) {
            if (CONFIG.DEBUG_MODE) {
                debugLog(`Объект ${targetObjectHash} является статическим - НЕ БЛОКИРУЕМ`);
            }
            return false;
        }
        
        for (const player of alt.Player.all) {
            if (!player?.valid) continue;
            
            const distance = native.getDistanceBetweenCoords(
                objPos.x, objPos.y, objPos.z,
                player.pos.x, player.pos.y, player.pos.z,
                true
            );
            
            if (distance <= 5.0) {
                const [hasWeapon, weaponHash] = native.getCurrentPedWeapon(player.scriptID, true);
                if (CONFIG.DEBUG_MODE) {
                    debugLog(`Игрок ${player.id} на расстоянии ${distance.toFixed(2)}м: естьОружие=${hasWeapon}, хешОружия=${weaponHash}, целевоеОружие=${targetWeaponHash}`);
                }
                
                if (hasWeapon && weaponHash === targetWeaponHash) {
                    if (CONFIG.DEBUG_MODE) {
                        debugLog(`Игрок ${player.id} держит соответствующее оружие - ЗАБЛОКИРОВАНО`);
                    }
                    return true;
                }
            }
        }
        
        return false;
    } catch (error) {
        if (CONFIG.DEBUG_MODE) {
            debugLog(`Ошибка проверки игроков: ${error.message}`);
        }
        return false;
    }
}

async function isHashBoundToPlayer(objHandle, targetObjectHash) {
    if (!objHandle || objHandle === 0) return false;
    
    try {
        const objPos = native.getEntityCoords(objHandle, false);
        return await checkAnyPlayerHasSpecificWeaponNearby(objPos, targetObjectHash);
    } catch (error) {
        return false;
    }
}

async function teleportAndOpenInventory() {
    if (!state.readingEnabled || !state.isActive || state.isFullyStopped || state.isLooting) {
        debugLog(`Skipping teleport: readingEnabled=${state.readingEnabled}, isActive=${state.isActive}, isFullyStopped=${state.isFullyStopped}, isLooting=${state.isLooting}`);
        return false;
    }
    
    try {
        const localPlayer = alt.Player.local;
        const hashToCheck = OBJECT_HASHES[state.currentHashIndex];

        debugLog(`Ищем объект с хешем: ${hashToCheck} (индекс: ${state.currentHashIndex})`);

        // Проверяем, сколько игроков держат оружие из списка
        let playersWithWeapons = 0;
        for (const player of alt.Player.all) {
            if (!player?.valid) continue;
            
            const distance = native.getDistanceBetweenCoords(
                localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z,
                player.pos.x, player.pos.y, player.pos.z,
                true
            );
            
            if (distance <= 300.0) {
                const isHoldingWeapon = await isPlayerHoldingTargetWeapon(player);
                if (isHoldingWeapon) {
                    playersWithWeapons++;
                    debugLog(`Игрок ${player.id} держит оружие из списка (всего: ${playersWithWeapons})`);
                }
            }
        }
        
        // Если больше одного игрока держит оружие, пропускаем объект
        if (playersWithWeapons > 1) {
            debugLog(`${playersWithWeapons} игроков держат оружие из списка - пропускаем объект ${hashToCheck}`);
            return { success: false };
        }

        state.originalPlayerPos = {
            x: localPlayer.pos.x,
            y: localPlayer.pos.y,
            z: localPlayer.pos.z - 1
        };
        
        const objHandle = native.getClosestObjectOfType(
            localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z,
            SEARCH_RADIUS, hashToCheck, false, false, false
        );

        state.currentHashIndex = (state.currentHashIndex + 1) % OBJECT_HASHES.length;
        
        if (objHandle !== 0) {
            const objPos = native.getEntityCoords(objHandle, false);
            const distance = native.getDistanceBetweenCoords(
                localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z,
                objPos.x, objPos.y, objPos.z,
                true
            );
            
            debugLog(`Найден объект на расстоянии: ${distance.toFixed(2)}`);
            
            if (isBlacklisted(objPos)) {
                debugLog('Объект в черном списке');
                return false;
            }
            
            if (await isHashBoundToPlayer(objHandle, hashToCheck)) {
                debugLog('Объект заблокирован игроком, пропускаем');
                return false;
            }
            
            debugLog('Объект свободен, начинаем процесс лута');
            state.isLooting = true;
            state.shouldReturn = true;
            state.objectsFound++;
            updateStatusUI();
            state.lastProcessedHash = hashToCheck;
            
            setForceReturnTimer();
            
            const teleportPos = { 
                x: objPos.x, 
                y: objPos.y, 
                z: objPos.z + TELEPORT_Z_OFFSET 
            };
            
            debugLog(`Телепортируемся в: ${teleportPos.x}, ${teleportPos.y}, ${teleportPos.z}`);
            
            alt.emitServer(EVENT_PLAYER_POS_SPOOF_POS, teleportPos.x, teleportPos.y, teleportPos.z);
            alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, true);
        
            await alt.Utils.wait(CONFIG.WAIT_AFTER_TP);
            
            if (await isHashBoundToPlayer(objHandle, hashToCheck)) {
                debugLog('Объект стал недоступен после телепорта, возвращаемся');
                await alt.Utils.wait(CONFIG.WAIT_AFTER_TP);
                returnToOriginalPosition();
                resetLootingState();
                return false;
            }
            
            state.lastFoundObjectHandle = objHandle;
            debugLog('Открываем инвентарь...');
            alt.emitServer(EMIT_OPEN, null, null);
            await alt.Utils.wait(CONFIG.WAIT_AFTER_OPEN);
            
            return { success: true, originalPos: state.originalPlayerPos };
        } else {
            debugLog('Объекты не найдены');
        }
        
        return { success: false };
    } catch (error) {
        debugLog(`Error in teleportAndOpenInventory: ${error.message}`);
        if (state.shouldReturn) {
            returnToOriginalPosition();
        }
        resetLootingState();
        return { success: false };
    }
}

async function processLootData(data) {
    if (!state.readingEnabled || !state.isActive || state.isFullyStopped || state.lastFoundObjectHandle === 0) {
        if (state.shouldReturn) {
            returnToOriginalPosition();
        }
        resetLootingState();
        return;
    }
    
    try {
        // Проверяем, сколько игроков держат оружие из списка во время лута
        const localPlayer = alt.Player.local;
        let playersWithWeapons = 0;
        for (const player of alt.Player.all) {
            if (!player?.valid) continue;
            
            const distance = native.getDistanceBetweenCoords(
                localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z,
                player.pos.x, player.pos.y, player.pos.z,
                true
            );
            
            if (distance <= 300.0) {
                const isHoldingWeapon = await isPlayerHoldingTargetWeapon(player);
                if (isHoldingWeapon) {
                    playersWithWeapons++;
                    debugLog(`Игрок ${player.id} держит оружие из списка во время лута (всего: ${playersWithWeapons})`);
                }
            }
        }
        
        // Если больше одного игрока держит оружие, закрываем инвентарь
        if (playersWithWeapons > 1) {
            debugLog(`${playersWithWeapons} игроков держат оружие из списка во время лута - закрываем инвентарь`);
            alt.emit('inventoryApi.close');
            if (state.shouldReturn) {
                returnToOriginalPosition();
            }
            resetLootingState();
            return;
        }
        
        if (Array.isArray(data?.[0]?.[2]) && data[0][2].length > 0) {
            const firstItem = data[0][2][0];
            
            if (Array.isArray(firstItem) && firstItem.length > 5) {
                const [itemId, , , , , itemUid] = firstItem;
                
                const objHandle = native.getClosestObjectOfType(
                    localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z,
                    SEARCH_RADIUS, state.lastProcessedHash, false, false, false
                );
                
                await alt.Utils.wait(CONFIG.WAIT_AFTER_TP);
                
                if (objHandle !== 0 && await isHashBoundToPlayer(objHandle, state.lastProcessedHash)) {
                    alt.emit('inventoryApi.close');
                    if (state.shouldReturn) {
                        returnToOriginalPosition();
                    }
                    resetLootingState();
                    return;
                }
                
                alt.emitServer(EMIT_LOOT, 7, itemUid, itemId, -1, 1, null, -1, null);
                state.itemsLooted++;
                updateStatusUI();
                
                await alt.Utils.wait(CONFIG.WAIT_AFTER_LOOT);
                alt.emit('inventoryApi.close');
                state.lastFoundObjectHandle = 0;
                await alt.Utils.wait(CONFIG.WAIT_BEFORE_CLOSE);
            } else {
                alt.emit('inventoryApi.close');
            }
        } else {
            alt.emit('inventoryApi.close');
        }
    } catch (error) {
        alt.emit('inventoryApi.close');
    } finally {
        if (state.shouldReturn) {
            returnToOriginalPosition();
        }
        resetLootingState();
    }
}

function handleEmptyInventory() {
    if (state.isActive && state.shouldReturn && state.originalPlayerPos) {
        returnToOriginalPosition();
    }
    resetLootingState();
}

async function spoofDisabler() {
    while (!state.isFullyStopped) {
        try {
            alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, false);
        } catch (error) {
        }
        await alt.Utils.wait(5000);
    }
}

async function loopSpoofing() {
    if (CONFIG.DEBUG_MODE) {
        debugLog('Запуск основного цикла');
    }
    updateStatusUI();
    spoofDisabler();
    
    while (true) {
        if (state.readingEnabled && state.isActive && !state.isFullyStopped && !state.isLooting) {
            if (CONFIG.DEBUG_MODE) {
                debugLog('Итерация основного цикла - пытаемся найти объекты');
            }
            const result = await teleportAndOpenInventory();
            
            if (result?.success) {
                if (CONFIG.DEBUG_MODE) {
                    debugLog('Успешно найден и обработан объект');
                }
                await alt.Utils.wait(CONFIG.WAIT_AFTER_LOOT * 3);
            } else {
                await alt.Utils.wait(CONFIG.MAIN_LOOP);
            }
        } else {
            await alt.Utils.wait(CONFIG.MAIN_LOOP);
        }
    }
}

alt.onServer('inventoryApi.inventoryDataResult', async (data) => {
    if (CONFIG.DEBUG_MODE) {
        debugLog(`Получены данные инвентаря: ${JSON.stringify(data)}`);
    }
    const isEmpty = !Array.isArray(data?.[0]?.[2]) || data[0][2].length === 0;
    
    if (CONFIG.DEBUG_MODE) {
        debugLog(`Инвентарь пуст: ${isEmpty}`);
    }
    
    if (isEmpty) {
        if (CONFIG.DEBUG_MODE) {
            debugLog('Обработка пустого инвентаря');
        }
        handleEmptyInventory();
    } else {
        if (CONFIG.DEBUG_MODE) {
            debugLog('Обработка данных лута');
        }
        await processLootData(data);
    }
});

alt.on('keydown', (key) => {
    if (key === 116 && !state.isFullyStopped) {
        state.isActive = !state.isActive;
        updateStatusUI();
        alt.emit('api.longNotify', `Автолут ${state.isActive ? "включен" : "выключен"}`, 1);
        
        if (!state.isActive) {
            state.shouldReturn = false;
            clearAllTimers();
            try {
                alt.emitServer(EVENT_PLAYER_POS_SPOOF_ENABLE, false);
            } catch (error) {
            }
        }
    }
});

alt.on('consoleCommand', (command) => {
    if (command === 'stop' && !state.isFullyStopped) {
        Object.assign(state, {
            readingEnabled: false,
            isActive: false,
            isFullyStopped: true,
            shouldReturn: false,
        });
        
        clearAllTimers();
        destroyStatusWebView();
        alt.emit('api.longNotify', 'Автолут полностью отключен', 1);
    }
    
    if (command === 'togglehud' && !state.isFullyStopped) {
        toggleHudVisibility();
    }
    
    if (command === 'clearblacklist' && !state.isFullyStopped) {
        state.blacklistedCoords.clear();
        state.failedObjects.clear();
        updateStatusUI();
        alt.emit('api.longNotify', 'Блеклист очищен', 1);
    }
    
    if (command === 'toggledebug' && !state.isFullyStopped) {
        CONFIG.DEBUG_MODE = !CONFIG.DEBUG_MODE;
        alt.emit('api.longNotify', `DEBUG режим ${CONFIG.DEBUG_MODE ? "включен" : "выключен"}`, 1);
        
        if (statusWebView?.valid) {
            try {
                statusWebView.emit('autoLoot:ToggleDebug', CONFIG.DEBUG_MODE);
            } catch (error) {}
        }
        
        if (CONFIG.DEBUG_MODE) {
            debugLog(`Debug mode enabled`);
        }
    }
    

});

loopSpoofing();