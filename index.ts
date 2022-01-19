import {GATHER_API_KEY, GATHER_MAP_ID, GATHER_SPACE_ID} from "./api-key";
import {Game, ServerClientEvent} from "@gathertown/gather-game-client";
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
        if (dataObject._name!.startsWith("To-Go Coffee"))
            console.log("Coffee needs ordered!")
    }
})

// check every 5s
setInterval(async () => {
    game.engine.sendAction({
        $case: "setTextStatus",
        setTextStatus: {
            textStatus: "Hello World!"
        }
    })
}, 5000);
