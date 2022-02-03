import {GATHER_API_KEY, GATHER_MAP_ID, GATHER_SPACE_ID} from "./api-key";
import {Game, MapObject, WireObject} from "@gathertown/gather-game-client";
import PF, {DiagonalMovement} from "pathfinding";
import {randomInt} from "crypto";

global.WebSocket = require("isomorphic-ws");


// gather game client setup
const game = new Game(() => Promise.resolve({apiKey: GATHER_API_KEY}));
game.connect(GATHER_SPACE_ID);
game.subscribeToConnection(connected => console.log("connected?", connected));
game.subscribeToEvent("playerMoves", (data, context) => {
    // Blow smoke?
    // console.log(data.playerMoves)
    // data.playerMoves.direction
});
game.subscribeToEvent("mapSetObjects", (data, context) => {
    if (data.mapSetObjects.mapId !== GATHER_MAP_ID) return
    // Ensure this is a create
    // @ts-ignore
    if (data.mapSetObjects.objects.length > 1) return
    for (const dataKey in data.mapSetObjects.objects) {
        const dataObject = data.mapSetObjects.objects[dataKey]
        if (dataObject._name?.startsWith("To-Go Coffee"))
            console.log("Coffee needs ordered!")
    }
})
// game.subscribeToEvent("playerJoins", (data, context) => {
//     setTimeout(async () => {
//         const player = game.getPlayer(context.playerId!)
//         if (player.name.toLowerCase().includes("phillis")) {
//             console.log("Rickroll time!")
//             // game.playSound("https://www.soundjay.com/buttons/beep-10.mp3", 0.1, context.playerId!)
//             // game.playSound("https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=Never+Gonna+Give+You+Up-+Original&filename=mz/Mzg1ODMxNTIzMzg1ODM3_JzthsfvUY24.MP3", 0.3, context.playerId!)
//         } else if (player.name.toLowerCase().includes("michael")) {
//             // game.playSound("https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=Never+Gonna+Give+You+Up-+Original&filename=mz/Mzg1ODMxNTIzMzg1ODM3_JzthsfvUY24.MP3", 0.3, context.playerId!)
//         }
//     }, 5000)
// })

function getRoomba(): { obj: MapObject; key: number } {
    for (const _key in game.partialMaps[GATHER_MAP_ID]?.objects) {
        const key = parseInt(_key)
        const obj = game.partialMaps[GATHER_MAP_ID]?.objects?.[key]
        if (!obj) continue
        if (obj._name! === "Cat Roomba") {
            return {obj, key}
        }
    }
    throw Error
}

function downloadGrid(): PF.Grid {
    const impassable = game.completeMaps[GATHER_MAP_ID]?.collisions!
    let passGrid: number[][] = [];
    for (let row = 0; row < impassable.length; row++) {
        passGrid[row] = []
        for (let col = 0; col < impassable[0].length; col++)
            passGrid[row][col] = Number(impassable[row][col])
    }
    return new PF.Grid(passGrid);
}

class Point {
    x: number = 0
    y: number = 0

    public static fromArray(pt: number[]): Point {
        return {x: pt[0], y: pt[1]}
    }
}

function getTargetPoint(grid: PF.Grid): Point {
    // TODO - Make it pick a person.
    // return {x: 22, y:25}
    let targetX: number = 0
    let targetY: number = 0
    while (true) {
        targetX = randomInt(0, grid.width);
        targetY = randomInt(0, grid.height);
        if (grid.isWalkableAt(targetX, targetY))
            break;
    }
    return {x: targetX, y: targetY};
}

function moveRoomba(target: Point): boolean {
    const {obj: roomba, key} = getRoomba();
    const objectUpdates: { [key: number]: WireObject } = {};

    // Move 1 step
    const speed = 1.0  // pixels per step
    const pixelSize = 32.0
    const dx = target.x - (roomba.x + roomba.offsetX!/pixelSize);
    const dy = target.y - (roomba.y + roomba.offsetY!/pixelSize);

    if (Math.abs(dx) < 1.0/pixelSize && Math.abs(dy) < 1.0/pixelSize)
        return false

    const theta = Math.atan2(dy, dx);
    // Compute speed adjusted step
    const stepX = speed / pixelSize * Math.cos(theta)
    const stepY = speed / pixelSize * Math.sin(theta)
    const newX = Math.abs(roomba.x + roomba.offsetX! / pixelSize + stepX);
    const newY = Math.abs(roomba.y + roomba.offsetY! / pixelSize + stepY);

    const baseX = Math.floor(newX);
    const baseY = Math.floor(newY);
    const fracX = Math.floor(pixelSize*(newX-baseX))
    const fracY = Math.floor(pixelSize*(newY-baseY))
    objectUpdates[key] = {
        x: baseX,
        y: baseY,
        offsetX: fracX,
        offsetY: fracY,
        _tags: []
    }

    console.log(objectUpdates)
    game.engine.sendAction({
        $case: "mapSetObjects",
        mapSetObjects: {mapId: GATHER_MAP_ID, objects: objectUpdates}
    })

    return true
}

function routeRoomba() {
    // Download the grid
    const grid = downloadGrid();
    const {obj: roomba, key} = getRoomba();
    // Get a target point that is passable
    let target = getTargetPoint(grid);
    // Navigate there.
    const finder = new PF.AStarFinder({
        diagonalMovement: DiagonalMovement.Never,
    })
    const path = finder.findPath(roomba.x!, roomba.y!, target.x, target.y, grid);
    console.log(path)

    // Trigger the animation to it
    let pathStep = 1;
    const stepTimer = setInterval(async () => {
        if (!moveRoomba(Point.fromArray(path[pathStep])))
            pathStep++;

        if (pathStep == path.length) {
            clearInterval(stepTimer)
            console.log("Roomba parked")
        }
    }, 100);
}

setTimeout(async () => {
    routeRoomba();
}, 3000)